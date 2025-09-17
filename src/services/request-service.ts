'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { StoredUserRequest } from "@/schemas/request-schema";
import { getCurrentUser } from "@/lib/session";

/**
 * Fetches all user requests, ordered by creation date.
 * This is a server-only function intended for admin use.
 * @returns A promise that resolves to an array of StoredUserRequest.
 */
export async function fetchUserRequests(): Promise<StoredUserRequest[]> {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        console.error("Unauthorized or unconfigured attempt to fetch user requests.");
        return [];
    }

    try {
        const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as StoredUserRequest));
    } catch (err) {
        console.error("Error fetching user requests:", err);
        return [];
    }
}
