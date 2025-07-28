
"use server";

import * as React from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UsersClient } from "./users-client";
import type { User } from "@/schemas/user-schema";

async function getUsers(): Promise<User[]> {
    const q = query(collection(db, "users"), orderBy("email", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
    } as User));
}

export default async function AdminUsersPage() {
    const initialUsers = await getUsers();
    return <UsersClient initialUsers={initialUsers} />;
}
