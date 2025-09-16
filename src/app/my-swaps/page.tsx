
"use server";

import * as React from "react";
import { MySwapsClient } from "./my-swaps-client";
import { getCurrentUser } from "@/lib/session";
import { getMySwaps } from "@/services/flight-swap-service";


export default async function MySwapsPage() {
    const user = await getCurrentUser();
    const initialSwaps = user ? await getMySwaps(user.uid) : [];

    return <MySwapsClient initialSwaps={initialSwaps} />;
}

    
