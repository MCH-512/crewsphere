
"use server";

import "server-only";
import { PurserReportsClient } from "./purser-reports-client";
import { fetchPurserReports } from "@/services/report-service";

export default async function AdminPurserReportsPage() {
    // Fetch initial data on the server
    const initialReports = await fetchPurserReports();
    
    return <PurserReportsClient initialReports={initialReports} />;
}
