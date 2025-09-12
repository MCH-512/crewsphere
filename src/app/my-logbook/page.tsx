"use server";

import * as React from "react";
import { getCurrentUser } from "@/lib/session";
import { MyLogbookClient } from "./my-logbook-client";
import { getLogbookEntries } from "@/services/logbook-service";


export default async function MyLogbookPage() {
    const user = await getCurrentUser();
    // Fetch initial entries on the server to provide immediate data to the client component
    const initialEntries = user ? await getLogbookEntries(user.uid) : [];

    return <MyLogbookClient initialEntries={initialEntries} />;
}
