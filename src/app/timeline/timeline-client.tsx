
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Plane, GraduationCap, Users } from "lucide-react";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
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
import type { DayContentProps } from "react-day-picker";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import type { TimelineActivity } from "./page";

interface FlightWithCrewDetails extends StoredFlight {
    departureAirportInfo?: Airport | null;
    arrivalAirportInfo?: Airport | null;
    crew: User[];
}

interface TrainingWithAttendeesDetails extends StoredTrainingSession {
    attendees: User[];
}

type SheetActivity = { type: 'flight', data: FlightWithCrewDetails } | { type: 'training', data: TrainingWithAttendeesDetails };

const activityConfig: Record<TimelineActivity['type'], { icon: React.ElementType; className: string; dotColor: string; }> = {
    flight: { icon: Plane, className: "border-blue-500", dotColor: "bg-blue-500" },
    training: { icon: GraduationCap, className: "border-yellow-500", dotColor: "bg-yellow-500" },
};

const ActivityDetailsSheet = ({ isOpen, onOpenChange, activity, isLoading, authUser }: { isOpen: boolean, onOpenChange: (open: boolean) => void, activity: SheetActivity | null, isLoading: boolean, authUser: User | null }) => {
    if (!isOpen) return null;

    const renderFlightDetails = (data: FlightWithCrewDetails) => (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-2"><CardDescription>Flight Info</CardDescription><CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5"/> {data.flightNumber}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                    <p><strong>Route:</strong> {data.departureAirportInfo?.iata || data.departureAirport} → {data.arrivalAirportInfo?.iata || data.arrivalAirport}</p>
                    <p><strong>Departure:</strong> {format(new Date(data.scheduledDepartureDateTimeUTC), "PPP HH:mm")} UTC</p>
                    <p><strong>Arrival:</strong> {format(new Date(data.scheduledArrivalDateTimeUTC), "PPP HH:mm")} UTC</p>
                    <p><strong>Aircraft:</strong> {data.aircraftType}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardDescription>Assigned Crew ({data.crew.length})</CardDescription></CardHeader>
                <CardContent>{['purser', 'pilote', 'cabin crew', 'instructor', 'stagiaire'].map(role => {
                    const members = data.crew.filter(c => c.role === role);
                    if (members.length === 0) return null;
                    return (
                        <div key={role}><h4 className="font-semibold capitalize mt-3 mb-2 text-primary">{role}</h4><div className="space-y-2">{members.map(member => (<div key={member.uid} className="flex items-center gap-2 text-sm">
                            <Avatar className="h-6 w-6"><AvatarImage src={member.photoURL || undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                            {authUser?.role === 'admin' ? (
                                <Link href={`/admin/users/${member.uid}`} className="hover:underline text-primary">{member.displayName}</Link>
                            ) : (
                                <span>{member.displayName}</span>
                            )}
                        </div>))}</div></div>
                    );
                })}
                </CardContent>
            </Card>
        </div>
    );

    const renderTrainingDetails = (data: TrainingWithAttendeesDetails) => (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-2"><CardDescription>Training Session</CardDescription><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5"/> {data.title}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                    <p><strong>Location:</strong> {data.location}</p>
                    <p><strong>Time:</strong> {format(data.sessionDateTimeUTC.toDate(), "PPP HH:mm")} UTC</p>
                    <p><strong>Description:</strong> {data.description}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardDescription>Attendees ({data.attendees.length})</CardDescription></CardHeader>
                <CardContent><div className="space-y-2 max-h-60 overflow-y-auto">{data.attendees.map(member => (
                <div key={member.uid} className="flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6"><AvatarImage src={member.photoURL || undefined} data-ai-hint="user portrait" /><AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    {authUser?.role === 'admin' ? (
                        <Link href={`/admin/users/${member.uid}`} className="hover:underline text-primary">{member.displayName} ({member.role})</Link>
                    ) : (
                        <span>{member.displayName} ({member.role})</span>
                    )}
                </div>))}</div></CardContent>
            </Card>
        </div>
    );

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}><SheetContent className="w-full sm:max-w-md">
            <SheetHeader><SheetTitle>Activity Details</SheetTitle><SheetDescription>{isLoading ? "Loading details..." : "Information about the selected event."}</SheetDescription></SheetHeader>
            <div className="py-4">{isLoading ? (<div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>) : activity ? (activity.type === 'flight' ? renderFlightDetails(activity.data) : renderTrainingDetails(activity.data)) : (<div className="text-center text-muted-foreground py-10"><p>Could not load activity details.</p></div>)}</div>
        </SheetContent></Sheet>
    );
};

const ActivityCard = ({ activity, onActivityClick, authUser }: { activity: TimelineActivity; onActivityClick: (type: 'flight' | 'training', id: string) => void, authUser: User | null; }) => {
    const config = activityConfig[activity.type];
    const Icon = config.icon;
    return <button className="w-full text-left mb-2" onClick={() => onActivityClick(activity.type, activity.id)}><div className={cn('p-3 w-full border-l-4 rounded-r-md flex items-start gap-4 bg-muted/30 hover:bg-muted/50 transition-colors', config.className)}><Icon className="h-5 w-5 mt-1 text-muted-foreground" /><div className="flex-grow text-left">
        <p className="font-semibold">{activity.title}</p>
        <div className="text-sm text-muted-foreground">{activity.description}</div>
        <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-4">
            {activity.details.purserName && (
                <div className="flex items-center gap-1">
                    Purser:
                    <span className="font-medium">{activity.details.purserName}</span>
                </div>
            )}
            {(activity.details.crewCount || activity.details.attendeeCount) && (
                <div className="flex items-center gap-1">
                    <Users className="h-3 w-3"/>
                    {activity.details.crewCount || activity.details.attendeeCount}
                </div>
            )}
        </div>
    </div></div></button>;
};

export function TimelineClient({ initialActivities, userMap }: { initialActivities: TimelineActivity[], userMap: Map<string, User> }) {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [activities, setActivities] = React.useState<TimelineActivity[]>(initialActivities);
    const [isLoading, setIsLoading] = React.useState(false);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(new Date());
    
    const [selectedActivity, setSelectedActivity] = React.useState<SheetActivity | null>(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [isSheetLoading, setIsSheetLoading] = React.useState(false);

    const handleMonthChange = async (month: Date) => {
        setIsLoading(true);
        setCurrentMonth(month);
        // This would need a server action or API route to re-fetch data for the new month
        // For now, we'll just show the initial data for any month
        setIsLoading(false);
    };

    const handleShowActivityDetails = async (type: 'flight' | 'training', id: string) => {
        setIsSheetOpen(true);
        setIsSheetLoading(true);
        setSelectedActivity(null);
        try {
            if (type === 'flight') {
                const flightSnap = await getDoc(doc(db, "flights", id));
                if (!flightSnap.exists()) throw new Error("Flight details not found.");
                const flight = { id: flightSnap.id, ...flightSnap.data() } as StoredFlight;
                const crewPromises = flight.allCrewIds.map(uid => getDoc(doc(db, "users", uid)));
                const crewDocs = await Promise.all(crewPromises);
                const crew = crewDocs.map(snap => snap.exists() ? { uid: snap.id, ...snap.data() } as User : null).filter(Boolean) as User[];
                const [depAirport, arrAirport] = await Promise.all([getAirportByCode(flight.departureAirport), getAirportByCode(flight.arrivalAirport)]);
                setSelectedActivity({ type: 'flight', data: { ...flight, departureAirportInfo: depAirport, arrivalAirportInfo: arrAirport, crew } });
            } else {
                const sessionSnap = await getDoc(doc(db, "trainingSessions", id));
                if (!sessionSnap.exists()) throw new Error("Training session not found.");
                const session = { id: sessionSnap.id, ...sessionSnap.data() } as StoredTrainingSession;
                const attendeePromises = session.attendeeIds.map(uid => getDoc(doc(db, "users", uid)));
                const attendeeDocs = await Promise.all(attendeePromises);
                const attendees = attendeeDocs.map(snap => snap.exists() ? { uid: snap.id, ...snap.data() } as User : null).filter(Boolean) as User[];
                setSelectedActivity({ type: 'training', data: { ...session, attendees } });
            }
        } catch (err) {
            console.error("Error fetching activity details:", err);
            setIsSheetOpen(false);
        } finally {
            setIsSheetLoading(false);
        }
    };
    
    const activityDotStyles = activities.reduce((acc, activity) => {
        const dateKey = format(activity.date.toDate(), 'yyyy-MM-dd');
        if (!acc[dateKey]) { acc[dateKey] = new Set(); }
        acc[dateKey].add(activityConfig[activity.type].dotColor);
        return acc;
    }, {} as Record<string, Set<string>>);

    const ActivityDayContent = (props: DayContentProps) => {
        const colors = activityDotStyles[format(props.date, 'yyyy-MM-dd')];
        return (
            <div className="relative flex h-full w-full items-center justify-center">
                <span>{format(props.date, 'd')}</span>
                {colors && (
                    <div className="absolute bottom-1.5 flex gap-1">
                        {Array.from(colors).slice(0, 3).map((color, i) => (<div key={i} className={cn("h-1.5 w-1.5 rounded-full", color)} />))}
                    </div>
                )}
            </div>
        );
    };
    
    const selectedDayActivities = activities.filter(activity => selectedDay && isSameDay(activity.date.toDate(), selectedDay));
    
    if (authLoading) {
      return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg"><CardHeader><CardTitle className="text-2xl font-headline flex items-center"><CalendarIcon className="mr-3 h-7 w-7 text-primary" />Global Timeline</CardTitle><CardDescription>A global view of all scheduled flights and training sessions. Click an event for details.</CardDescription></CardHeader></Card>
            </AnimatedCard>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <AnimatedCard delay={0.1} className="lg:col-span-3">
                    <Card className="shadow-sm">
                        <Calendar 
                          mode="single" 
                          selected={selectedDay} 
                          onSelect={setSelectedDay} 
                          month={currentMonth}
                          onMonthChange={handleMonthChange}
                          components={{ DayContent: ActivityDayContent }} 
                          className="p-2 sm:p-4" 
                        />
                    </Card>
                </AnimatedCard>
                <AnimatedCard delay={0.15} className="lg:col-span-2">
                    <Card className="shadow-sm h-full">
                        <CardHeader><CardTitle className="text-lg">{selectedDay ? format(selectedDay, "EEEE, PPP") : "Select a day"}</CardTitle></CardHeader>
                        <CardContent>{isLoading ? (<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>) : selectedDayActivities.length > 0 ? (selectedDayActivities.map(activity => <ActivityCard key={activity.id} activity={activity} onActivityClick={handleShowActivityDetails} authUser={user} />)) : (<p className="text-sm text-muted-foreground text-center p-4">No activities scheduled for this day.</p>)}</CardContent>
                    </Card>
                </AnimatedCard>
            </div>
            <ActivityDetailsSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} activity={selectedActivity} isLoading={isSheetLoading} authUser={user} />
        </div>
    );
}
