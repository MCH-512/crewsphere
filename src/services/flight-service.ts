
"use server";

import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, doc } from "firebase/firestore";
import { startOfMonth, endOfMonth } from 'date-fns';
import { StoredFlight, type FlightFormValues } from "@/schemas/flight-schema";
import { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import { User } from "@/schemas/user-schema";
import { getAirportByCode } from "./airport-service";

export interface FlightForDisplay extends StoredFlight {
    departureAirportName?: string;
    arrivalAirportName?: string;
    purserName?: string;
    crewCount: number;
    pendingSwap?: StoredFlightSwap;
}

export async function getFlightsForAdmin(calendarMonth: Date = new Date()) {
    if (!isConfigValid || !db) {
        throw new Error("Firebase is not configured.");
    }
    
    // Fetch all user data once
    const usersSnapshot = await getDocs(collection(db, "users"));
    const allUsers = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
    const userMap = new Map(allUsers.map(u => [u.uid, u]));
    
    // Categorize users
    const pilots = allUsers.filter(u => u.role === 'pilote');
    const pursers = allUsers.filter(u => ['purser', 'admin', 'instructor'].includes(u.role || '') && u.role !== 'pilote');
    const cabinCrew = allUsers.filter(u => u.role === 'cabin crew');
    const instructors = allUsers.filter(u => u.role === 'instructor');
    const trainees = allUsers.filter(u => u.role === 'stagiaire');

    // Fetch flights for the given month
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const flightsQuery = query(
        collection(db, "flights"), 
        orderBy("scheduledDepartureDateTimeUTC", "desc")
    );
    const swapsQuery = query(collection(db, "flightSwaps"), where("status", "==", "pending_approval"));

    const [flightsSnapshot, swapsSnapshot] = await Promise.all([getDocs(flightsQuery), getDocs(swapsQuery)]);
    
    const allFlights = flightsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as StoredFlight);
    const flightsInMonth = allFlights.filter(f => {
        const flightDate = new Date(f.scheduledDepartureDateTimeUTC);
        return flightDate >= start && flightDate <= end;
    });

    const pendingSwaps = swapsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap));
    const swapsByFlightId = new Map(pendingSwaps.map(s => [s.initiatingFlightId, s]));

    const flights = await Promise.all(
        flightsInMonth.map(async (data) => {
            const [depAirport, arrAirport] = await Promise.all([
                getAirportByCode(data.departureAirport),
                getAirportByCode(data.arrivalAirport),
            ]);
            const crewCount = (data.allCrewIds || []).length;
            return {
                ...data,
                departureAirportName: `${depAirport?.name} (${depAirport?.iata})` || data.departureAirport,
                arrivalAirportName: `${arrAirport?.name} (${arrAirport?.iata})` || data.arrivalAirport,
                purserName: userMap.get(data.purserId)?.displayName || 'N/A',
                crewCount,
                pendingSwap: swapsByFlightId.get(data.id),
            } as FlightForDisplay;
        })
    );

    return {
        flights: flights, // Already sorted by query
        allUsers,
        pilots,
        pursers,
        cabinCrew,
        instructors,
        trainees,
        userMap
    };
}
