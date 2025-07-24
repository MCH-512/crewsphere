
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
        const initiatedSwapsQuery = query(
            collection(db, "flightSwaps"),
            where("initiatingUserId", "==", userId),
            orderBy("createdAt", "desc")
        );
        
        const requestedSwapsQuery = query(
            collection(db, "flightSwaps"),
            where("requestingUserId", "==", userId),
            orderBy("createdAt", "desc")
        );

        const [initiatedSnapshot, requestedSnapshot] = await Promise.all([
            getDocs(initiatedSwapsQuery),
            getDocs(requestedSwapsQuery)
        ]);
        
        const swapsMap = new Map<string, StoredFlightSwap>();

        initiatedSnapshot.docs.forEach(doc => {
            swapsMap.set(doc.id, { id: doc.id, ...doc.data() } as StoredFlightSwap);
        });

        requestedSnapshot.docs.forEach(doc => {
            // Avoid duplicates if a user somehow swapped with themselves
            if (!swapsMap.has(doc.id)) {
                swapsMap.set(doc.id, { id: doc.id, ...doc.data() } as StoredFlightSwap);
            }
        });

        const allSwaps = Array.from(swapsMap.values());
        allSwaps.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        
        return allSwaps;

    } catch (error) {
        console.error("Error fetching user's flight swaps:", error);
        // In a real app, you might want to handle this error more gracefully
        throw new Error("Could not retrieve your flight swap history.");
    }
}
