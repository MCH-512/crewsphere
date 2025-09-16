
'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, updateDoc, writeBatch, serverTimestamp, deleteDoc, query, where, orderBy, addDoc } from "firebase/firestore";
import { StoredFlight } from "@/schemas/flight-schema";
import { User } from "@/contexts/auth-context";
import { logAuditEvent } from "@/lib/audit-logger";
import type { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import { checkCrewAvailability } from "./user-activity-service";


/**
 * Posts a flight for swapping.
 * @param flightToPost The flight being offered for swap.
 * @param user The user posting the swap.
 */
export async function postFlightSwap(flightToPost: StoredFlight, user: User): Promise<void> {
    if (!isConfigValid || !db) {
        throw new Error("Firebase is not configured.");
    }
    
    try {
        await addDoc(collection(db, "flightSwaps"), {
            initiatingUserId: user.uid,
            initiatingUserEmail: user.email,
            initiatingFlightId: flightToPost.id,
            participantIds: [user.uid], // Add participants array
            flightInfo: {
                flightNumber: flightToPost.flightNumber,
                departureAirport: flightToPost.departureAirport,
                arrivalAirport: flightToPost.arrivalAirport,
                scheduledDepartureDateTimeUTC: flightToPost.scheduledDepartureDateTimeUTC,
            },
            status: "posted",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

         await logAuditEvent({
            userId: user.uid,
            userEmail: user.email || 'N/A',
            actionType: 'POST_FLIGHT_SWAP',
            entityType: 'FLIGHT_SWAP',
            details: `Posted flight ${flightToPost.flightNumber} for swap`
        });

    } catch (error) {
         console.error("Error posting flight for swap:", error);
        throw new Error("Could not post your flight for swapping.");
    }
}


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
        const swapDoc = await getDoc(swapDocRef);
        if (!swapDoc.exists()) throw new Error("Swap request not found.");
        const swapData = swapDoc.data();

        await updateDoc(swapDocRef, {
            status: "pending_approval",
            requestingUserId: user.uid,
            requestingUserEmail: user.email,
            requestingFlightId: requestingFlight.id,
            participantIds: [swapData.initiatingUserId, user.uid], // Update participants array
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
 * Fetches all flight swaps relevant to a specific user.
 * @param userId The UID of the user whose swaps to fetch.
 * @returns A promise that resolves to an array of StoredFlightSwap.
 */
export async function getMySwaps(userId: string): Promise<StoredFlightSwap[]> {
    if (!isConfigValid || !db || !userId) {
        return [];
    }

    try {
        const swapsQuery = query(
            collection(db, "flightSwaps"),
            where("participantIds", "array-contains", userId),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(swapsQuery);
        
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap));

    } catch (error) {
        console.error("Error fetching user's flight swaps:", error);
        // Instead of throwing, return empty array to allow UI to handle the error.
        return [];
    }
}

export interface SwapWithConflict extends StoredFlightSwap {
    conflict?: string | null;
}

export async function getAvailableSwaps(userId: string): Promise<SwapWithConflict[]> {
    if (!isConfigValid || !db || !userId) {
        return [];
    }

    try {
        const swapsQuery = query(
            collection(db, "flightSwaps"),
            where("status", "==", "posted")
        );
        const swapsSnapshot = await getDocs(swapsQuery);

        const availableSwaps = swapsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap))
            .filter(swap => swap.initiatingUserId !== userId);

        // Enrich with conflict information
        const swapsWithConflicts = await Promise.all(
            availableSwaps.map(async (swap) => {
                const conflicts = await checkCrewAvailability(
                    [userId],
                    new Date(swap.flightInfo.scheduledDepartureDateTimeUTC),
                    new Date(swap.flightInfo.scheduledArrivalDateTimeUTC),
                    undefined // We are not editing, so no need to ignore an activity
                );
                return {
                    ...swap,
                    conflict: conflicts[userId]?.details || null,
                };
            })
        );
        
        return swapsWithConflicts;

    } catch (error) {
        console.error("Error fetching available swaps:", error);
        return [];
    }
}
