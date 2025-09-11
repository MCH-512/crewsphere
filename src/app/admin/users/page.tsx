
"use server";

import "server-only";
import { UsersClient } from "./users-client";
import { fetchUsers } from "@/services/user-service";

export default async function AdminUsersPage() {
    // Fetch initial data on the server to reduce client-side loading
    const initialUsers = await fetchUsers();
    
    return <UsersClient initialUsers={initialUsers} />;
}
