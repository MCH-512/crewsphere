'use server';

import { db, auth, isConfigValid } from "@/lib/firebase";
import { collection, doc, getDocs, query, orderBy, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, type AuthError } from "firebase/auth";
import type { User, ManageUserFormValues } from "@/schemas/user-schema";
import { manageUserFormSchema } from "@/schemas/user-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";


export async function fetchUsers(): Promise<User[]> {
    z.object({}).parse({});
    if (!isConfigValid || !db) {
        console.error("User fetch failed: Firebase is not configured.");
        return []; 
    }
    
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
        return [];
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
    
    // Validate data with Zod before proceeding
    const validationResult = manageUserFormSchema.safeParse(data);
    if (!validationResult.success) {
        throw new Error(`Invalid user data: ${JSON.stringify(validationResult.error.flatten().fieldErrors)}`);
    }
    const validatedData = validationResult.data;

    if (isCreate) {
        if (!validatedData.email || !validatedData.password) {
            throw new Error("Email and password are required to create a user.");
        }
        
        let newUid: string | null = null;
        try {
             // This is a placeholder. In a real app, use Admin SDK in a Cloud Function.
            const userCredential = await createUserWithEmailAndPassword(auth, validatedData.email, validatedData.password);
            newUid = userCredential.user.uid;

            await updateProfile(userCredential.user, { displayName: validatedData.displayName });
            
            const userDocRef = doc(db, "users", newUid);
            await setDoc(userDocRef, {
                uid: newUid,
                email: validatedData.email,
                displayName: validatedData.displayName,
                fullName: validatedData.fullName,
                employeeId: validatedData.employeeId || null,
                joiningDate: validatedData.joiningDate || null,
                role: validatedData.role || 'other',
                accountStatus: validatedData.accountStatus ? 'active' : 'inactive',
                baseAirport: validatedData.baseAirport || null,
                createdAt: serverTimestamp(),
                lastLogin: null,
            });

            await logAuditEvent({
                userId: adminUser.uid,
                userEmail: adminUser.email || 'N/A',
                actionType: "CREATE_USER",
                entityType: "USER",
                entityId: newUid,
                details: { email: validatedData.email, role: validatedData.role, displayName: validatedData.displayName },
            });

        } catch (error: unknown) {
             // Rollback logic would be more complex and require Admin SDK.
             // For now, we log the critical failure.
            if (newUid) {
                console.error(`CRITICAL: Auth user ${newUid} was created but Firestore document failed. Manual cleanup required.`);
            }
            const authError = error as AuthError;
            if (authError.code === 'auth/email-already-in-use') {
                throw new Error("This email address is already in use by another account.");
            }
            throw new Error(authError.message || "Failed to create user.");
        }
    } else {
        if (!userId) {
            throw new Error("User ID is required for updating.");
        }
        try {
            const userDocRef = doc(db, "users", userId);
            await updateDoc(userDocRef, {
                displayName: validatedData.displayName,
                fullName: validatedData.fullName,
                employeeId: validatedData.employeeId || null,
                joiningDate: validatedData.joiningDate || null,
                role: validatedData.role || 'other',
                accountStatus: validatedData.accountStatus ? 'active' : 'inactive',
                baseAirport: validatedData.baseAirport || null,
            });
            
            await logAuditEvent({
                userId: adminUser.uid,
                userEmail: adminUser.email || 'N/A',
                actionType: "UPDATE_USER",
                entityType: "USER",
                entityId: userId,
                details: { email: validatedData.email, role: validatedData.role },
            });
        } catch (error: unknown) {
            const authError = error as AuthError;
            throw new Error(authError.message || "Failed to update user.");
        }
    }
}