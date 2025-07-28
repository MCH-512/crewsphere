
'use server';

import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { parseISO, differenceInMinutes } from "date-fns";
import { db, isConfigValid } from "@/lib/firebase";
import { StoredFlight } from "@/schemas/flight-schema";

export interface LogbookEntry extends StoredFlight {
    flightDurationMinutes: number;
    userRoleOnFlight: string;
}

export async function getLogbookEntries(userId: string | undefined): Promise<LogbookEntry[]> {
    if (!userId || !isConfigValid || !db) {
        return [];
    }

    try {
        const flightsQuery = query(
            collection(db, "flights"),
            where("allCrewIds", "array-contains", userId),
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
            else if (data.pilotIds?.includes(userId)) userRoleOnFlight = "Pilot";
            else if (data.cabinCrewIds?.includes(userId)) userRoleOnFlight = "Cabin Crew";
            else if (data.instructorIds?.includes(userId)) userRoleOnFlight = "Instructor";
            else if (data.traineeIds?.includes(userId)) userRoleOnFlight = "Stagiaire";

            return { ...data, flightDurationMinutes, userRoleOnFlight };
        });
        return entries;
    } catch (err: any) {
        console.error("Error fetching logbook:", err);
        throw new Error("Could not load flight logbook data. The necessary database indexes might still be building. Please try again in a few minutes.");
    }
}
