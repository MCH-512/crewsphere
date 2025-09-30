
'use server';

import * as React from "react";
import { MyScheduleClient } from "./my-schedule-client";
import { getUserActivitiesForMonth } from "@/services/activity-service";
import { getCurrentUser } from "@/lib/session";
import { z } from 'zod';

// Zod schema for functions that take no arguments
const EmptySchema = z.object({});

export default async function MySchedulePage() {
    EmptySchema.parse({}); // Zod validation
    const user = await getCurrentUser();
    // Fetch initial activities for the current user for the current month
    const initialActivities = user ? await getUserActivitiesForMonth(new Date(), user.uid) : [];

    return <MyScheduleClient initialActivities={initialActivities} />;
}
