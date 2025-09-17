
"use server";

import "server-only";
import { UserRequestsClient } from "./user-requests-client";
import { fetchUserRequests } from "@/services/request-service";

export default async function AdminUserRequestsPage() {
    const initialRequests = await fetchUserRequests();
    
    return <UserRequestsClient initialRequests={initialRequests} />;
}
