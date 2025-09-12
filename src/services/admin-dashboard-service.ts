'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, where,getCountFromServer } from "firebase/firestore";
import type { AdminDashboardStats } from "@/config/nav";
import { getCurrentUser } from "@/lib/session";

/**
 * Fetches and aggregates key statistics for the admin dashboard.
 * This function performs several count queries in parallel.
 * @returns A promise that resolves to an AdminDashboardStats object.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        // Return zeroed-out stats if user is not an admin or Firebase is not configured
        return {
            pendingRequests: 0,
            pendingDocValidations: 0,
            newSuggestions: 0,
            pendingSwaps: 0,
            pendingReports: 0,
            activeAlerts: 0,
        };
    }

    try {
        // Define queries for each statistic
        const requestsQuery = query(collection(db, "requests"), where("status", "==", "pending"));
        const validationsQuery = query(collection(db, "userDocuments"), where("status", "==", "pending-validation"));
        const suggestionsQuery = query(collection(db, "suggestions"), where("status", "==", "new"));
        const swapsQuery = query(collection(db, "flightSwaps"), where("status", "==", "pending_approval"));
        const reportsQuery = query(collection(db, "purserReports"), where("status", "==", "submitted"));
        const alertsQuery = query(collection(db, "alerts"), where("isActive", "==", true));

        // Execute count queries in parallel for maximum performance
        const [
            requestsSnapshot,
            validationsSnapshot,
            suggestionsSnapshot,
            swapsSnapshot,
            reportsSnapshot,
            alertsSnapshot
        ] = await Promise.all([
            getCountFromServer(requestsQuery),
            getCountFromServer(validationsQuery),
            getCountFromServer(suggestionsQuery),
            getCountFromServer(swapsQuery),
            getCountFromServer(reportsQuery),
            getCountFromServer(alertsQuery),
        ]);

        // Construct the result object from the counts
        return {
            pendingRequests: requestsSnapshot.data().count,
            pendingDocValidations: validationsSnapshot.data().count,
            newSuggestions: suggestionsSnapshot.data().count,
            pendingSwaps: swapsSnapshot.data().count,
            pendingReports: reportsSnapshot.data().count,
            activeAlerts: alertsSnapshot.data().count,
        };

    } catch (error) {
        console.error("Error fetching admin dashboard stats:", error);
        // On error, return a zeroed-out object to prevent crashing the dashboard
        return {
            pendingRequests: 0,
            pendingDocValidations: 0,
            newSuggestions: 0,
            pendingSwaps: 0,
            pendingReports: 0,
            activeAlerts: 0,
        };
    }
}
