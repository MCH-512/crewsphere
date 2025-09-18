
'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import type { StoredUserRequest, RequestFormValues } from "@/schemas/request-schema";
import { getCurrentUser } from "@/lib/session";
import { logAuditEvent } from "@/lib/audit-logger";

/**
 * Submits a new request for a user.
 * This is a server-only function.
 * @param data The validated form data for the request.
 * @returns The ID of the newly created request document.
 */
export async function submitUserRequest(data: RequestFormValues): Promise<string> {
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) {
        throw new Error("User is not authenticated or Firebase is not configured.");
    }

    try {
        const isLeaveRequest = data.requestCategory === "Leave & Absences";
        
        const requestData = {
            userId: user.uid,
            userEmail: user.email,
            requestType: data.requestCategory,
            specificRequestType: data.specificRequestType || null,
            urgencyLevel: data.urgencyLevel,
            subject: data.subject || data.specificRequestType, // Fallback to specific type for subject
            details: data.details,
            startDate: isLeaveRequest ? data.startDate : null,
            endDate: isLeaveRequest ? data.endDate : null,
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
