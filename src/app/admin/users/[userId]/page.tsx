
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft, User as UserIcon, Calendar, GraduationCap, Inbox, CheckCircle, XCircle, ShieldCheck, CalendarX, CalendarClock, CalendarCheck2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNowStrict, differenceInDays } from "date-fns";
import { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { StoredCourse } from "@/schemas/course-schema";
import { StoredUserDocument } from "@/schemas/user-document-schema";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// --- Interfaces for fetched data ---
interface UserActivity {
  id: string;
  activityType: 'flight' | 'leave' | 'training' | 'standby' | 'day-off';
  date: Timestamp;
  comments?: string;
  flightNumber?: string;
}

interface RequestSummary {
    id: string;
    subject: string;
    status: "pending" | "approved" | "rejected" | "in-progress";
    createdAt: Timestamp;
}

interface TrainingWithCourse extends StoredUserQuizAttempt {
    courseTitle?: string;
}

interface UserProfileData {
    user: User;
    activities: UserActivity[];
    trainings: TrainingWithCourse[];
    requests: RequestSummary[];
    documents: StoredUserDocument[];
}

// --- Status Logic (mirrored from expiry management for consistency) ---
const EXPIRY_WARNING_DAYS = 30;
type DocumentStatus = 'valid' | 'expiring-soon' | 'expired';

const getDocumentStatus = (expiryDate: Date): DocumentStatus => {
    const today = new Date();
    const daysUntilExpiry = differenceInDays(expiryDate, today);

    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) return 'expiring-soon';
    return 'valid';
};

const statusConfig: Record<DocumentStatus, { icon: React.ElementType, color: string, label: string }> = {
    expired: { icon: CalendarX, color: "text-destructive", label: "Expired" },
    'expiring-soon': { icon: CalendarClock, color: "text-yellow-600", label: "Expiring Soon" },
    valid: { icon: CalendarCheck2, color: "text-green-600", label: "Valid" },
};

// --- Page Component ---
export default function UserDetailPage() {
    const { user: adminUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const userId = params.userId as string;

    const [profileData, setProfileData] = React.useState<UserProfileData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!userId || !adminUser || adminUser.role !== 'admin') {
            if (!authLoading) router.push('/');
            return;
        }

        const fetchUserProfileData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const userDocRef = doc(db, "users", userId);
                
                const userPromise = getDoc(userDocRef);
                const activitiesPromise = getDocs(query(collection(db, "userActivities"), where("userId", "==", userId), orderBy("date", "desc"), limit(5)));
                const trainingsPromise = getDocs(query(collection(db, "userQuizAttempts"), where("userId", "==", userId), orderBy("completedAt", "desc"), limit(5)));
                const requestsPromise = getDocs(query(collection(db, "requests"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(5)));
                const documentsPromise = getDocs(query(collection(db, "userDocuments"), where("userId", "==", userId), orderBy("expiryDate", "asc")));

                const [userSnap, activitiesSnap, trainingsSnap, requestsSnap, documentsSnap] = await Promise.all([userPromise, activitiesPromise, trainingsPromise, requestsSnap, documentsPromise]);
                
                if (!userSnap.exists()) throw new Error("User not found.");
                const fetchedUser = { uid: userSnap.id, ...userSnap.data() } as User;
                
                const activities = activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserActivity);
                const requests = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as RequestSummary);
                const documents = documentsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as StoredUserDocument);

                const trainingAttempts = trainingsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as StoredUserQuizAttempt);
                const courseIds = [...new Set(trainingAttempts.map(t => t.courseId))];
                const coursePromises = courseIds.map(id => getDoc(doc(db, "courses", id)));
                const courseDocs = await Promise.all(coursePromises);
                const coursesMap = new Map(courseDocs.map(d => [d.id, d.data() as StoredCourse]));
                const trainings = trainingAttempts.map(t => ({ ...t, courseTitle: coursesMap.get(t.courseId)?.title || "Unknown Course" }));

                setProfileData({ user: fetchedUser, activities, trainings, requests, documents });

            } catch (err: any) {
                setError(err.message || "Failed to load user profile.");
                toast({ title: "Loading Error", description: err.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserProfileData();
    }, [userId, adminUser, authLoading, router, toast]);

    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (error) {
        return <div className="text-center py-10"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><p className="mt-4 text-lg">{error}</p><Button onClick={() => router.push('/admin/users')} className="mt-4">Back to Users</Button></div>;
    }
    
    if (!profileData) return null;

    const { user, activities, trainings, requests, documents } = profileData;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
             <Button variant="outline" onClick={() => router.push('/admin/users')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to User List</Button>
            
             <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <Avatar className="h-20 w-20 border">
                        <AvatarImage src={user.photoURL || undefined} data-ai-hint="user portrait" />
                        <AvatarFallback className="text-2xl">{user.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <CardTitle className="text-3xl font-headline">{user.fullName || user.displayName}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                             <Badge variant="outline" className="capitalize">{user.role || "N/A"}</Badge>
                             <Badge variant={user.accountStatus === 'active' ? 'success' : 'destructive'} className="capitalize">{user.accountStatus || "Unknown"}</Badge>
                             <span>Employee ID: <span className="font-semibold">{user.employeeId || 'N/A'}</span></span>
                        </div>
                    </div>
                </CardHeader>
             </Card>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-primary"/>Recent Schedule</CardTitle></CardHeader>
                    <CardContent>
                        {activities.length > 0 ? (
                             <ul className="space-y-2">{activities.map(act => <li key={act.id} className="text-sm flex justify-between"><span>{act.activityType === 'flight' ? `Flight ${act.flightNumber}` : act.comments || act.activityType}</span> <span className="text-muted-foreground">{format(act.date.toDate(), 'PP')}</span></li>)}</ul>
                        ) : (<p className="text-sm text-muted-foreground text-center py-4">No recent activities found.</p>)}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Inbox className="h-5 w-5 text-primary"/>Recent Requests</CardTitle></CardHeader>
                    <CardContent>
                        {requests.length > 0 ? (
                             <ul className="space-y-2">{requests.map(req => <li key={req.id} className="text-sm flex justify-between"><span>{req.subject}</span><Badge variant="secondary" className="capitalize">{req.status}</Badge></li>)}</ul>
                        ) : (<p className="text-sm text-muted-foreground text-center py-4">No recent requests found.</p>)}
                    </CardContent>
                </Card>
             </div>

             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Training History</CardTitle></CardHeader>
                <CardContent>
                     {trainings.length > 0 ? (
                        <div className="space-y-3">
                            {trainings.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <div>
                                        <p className="font-medium">{t.courseTitle}</p>
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
                     {documents.length > 0 ? (
                        <ul className="space-y-3">
                            {documents.map(doc => {
                                const expiryDate = doc.expiryDate.toDate();
                                const status = getDocumentStatus(expiryDate);
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
