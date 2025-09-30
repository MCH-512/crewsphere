'use server';

import "server-only";
import { AdminFlightsClient } from "./flights-client";
import { getFlightsForAdmin } from "@/services/flight-service";
import { z } from "zod";

const EmptySchema = z.object({});

export default async function AdminFlightsPage() {
    EmptySchema.parse({}); // Zod validation
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
