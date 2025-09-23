"use server";

import "server-only";
import { UsersClient } from "./users-client";
import { fetchUsers } from "@/services/user-service";
import { z } from "zod";

const EmptySchema = z.object({});

export default async function AdminUsersPage() {
    EmptySchema.parse({}); // Zod validation
    // Fetch initial data on the server to reduce client-side loading
    const initialUsers = await fetchUsers();
    
    return <UsersClient initialUsers={initialUsers} />;
}
