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
        // Cette redirection est une sécurité supplémentaire. 
        // La logique dans AppLayout gère déjà la plupart des cas.
        redirect('/login');
    }

    // Le composant serveur récupère les données et les passe au composant client.
    return (
        <SettingsClientPage initialUser={user} />
    );
}
