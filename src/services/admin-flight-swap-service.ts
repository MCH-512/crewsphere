
'use server';

import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, Timestamp, collection, updateDoc, writeBatch, getDoc } from "firebase/firestore";
import type { StoredFlight } from "@/schemas/flight-schema";
import type { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { startOfDay } from "date-fns";
import { checkCrewAvailability } from "@/services/user-activity-service";

const findUserRoleOnFlight = (flight: StoredFlight, userId: string): { role: string; field: string } | null => {
    if (flight.purserId === userId) return { role: 'purser', field: 'purserId' };
    if (flight.pilotIds?.includes(userId)) return { role: 'pilot', field: 'pilotIds' };
    if (flight.cabinCrewIds?.includes(userId)) return { role: 'cabin crew', field: 'cabinCrewIds' };
    if (flight.instructorIds?.includes(userId)) return { role: 'instructor', field: 'instructorIds' };
    if (flight.traineeIds?.includes(userId)) return { role: 'trainee', field: 'traineeIds' };
    return null;
};

const updateCrewArray = (crewArray: string[], userToRemove: string, userToAdd: string): string[] => {
    const newArray = crewArray.filter(id => id !== userToRemove);
    if (!newArray.includes(userToAdd)) {
        newArray.push(userToAdd);
    }
    return newArray;
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
                allCrewIds: updateCrewArray(flight1Data.allCrewIds, swapData.initiatingUserId, swapData.requestingUserId)
            };
            const flight2Update: Partial<StoredFlight> = {
                allCrewIds: updateCrewArray(flight2Data.allCrewIds, swapData.requestingUserId, swapData.initiatingUserId)
            };
            
            if (user1Role.field === 'purserId') {
                (flight1Update as any).purserId = swapData.requestingUserId;
                (flight2Update as any).purserId = swapData.initiatingUserId;
            } else {
                 (flight1Update as any)[user1Role.field] = updateCrewArray((flight1Data as any)[user1Role.field], swapData.initiatingUserId, swapData.requestingUserId);
                 (flight2Update as any)[user2Role.field] = updateCrewArray((flight2Data as any)[user2Role.field], swapData.requestingUserId, swapData.initiatingUserId);
            }
            
            // --- Update Activities ---
            const activity1Id = flight1Data.activityIds?.[swapData.initiatingUserId];
            const activity2Id = flight2Data.activityIds?.[swapData.requestingUserId];

            const newActivityIdsF1 = { ...flight1Data.activityIds };
            delete newActivityIdsF1[swapData.initiatingUserId];
            if (activity2Id) newActivityIdsF1[swapData.requestingUserId] = activity2Id;
            flight1Update.activityIds = newActivityIdsF1;
            
            const newActivityIdsF2 = { ...flight2Data.activityIds };
            delete newActivityIdsF2[swapData.requestingUserId];
            if (activity1Id) newActivityIdsF2[swapData.initiatingUserId] = activity1Id;
            flight2Update.activityIds = newActivityIdsF2;

            transaction.update(flight1Ref, flight1Update);
            transaction.update(flight2Ref, flight2Update);
            
            const activityBatch = writeBatch(db);
            if (activity1Id) {
                activityBatch.update(doc(db, "userActivities", activity1Id), { 
                    flightId: flight2Snap.id, 
                    flightNumber: flight2Data.flightNumber, 
                    departureAirport: flight2Data.departureAirport, 
                    arrivalAirport: flight2Data.arrivalAirport, 
                    date: Timestamp.fromDate(startOfDay(new Date(flight2Data.scheduledDepartureDateTimeUTC))), 
                    comments: `Flight ${flight2Data.flightNumber} from ${flight2Data.departureAirport} to ${flight2Data.arrivalAirport}`, 
                });
            }
             if (activity2Id) {
                activityBatch.update(doc(db, "userActivities", activity2Id), { 
                    flightId: flight1Snap.id, 
                    flightNumber: flight1Data.flightNumber, 
                    departureAirport: flight1Data.departureAirport, 
                    arrivalAirport: flight1Data.arrivalAirport, 
                    date: Timestamp.fromDate(startOfDay(new Date(flight1Data.scheduledDepartureDateTimeUTC))), 
                    comments: `Flight ${flight1Data.flightNumber} from ${flight1Data.departureAirport} to ${flight1Data.arrivalAirport}`, 
                });
            }
            await activityBatch.commit();
            
            transaction.update(swapRef, {
                status: 'approved',
                resolvedBy: adminId,
                updatedAt: serverTimestamp()
            });
        });
        
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

export async function checkSwapConflict(swap: StoredFlightSwap): Promise<string | null> {
    if (!swap.requestingFlightId || !swap.requestingUserId || !swap.requestingFlightInfo || !swap.initiatingFlightId || !swap.initiatingUserId) {
        return "Swap request is incomplete and cannot be checked.";
    }

    try {
        const initiatorConflicts = await checkCrewAvailability(
            [swap.initiatingUserId],
            new Date(swap.requestingFlightInfo.scheduledDepartureDateTimeUTC),
            new Date(swap.requestingFlightInfo.scheduledArrivalDateTimeUTC || swap.requestingFlightInfo.scheduledDepartureDateTimeUTC),
            swap.initiatingFlightId // Ignore the original flight
        );
        if (Object.keys(initiatorConflicts).length > 0) {
            const conflict = Object.values(initiatorConflicts)[0];
            return `${swap.initiatingUserEmail} has a conflict on the new date: ${conflict.details}.`;
        }

        const requesterConflicts = await checkCrewAvailability(
            [swap.requestingUserId],
            new Date(swap.flightInfo.scheduledDepartureDateTimeUTC),
            new Date(swap.flightInfo.scheduledArrivalDateTimeUTC),
            swap.requestingFlightId // Ignore the original flight
        );
         if (Object.keys(requesterConflicts).length > 0) {
            const conflict = Object.values(requesterConflicts)[0];
            return `${swap.requestingUserEmail} has a conflict on the new date: ${conflict.details}.`;
        }

        return null;

    } catch (error) {
        console.error("Error checking swap conflict:", error);
        return "Could not automatically check for conflicts due to a server error.";
    }
}
