'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { requestFormSchema, type StoredUserRequest, type RequestFormValues } from "@/schemas/request-schema";
import { getCurrentUser } from "@/lib/session";
import { logAuditEvent } from "@/lib/audit-logger";
import { z } from 'zod';

/**
 * Submits a new request for a user.
 * This is a server-only function.
 * @param data The validated form data for the request.
 * @returns The ID of the newly created request document.
 */
export async function submitUserRequest(data: RequestFormValues): Promise<string> {
    const validatedData = requestFormSchema.parse(data);
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) {
        throw new Error("User is not authenticated or Firebase is not configured.");
    }

    try {
        const isLeaveRequest = validatedData.requestCategory === "Leave & Absences";
        
        const requestData = {
            userId: user.uid,
            userEmail: user.email,
            requestType: validatedData.requestCategory,
            specificRequestType: validatedData.specificRequestType || null,
            urgencyLevel: validatedData.urgencyLevel,
            subject: validatedData.subject || validatedData.specificRequestType, // Fallback to specific type for subject
            details: validatedData.details,
            startDate: isLeaveRequest ? validatedData.startDate : null,
            endDate: isLeaveRequest ? validatedData.endDate : null,
            createdAt: serverTimestamp(),
            status: "pending" as const,
        };

        const docRef = await addDoc(collection(db, "requests"), requestData);

        await logAuditEvent({
            userId: user.uid,
            userEmail: user.email!,
            actionType: 'CREATE_REQUEST',
            entityType: 'REQUEST',
            entityId: docRef.id,
            details: { subject: requestData.subject, category: requestData.requestType },
        });

        return docRef.id;

    } catch (error) {
        console.error("Error submitting new request:", error);
        throw new Error("Failed to submit the request due to a server error.");
    }
}


/**
 * Fetches all user requests, ordered by creation date.
 * This is a server-only function intended for admin use.
 * @returns A promise that resolves to an array of StoredUserRequest.
 */
export async function fetchUserRequests(): Promise<StoredUserRequest[]> {
    z.object({}).parse({}); // Zod validation for function with no args
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        console.error("Unauthorized or unconfigured attempt to fetch user requests.");
        return [];
    }

    try {
        const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as StoredUserRequest));
    } catch (err) {
        console.error("Error fetching user requests:", err);
        return [];
    }
}
