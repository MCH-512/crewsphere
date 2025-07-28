"use server";

import * as React from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserDocument } from "./users-client";
import { UsersClient } from "./users-client";

async function getUsers() {
    const q = query(collection(db, "users"), orderBy("email", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
    } as UserDocument));
}

export default async function AdminUsersPage() {
    const initialUsers = await getUsers();
    return <UsersClient initialUsers={initialUsers} />;
}
