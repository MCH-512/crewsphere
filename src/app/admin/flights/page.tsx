
"use server";

import * as React from "react";
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FlightsClient } from "./flights-client";
import type { User } from "@/schemas/user-schema";
import type { StoredFlight } from "@/schemas/flight-schema";
import type { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import { getAirportByCode } from "@/services/airport-service";

interface FlightForDisplay extends StoredFlight {
    departureAirportName?: string;
    arrivalAirportName?: string;
    purserName?: string;
    crewCount: number;
    pendingSwap?: StoredFlightSwap;
}

async function getFlightsAndUsers(): Promise<{ flights: FlightForDisplay[], users: User[] }> {
    const usersSnapshot = await getDocs(query(collection(db, "users"), orderBy("email", "asc")));
    const allUsersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
    const userMapData = new Map(allUsersData.map(u => [u.uid, u]));

    const flightsQuery = query(collection(db, "flights"), orderBy("scheduledDepartureDateTimeUTC", "desc"));
    const swapsQuery = query(collection(db, "flightSwaps"), where("status", "==", "pending_approval"));
    
    const [flightsSnapshot, swapsSnapshot] = await Promise.all([getDocs(flightsQuery), getDocs(swapsQuery)]);

    const pendingSwaps = swapsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap));
    const swapsByFlightId = new Map(pendingSwaps.map(s => [s.initiatingFlightId, s]));

    const fetchedFlights = await Promise.all(
        flightsSnapshot.docs.map(async (d) => {
            const data = { id: d.id, ...d.data() } as StoredFlight;
            const [depAirport, arrAirport] = await Promise.all([
                getAirportByCode(data.departureAirport),
                getAirportByCode(data.arrivalAirport),
            ]);
            const crewCount = 1 + (data.pilotIds?.length || 0) + (data.cabinCrewIds?.length || 0) + (data.instructorIds?.length || 0) + (data.traineeIds?.length || 0);
            return {
                ...data,
                departureAirportName: `${depAirport?.name} (${depAirport?.iata})` || data.departureAirport,
                arrivalAirportName: `${arrAirport?.name} (${arrAirport?.iata})` || data.arrivalAirport,
                purserName: userMapData.get(data.purserId)?.displayName || 'N/A',
                crewCount,
                pendingSwap: swapsByFlightId.get(d.id),
            } as FlightForDisplay;
        })
    );

    return { flights: fetchedFlights, users: allUsersData };
}


export default async function AdminFlightsPage() {
    const { flights, users } = await getFlightsAndUsers();
    return <FlightsClient initialFlights={flights} initialUsers={users} />;
}
