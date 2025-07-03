
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Loader2, Plane, Briefcase, GraduationCap, Bed, Anchor } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";

interface UserActivity {
  id: string;
  activityType: 'flight' | 'leave' | 'training' | 'standby' | 'day-off';
  date: Timestamp;
  comments?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
}

const activityConfig: Record<UserActivity['activityType'], { icon: React.ElementType; label: string; className: string; dotColor: string; }> = {
    flight: { icon: Plane, label: "Flight", className: "border-blue-500", dotColor: "bg-blue-500" },
    leave: { icon: Briefcase, label: "Leave", className: "border-green-500", dotColor: "bg-green-500" },
    training: { icon: GraduationCap, label: "Training", className: "border-yellow-500", dotColor: "bg-yellow-500" },
    'day-off': { icon: Bed, label: "Day Off", className: "border-gray-500", dotColor: "bg-gray-500" },
    standby: { icon: Anchor, label: "Standby", className: "border-orange-500", dotColor: "bg-orange-500" },
};

export default function MySchedulePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [activities, setActivities] = React.useState<UserActivity[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(new Date());

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
    
    const ActivityCard = ({ activity }: { activity: UserActivity }) => {
        const config = activityConfig[activity.activityType];
        const Icon = config.icon;
        return (
            <div className={`p-3 mb-2 border-l-4 rounded-r-md flex items-start gap-4 bg-muted/30 ${config.className}`}>
                <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
                <div className="flex-grow">
                    <p className="font-semibold">{config.label}</p>
                    <div className="text-sm text-muted-foreground">
                        {activity.activityType === 'flight' && `Flight ${activity.flightNumber || 'N/A'}: ${activity.departureAirport || 'N/A'} → ${activity.arrivalAirport || 'N/A'}`}
                        {activity.comments && <p>{activity.comments}</p>}
                    </div>
                </div>
            </div>
        )
    };

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
                        <CardDescription>View your monthly flight, training, and leave schedule.</CardDescription>
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
                                selectedDayActivities.map(activity => <ActivityCard key={activity.id} activity={activity} />)
                            ) : (
                                <p className="text-sm text-muted-foreground text-center p-4">No activities scheduled for this day.</p>
                            )}
                        </CardContent>
                    </Card>
                </AnimatedCard>
            </div>
        </div>
    );
}
