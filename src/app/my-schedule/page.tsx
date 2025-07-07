
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Plane, Briefcase, GraduationCap, Bed, Anchor, Users } from "lucide-react";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type StoredFlight } from "@/schemas/flight-schema";
import { getAirportByCode, type Airport } from "@/services/airport-service";

interface UserActivity {
  id: string;
  activityType: 'flight' | 'leave' | 'training' | 'standby' | 'day-off';
  date: Timestamp;
  comments?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  flightId?: string;
}

interface FlightWithCrewDetails extends StoredFlight {
    departureAirportInfo?: Airport | null;
    arrivalAirportInfo?: Airport | null;
    crew: User[];
}

const activityConfig: Record<UserActivity['activityType'], { icon: React.ElementType; label: string; className: string; dotColor: string; }> = {
    flight: { icon: Plane, label: "Flight", className: "border-blue-500", dotColor: "bg-blue-500" },
    leave: { icon: Briefcase, label: "Leave", className: "border-green-500", dotColor: "bg-green-500" },
    training: { icon: GraduationCap, label: "Training", className: "border-yellow-500", dotColor: "bg-yellow-500" },
    'day-off': { icon: Bed, label: "Day Off", className: "border-gray-500", dotColor: "bg-gray-500" },
    standby: { icon: Anchor, label: "Standby", className: "border-orange-500", dotColor: "bg-orange-500" },
};

const FlightDetailsSheet = ({ isOpen, onOpenChange, flight, isLoading }: { isOpen: boolean, onOpenChange: (open: boolean) => void, flight: FlightWithCrewDetails | null, isLoading: boolean }) => {
    if (!isOpen) return null;

    const renderCrewList = (role: User['role']) => {
        const members = flight?.crew.filter(c => c.role === role);
        if (!members || members.length === 0) return null;

        return (
            <div>
                <h4 className="font-semibold capitalize mt-3 mb-2 text-primary">{role}</h4>
                <div className="space-y-2">
                    {members.map(member => (
                        <div key={member.uid} className="flex items-center gap-2 text-sm">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={member.photoURL || undefined} data-ai-hint="user portrait" />
                                <AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span>{member.displayName}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Flight Details</SheetTitle>
                    <SheetDescription>
                        {isLoading ? "Loading flight information..." : `Details for flight ${flight?.flightNumber}.`}
                    </SheetDescription>
                </SheetHeader>
                <div className="py-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : flight ? (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Flight Info</CardDescription>
                                    <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5"/> {flight.flightNumber}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm space-y-1">
                                    <p><strong>Route:</strong> {flight.departureAirportInfo?.iata || flight.departureAirport} → {flight.arrivalAirportInfo?.iata || flight.arrivalAirport}</p>
                                    <p><strong>Departure:</strong> {format(new Date(flight.scheduledDepartureDateTimeUTC), "PPP HH:mm")} UTC</p>
                                    <p><strong>Arrival:</strong> {format(new Date(flight.scheduledArrivalDateTimeUTC), "PPP HH:mm")} UTC</p>
                                    <p><strong>Aircraft:</strong> {flight.aircraftType}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                     <CardDescription>Assigned Crew</CardDescription>
                                     <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/> {flight.crew.length} Members</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {renderCrewList('purser')}
                                    {renderCrewList('pilote')}
                                    {renderCrewList('cabin crew')}
                                    {renderCrewList('instructor')}
                                    {renderCrewList('stagiaire')}
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-10">
                            <p>Could not load flight details.</p>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};


const ActivityCard = ({ activity, onFlightClick }: { activity: UserActivity; onFlightClick: (flightId: string) => void }) => {
    const config = activityConfig[activity.activityType];
    const Icon = config.icon;
    const isClickable = activity.activityType === 'flight' && activity.flightId;
    
    const content = (
        <div className={cn('p-3 w-full border-l-4 rounded-r-md flex items-start gap-4 bg-muted/30', config.className, isClickable && 'hover:bg-muted/50 transition-colors')}>
            <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
            <div className="flex-grow text-left">
                <p className="font-semibold">{config.label}</p>
                <div className="text-sm text-muted-foreground">
                    {activity.activityType === 'flight' && `Flight ${activity.flightNumber || 'N/A'}: ${activity.departureAirport || 'N/A'} → ${activity.arrivalAirport || 'N/A'}`}
                    {activity.comments && <p>{activity.comments}</p>}
                </div>
            </div>
        </div>
    );

    if (isClickable) {
        return <button className="w-full text-left mb-2" onClick={() => onFlightClick(activity.flightId!)}>{content}</button>
    }

    return <div className="mb-2">{content}</div>;
};

export default function MySchedulePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [activities, setActivities] = React.useState<UserActivity[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(new Date());
    
    const [selectedFlight, setSelectedFlight] = React.useState<FlightWithCrewDetails | null>(null);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [isSheetLoading, setIsSheetLoading] = React.useState(false);

    const fetchActivities = React.useCallback(async (month: Date) => {
        if (!user) return;
        setIsLoading(true);
        const start = startOfMonth(month);
        const end = endOfMonth(month);

        try {
            const q = query(
                collection(db, "userActivities"),
                where("userId", "==", user.uid),
                where("date", ">=", start),
                where("date", "<=", end)
            );
            const querySnapshot = await getDocs(q);
            const fetchedActivities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivity));
            fetchedActivities.sort((a, b) => a.date.toMillis() - b.date.toMillis());
            setActivities(fetchedActivities);
        } catch (error) {
            console.error("Error fetching schedule:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
            } else {
                fetchActivities(currentMonth);
            }
        }
    }, [user, authLoading, router, fetchActivities, currentMonth]);

    const handleShowFlightDetails = async (flightId: string) => {
        if (!flightId) return;

        setIsSheetOpen(true);
        setIsSheetLoading(true);
        setSelectedFlight(null);

        try {
            const flightDocRef = doc(db, "flights", flightId);
            const flightSnap = await getDoc(flightDocRef);
            if (!flightSnap.exists()) {
                throw new Error("Flight details not found.");
            }
            const flight = { id: flightSnap.id, ...flightSnap.data() } as StoredFlight;

            const crewIds = Array.from(new Set([
                flight.purserId,
                ...(flight.pilotIds || []),
                ...(flight.cabinCrewIds || []),
                ...(flight.instructorIds || []),
                ...(flight.traineeIds || []),
            ].filter(Boolean)));

            const crewPromises = crewIds.map(uid => getDoc(doc(db, "users", uid)));
            const crewDocs = await Promise.all(crewPromises);
            const crew = crewDocs.map(snap => snap.exists() ? { uid: snap.id, ...snap.data() } as User : null).filter(Boolean) as User[];
            
            const [depAirport, arrAirport] = await Promise.all([
                getAirportByCode(flight.departureAirport),
                getAirportByCode(flight.arrivalAirport),
            ]);

            setSelectedFlight({
                ...flight,
                departureAirportInfo: depAirport,
                arrivalAirportInfo: arrAirport,
                crew,
            });

        } catch (err) {
            console.error("Error fetching flight details:", err);
            setIsSheetOpen(false);
        } finally {
            setIsSheetLoading(false);
        }
    };
    
    const ActivityDay = ({ date }: { date: Date }) => {
        const dayActivities = activities.filter(a => a.date.toDate().toDateString() === date.toDateString());
        return (
            <div className="relative h-full w-full flex items-center justify-center">
                {date.getDate()}
                {dayActivities.length > 0 && (
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                        {dayActivities.slice(0, 3).map(activity => (
                            <div key={activity.id} className={cn("h-1.5 w-1.5 rounded-full", activityConfig[activity.activityType]?.dotColor)} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const selectedDayActivities = activities.filter(
        activity => selectedDay && activity.date.toDate().toDateString() === selectedDay.toDateString()
    );

    if (authLoading || (!user && !authLoading)) {
      return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <CalendarIcon className="mr-3 h-7 w-7 text-primary" />
                            My Schedule
                        </CardTitle>
                        <CardDescription>View your monthly flight, training, and leave schedule. Click on a flight for more details.</CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <AnimatedCard delay={0.1} className="lg:col-span-3">
                    <Card className="shadow-sm">
                        <Calendar
                            mode="single"
                            selected={selectedDay}
                            onSelect={setSelectedDay}
                            onMonthChange={setCurrentMonth}
                            components={{ Day: ActivityDay }}
                            className="p-2 sm:p-4"
                        />
                    </Card>
                </AnimatedCard>
                <AnimatedCard delay={0.15} className="lg:col-span-2">
                    <Card className="shadow-sm h-full">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                {selectedDay ? format(selectedDay, "EEEE, PPP") : "Select a day"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : selectedDayActivities.length > 0 ? (
                                selectedDayActivities.map(activity => <ActivityCard key={activity.id} activity={activity} onFlightClick={handleShowFlightDetails} />)
                            ) : (
                                <p className="text-sm text-muted-foreground text-center p-4">No activities scheduled for this day.</p>
                            )}
                        </CardContent>
                    </Card>
                </AnimatedCard>
            </div>
             <FlightDetailsSheet
                isOpen={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                flight={selectedFlight}
                isLoading={isSheetLoading}
            />
        </div>
    );
}
