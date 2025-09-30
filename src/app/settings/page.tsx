"use server";

import * as React from "react";
import { getCurrentUser } from "@/lib/session";
import SettingsClientPage from "./settings-client-page";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";

const EmptySchema = z.object({});

export default async function SettingsPage() {
    EmptySchema.parse({}); // Zod validation
    const user = await getCurrentUser();

    if (!user) {
        // This redirection is a failsafe. 
        // The logic in AppLayout handles most unauthenticated cases on the client side.
        redirect('/login');
    }

    // The server component fetches the data and passes it to the client component.
    return (
        <SettingsClientPage initialUser={user} />
    );
}
