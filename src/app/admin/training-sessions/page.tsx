
"use server";

import "server-only";
import { TrainingSessionsClient } from "./training-sessions-client";
import { getTrainingSessionsPageData } from "@/services/training-service";


export default async function AdminTrainingSessionsPage() {
    // Fetch initial data on the server to reduce client-side loading
    const initialData = await getTrainingSessionsPageData();
    
    return <TrainingSessionsClient {...initialData} />;
}
