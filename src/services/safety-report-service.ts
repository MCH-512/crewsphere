'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { safetyReportFormSchema, type SafetyReportFormValues } from "@/schemas/safety-report-schema";
import { getCurrentUser } from "@/lib/session";
import { logAuditEvent } from "@/lib/audit-logger";
import { z } from "zod";

const SubmitSafetyReportSchema = z.custom<SafetyReportFormValues>();

export async function submitSafetyReport(data: SafetyReportFormValues): Promise<{ success: boolean; message: string; }> {
    const validatedData = safetyReportFormSchema.safeParse(data);
    if (!validatedData.success) {
        // Log the detailed validation error for debugging
        console.error("Safety report validation failed:", validatedData.error.flatten());
        throw new Error("Invalid report data provided. Please check the form and try again.");
    }
    
    const user = await getCurrentUser();
    if (!isConfigValid || !db) {
        throw new Error("Server is not configured to accept reports.");
    }
    
    const { isAnonymous, ...reportData } = validatedData.data;

    try {
        const reportPayload = {
            ...reportData,
            isAnonymous,
            reporterId: isAnonymous ? null : user?.uid,
            reporterEmail: isAnonymous ? null : user?.email,
            status: 'new' as const,
            eventDate: new Date(reportData.eventDate),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "safetyReports"), reportPayload);

        // Only log an identifiable audit event if the submission is not anonymous
        if (!isAnonymous && user) {
            await logAuditEvent({
                userId: user.uid,
                userEmail: user.email!,
                actionType: 'SUBMIT_SAFETY_REPORT',
                entityType: 'SAFETY_REPORT',
                entityId: docRef.id,
                details: { eventType: reportData.eventType, flight: reportData.flightNumber || 'N/A' },
            });
        }
        
        return { success: true, message: "Your safety report has been submitted successfully." };

    } catch (error) {
        console.error("Error submitting safety report:", error);
        return { success: false, message: "A server error occurred while submitting your report." };
    }
}
