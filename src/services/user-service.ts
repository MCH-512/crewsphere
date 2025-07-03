
'use server';

import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { User } from "@/contexts/auth-context";

export async function getUsersByRole(role: string): Promise<User[]> {
    if (!db) {
        console.error("Firestore not initialized");
        return [];
    }
    
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("role", "==", role));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        return querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        } as User));
    } catch (error) {
        console.error(`Error fetching users with role ${role}:`, error);
        throw new Error("Could not fetch users.");
    }
}
