
'use server';

import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import type { StoredFlight } from "@/schemas/flight-schema";
import type { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { startOfDay } from "date-fns";

const findUserRoleOnFlight = (flight: StoredFlight, userId: string): { role: string; field: string } | null => {
    if (flight.purserId === userId) return { role: 'purser', field: 'purserId' };
    if (flight.pilotIds?.includes(userId)) return { role: 'pilot', field: 'pilotIds' };
    if (flight.cabinCrewIds?.includes(userId)) return { role: 'cabin crew', field: 'cabinCrewIds' };
    if (flight.instructorIds?.includes(userId)) return { role: 'instructor', field: 'instructorIds' };
    if (flight.traineeIds?.includes(userId)) return { role: 'trainee', field: 'traineeIds' };
    return null;
};

const updateCrewArray = (crewArray: string[], userToAdd: string, userToRemove: string): string[] => {
    return crewArray.filter(id => id !== userToRemove).concat(userToAdd);
};

export async function approveFlightSwap(swapId: string, adminId: string, adminEmail: string) {
    if (!db) throw new Error("Database not configured");

    try {
        await runTransaction(db, async (transaction) => {
            const swapRef = doc(db, "flightSwaps", swapId);
            const swapSnap = await transaction.get(swapRef);
            if (!swapSnap.exists()) throw new Error("Swap request not found.");
            const swapData = swapSnap.data() as StoredFlightSwap;

            if (swapData.status !== 'pending_approval') throw new Error("This swap is not pending approval.");
            if (!swapData.requestingFlightId || !swapData.requestingUserId) throw new Error("Swap request is incomplete.");

            const flight1Ref = doc(db, "flights", swapData.initiatingFlightId);
            const flight2Ref = doc(db, "flights", swapData.requestingFlightId);
            const [flight1Snap, flight2Snap] = await Promise.all([transaction.get(flight1Ref), transaction.get(flight2Ref)]);
            if (!flight1Snap.exists() || !flight2Snap.exists()) throw new Error("One or both flights involved in the swap could not be found.");
            const flight1Data = flight1Snap.data() as StoredFlight;
            const flight2Data = flight2Snap.data() as StoredFlight;

            const user1Role = findUserRoleOnFlight(flight1Data, swapData.initiatingUserId);
            const user2Role = findUserRoleOnFlight(flight2Data, swapData.requestingUserId);
            if (!user1Role || !user2Role) throw new Error("Could not determine user role on one of the flights.");
            if (user1Role.role !== user2Role.role) throw new Error(`Role mismatch: Cannot swap a ${user1Role.role} with a ${user2Role.role}.`);

            // --- Update Flights ---
            const flight1Update: Partial<StoredFlight> = {
                allCrewIds: updateCrewArray(flight1Data.allCrewIds, swapData.requestingUserId, swapData.initiatingUserId)
            };
            const flight2Update: Partial<StoredFlight> = {
                allCrewIds: updateCrewArray(flight2Data.allCrewIds, swapData.initiatingUserId, swapData.requestingUserId)
            };
            
            if (user1Role.field === 'purserId') {
                (flight1Update as any).purserId = swapData.requestingUserId;
                (flight2Update as any).purserId = swapData.initiatingUserId;
            } else {
                 (flight1Update as any)[user1Role.field] = updateCrewArray((flight1Data as any)[user1Role.field], swapData.requestingUserId, swapData.initiatingUserId);
                 (flight2Update as any)[user2Role.field] = updateCrewArray((flight2Data as any)[user2Role.field], swapData.initiatingUserId, swapData.requestingUserId);
            }
            transaction.update(flight1Ref, flight1Update);
            transaction.update(flight2Ref, flight2Update);

            // --- Update Activities ---
            const activity1Id = flight1Data.activityIds?.[swapData.initiatingUserId];
            const activity2Id = flight2Data.activityIds?.[swapData.requestingUserId];

            if (activity1Id) {
                const activity1Ref = doc(db, "userActivities", activity1Id);
                transaction.update(activity1Ref, {
                    flightId: flight2Data.id,
                    flightNumber: flight2Data.flightNumber,
                    departureAirport: flight2Data.departureAirport,
                    arrivalAirport: flight2Data.arrivalAirport,
                    date: Timestamp.fromDate(startOfDay(new Date(flight2Data.scheduledDepartureDateTimeUTC))),
                    comments: `Flight ${flight2Data.flightNumber} from ${flight2Data.departureAirport} to ${flight2Data.arrivalAirport}`,
                });
            }
             if (activity2Id) {
                const activity2Ref = doc(db, "userActivities", activity2Id);
                transaction.update(activity2Ref, {
                    flightId: flight1Data.id,
                    flightNumber: flight1Data.flightNumber,
                    departureAirport: flight1Data.departureAirport,
                    arrivalAirport: flight1Data.arrivalAirport,
                    date: Timestamp.fromDate(startOfDay(new Date(flight1Data.scheduledDepartureDateTimeUTC))),
                    comments: `Flight ${flight1Data.flightNumber} from ${flight1Data.departureAirport} to ${flight1Data.arrivalAirport}`,
                });
            }

            // --- Update Swap Request ---
            transaction.update(swapRef, {
                status: 'approved',
                resolvedBy: adminId,
                updatedAt: serverTimestamp()
            });
        });

        // --- Log Audit Event (outside transaction) ---
        await logAuditEvent({
            userId: adminId, userEmail: adminEmail,
            actionType: 'APPROVE_FLIGHT_SWAP', entityType: 'FLIGHT_SWAP',
            entityId: swapId,
        });

    } catch (error) {
        console.error("Error approving flight swap:", error);
        throw error;
    }
}

export async function rejectFlightSwap(swapId: string, adminId: string, adminEmail: string, notes: string) {
    if (!db) throw new Error("Database not configured");
    if (!notes) throw new Error("Rejection notes are required.");
    
    const swapRef = doc(db, "flightSwaps", swapId);
    
    await updateDoc(swapRef, {
        status: 'rejected',
        resolvedBy: adminId,
        adminNotes: notes,
        updatedAt: serverTimestamp(),
    });
    
     await logAuditEvent({
        userId: adminId, userEmail: adminEmail,
        actionType: 'REJECT_FLIGHT_SWAP', entityType: 'FLIGHT_SWAP',
        entityId: swapId, details: { notes }
    });
}
