'use server';

import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { parseISO, differenceInMinutes } from "date-fns";
import { db, isConfigValid } from "@/lib/firebase";
import { StoredFlight } from "@/schemas/flight-schema";
import { z } from "zod";

export interface LogbookEntry {
    id: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    aircraftType: string;
    flightDurationMinutes: number;
    userRoleOnFlight: string;
    // Dates are converted to strings for serialization
    scheduledDepartureDateTimeUTC: string;
    scheduledArrivalDateTimeUTC: string;
}

const GetLogbookInputSchema = z.string().min(1, "User ID is required.");


export async function getLogbookEntries(userId: string): Promise<LogbookEntry[]> {
    const validatedUserId = GetLogbookInputSchema.safeParse(userId);
    if (!validatedUserId.success || !isConfigValid || !db) {
        return [];
    }

    try {
        const flightsQuery = query(
            collection(db, "flights"),
            where("allCrewIds", "array-contains", validatedUserId.data),
            orderBy("scheduledDepartureDateTimeUTC", "desc")
        );

        const querySnapshot = await getDocs(flightsQuery);
        const entries: LogbookEntry[] = querySnapshot.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() } as StoredFlight;
            const departure = parseISO(data.scheduledDepartureDateTimeUTC);
            const arrival = parseISO(data.scheduledArrivalDateTimeUTC);
            const flightDurationMinutes = differenceInMinutes(arrival, departure);

            let userRoleOnFlight = "Crew";
            if (data.purserId === userId) userRoleOnFlight = "Purser";
            else if (data.pilotIds?.includes(userId as string)) userRoleOnFlight = "Pilote";
            else if (data.cabinCrewIds?.includes(userId as string)) userRoleOnFlight = "Cabin Crew";
            else if (data.instructorIds?.includes(userId as string)) userRoleOnFlight = "Instructor";
            else if (data.traineeIds?.includes(userId as string)) userRoleOnFlight = "Stagiaire";

            return { 
                id: doc.id,
                flightNumber: data.flightNumber,
                departureAirport: data.departureAirport,
                arrivalAirport: data.arrivalAirport,
                scheduledDepartureDateTimeUTC: data.scheduledDepartureDateTimeUTC,
                scheduledArrivalDateTimeUTC: data.scheduledArrivalDateTimeUTC,
                aircraftType: data.aircraftType,
                flightDurationMinutes, 
                userRoleOnFlight,
            };
        });
        return entries;
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        console.error("Error fetching logbook:", errorMessage);
        // Avoid throwing on server to prevent crashing the page, return empty array instead.
        // Client can show an error message.
        return [];
    }
}