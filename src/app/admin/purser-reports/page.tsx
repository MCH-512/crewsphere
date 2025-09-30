'use server';

import "server-only";
import { PurserReportsClient } from "./purser-reports-client";
import { fetchPurserReports } from "@/services/report-service";
import { z } from "zod";

const EmptySchema = z.object({});

export default async function AdminPurserReportsPage() {
    EmptySchema.parse({}); // Zod validation
    // Fetch initial data on the server
    const initialReports = await fetchPurserReports();
    
    return <PurserReportsClient initialReports={initialReports} />;
}
