
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Plane, Briefcase, GraduationCap, Bed, Anchor, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { getTodayActivities, type TodayActivity } from "@/services/schedule-service";

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

        const fetchTodayActivities = async () => {
            setIsLoading(true);
            try {
                const todayActivities = await getTodayActivities();
                setActivities(todayActivities);
            } catch (error) {
                console.error("Error fetching today's schedule:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTodayActivities();
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
