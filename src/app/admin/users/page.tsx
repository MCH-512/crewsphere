
"use client";

import * as React from "react";
import { UsersClient } from "./users-client";

export default function AdminUsersPage() {
    // This component now simply renders the client component.
    // The initialUsers prop is removed, as fetching is now handled client-side.
    return <UsersClient />;
}
