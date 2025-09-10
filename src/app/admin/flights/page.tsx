
"use server";

import "server-only";
import { AdminFlightsClient } from "./flights-client";
import { getFlightsForAdmin } from "@/services/flight-service";

export default async function AdminFlightsPage() {
    // Fetch initial data on the server to reduce client-side loading
    const { 
        flights, 
        allUsers, 
        pilots, 
        pursers, 
        cabinCrew, 
        instructors, 
        trainees,
        userMap
    } = await getFlightsForAdmin();

    return <AdminFlightsClient 
        initialFlights={flights} 
        initialAllUsers={allUsers}
        initialPilots={pilots}
        initialPursers={pursers}
        initialCabinCrew={cabinCrew}
        initialInstructors={instructors}
        initialTrainees={trainees}
        initialUserMap={userMap}
    />;
}
