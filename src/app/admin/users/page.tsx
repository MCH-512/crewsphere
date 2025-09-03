
"use server";

import * as React from "react";
import { UsersClient } from "./users-client";
import { getInitialUsers } from "@/services/user-service";

export default async function AdminUsersPage() {
    // Fetch initial data on the server to provide a non-empty shell to the client component.
    // The client will then re-fetch to ensure data is fresh and respects client-side auth.
    const initialUsers = await getInitialUsers();
    return <UsersClient initialUsers={initialUsers} />;
}
