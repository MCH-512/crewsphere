
"use server";

import * as React from "react";
import { MySwapsClient } from "./my-swaps-client";
import { getCurrentUser } from "@/lib/session";
import { getMySwaps } from "@/services/flight-swap-service";
import { z } from 'zod';

// Zod schema for functions that take no arguments
const EmptySchema = z.object({});


export default async function MySwapsPage() {
    EmptySchema.parse({}); // Zod validation
    const user = await getCurrentUser();
    const initialSwaps = user ? await getMySwaps(user.uid) : [];

    return <MySwapsClient initialSwaps={initialSwaps} />;
}
