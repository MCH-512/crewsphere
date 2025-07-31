
'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, updateDoc, writeBatch, serverTimestamp, deleteDoc, query, where, orderBy } from "firebase/firestore";
import { StoredFlight } from "@/schemas/flight-schema";
import { User } from "@/contexts/auth-context";
import { logAuditEvent } from "@/lib/audit-logger";
import type { StoredFlightSwap } from "@/schemas/flight-swap-schema";


/**
 * Creates a request to swap a flight.
 * @param swapId The ID of the `flightSwaps` document to update.
 * @param requestingFlight The flight being offered in exchange.
 * @param user The user making the request.
 */
export async function requestFlightSwap(swapId: string, requestingFlight: StoredFlight, user: User): Promise<void> {
    if (!isConfigValid || !db) {
        throw new Error("Firebase is not configured.");
    }
    
    const swapDocRef = doc(db, "flightSwaps", swapId);
    
    try {
        await updateDoc(swapDocRef, {
            status: "pending_approval",
            requestingUserId: user.uid,
            requestingUserEmail: user.email,
            requestingFlightId: requestingFlight.id,
            requestingFlightInfo: {
                flightNumber: requestingFlight.flightNumber,
                departureAirport: requestingFlight.departureAirport,
                arrivalAirport: requestingFlight.arrivalAirport,
                scheduledDepartureDateTimeUTC: requestingFlight.scheduledDepartureDateTimeUTC,
            },
            updatedAt: serverTimestamp(),
        });
        
        await logAuditEvent({
            userId: user.uid,
            userEmail: user.email || 'N/A',
            actionType: 'REQUEST_FLIGHT_SWAP',
            entityType: 'FLIGHT_SWAP',
            entityId: swapId,
            details: `Requested to swap flight ${requestingFlight.flightNumber}`
        });

    } catch (error) {
        console.error("Error requesting flight swap:", error);
        throw new Error("Could not submit your swap request.");
    }
}

/**
 * Cancels a flight swap that the user initiated.
 * @param swapId The ID of the `flightSwaps` document to cancel.
 * @param userId The UID of the user initiating the cancellation.
 */
export async function cancelMySwap(swapId: string, userId: string): Promise<void> {
    if (!isConfigValid || !db) {
        throw new Error("Firebase is not configured.");
    }
    
    const swapDocRef = doc(db, "flightSwaps", swapId);

    try {
        const swapDoc = await getDoc(swapDocRef);
        if (!swapDoc.exists()) {
            throw new Error("Swap does not exist.");
        }

        if (swapDoc.data().initiatingUserId !== userId) {
            throw new Error("You can only cancel swaps that you initiated.");
        }

        // Using update instead of delete to keep a record.
        await updateDoc(swapDocRef, {
            status: "cancelled",
            updatedAt: serverTimestamp(),
        });

        await logAuditEvent({
            userId,
            actionType: 'CANCEL_FLIGHT_SWAP',
            entityType: 'FLIGHT_SWAP',
            entityId: swapId,
        });

    } catch (error) {
        console.error("Error cancelling flight swap:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Could not cancel your swap post.");
    }
}


/**
 * Fetches all flight swaps relevant to a specific user (initiated or requested by them).
 * This function now fetches all swaps and filters client-side to ensure robustness
 * and avoid complex index-dependent queries that can fail.
 * @param userId The UID of the user whose swaps to fetch.
 * @returns A promise that resolves to an array of StoredFlightSwap.
 */
export async function getMySwaps(userId: string): Promise<StoredFlightSwap[]> {
    if (!isConfigValid || !db) {
        console.error("Firebase is not configured. Cannot fetch swaps.");
        return [];
    }

    if (!userId) {
        return [];
    }

    try {
        // Fetch ALL swaps. This is a robust query that doesn't need a special index.
        const allSwapsQuery = query(collection(db, "flightSwaps"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(allSwapsQuery);
        const allSwaps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap));

        // Filter on the client-side. This is more reliable.
        const userSwaps = allSwaps.filter(swap => 
            swap.initiatingUserId === userId || swap.requestingUserId === userId
        );
        
        return userSwaps;

    } catch (error) {
        console.error("Error fetching user's flight swaps:", error);
        throw new Error("Could not retrieve your flight swap history.");
    }
}
