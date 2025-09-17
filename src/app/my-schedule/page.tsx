
"use server";

import * as React from "react";
import { MyScheduleClient } from "./my-schedule-client";
import { getUserActivitiesForMonth } from "@/services/activity-service";
import { getCurrentUser } from "@/lib/session";


export default async function MySchedulePage() {
    const user = await getCurrentUser();
    // Fetch initial activities for the current user for the current month
    const initialActivities = user ? await getUserActivitiesForMonth(new Date(), user.uid) : [];

    return <MyScheduleClient initialActivities={initialActivities} />;
}
