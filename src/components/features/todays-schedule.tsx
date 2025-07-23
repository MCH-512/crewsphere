
"use server";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Plane, Briefcase, GraduationCap, Bed, Anchor } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { getCurrentUser } from "@/lib/session";

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

async function getTodayActivities(userId: string | undefined): Promise<TodayActivity[]> {
    if (!userId) {
        return [];
    }
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    try {
        const q = query(
            collection(db, "userActivities"),
            where("userId", "==", userId),
            where("date", ">=", todayStart),
            where("date", "<=", todayEnd)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs.map(doc => doc.data() as TodayActivity);
        }
        return [];
    } catch (error) {
        console.error("Error fetching today's schedule:", error);
        return [];
    }
}


export async function TodaysScheduleCard() {
    const user = await getCurrentUser();
    const activities = await getTodayActivities(user?.uid);

    const renderContent = () => {
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
