
'use server';

import { db, auth, isConfigValid } from "@/lib/firebase";
import { collection, doc, getDocs, query, orderBy, setDoc, updateDoc, serverTimestamp, limit } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import type { User, ManageUserFormValues } from "@/schemas/user-schema";
import { logAuditEvent } from "./audit-logger";

export async function getInitialUsers(): Promise<User[]> {
    if (!isConfigValid || !db) return [];
    // This provides a quick, non-empty list for the initial server render.
    // The client will then fetch the full, sorted list.
    const usersQuery = query(collection(db, "users"), orderBy("fullName", "asc"), limit(25));
    try {
        const querySnapshot = await getDocs(usersQuery);
        return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
    } catch (e) {
        console.error("Failed to fetch initial users:", e);
        return [];
    }
}

export async function fetchUsers(): Promise<User[]> {
    if (!isConfigValid || !db) throw new Error("Firebase is not configured.");
    
    const usersQuery = query(collection(db, "users"), orderBy("fullName", "asc"));
    const querySnapshot = await getDocs(usersQuery);
    return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
}


interface ManageUserParams {
    isCreate: boolean;
    data: ManageUserFormValues;
    userId?: string;
    adminUser: User;
}

export async function manageUser({ isCreate, data, userId, adminUser }: ManageUserParams): Promise<void> {
    if (!isConfigValid || !db || !auth) {
        throw new Error("Firebase is not configured.");
    }

    if (isCreate) {
        if (!data.email || !data.password) {
            throw new Error("Email and password are required to create a user.");
        }

        try {
            // This part is tricky as createUserWithEmailAndPassword logs the new user in on the server.
            // This is a known complexity. For this app's purpose, we proceed, but in a real-world
            // scenario, you might use a Cloud Function triggered by a Firestore document write.
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const newUid = userCredential.user.uid;
            
            const userDocRef = doc(db, "users", newUid);
            await setDoc(userDocRef, {
                uid: newUid,
                email: data.email,
                displayName: data.displayName,
                fullName: data.fullName,
                employeeId: data.employeeId || null,
                joiningDate: data.joiningDate || null,
                role: data.role || 'other',
                accountStatus: data.accountStatus ? 'active' : 'inactive',
                createdAt: serverTimestamp(),
                lastLogin: null,
            });

            await logAuditEvent({
                userId: adminUser.uid,
                userEmail: adminUser.email || 'N/A',
                actionType: "CREATE_USER",
                entityType: "USER",
                entityId: newUid,
                details: { email: data.email, role: data.role, displayName: data.displayName },
            });
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                throw new Error("This email address is already in use by another account.");
            }
            throw new Error(error.message || "Failed to create user.");
        }
    } else {
        if (!userId) {
            throw new Error("User ID is required for updating.");
        }
        try {
            const userDocRef = doc(db, "users", userId);
            await updateDoc(userDocRef, {
                displayName: data.displayName,
                fullName: data.fullName,
                employeeId: data.employeeId || null,
                joiningDate: data.joiningDate || null,
                role: data.role || 'other',
                accountStatus: data.accountStatus ? 'active' : 'inactive',
            });
            
            await logAuditEvent({
                userId: adminUser.uid,
                userEmail: adminUser.email || 'N/A',
                actionType: "UPDATE_USER",
                entityType: "USER",
                entityId: userId,
                details: { email: data.email, role: data.role },
            });
        } catch (error: any) {
            throw new Error(error.message || "Failed to update user.");
        }
    }
}
