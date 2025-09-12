
"use server";

import * as React from "react";
import { MyScheduleClient } from "./my-schedule-client";
import { getUserActivitiesForMonth } from "@/services/user-activity-service";
import { getCurrentUser } from "@/lib/session";


export default async function MySchedulePage() {
    const user = await getCurrentUser();
    const initialActivities = user ? await getUserActivitiesForMonth(user.uid, new Date()) : [];

    return <MyScheduleClient initialActivities={initialActivities} />;
}
