
"use client";

import * as React from "react";
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Plane, Briefcase, GraduationCap, Bed, Anchor, Globe, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import type { StoredFlight } from "@/schemas/flight-schema";
import type { StoredTrainingSession } from "@/schemas/training-session-schema";
import { getAirportByCode } from "@/services/airport-service";
import type { UserActivity, ActivityType } from "@/schemas/user-activity-schema";
import type { User as AuthUser } from "@/schemas/user-schema";
import { getUserActivitiesForMonth, type ActivityData } from "@/services/activity-service";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ActivityDetailsSheet, type SheetActivityDetails } from "@/components/features/activity-details-sheet";


// --- UI Configuration ---
const activityConfig: Record<ActivityType, { icon: React.ElementType; label: string; dotColor: string; }> = {
    flight: { icon: Plane, label: "Flight", dotColor: "bg-primary" },
    leave: { icon: Briefcase, label: "Leave", dotColor: "bg-green-500" },
    training: { icon: GraduationCap, label: "Training", dotColor: "bg-yellow-500" },
    'day-off': { icon: Bed, label: "Day Off", dotColor: "bg-gray-500" },
    standby: { icon: Anchor, label: "Standby", dotColor: "bg-orange-500" },
};

// --- Sub-components ---
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
            acc[dateKey] = new Set<string>();
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
              selectedDayActivities.map((activity) => <ActivityCard key={activity.id} activity={activity} onActivityClick={handleShowActivityDetails} view={view}/>)
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
                                <Button variant={view === 'personal' ? 'default' : 'ghost'} size="sm" onClick={() => setView('personal')} className="flex items-center gap-1"><User className="h-4 w-4"/> Personal</Button>
                                <Button variant={view === 'global' ? 'default' : 'ghost'} size="sm" onClick={() => setView('global')} className="flex items-center gap-1"><Globe className="h-4 w-4"/> Global</Button>
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
            <ActivityDetailsSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} activity={sheetActivity} isLoading={isSheetLoading} authUser={user}