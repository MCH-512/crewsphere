
"use client";

import * as React from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CalendarCheck, Plane, Briefcase, GraduationCap, Bed, Anchor } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

// Simplified activity type for this component
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
    const [activity, setActivity] = React.useState<TodayActivity | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const fetchTodayActivity = async () => {
            setIsLoading(true);
            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());

            try {
                const q = query(
                    collection(db, "userActivities"),
                    where("userId", "==", user.uid),
                    where("date", ">=", todayStart),
                    where("date", "<=", todayEnd),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setActivity(querySnapshot.docs[0].data() as TodayActivity);
                } else {
                    // If no specific activity, assume it's a day off for display purposes.
                    setActivity({ activityType: 'day-off', comments: 'No scheduled activities' });
                }
            } catch (error) {
                console.error("Error fetching today's schedule:", error);
                setActivity(null); // Or some error state
            } finally {
                setIsLoading(false);
            }
        };

        fetchTodayActivity();
    }, [user]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            );
        }

        if (!activity) {
            return <p className="text-sm text-muted-foreground">No schedule information available.</p>;
        }

        const config = activityConfig[activity.activityType];
        const Icon = config.icon;

        return (
            <div className="flex items-start gap-4">
                <Icon className="h-8 w-8 text-primary mt-1" />
                <div>
                    <p className="font-semibold text-lg">{config.label}</p>
                    <div className="text-sm text-muted-foreground">
                        {activity.activityType === 'flight' && `Flight ${activity.flightNumber || 'N/A'}: ${activity.departureAirport || 'N/A'} → ${activity.arrivalAirport || 'N/A'}`}
                        {activity.activityType === 'leave' && (activity.comments || "On approved leave.")}
                        {activity.activityType === 'training' && (activity.comments || "Scheduled training session.")}
                        {activity.activityType === 'standby' && (activity.comments || "On standby duty.")}
                        {activity.activityType === 'day-off' && "Enjoy your day off!"}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5" />
                    Today's Schedule
                </CardTitle>
                <CardDescription>{format(new Date(), "EEEE, PPP")}</CardDescription>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}
