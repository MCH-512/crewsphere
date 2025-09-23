
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Plane, Briefcase, GraduationCap, Bed, Anchor, Users, Globe, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type StoredFlight } from "@/schemas/flight-schema";
import { type StoredTrainingSession } from "@/schemas/training-session-schema";
import { getAirportByCode, type Airport } from "@/services/airport-service";
import type { UserActivity, ActivityData } from "@/schemas/user-activity-schema";
import type { User as AuthUser } from "@/schemas/user-schema";
import Link from 'next/link';
import { getUserActivitiesForMonth } from "@/services/activity-service";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// --- Data Structures ---
interface FlightWithCrewDetails extends StoredFlight {
    departureAirportInfo?: Airport | null;
    arrivalAirportInfo?: Airport | null;
    crew: AuthUser[];
}
interface TrainingWithAttendeesDetails extends StoredTrainingSession {
    attendees: AuthUser[];
}
type SheetActivityDetails = { type: 'flight', data: FlightWithCrewDetails } | { type: 'training', data: TrainingWithAttendeesDetails };

// --- UI Configuration ---
const activityConfig: Record<UserActivity['activityType'], { icon: React.ElementType; label: string; dotColor: string; }> = {
    flight: { icon: Plane, label: "Flight", dotColor: "bg-primary" },
    leave: { icon: Briefcase, label: "Leave", dotColor: "bg-green-500" },
    training: { icon: GraduationCap, label: "Training", dotColor: "bg-yellow-500" },
    'day-off': { icon: Bed, label: "Day Off", dotColor: "bg-gray-500" },
    standby: { icon: Anchor, label: "Standby", dotColor: "bg-orange-500" },
};

// --- Sub-components ---
const FlightDetails = ({ data, authUser }: { data: FlightWithCrewDetails, authUser: AuthUser | null }) => (
    <div className="space-y-4">
        <Card><CardHeader className="pb-2"><CardDescription>Flight Info</CardDescription><CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5"/> {data.flightNumber}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1"><p><strong>Route:</strong> {data.departureAirportInfo?.iata || data.departureAirport} → {data.arrivalAirportInfo?.iata || data.arrivalAirport}</p><p><strong>Departure:</strong> {format(new Date(data.scheduledDepartureDateTimeUTC), "PPP HH:mm")} UTC</p><p><strong>Arrival:</strong> {format(new Date(data.scheduledArrivalDateTimeUTC), "PPP HH:mm")} UTC</p><p><strong>Aircraft:</strong> {data.aircraftType}</p></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardDescription>Assigned Crew ({data.crew.length})</CardDescription></CardHeader>
            <CardContent>{['purser', 'pilote', 'cabin crew', 'instructor', 'stagiaire'].map(role => {
                const members = data.crew.filter(c => c.role === role);
                if (members.length === 0) return null;
                return (<div key={role}><h4 className="font-semibold capitalize mt-3 mb-2 text-primary">{role}</h4><div className="space-y-2">{members.map(member => (<div key={member.uid} className="flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6"><AvatarImage src={member.photoURL ?? undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    {authUser?.role === 'admin' ? (
                        <Link href={`/admin/users/${member.uid}`} className="hover:underline text-primary">{member.displayName}</Link>
                    ) : (
                        <span>{member.displayName}</span>
                    )}
                </div>))}</div></div>);})}
            </CardContent>
        </Card>
    </div>
);

const TrainingDetails = ({ data, authUser }: { data: TrainingWithAttendeesDetails, authUser: AuthUser | null }) => {
    const sessionDate = typeof data.sessionDateTimeUTC === 'string'
        ? new Date(data.sessionDateTimeUTC)
        : data.sessionDateTimeUTC.toDate();
        
    return (
        <div className="space-y-4">
            <Card><CardHeader className="pb-2"><CardDescription>Training Session</CardDescription><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5"/> {data.title}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1"><p><strong>Location:</strong> {data.location}</p><p><strong>Time:</strong> {format(sessionDate, "PPP HH:mm")} UTC</p><p><strong>Description:</strong> {data.description}</p></CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardDescription>Attendees ({data.attendees.length})</CardDescription></CardHeader>
                <CardContent><div className="space-y-2 max-h-60 overflow-y-auto">{data.attendees.map(member => (
                    <div key={member.uid} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6"><AvatarImage src={member.photoURL ?? undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                       {authUser?.role === 'admin' ? (
                            <Link href={`/admin/users/${member.uid}`} className="hover:underline text-primary">{member.displayName} ({member.role})</Link>
                        ) : (
                            <span>{member.displayName} ({member.role})</span>
                        )}
                    </div>))}
                </div></CardContent>
            </Card>
        </div>
    );
};

const ActivityDetailsSheet = ({ isOpen, onOpenChange, activity, isLoading, authUser, error }: { isOpen: boolean, onOpenChange: (open: boolean) => void, activity: SheetActivityDetails | null, isLoading: boolean, authUser: AuthUser | null, error: string | null }) => {
    if (!isOpen) return null;

    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
            <SheetHeader><SheetTitle>Activity Details</SheetTitle><SheetDescription>{isLoading ? "Loading details..." : "Information about the selected event."}</SheetDescription></SheetHeader>
            <div className="py-4">
                {isLoading ? (
                    <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : error ? (
                    <div className="text-center text-destructive py-10 flex flex-col items-center gap-2">
                        <AlertTriangle className="h-8 w-8"/>
                        <p className="font-semibold">Error Loading Details</p>
                        <p className="text-sm">{error}</p>
                    </div>
                ) : activity ? (
                    activity.type === 'flight' ? <FlightDetails data={activity.data} authUser={authUser} /> : <TrainingDetails data={activity.data} authUser={authUser} />
                ) : null}
            </div>
        </SheetContent>
      </Sheet>
    );
};

const ActivityCard = ({ activity, onActivityClick, view }: { activity: ActivityData; onActivityClick: (activity: UserActivity) => void; view: 'personal' | 'global' }) => {
    const config = activityConfig[activity.activityType];
    const Icon = config.icon;
    const isClickable = activity.activityType === 'flight' || activity.activityType === 'training';
    
    const content = (
        <div className={cn('p-3 w-full border-l-4 rounded-r-md flex items-start gap-4 bg-muted/30 mb-2', config.dotColor.replace('bg-', 'border-'), isClickable ? 'hover:bg-muted/50 transition-colors' : 'cursor-default')}>
            <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
            <div className="flex-grow text-left">
                <p className="font-semibold">{config.label} {view === 'global' && activity.activityType === 'flight' ? `- ${activity.flightNumber}` : ''}</p>
                <div className="text-sm text-muted-foreground">
                    {activity.activityType === 'flight' ? `${activity.departureAirport || 'N/A'} → ${activity.arrivalAirport || 'N/A'}` : activity.comments}
                </div>
                 {view === 'global' && activity.userId && (
                    <p className="text-xs text-muted-foreground pt-1">User: {activity.userEmail}</p>
                )}
            </div>
        </div>
    );

    if (isClickable) {
        return <button className="w-full text-left" onClick={() => onActivityClick(activity as UserActivity)}>{content}</button>;
    }
    return content;
};

// --- Main Page Client Component ---
export function MyScheduleClient({ initialActivities }: { initialActivities: ActivityData[] }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [view, setView] = React.useState<'personal' | 'global'>('personal');
    const [activities, setActivities] = React.useState<ActivityData[]>(initialActivities);
    const [isLoading, setIsLoading] = React.useState(false); // For subsequent fetches
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(new Date());
    
    const [sheetActivity, setSheetActivity] = React.useState<SheetActivityDetails | null>(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [isSheetLoading, setIsSheetLoading] = React.useState(false);
    const [sheetError, setSheetError] = React.useState<string | null>(null);
    const [userMap, setUserMap] = React.useState<Map<string, AuthUser>>(new Map());

     React.useEffect(() => {
        const fetchAllUsers = async () => {
             const usersSnapshot = await getDocs(collection(db, "users"));
             const map = new Map<string, AuthUser>();
             usersSnapshot.forEach(doc => {
                 map.set(doc.id, { uid: doc.id, ...doc.data() } as AuthUser);
             });
             setUserMap(map);
        };
        if(user) fetchAllUsers();
    }, [user]);

    const handleMonthChange = React.useCallback(async (month: Date) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const fetchedActivities = await getUserActivitiesForMonth(month, view === 'global' ? undefined : user.uid);
            setActivities(fetchedActivities);
        } catch (error) {
            console.error("Error fetching schedule:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user, view]);
    
    React.useEffect(() => {
        if (!authLoading && user) {
            handleMonthChange(currentMonth);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, user, authLoading]);


    const onMonthChange = (month: Date) => {
        setCurrentMonth(month);
        handleMonthChange(month);
    };

    const handleShowActivityDetails = async (activity: UserActivity) => {
        setIsSheetOpen(true);
        setIsSheetLoading(true);
        setSheetActivity(null);
        setSheetError(null);
        try {
            if (activity.flightId) {
                const flightSnap = await getDoc(doc(db, "flights", activity.flightId));
                if (!flightSnap.exists()) throw new Error("Flight details not found. It may have been deleted.");
                const flight = { id: flightSnap.id, ...flightSnap.data() } as StoredFlight;
                
                const crew = (flight.allCrewIds || []).map(uid => userMap.get(uid)).filter(Boolean) as AuthUser[];
                const [depAirport, arrAirport] = await Promise.all([getAirportByCode(flight.departureAirport), getAirportByCode(flight.arrivalAirport)]);
                
                setSheetActivity({ type: 'flight', data: { ...flight, departureAirportInfo: depAirport, arrivalAirportInfo: arrAirport, crew } });
            } else if (activity.trainingSessionId) {
                const sessionSnap = await getDoc(doc(db, "trainingSessions", activity.trainingSessionId));
                if (!sessionSnap.exists()) throw new Error("Training session not found. It may have been deleted.");
                const session = { id: sessionSnap.id, ...sessionSnap.data() } as StoredTrainingSession;
                const attendees = (session.attendeeIds || []).map(uid => userMap.get(uid)).filter(Boolean) as AuthUser[];
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

    const selectedDayActivities = activities.filter(activity => selectedDay && isSameDay(activity.date.toDate(), selectedDay));
    
    const activityDotStyles = activities.reduce((acc, activity) => {
        const dateKey = format(activity.date.toDate(), 'yyyy-MM-dd');
        if (!acc[dateKey]) {
            acc[dateKey] = new Set();
        }
        acc[dateKey].add(activityConfig[activity.activityType].dotColor);
        return acc;
    }, {} as Record<string, Set<string>>);


    const footer = selectedDay ? (
        <div className="p-4 pt-0">
          <h3 className="text-lg font-semibold mb-2 text-center md:text-left">{format(selectedDay, "EEEE, PPP")}</h3>
          <div className="max-h-48 overflow-y-auto pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : selectedDayActivities.length > 0 ? (
              selectedDayActivities.map(activity => <ActivityCard key={activity.id} activity={activity} onActivityClick={handleShowActivityDetails} view={view}/>)
            ) : (
              <p className="text-sm text-muted-foreground text-center p-4">No activities scheduled for this day.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="p-4 text-center text-sm text-muted-foreground">Please pick a day.</p>
      );
    
    if (authLoading) { 
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>; 
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg"><CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                             <CardTitle className="text-2xl font-headline flex items-center"><CalendarIcon className="mr-3 h-7 w-7 text-primary" />{view === 'personal' ? 'My Schedule' : 'Global Timeline'}</CardTitle>
                             <CardDescription>View {view === 'personal' ? 'your monthly schedule.' : 'all crew activities.'} Click an event for details.</CardDescription>
                        </div>
                        {user?.role === 'admin' && (
                            <div className="flex items-center gap-2 mt-4 sm:mt-0 p-1 bg-muted rounded-lg">
                                <Button variant={view === 'personal' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('personal')} className="flex items-center gap-1"><User className="h-4 w-4"/> Personal</Button>
                                <Button variant={view === 'global' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('global')} className="flex items-center gap-1"><Globe className="h-4 w-4"/> Global</Button>
                            </div>
                        )}
                    </div>
                </CardHeader></Card>
            </AnimatedCard>
            <Card className="shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    <Calendar
                        mode="single"
                        selected={selectedDay}
                        onSelect={setSelectedDay}
                        month={currentMonth}
                        onMonthChange={onMonthChange}
                        components={{
                            DayContent: ({ date }) => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const colors = activityDotStyles[dateKey];
                                return (
                                    <div className="relative flex h-full w-full items-center justify-center">
                                        <span>{format(date, 'd')}</span>
                                        {colors && (
                                            <div className="absolute bottom-1.5 flex gap-1">
                                                {Array.from(colors).slice(0, 3).map((color, i) => (
                                                    <div key={i} className={cn("h-1.5 w-1.5 rounded-full", color)} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            },
                        }}
                        className="p-2 sm:p-4 border-b lg:border-r lg:border-b-0"
                    />
                    <div className="p-4">
                        {footer}
                    </div>
                </div>
                 <Separator />
                 <CardFooter className="p-4 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(activityConfig).map(([key, { label, dotColor }]) => (
                        <div key={key} className="flex items-center gap-2">
                            <div className={cn("h-2.5 w-2.5 rounded-full", dotColor)} />
                            <span>{label}</span>
                        </div>
                    ))}
                </CardFooter>
            </Card>
            <ActivityDetailsSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} activity={sheetActivity} isLoading={isSheetLoading} authUser={user} error={sheetError} />
        </div>
    );
}
