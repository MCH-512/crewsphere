
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Plane, Briefcase, GraduationCap, Bed, Anchor, Users } from "lucide-react";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type StoredFlight } from "@/schemas/flight-schema";
import { type StoredTrainingSession } from "@/schemas/training-session-schema";
import { getAirportByCode, type Airport } from "@/services/airport-service";
import { type UserActivity } from "@/schemas/user-activity-schema";

// --- Data Structures ---
interface FlightWithCrewDetails extends StoredFlight {
    departureAirportInfo?: Airport | null;
    arrivalAirportInfo?: Airport | null;
    crew: User[];
}
interface TrainingWithAttendeesDetails extends StoredTrainingSession {
    attendees: User[];
}
type SheetActivityDetails = { type: 'flight', data: FlightWithCrewDetails } | { type: 'training', data: TrainingWithAttendeesDetails };

// --- UI Configuration ---
const activityConfig: Record<UserActivity['activityType'], { icon: React.ElementType; label: string; className: string; dotColor: string; }> = {
    flight: { icon: Plane, label: "Flight", className: "border-blue-500", dotColor: "bg-blue-500" },
    leave: { icon: Briefcase, label: "Leave", className: "border-green-500", dotColor: "bg-green-500" },
    training: { icon: GraduationCap, label: "Training", className: "border-yellow-500", dotColor: "bg-yellow-500" },
    'day-off': { icon: Bed, label: "Day Off", className: "border-gray-500", dotColor: "bg-gray-500" },
    standby: { icon: Anchor, label: "Standby", className: "border-orange-500", dotColor: "bg-orange-500" },
};

// --- Sub-components ---
const ActivityDetailsSheet = ({ isOpen, onOpenChange, activity }: { isOpen: boolean, onOpenChange: (open: boolean) => void, activity: SheetActivityDetails | null }) => {
    if (!isOpen) return null;

    const renderFlightDetails = (data: FlightWithCrewDetails) => (
        <div className="space-y-4">
            <Card><CardHeader className="pb-2"><CardDescription>Flight Info</CardDescription><CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5"/> {data.flightNumber}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1"><p><strong>Route:</strong> {data.departureAirportInfo?.iata || data.departureAirport} → {data.arrivalAirportInfo?.iata || data.arrivalAirport}</p><p><strong>Departure:</strong> {format(new Date(data.scheduledDepartureDateTimeUTC), "PPP HH:mm")} UTC</p><p><strong>Arrival:</strong> {format(new Date(data.scheduledArrivalDateTimeUTC), "PPP HH:mm")} UTC</p><p><strong>Aircraft:</strong> {data.aircraftType}</p></CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardDescription>Assigned Crew ({data.crew.length})</CardDescription></CardHeader>
                <CardContent>{['purser', 'pilote', 'cabin crew', 'instructor', 'stagiaire'].map(role => {
                    const members = data.crew.filter(c => c.role === role);
                    if (members.length === 0) return null;
                    return (<div key={role}><h4 className="font-semibold capitalize mt-3 mb-2 text-primary">{role}</h4><div className="space-y-2">{members.map(member => (<div key={member.uid} className="flex items-center gap-2 text-sm">
                        <Avatar className="h-6 w-6"><AvatarImage src={member.photoURL || undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><span>{member.displayName}</span>
                    </div>))}</div></div>);})}
                </CardContent>
            </Card>
        </div>
    );
    const renderTrainingDetails = (data: TrainingWithAttendeesDetails) => (
        <div className="space-y-4">
            <Card><CardHeader className="pb-2"><CardDescription>Training Session</CardDescription><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5"/> {data.title}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1"><p><strong>Location:</strong> {data.location}</p><p><strong>Time:</strong> {format(data.sessionDateTimeUTC.toDate(), "PPP HH:mm")} UTC</p><p><strong>Description:</strong> {data.description}</p></CardContent>
            </Card>
            <Card><CardHeader className="pb-2"><CardDescription>Attendees ({data.attendees.length})</CardDescription></CardHeader>
                <CardContent><div className="space-y-2 max-h-60 overflow-y-auto">{data.attendees.map(member => (
                    <div key={member.uid} className="flex items-center gap-2 text-sm"><Avatar className="h-6 w-6"><AvatarImage src={member.photoURL || undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><span>{member.displayName} ({member.role})</span></div>))}
                </div></CardContent>
            </Card>
        </div>
    );
    return (<Sheet open={isOpen} onOpenChange={onOpenChange}><SheetContent className="w-full sm:max-w-md"><SheetHeader><SheetTitle>Activity Details</SheetTitle><SheetDescription>Information about the selected event.</SheetDescription></SheetHeader><div className="py-4">
        {activity ? (activity.type === 'flight' ? renderFlightDetails(activity.data) : renderTrainingDetails(activity.data)) : <div className="text-center text-muted-foreground py-10"><p>Could not load activity details.</p></div>}
    </div></SheetContent></Sheet>);
};

const ActivityCard = ({ activity, onActivityClick }: { activity: UserActivity; onActivityClick: (activity: UserActivity) => void }) => {
    const config = activityConfig[activity.activityType];
    const Icon = config.icon;
    const isClickable = activity.activityType === 'flight' || activity.activityType === 'training';
    const content = (<div className={cn('p-3 w-full border-l-4 rounded-r-md flex items-start gap-4 bg-muted/30', config.className, isClickable && 'hover:bg-muted/50 transition-colors')}><Icon className="h-5 w-5 mt-1 text-muted-foreground" /><div className="flex-grow text-left"><p className="font-semibold">{config.label}</p><div className="text-sm text-muted-foreground">{activity.activityType === 'flight' && `Flight ${activity.flightNumber || 'N/A'}: ${activity.departureAirport || 'N/A'} → ${activity.arrivalAirport || 'N/A'}`}{activity.comments && <p>{activity.comments}</p>}</div></div></div>);
    if (isClickable) { return <button className="w-full text-left mb-2" onClick={() => onActivityClick(activity)}>{content}</button>; }
    return <div className="mb-2">{content}</div>;
};

// --- Main Page Component ---
export default function MySchedulePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [activities, setActivities] = React.useState<UserActivity[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(new Date());
    
    // State for pre-loaded details
    const [userMap, setUserMap] = React.useState<Map<string, User>>(new Map());
    const [flightDetailsMap, setFlightDetailsMap] = React.useState<Map<string, FlightWithCrewDetails>>(new Map());
    const [trainingDetailsMap, setTrainingDetailsMap] = React.useState<Map<string, TrainingWithAttendeesDetails>>(new Map());

    // State for the details sheet
    const [sheetActivity, setSheetActivity] = React.useState<SheetActivityDetails | null>(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);

    const fetchActivities = React.useCallback(async (month: Date) => {
        if (!user) return;
        setIsLoading(true);
        const start = startOfMonth(month);
        const end = endOfMonth(month);

        try {
            const q = query(collection(db, "userActivities"), where("userId", "==", user.uid), where("date", ">=", start), where("date", "<=", end));
            const querySnapshot = await getDocs(q);
            const fetchedActivities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivity));
            fetchedActivities.sort((a, b) => a.date.toMillis() - b.date.toMillis());
            setActivities(fetchedActivities);

            // Now pre-fetch details for all activities in the month
            const flightIds = new Set(fetchedActivities.filter(a => a.flightId).map(a => a.flightId!));
            const trainingIds = new Set(fetchedActivities.filter(a => a.trainingSessionId).map(a => a.trainingSessionId!));
            const allUserIds = new Set<string>();

            const newFlightDetailsMap = new Map<string, FlightWithCrewDetails>();
            const newTrainingDetailsMap = new Map<string, TrainingWithAttendeesDetails>();
            
            const flightPromises = Array.from(flightIds).map(id => getDoc(doc(db, "flights", id)));
            const trainingPromises = Array.from(trainingIds).map(id => getDoc(doc(db, "trainingSessions", id)));
            
            const flightSnaps = await Promise.all(flightPromises);
            const trainingSnaps = await Promise.all(trainingPromises);

            flightSnaps.forEach(snap => {
                if(snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as StoredFlight;
                    if (data.allCrewIds) {
                        data.allCrewIds.forEach(uid => allUserIds.add(uid));
                    }
                    newFlightDetailsMap.set(snap.id, data as FlightWithCrewDetails);
                }
            });
            trainingSnaps.forEach(snap => {
                if(snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as StoredTrainingSession;
                    if (data.attendeeIds) {
                        data.attendeeIds.forEach(uid => allUserIds.add(uid));
                    }
                    newTrainingDetailsMap.set(snap.id, data as TrainingWithAttendeesDetails);
                }
            });
            
            // Fetch all required users in one go
            const newUserMap = new Map(userMap);
            const usersToFetch = Array.from(allUserIds).filter(uid => !newUserMap.has(uid));
            if (usersToFetch.length > 0) {
                const userPromises = usersToFetch.map(uid => getDoc(doc(db, "users", uid)));
                const userSnaps = await Promise.all(userPromises);
                userSnaps.forEach(snap => {
                    if(snap.exists()) newUserMap.set(snap.id, {uid: snap.id, ...snap.data()} as User);
                });
                setUserMap(newUserMap);
            }
            
            // Populate crew/attendee details
            newFlightDetailsMap.forEach(flight => {
                flight.crew = flight.allCrewIds?.map(uid => newUserMap.get(uid)!).filter(Boolean) || [];
            });
            newTrainingDetailsMap.forEach(session => {
                session.attendees = session.attendeeIds?.map(uid => newUserMap.get(uid)!).filter(Boolean) || [];
            });

            setFlightDetailsMap(newFlightDetailsMap);
            setTrainingDetailsMap(newTrainingDetailsMap);

        } catch (error) {
            console.error("Error fetching schedule:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user, userMap]);

    React.useEffect(() => {
        if (!authLoading && user) fetchActivities(currentMonth);
        else if (!authLoading) router.push('/login');
    }, [user, authLoading, router, fetchActivities, currentMonth]);

    const handleShowActivityDetails = (activity: UserActivity) => {
        if (activity.flightId && flightDetailsMap.has(activity.flightId)) {
            setSheetActivity({ type: 'flight', data: flightDetailsMap.get(activity.flightId)! });
            setIsSheetOpen(true);
        } else if (activity.trainingSessionId && trainingDetailsMap.has(activity.trainingSessionId)) {
            setSheetActivity({ type: 'training', data: trainingDetailsMap.get(activity.trainingSessionId)! });
            setIsSheetOpen(true);
        }
    };

    const selectedDayActivities = activities.filter(activity => selectedDay && isSameDay(activity.date.toDate(), selectedDay));

    const activityModifiers = {
        hasActivity: activities.map(a => a.date.toDate()),
    };
    
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
              selectedDayActivities.map(activity => <ActivityCard key={activity.id} activity={activity} onActivityClick={handleShowActivityDetails} />)
            ) : (
              <p className="text-sm text-muted-foreground text-center p-4">No activities scheduled for this day.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="p-4 text-center text-sm text-muted-foreground">Please pick a day.</p>
      );
    
    if (authLoading || (!user && !authLoading)) { return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>; }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg"><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><CalendarIcon className="mr-3 h-7 w-7 text-primary" />My Schedule</CardTitle><CardDescription>View your monthly flight, training, and leave schedule. Click on a flight or training for more details.</CardDescription></CardHeader></Card>
            </AnimatedCard>
            <Card className="shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    <Calendar
                        mode="single"
                        selected={selectedDay}
                        onSelect={setSelectedDay}
                        onMonthChange={setCurrentMonth}
                        modifiers={activityModifiers}
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
            </Card>
            <ActivityDetailsSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} activity={sheetActivity} />
        </div>
    );
}
