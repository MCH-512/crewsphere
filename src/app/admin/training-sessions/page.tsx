
'use server';

import "server-only";
import { TrainingSessionsClient } from "./training-sessions-client";
import { getTrainingSessionsPageData from "@/services/training-service";
import { z } from 'zod';

const EmptySchema = z.object({});

export default async function AdminTrainingSessionsPage() {
    EmptySchema.parse({}); // Zod validation
    // Fetch initial data on the server to reduce client-side loading
    const initialData = await getTrainingSessionsPageData();
    
    return <TrainingSessionsClient {...initialData} />;
}
