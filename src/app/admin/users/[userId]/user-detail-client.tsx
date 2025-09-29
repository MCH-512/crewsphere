"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { type User } from "@/schemas/user-schema";
import { Timestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft, Calendar, GraduationCap, Inbox, CheckCircle, XCircle, ShieldCheck, CalendarX, CalendarClock, CalendarCheck2, PlusCircle, Edit, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StoredDocument } from "@/schemas/document-schema";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StoredUserQuizAttempt } from "@/schemas/course-schema";
import { StoredUserDocument, UserDocumentStatus } from "@/schemas/user-document-schema";
import { UserActivity } from "@/schemas/user-activity-schema";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manualActivityFormSchema, manualActivityTypes, type ManualActivityFormValues } from "@/schemas/manual-activity-schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { logAuditEvent } from "@/lib/audit-logger";
import type { Airport } from "@/services/airport-service";
import type { StoredUserRequest } from "@/schemas/request-schema";
import { Suspense } from "react";
import { ProfileData, getUserProfileData } from "@/services/user-profile-service";
import { UserDocumentStatus as CalculatedDocStatus, getDocumentStatus } from "@/schemas/user-document-schema";
import { getDocumentStatus, getStatusBadgeVariant } from "@/schemas/user-document-schema";
import { cn } from "@/lib/utils";

const DynamicMap = dynamic(() =&gt; import('@/components/features/live-map').then(mod =&gt; mod.MapDisplay), {
    ssr: false,
    loading: () =&gt; &lt;div className="flex justify-center items-center h-full"&gt;&lt;Loader2 className="h-6 w-6 animate-spin" /&gt;&lt;/div&gt;,
});

const statusConfig: Record&lt;CalculatedDocStatus, { icon: React.ElementType, color: string, label: string }&gt; = {
    expired: { icon: CalendarX, color: "text-destructive", label: "Expired" },
    'expiring-soon': { icon: CalendarClock, color: "text-yellow-600", label: "Expiring Soon" },
    approved: { icon: CalendarCheck2, color: "text-green-600", label: "Approved" },
    'pending-validation': { icon: CalendarClock, color: "text-blue-600", label: "Pending Validation"},
};

const getFlagEmoji = (countryCode: string | undefined) =&gt; {
    if (!countryCode || countryCode.length !== 2) return '';
    const codePoints = countryCode.toUpperCase().split('').map(char =&gt; 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};


const AddManualActivityDialog = ({ userId, onActivityAdded, adminUser }: { userId: string, onActivityAdded: () =&gt; void, adminUser: User | null }) =&gt; {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    const form = useForm&lt;ManualActivityFormValues&gt;({
        resolver: zodResolver(manualActivityFormSchema),
        defaultValues: {
            activityType: "Day Off",
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            comments: ""
        },
    });

    const onSubmit = async (data: ManualActivityFormValues) =&gt; {
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

            interval.forEach(day =&gt; {
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
      &lt;Dialog open={isOpen} onOpenChange={setIsOpen}&gt;
        &lt;DialogTrigger asChild&gt;
            &lt;Button&gt;&lt;PlusCircle className="mr-2 h-4 w-4"/&gt;Add Manual Activity&lt;/Button&gt;
        &lt;/DialogTrigger&gt;
        &lt;DialogContent&gt;
            &lt;DialogHeader&gt;
                &lt;DialogTitle&gt;Add Manual Schedule Activity&lt;/DialogTitle&gt;
                &lt;DialogDescription&gt;Add a non-flight activity like leave or standby to this user&apos;s schedule.&lt;/DialogDescription&gt;
            &lt;/DialogHeader&gt;
            &lt;Form {...form}&gt;
                &lt;form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"&gt;
                    &lt;FormField control={form.control} name="activityType" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Activity Type&lt;/FormLabel&gt;&lt;Select onValueChange={field.onChange} value={field.value}&gt;&lt;FormControl&gt;&lt;SelectTrigger&gt;&lt;SelectValue/&gt;&lt;/SelectTrigger&gt;&lt;/FormControl&gt;&lt;SelectContent&gt;{manualActivityTypes.map(t =&gt; &lt;SelectItem key={t} value={t}&gt;{t}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;&lt;/Select&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                     &lt;div className="grid grid-cols-2 gap-4"&gt;
                        &lt;FormField control={form.control} name="startDate" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Start Date&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input type="date" {...field} value={field.value || ""} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                        &lt;FormField control={form.control} name="endDate" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;End Date&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input type="date" {...field} value={field.value || ""} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                    &lt;/div&gt;
                    &lt;FormField control={form.control} name="comments" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Notes (Optional)&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Textarea {...field} placeholder="Add any relevant details..."/&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                    &lt;DialogFooter&gt;
                        &lt;DialogClose asChild&gt;&lt;Button type="button" variant="outline"&gt;Cancel&lt;/Button&gt;&lt;/DialogClose&gt;
                        &lt;Button type="submit" disabled={isSubmitting}&gt;{isSubmitting &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}Add to Schedule&lt;/Button&gt;
                    &lt;/DialogFooter&gt;
                &lt;/form&gt;
            &lt;/Form&gt;
        &lt;/DialogContent&gt;
      &lt;/Dialog&gt;
    );
}

interface UserDetailClientProps {
    initialProfileData: ProfileData;
    initialUserMap: Map&lt;string, User&gt;;
}


// --- Page Component ---
export function UserDetailClient({ initialProfileData, initialUserMap }: UserDetailClientProps) {
    const { user: adminUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const toast = useToast()

    const [profileData, setProfileData] = React.useState&lt;ProfileData&gt;(initialProfileData);
    const [userMap, setUserMap] = React.useState&lt;Map&lt;string, User&gt;&gt;(initialUserMap);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState&lt;string | null&gt;(null);
    const [success, setSuccess] = React.useState&lt;string | null&gt;(null);

    const [sheetActivity, setSheetActivity] = React.useState&lt;SheetActivityDetails | null&gt;(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [isSheetLoading, setIsSheetLoading] = React.useState(false);
    const [sheetError, setSheetError] = React.useState&lt;string | null&gt;(null);

    const fetchUserProfileData = React.useCallback(async () =&gt; {
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const freshData = await getUserProfileData(profileData.user.uid);
            if (freshData) {
                setProfileData(freshData);
                setUserMap(freshData.userMap);
                setSuccess("Profile data has been updated.");
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
    
    const formatDateDisplay = (dateValue?: string | null | Timestamp) =&gt; {
        if (!dateValue) return "N/A";
        let dateObj: Date;
        if (dateValue instanceof Timestamp) {
            dateObj = dateValue.toDate();
        } else {
            try {
                dateObj = new Date(dateValue);
                 if (isNaN(dateObj.getTime())) return "Invalid Date";
            } catch(e: unknown) {
                 return String(dateValue);
            }
        }
        return format(dateObj, "PPp");
    };

     const handleShowActivityDetails = async (activity: UserActivity) =&gt; {
        setIsSheetOpen(true);
        setIsSheetLoading(true);
        setSheetActivity(null);
        setSheetError(null);
        try {
            if (activity.flightId) {
                const flightSnap = await getDoc(doc(db, "flights", activity.flightId));
                if (!flightSnap.exists()) throw new Error("Flight details not found. It may have been deleted.");
                const flight = { id: flightSnap.id, ...flightSnap.data() } as StoredFlight;
                const crew = (flight.allCrewIds || []).map(uid =&gt; userMap.get(uid)).filter(Boolean) as User[];
                setSheetActivity({ type: 'flight', data: { ...flight, crew } });
            } else if (activity.trainingSessionId) {
                const sessionSnap = await getDoc(doc(db, "trainingSessions", activity.trainingSessionId));
                if (!sessionSnap.exists()) throw new Error("Training session not found. It may have been deleted.");
                const session = { id: sessionSnap.id, ...sessionSnap.data() } as StoredTrainingSession;
                const attendees = (session.attendeeIds || []).map(uid =&gt; userMap.get(uid)).filter(Boolean) as User[];
                setSheetActivity({ type: 'training', data: { ...session, attendees } });
            }
        } catch(err) {
            const e = err as Error;
            console.error("Error fetching activity details:", e);
            setSheetError(e.message || "An unexpected error occurred.");
        } finally {
            setIsSheetLoading(false);
        }
    };


    if (authLoading) {
        return &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;
    }
    
    if (error) {
        return &lt;div className="text-center py-10"&gt;&lt;AlertTriangle className="mx-auto h-12 w-12 text-destructive" /&gt;&lt;p className="mt-4 text-lg"&gt;{error}&lt;/p&gt;&lt;Button onClick={() =&gt; router.push('/admin/users')} className="mt-4"&gt;Back to Users&lt;/Button&gt;&lt;/div&gt;;
    }
    
    if (!profileData) return null;

    const { user, activities, trainings, requests, documents, baseAirport } = profileData;
    const flagEmoji = getFlagEmoji(baseAirport?.countryCode);
    const avatarFallback = user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : user?.email?.substring(0,2).toUpperCase() || 'U';

    return (
        &lt;div className="space-y-6 max-w-6xl mx-auto"&gt;
             &lt;Button variant="outline" onClick={() =&gt; router.push('/admin/users')}&gt;&lt;ArrowLeft className="mr-2 h-4 w-4"/&gt;Back to User List&lt;/Button&gt;
            
             &lt;div className="grid grid-cols-1 lg:grid-cols-3 gap-6"&gt;
                &lt;div className="lg:col-span-2 space-y-6"&gt;
                    &lt;Card className="shadow-lg"&gt;
                        &lt;CardHeader className="flex flex-col md:flex-row items-start md:items-center gap-4"&gt;
                            &lt;Avatar className="h-20 w-20 border"&gt;
                                &lt;AvatarImage src={user.photoURL ?? undefined} data-ai-hint="user portrait" /&gt;
                                &lt;AvatarFallback className="text-2xl"&gt;{avatarFallback}&lt;/AvatarFallback&gt;
                            &lt;/Avatar&gt;
                            &lt;div className="flex-1"&gt;
                                &lt;CardTitle className="text-3xl font-headline flex items-center gap-2"&gt;{user.fullName || user.displayName} {flagEmoji}&lt;/CardTitle&gt;
                                &lt;CardDescription&gt;{user.email}&lt;/CardDescription&gt;
                                &lt;div className="flex flex-wrap items-center gap-2 mt-2"&gt;
                                    &lt;Badge variant="outline" className="capitalize"&gt;{user.role || "N/A"}&lt;/Badge&gt;
                                    &lt;Badge variant={user.accountStatus === 'active' ? 'success' : 'destructive'} className="capitalize"&gt;{user.accountStatus || "Unknown"}&lt;/Badge&gt;
                                    &lt;span&gt;Employee ID: &lt;span className="font-semibold"&gt;{user.employeeId || 'N/A'}&lt;/span&gt;&lt;/span&gt;
                                    &lt;span&gt;Joined: &lt;span className="font-semibold"&gt;{formatDateDisplay(user.joiningDate)}&lt;/span&gt;&lt;/span&gt;
                                &lt;/div&gt;
                            &lt;/div&gt;
                            &lt;Button onClick={() =&gt; router.push(`/admin/users`)}&gt;&lt;Edit className="mr-2 h-4 w-4" /&gt;Edit Profile&lt;/Button&gt;
                        &lt;/CardHeader&gt;
                    &lt;/Card&gt;
                    &lt;div className="grid grid-cols-1 md:grid-cols-2 gap-6"&gt;
                        &lt;Card&gt;
                            &lt;CardHeader className="flex-row justify-between items-center pb-2"&gt;
                                &lt;CardTitle className="text-lg flex items-center gap-2"&gt;&lt;Calendar className="h-5 w-5 text-primary"/&gt;Recent Schedule&lt;/CardTitle&gt;
                                &lt;Button&gt;&lt;PlusCircle className="mr-2 h-4 w-4"/&gt;Add Activity&lt;/Button&gt;
                            &lt;/CardHeader&gt;
                            &lt;CardContent&gt;
                                {isLoading ? &lt;div className="flex justify-center p-4"&gt;&lt;Loader2 className="h-6 w-6 animate-spin"/&gt;&lt;/div&gt; :
                                activities.length &gt; 0 ? (
                                    &lt;ul className="space-y-2"&gt;{activities.map(act =&gt; &lt;li key={act.id} className="text-sm flex justify-between"&gt;
                                        &lt;span&gt;{act.activityType === 'flight' ? `Flight ${act.flightNumber}` : act.comments || act.activityType}&lt;/span&gt;
                                        &lt;span className="text-muted-foreground"&gt;{format(act.date.toDate(), 'PP')}&lt;/span&gt;
                                    &lt;/li&gt;)}&lt;/ul&gt;
                                ) : (&lt;p className="text-sm text-muted-foreground text-center py-4"&gt;No recent activities found.&lt;/p&gt;)}
                            &lt;/CardContent&gt;
                        &lt;/Card&gt;
                         &lt;Card&gt;
                            &lt;CardHeader className="pb-2"&gt;&lt;CardTitle className="text-lg flex items-center gap-2"&gt;&lt;Inbox className="h-5 w-5 text-primary"/&gt;Recent Requests&lt;/CardTitle&gt;&lt;/CardHeader&gt;
                            &lt;CardContent&gt;
                                 {isLoading ? &lt;div className="flex justify-center p-4"&gt;&lt;Loader2 className="h-6 w-6 animate-spin"/&gt;&lt;/div&gt; :
                                requests.length &gt; 0 ? (
                                    &lt;ul className="space-y-2"&gt;{requests.map((req) =&gt; &lt;li key={req.id} className="text-sm flex justify-between"&gt;
                                        &lt;Link href={`/admin/user-requests`} className="hover:underline text-primary truncate pr-2"&gt;{req.subject}&lt;/Link&gt;
                                        &lt;Badge variant="secondary" className="capitalize"&gt;{req.status}&lt;/Badge&gt;
                                    &lt;/li&gt;)}&lt;/ul&gt;
                                ) : (&lt;p className="text-sm text-muted-foreground text-center py-4"&gt;No recent requests found.&lt;/p&gt;)}
                            &lt;/CardContent&gt;
                        &lt;/Card&gt;
                    &lt;/div&gt;
                &lt;/div&gt;
                &lt;Card className="lg:col-span-1 h-full"&gt;
                    &lt;CardHeader&gt;
                        &lt;CardTitle className="text-lg flex items-center gap-2"&gt;&lt;MapPin className="h-5 w-5 text-primary"/&gt;Base of Operations&lt;/CardTitle&gt;
                         &lt;CardDescription&gt;{baseAirport ? `${baseAirport.name} (${baseAirport.iata})` : "Not Assigned"}&lt;/CardDescription&gt;
                    &lt;/CardHeader&gt;
                    &lt;CardContent className="h-[350px] w-full p-0"&gt;
                        {baseAirport ? (
                            &lt;Suspense fallback=&lt;div className="flex justify-center items-center h-full"&gt;&lt;Loader2 className="h-6 w-6 animate-spin" /&gt;&lt;/div&gt;&gt;
                                &lt;DynamicMap 
                                    center={[baseAirport.lat, baseAirport.lon]} 
                                    zoom={8} 
                                    markers={[{lat: baseAirport.lat, lon: baseAirport.lon, popup: `&lt;b&gt;${baseAirport.name}&lt;/b&gt;&lt;br/&gt;${baseAirport.city}, ${baseAirport.country}`}]}
                                /&gt;
                            &lt;/Suspense&gt;
                        ) : &lt;div className="flex items-center justify-center h-full text-muted-foreground"&gt;No base airport assigned.&lt;/div&gt;}
                    &lt;/CardContent&gt;
                &lt;/Card&gt;
             &lt;/div&gt;

             &lt;Card&gt;
                &lt;CardHeader&gt;&lt;CardTitle className="text-lg flex items-center gap-2"&gt;&lt;GraduationCap className="h-5 w-5 text-primary"/&gt;Training History&lt;/CardTitle&gt;&lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    {isLoading ? &lt;div className="flex justify-center p-4"&gt;&lt;Loader2 className="h-6 w-6 animate-spin"/&gt;&lt;/div&gt; :
                     trainings.length &gt; 0 ? (
                        &lt;div className="space-y-3"&gt;
                            {trainings.map((t) =&gt; (
                                &lt;div key={t.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50"&gt;
                                    &lt;div&gt;
                                        &lt;p className="font-medium"&gt;
                                            &lt;Link href={`/training/${t.courseId}`} className="hover:underline text-primary"&gt;
                                                {t.courseId} {/* Fallback to ID if title not available */}
                                            &lt;/Link&gt;
                                        &lt;/p&gt;
                                        &lt;p className="text-xs text-muted-foreground"&gt;Completed {format(t.completedAt.toDate(), "PPp")}&lt;/p&gt;
                                    &lt;/div&gt;
                                    &lt;Badge variant={t.status === 'passed' ? 'success' : 'destructive'} className="flex items-center gap-1"&gt;
                                        {t.status === 'passed' ? &lt;CheckCircle className="h-3 w-3"/&gt; : &lt;XCircle className="h-3 w-3"/&gt;}
                                        {t.score.toFixed(0)}%
                                    &lt;/Badge&gt;
                                &lt;/div&gt;
                            ))}&lt;/div&gt;
                    ) : (&lt;p className="text-sm text-muted-foreground text-center py-4"&gt;No training history found.&lt;/p&gt;)}
                &lt;/CardContent&gt;
             &lt;/Card&gt;

             &lt;Card&gt;
                &lt;CardHeader&gt;&lt;CardTitle className="text-lg flex items-center gap-2"&gt;&lt;ShieldCheck className="h-5 w-5 text-primary"/&gt;Tracked Documents &amp; Licenses&lt;/CardTitle&gt;&lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    {isLoading ? &lt;div className="flex justify-center p-4"&gt;&lt;Loader2 className="h-6 w-6 animate-spin"/&gt;&lt;/div&gt; :
                     documents.length &gt; 0 ? (
                        &lt;ul className="space-y-3"&gt;
                            {documents.map((doc: StoredUserDocument) =&gt; {
                                const expiryDate = doc.expiryDate.toDate();
                                const status = getDocumentStatus(doc, 30);
                                const config = statusConfig[status];
                                const Icon = config.icon;
                                return (
                                    &lt;li key={doc.id} className="text-sm flex justify-between items-center p-2 rounded-md bg-muted/50"&gt;
                                        &lt;div className="flex items-center gap-2"&gt;
                                            &lt;Icon className={cn("h-5 w-5", config.color)} /&gt;
                                            &lt;div&gt;
                                                &lt;p className="font-medium"&gt;{doc.documentName}&lt;/p&gt;
                                                &lt;p className="text-xs text-muted-foreground"&gt;{doc.documentType}&lt;/p&gt;
                                            &lt;/div&gt;
                                        &lt;/div&gt;
                                        &lt;div className="text-right"&gt;
                                            &lt;p className={cn("font-semibold", config.color)}&gt;{config.label}&lt;/p&gt;
                                            &lt;p className="text-xs text-muted-foreground"&gt;Expires: {format(expiryDate, 'PP')}&lt;/p&gt;
                                        &lt;/div&gt;
                                    &lt;/li&gt;
                                );
                            })}
                        &lt;/ul&gt;
                    ) : (&lt;p className="text-sm text-muted-foreground text-center py-4"&gt;No documents are tracked for this user.&lt;/p&gt;)}
                &lt;/CardContent&gt;
             &lt;/Card&gt;
             &lt;ActivityDetailsSheet 
                isOpen={isSheetOpen} 
                onOpenChange={setIsSheetOpen} 
                activity={sheetActivity} 
                isLoading={isSheetLoading} 
                authUser={adminUser} 
                error={sheetError} 
             /&gt;
        &lt;/div&gt;
    );
}
