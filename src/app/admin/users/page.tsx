
"use server";

import * as React from "react";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
    // The initial data fetching is moved to the client component
    // to ensure requests are authenticated with the user's credentials.
    // We pass an empty array to avoid a flash of "no users found".
    return <UsersClient initialUsers={[]} />;
}
