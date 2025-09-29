
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { type User } from "@/schemas/user-schema";
import { type Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft, User as UserIcon, Calendar, GraduationCap, Inbox, CheckCircle, XCircle, ShieldCheck, CalendarX, CalendarClock, CalendarCheck2, PlusCircle, Info, CalendarDays, Edit, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNowStrict, differenceInDays, startOfDay, eachDayOfInterval } from "date-fns";
import { type StoredUserQuizAttempt, type StoredCourse } from "@/schemas/course-schema";
import { type StoredUserDocument, type UserDocumentStatus as CalculatedDocStatus, getDocumentStatus } from "@/schemas/user-document-schema";
import { cn } from "@/lib/utils";
import { type UserActivity } from "@/schemas/user-activity-schema";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manualActivityFormSchema, manualActivityTypes, type ManualActivityFormValues } from "@/schemas/manual-activity-schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { logAuditEvent } from "@/lib/audit-logger";
import { type Airport } from "@/services/airport-service";
import type { StoredUserRequest } from "@/schemas/request-schema";
import { Suspense } from "react";
import { type ProfileData, getUserProfileData } from "@/services/user-profile-service";
import { db } from "@/lib/firebase";
import { writeBatch, doc, collection } from "firebase/firestore";

const DynamicMap = dynamic(() => import('@/components/features/live-map').then(mod => mod.MapDisplay), {
    ssr: false,
    loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>,
});


const statusConfig: Record<CalculatedDocStatus, { icon: React.ElementType, color: string, label: string }> = {
    expired: { icon: CalendarX, color: "text-destructive", label: "Expired" },
    'expiring-soon': { icon: CalendarClock, color: "text-yellow-600", label: "Expiring Soon" },
    approved: { icon: CalendarCheck2, color: "text-green-600", label: "Approved" },
    'pending-validation': { icon: CalendarClock, color: "text-blue-600", label: "Pending Validation"},
};

const getFlagEmoji = (countryCode: string | undefined) => {
    if (!countryCode || countryCode.length !== 2) return '';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};


const AddManualActivityDialog = ({ userId, onActivityAdded, adminUser }: { userId: string, onActivityAdded: () => void, adminUser: User | null }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    const form = useForm<ManualActivityFormValues>({
        resolver: zodResolver(manualActivityFormSchema),
        defaultValues: {
            activityType: "Day Off",
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            comments: ""
        },
    });

    const onSubmit = async (data: ManualActivityFormValues) => {
        if (!adminUser) {
            toast({ title: "Unauthorized", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const interval = eachDayOfInterval({ 
                start: new Date(data.startDate), 
                end: new Date(data.endDate) 
            });

            const activityTypeMapping = {
                "Standby": "standby", "Day Off": "day-off", "Sick Leave": "leave",
                "Emergency Leave": "leave", "Annual Leave": "leave",
            } as const;
            const dbActivityType = activityTypeMapping[data.activityType];
            const comments = data.comments ? `${data.activityType}: ${data.comments}` : data.activityType;

            interval.forEach(day => {
                const activityRef = doc(collection(db, "userActivities"));
                batch.set(activityRef, {
                    userId,
                    activityType: dbActivityType,
                    date: Timestamp.fromDate(startOfDay(day)),
                    comments,
                });
            });

            await batch.commit();
            await logAuditEvent({ userId: adminUser.uid, userEmail: adminUser.email || "N/A", actionType: 'CREATE_MANUAL_ACTIVITY', entityType: "USER_ACTIVITY", entityId: userId, details: { type: data.activityType, dates: `${data.startDate} to ${data.endDate}` } });
            toast({ title: "Activity Added", description: `The new activity has been added to the user's schedule.` });
            onActivityAdded();
            setIsOpen(false);
        } catch (error) {
            const e = error as Error;
            toast({ title: "Error", description: e.message || "Could not add activity.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4"/>Add Manual Activity</Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Manual Schedule Activity</DialogTitle>
                <DialogDescription>Add a non-flight activity like leave or standby to this user's schedule.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="activityType" render={({ field }) => (
                        <FormItem><FormLabel>Activity Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{manualActivityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="startDate" render={({ field }) => <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>} />
                        <FormField control={form.control} name="endDate" render={({ field }) => <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>} />
                    </div>
                    <FormField control={form.control} name="comments" render={({ field }) => <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="Add any relevant details..."/></FormControl><FormMessage /></FormItem>} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Add to Schedule</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    );
}

interface UserDetailClientProps {
    initialProfileData: ProfileData;
}

// --- Page Component ---
export function UserDetailClient({ initialProfileData }: UserDetailClientProps) {
    const { user: adminUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [profileData, setProfileData] = React.useState<ProfileData>(initialProfileData);
    const [isLoading, setIsLoading] = React.useState(false); // For refresh only
    const [error, setError] = React.useState<string | null>(null);

    const fetchUserProfileData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const freshData = await getUserProfileData(profileData.user.uid);
            if (freshData) {
                setProfileData(freshData);
                toast({ title: "Profile Refreshed", description: "The user's data has been updated." });
            } else {
                throw new Error("Failed to refresh user profile data.");
            }
        } catch (err) {
            const e = err as Error;
            setError(e.message || "Failed to load user profile.");
            toast({ title: "Loading Error", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [profileData.user.uid, toast]);
    
    const formatDateDisplay = (dateValue?: string | null | Timestamp) => {
        if (!dateValue) return "N/A";
        let dateObj: Date;
        if (dateValue instanceof Timestamp) {
            dateObj = dateValue.toDate();
        } else {
            try {
                dateObj = new Date(dateValue);
                 if (isNaN(dateObj.getTime())) return "Invalid Date";
            } catch(e) {
                 return String(dateValue);
            }
        }
        return format(dateObj, "PPP");
    };

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (error) {
        return <div className="text-center py-10"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><p className="mt-4 text-lg">{error}</p><Button onClick={() => router.push('/admin/users')} className="mt-4">Back to Users</Button></div>;
    }
    
    if (!profileData) return null;

    const { user, activities, trainings, requests, documents, baseAirport } = profileData;
    const flagEmoji = getFlagEmoji(baseAirport?.countryCode);
    const avatarFallback = user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : user?.email?.substring(0,2).toUpperCase() || 'U';

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
             <Button variant="outline" onClick={() => router.push('/admin/users')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to User List</Button>
            
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-col md:flex-row items-start md:items-center gap-4">
                            <Avatar className="h-20 w-20 border">
                                <AvatarImage src={user.photoURL ?? undefined} data-ai-hint="user portrait" />
                                <AvatarFallback className="text-2xl">{avatarFallback}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <CardTitle className="text-3xl font-headline flex items-center gap-2">{user.fullName || user.displayName} {flagEmoji}</CardTitle>
                                <CardDescription>{user.email}</CardDescription>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <Badge variant="outline" className="capitalize">{user.role || "N/A"}</Badge>
                                    <Badge variant={user.accountStatus === 'active' ? 'success' : 'destructive'} className="capitalize">{user.accountStatus || "Unknown"}</Badge>
                                    <span>Employee ID: <span className="font-semibold">{user.employeeId || 'N/A'}</span></span>
                                    <span>Joined: <span className="font-semibold">{formatDateDisplay(user.joiningDate)}</span></span>
                                </div>
                            </div>
                            <Button onClick={() => router.push(`/admin/users`)}><Edit className="mr-2 h-4 w-4" />Edit Profile</Button>
                        </CardHeader>
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader className="flex-row justify-between items-center pb-2">
                                <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-primary"/>Recent Schedule</CardTitle>
                                <AddManualActivityDialog userId={user.uid} onActivityAdded={fetchUserProfileData} adminUser={adminUser} />
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                                activities.length > 0 ? (
                                    <ul className="space-y-2">{activities.map((act) => <li key={act.id} className="text-sm flex justify-between"><span>{act.activityType === 'flight' ? `Flight ${act.flightNumber}` : act.comments || act.activityType}</span> <span className="text-muted-foreground">{format(act.date.toDate(), 'PP')}</span></li>)}</ul>
                                ) : (<p className="text-sm text-muted-foreground text-center py-4">No recent activities found.</p>)}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Inbox className="h-5 w-5 text-primary"/>Recent Requests</CardTitle></CardHeader>
                            <CardContent>
                                 {isLoading ? <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                                requests.length > 0 ? (
                                    <ul className="space-y-2">{requests.map((req) => <li key={req.id} className="text-sm flex justify-between">
                                        <Link href={`/admin/user-requests`} className="hover:underline text-primary truncate pr-2">{req.subject}</Link>
                                        <Badge variant="secondary" className="capitalize">{req.status}</Badge>
                                    </li>)}</ul>
                                ) : (<p className="text-sm text-muted-foreground text-center py-4">No recent requests found.</p>)}
                            </CardContent>
                        </Card>
                    </div>
                </div>
                <Card className="lg:col-span-1 h-full">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary"/>Base of Operations</CardTitle>
                         <CardDescription>{baseAirport ? `${baseAirport.name} (${baseAirport.iata})` : "Not Assigned"}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] w-full p-0">
                        {baseAirport ? (
                            <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                                <DynamicMap 
                                    center={[baseAirport.lat, baseAirport.lon]} 
                                    zoom={8} 
                                    markers={[{lat: baseAirport.lat, lon: baseAirport.lon, popup: `<b>${baseAirport.name}</b><br/>${baseAirport.city}, ${baseAirport.country}`}]}
                                />
                            </Suspense>
                        ) : <div className="flex items-center justify-center h-full text-muted-foreground">No base airport assigned.</div>}
                    </CardContent>
                </Card>
             </div>

             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Training History</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                     trainings.length > 0 ? (
                        <div className="space-y-3">
                            {trainings.map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <div>
                                        <p className="font-medium">
                                            <Link href={`/training/${t.courseId}`} className="hover:underline text-primary">
                                                {t.courseTitle}
                                            </Link>
                                        </p>
                                        <p className="text-xs text-muted-foreground">Completed {formatDistanceToNowStrict(t.completedAt.toDate(), { addSuffix: true })}</p>
                                    </div>
                                    <Badge variant={t.status === 'passed' ? 'success' : 'destructive'} className="flex items-center gap-1">
                                        {t.status === 'passed' ? <CheckCircle className="h-3 w-3"/> : <XCircle className="h-3 w-3"/>}
                                        {t.score.toFixed(0)}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    ) : (<p className="text-sm text-muted-foreground text-center py-4">No training history found.</p>)}
                </CardContent>
             </Card>

             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Tracked Documents & Licenses</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                     documents.length > 0 ? (
                        <ul className="space-y-3">
                            {documents.map((doc: StoredUserDocument) => {
                                const expiryDate = doc.expiryDate.toDate();
                                const status = getDocumentStatus(doc, 30);
                                const config = statusConfig[status];
                                const Icon = config.icon;
                                return (
                                    <li key={doc.id} className="text-sm flex justify-between items-center p-2 rounded-md bg-muted/50">
                                        <div className="flex items-center gap-2">
                                            <Icon className={cn("h-5 w-5", config.color)} />
                                            <div>
                                                <p className="font-medium">{doc.documentName}</p>
                                                <p className="text-xs text-muted-foreground">{doc.documentType}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn("font-semibold", config.color)}>{config.label}</p>
                                            <p className="text-xs text-muted-foreground">Expires: {format(expiryDate, 'PP')}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (<p className="text-sm text-muted-foreground text-center py-4">No documents are tracked for this user.</p>)}
                </CardContent>
             </Card>
        </div>
    );
}

