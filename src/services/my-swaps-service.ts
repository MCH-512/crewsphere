
'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import type { StoredFlightSwap } from "@/schemas/flight-swap-schema";

export async function getMySwaps(userId: string): Promise<StoredFlightSwap[]> {
    if (!isConfigValid || !db) {
        console.error("Firebase is not configured. Cannot fetch swaps.");
        return [];
    }

    if (!userId) {
        return [];
    }

    try {
        const swapsQuery = query(
            collection(db, "flightSwaps"),
            where("initiatingUserId", "==", userId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(swapsQuery);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap));
    } catch (error) {
        console.error("Error fetching user's flight swaps:", error);
        // In a real app, you might want to handle this error more gracefully
        return [];
    }
}
