
"use server";

import "server-only";
import { AlertsClient } from "./alerts-client";
import { getAlerts } from "@/services/alert-service";

export default async function AdminAlertsPage() {
    const initialAlerts = await getAlerts();
    
    return <AlertsClient initialAlerts={initialAlerts} />;
}
