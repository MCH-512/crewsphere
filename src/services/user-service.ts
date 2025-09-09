
'use server';

import { db, auth, isConfigValid } from "@/lib/firebase";
import { collection, doc, getDocs, query, orderBy, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import type { User, ManageUserFormValues } from "@/schemas/user-schema";
import { logAuditEvent } from "@/lib/audit-logger";

export async function fetchUsers(): Promise<User[]> {
    if (!isConfigValid || !db) throw new Error("Firebase is not configured.");
    
    // Sorting by email is generally more reliable and performant.
    const usersQuery = query(collection(db, "users"), orderBy("email", "asc"));
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
            // NOTE: This approach of using the client SDK on the server is generally not recommended
            // for production as it can have unexpected authentication behavior.
            // A more robust solution involves using the Firebase Admin SDK in a dedicated backend environment.
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
