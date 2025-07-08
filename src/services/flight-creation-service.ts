
'use server';

import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
import type { FlightFormValues } from "@/schemas/flight-schema";
import { addDays, addWeeks, startOfDay, parseISO, isBefore, isEqual, differenceInMilliseconds } from 'date-fns';
import { logAuditEvent } from "@/lib/audit-logger";
import { User } from "@/contexts/auth-context";

export async function createFlights(data: FlightFormValues, adminUser: User): Promise<{ success: boolean; count: number; error?: string }> {
    const allCrewIds = [...new Set([data.purserId, ...(data.pilotIds || []), ...(data.cabinCrewIds || []), ...(data.instructorIds || []), ...(data.traineeIds || [])].filter(Boolean))];
    const operationsPerFlight = 1 + allCrewIds.length;
    const MAX_OPERATIONS = 499; // Keep a small buffer
    
    const flightInstances: FlightFormValues[] = [];

    try {
        if (data.recurrence === 'none' || !data.recurrence) {
            flightInstances.push(data);
        } else {
            const startDate = parseISO(data.scheduledDepartureDateTimeUTC);
            const endDate = parseISO(data.recurrenceEndDate!);
            const flightDuration = differenceInMilliseconds(parseISO(data.scheduledArrivalDateTimeUTC), startDate);

            let currentDate = startDate;
            while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
                 if (flightInstances.length * operationsPerFlight > MAX_OPERATIONS) {
                    // Instead of throwing, return an error object. This is the key fix.
                    const errorMessage = `This recurrence creates too many flights. Maximum of ${Math.floor(MAX_OPERATIONS / operationsPerFlight)} flights can be created at once.`;
                    return { success: false, count: 0, error: errorMessage };
                }

                const newDepartureDate = new Date(currentDate);
                const newArrivalDate = new Date(newDepartureDate.getTime() + flightDuration);

                flightInstances.push({
                    ...data,
                    scheduledDepartureDateTimeUTC: newDepartureDate.toISOString(),
                    scheduledArrivalDateTimeUTC: newArrivalDate.toISOString(),
                });
                
                currentDate = data.recurrence === 'daily' ? addDays(currentDate, 1) : addWeeks(currentDate, 1);
            }
        }

        if (flightInstances.length === 0) {
            return { success: false, count: 0, error: "No flights to create for the given date range." };
        }

        const batch = writeBatch(db);

        for (const flightData of flightInstances) {
            const flightRef = doc(collection(db, "flights"));
            const activityIds: Record<string, string> = {};

            for (const crewId of allCrewIds) {
                const activityRef = doc(collection(db, "userActivities"));
                batch.set(activityRef, {
                    userId: crewId,
                    activityType: 'flight' as const,
                    flightId: flightRef.id,
                    date: Timestamp.fromDate(startOfDay(new Date(flightData.scheduledDepartureDateTimeUTC))),
                    flightNumber: flightData.flightNumber,
                    departureAirport: flightData.departureAirport,
                    arrivalAirport: flightData.arrivalAirport,
                    comments: `Flight ${flightData.flightNumber} from ${flightData.departureAirport} to ${flightData.arrivalAirport}`,
                });
                activityIds[crewId] = activityRef.id;
            }
            
            const { recurrence, recurrenceEndDate, ...singleFlightData } = flightData;

            batch.set(flightRef, {
                ...singleFlightData,
                allCrewIds,
                activityIds,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                purserReportSubmitted: false,
            });
        }

        await batch.commit();

        await logAuditEvent({ 
            userId: adminUser.uid, 
            userEmail: adminUser.email, 
            actionType: "CREATE_FLIGHT_BATCH", 
            entityType: "FLIGHT", 
            details: { 
                flightNumber: data.flightNumber,
                count: flightInstances.length, 
                recurrence: data.recurrence 
            } 
        });

        return { success: true, count: flightInstances.length };

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while preparing flights.";
        console.error("Critical error in flight-creation-service:", e);
        return { success: false, count: 0, error: errorMessage };
    }
}
