"use server";

import "server-only";
import { AlertsClient } from "./alerts-client";
import { getAlerts } from "@/services/alert-service";
import { z } from "zod";

const EmptySchema = z.object({});

export default async function AdminAlertsPage() {
    EmptySchema.parse({}); // Zod validation
    const initialAlerts = await getAlerts();
    
    return <AlertsClient initialAlerts={initialAlerts} />;
}
