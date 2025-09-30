'use server';

import * as React from "react";
import { getCurrentUser } from "@/lib/session";
import { MyLogbookClient } from "./my-logbook-client";
import { getLogbookEntries } from "@/services/logbook-service";
import { z } from 'zod';

// Zod schema for functions that take no arguments
const EmptySchema = z.object({});


export default async function MyLogbookPage() {
    EmptySchema.parse({}); // Zod validation
    const user = await getCurrentUser();
    // Fetch initial entries on the server to provide immediate data to the client component
    const initialEntries = user ? await getLogbookEntries(user.uid) : [];

    return <MyLogbookClient initialEntries={initialEntries} />;
}
