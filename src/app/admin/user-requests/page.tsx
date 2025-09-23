"use server";

import "server-only";
import { UserRequestsClient } from "./user-requests-client";
import { fetchUserRequests } from "@/services/request-service";
import { z } from "zod";

const EmptySchema = z.object({});

export default async function AdminUserRequestsPage() {
    EmptySchema.parse({}); // Zod validation
    const initialRequests = await fetchUserRequests();
    
    return <UserRequestsClient initialRequests={initialRequests} />;
}
