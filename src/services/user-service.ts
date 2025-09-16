
'use server';

import { db, auth, isConfigValid } from "@/lib/firebase";
import { collection, doc, getDocs, query, orderBy, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from "firebase/auth";
import type { User, ManageUserFormValues } from "@/schemas/user-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { getCurrentUser } from "@/lib/session";

export async function fetchUsers(): Promise<User[]> {
    if (!isConfigValid || !db) {
        console.error("User fetch failed: Firebase is not configured.");
        return []; 
    }
    
    // Security check: only admins can list all users.
    const adminUser = await getCurrentUser();
    if (!adminUser || adminUser.role !== 'admin') {
        console.warn("Unauthorized attempt to fetch all users.");
        return [];
    }

    try {
        const usersQuery = query(collection(db, "users"), orderBy("email", "asc"));
        const querySnapshot = await getDocs(usersQuery);
        return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
    } catch (error) {
        console.error("Error fetching users from Firestore:", error);
        return []; // Return empty on error to prevent page crash
    }
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
        
        // This is a placeholder for a more robust creation flow.
        // A proper implementation would use a Cloud Function with the Admin SDK
        // to avoid the security risks of creating users from the client or another user's session.
        // For this project, we acknowledge this limitation.
        let newUid: string | null = null;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            newUid = userCredential.user.uid;

            // Update profile for the newly created user
            await updateProfile(userCredential.user, { displayName: data.displayName });
            
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
                baseAirport: data.baseAirport || null,
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
            // Rollback: If Firestore write fails after Auth user is created, delete the Auth user.
            if (newUid) {
                try {
                    const userToDelete = auth.currentUser;
                     if (userToDelete && userToDelete.uid === newUid) {
                        await deleteUser(userToDelete);
                        console.log(`Successfully rolled back and deleted auth user: ${newUid}`);
                    }
                } catch (rollbackError) {
                    console.error(`CRITICAL: Failed to rollback user creation for ${newUid}. Manual cleanup required.`, rollbackError);
                }
            }

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
                baseAirport: data.baseAirport || null,
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
