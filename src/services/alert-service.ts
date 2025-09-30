import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { StoredAlert } from "@/schemas/alert-schema";
import { getCurrentUser } from "@/lib/session";
import { z } from 'zod';

const EmptySchema = z.object({});


/**
 * Fetches all alerts, ordered by creation date.
 * This is a server-only function intended for admin use.
 * @returns A promise that resolves to an array of StoredAlert.
 */
export async function getAlerts(): Promise<StoredAlert[]> {
    EmptySchema.parse({}); // Zod validation for function with no args
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        console.error("Unauthorized or unconfigured attempt to fetch alerts.");
        return [];
    }

    try {
        const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedAlerts = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as StoredAlert));
        return fetchedAlerts;
    } catch (err) {
        console.error("Error fetching alerts:", err);
        return [];
    }
}