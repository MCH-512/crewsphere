
"use server";

import * as React from "react";
import { MySwapsClient } from "./my-swaps-client";

export default async function MySwapsPage() {
    // This page is now a Server Component shell.
    // It renders the Client Component which will be responsible for fetching its own data.
    return <MySwapsClient />;
}
