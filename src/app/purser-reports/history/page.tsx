'use server';

import * as React from "react";
import { PurserReportsHistoryClient } from "./purser-reports-history-client";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import type { StoredPurserReport } from "@/schemas/purser-report-schema";
import { redirect } from "next/navigation";


async function getHistory() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    try {
        const q = query(
            collection(db, "purserReports"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        // Correctly serialize Timestamps to strings for the client component
        return querySnapshot.docs.map(doc => {
            const data = doc.data() as StoredPurserReport;
            return { 
                ...data,
                id: doc.id,
                createdAt: data.createdAt.toDate().toISOString(),
                // Ensure other potential Timestamps are handled if necessary
                updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : undefined,
                flightDate: data.flightDate, // Already a string
            };
        });
    } catch (err) {
        console.error("Error fetching reports:", err);
        return [];
    }
}

export default async function PurserReportsHistoryPage() {
    const reports = await getHistory();
    return <PurserReportsHistoryClient initialReports={reports as any} />;
}
