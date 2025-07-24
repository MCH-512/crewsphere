
"use server";

import * as React from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type User } from "@/contexts/auth-context";
import { TimelineClient } from "./timeline-client";
import { getTimelineData, type TimelineActivity } from "@/services/timeline-service";

// Main Server Component
export default async function TimelinePage() {
    // We fetch a map of all users ONCE on the server.
    // This is acceptable as the number of crew members is manageable and avoids multiple lookups on the client.
    const usersSnapshot = await getDocs(collection(db, "users"));
    const userMap = new Map<string, User>();
    usersSnapshot.forEach(doc => {
        userMap.set(doc.id, { uid: doc.id, ...doc.data() } as User);
    });

    // We fetch only the activities for the initial month.
    // Subsequent months will be fetched on the client.
    const initialActivities = await getTimelineData(new Date(), userMap);

    return <TimelineClient initialActivities={initialActivities} userMap={userMap} />;
}
