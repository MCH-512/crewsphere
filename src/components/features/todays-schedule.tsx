
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Plane, Briefcase, GraduationCap, Bed, Anchor, Loader2 } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

interface TodayActivity {
  activityType: 'flight' | 'leave' | 'training' | 'standby' | 'day-off';
  comments?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
}

const activityConfig: Record<TodayActivity['activityType'], { icon: React.ElementType; label: string; }> = {
    flight: { icon: Plane, label: "Flight" },
    leave: { icon: Briefcase, label: "Leave" },
    training: { icon: GraduationCap, label: "Training" },
    'day-off': { icon: Bed, label: "Day Off" },
    standby: { icon: Anchor, label: "Standby" },
};

export function TodaysScheduleCard() {
    const { user } = useAuth();
    const [activities, setActivities] = React.useState<TodayActivity[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const getTodayActivities = async () => {
            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());
            
            try {
                const q = query(
                    collection(db, "userActivities"),
                    where("userId", "==", user.uid),
                    where("date", ">=", todayStart),
                    where("date", "<=", todayEnd)
                );
                const querySnapshot = await getDocs(q);
                console.log(`Fetched ${querySnapshot.size} activities for today for user ${user.uid}.`);
                if (!querySnapshot.empty) {
                    setActivities(querySnapshot.docs.map(doc => doc.data() as TodayActivity));
                }
            } catch (error) {
                console.error("Error fetching today's schedule:", error);
            } finally {
                setIsLoading(false);
            }
        };

        getTodayActivities();

    }, [user]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-start gap-4">
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mt-1" />
                    <div>
                        <p className="font-semibold">Loading Schedule...</p>
                        <div className="text-sm text-muted-foreground">
                            <p>Checking your agenda for today.</p>
                        </div>
                    </div>
                </div>
            );
        }
        
        if (activities.length === 0) {
            return (
                 <div className="flex items-start gap-4">
                    <Bed className="h-6 w-6 text-primary mt-1" />
                    <div>
                        <p className="font-semibold">No Scheduled Activities</p>
                        <div className="text-sm text-muted-foreground">
                            <p>Enjoy your day!</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {activities.map((activity, index) => {
                    const config = activityConfig[activity.activityType];
                    const Icon = config.icon;
                    return (
                        <div key={index} className="flex items-start gap-4">
                            <Icon className="h-6 w-6 text-primary mt-1" />
                            <div>
                                <p className="font-semibold">{config.label}</p>
                                <div className="text-sm text-muted-foreground">
                                    {activity.activityType === 'flight' && `Flight ${activity.flightNumber || 'N/A'}: ${activity.departureAirport || 'N/A'} → ${activity.arrivalAirport || 'N/A'}`}
                                    {activity.comments && <p>{activity.comments}</p>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <Card className="h-full shadow-md hover:shadow-lg transition-shadow flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5" />
                    Today's Schedule
                </CardTitle>
                <CardDescription>{format(new Date(), "EEEE, PPP")}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                {renderContent()}
            </CardContent>
        </Card>
    );
}
