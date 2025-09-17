
'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import type { StoredPurserReport } from "@/schemas/purser-report-schema";
import { getCurrentUser } from "@/lib/session";

/**
 * Fetches all purser reports, ordered by creation date.
 * This is a server-only function intended for admin use.
 * @returns A promise that resolves to an array of StoredPurserReport.
 */
export async function fetchPurserReports(): Promise<StoredPurserReport[]> {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        console.error("Unauthorized or unconfigured attempt to fetch reports.");
        return [];
    }

    try {
        const q = query(collection(db, "purserReports"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedReports = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as StoredPurserReport));
        return fetchedReports;
    } catch (err) {
        console.error("Error fetching purser reports:", err);
        return []; // Return empty array on error to prevent page crashes
    }
}
