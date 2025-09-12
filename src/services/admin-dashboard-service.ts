'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, where, getCountFromServer, Timestamp } from "firebase/firestore";
import type { AdminDashboardStats } from "@/config/nav";
import { getCurrentUser } from "@/lib/session";
import { startOfDay, subDays, format, eachDayOfInterval } from 'date-fns';


export interface WeeklyTrendDataPoint {
    date: string; // "YYYY-MM-DD"
    Requests: number;
    Suggestions: number;
    Swaps: number;
}

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


/**
 * Fetches and aggregates daily counts for key activities over the last 7 days.
 * @returns A promise that resolves to an array of daily trend data.
 */
export async function getAdminDashboardWeeklyTrends(): Promise<WeeklyTrendDataPoint[]> {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin' || !isConfigValid || !db) {
        return [];
    }

    const endDate = new Date();
    const startDate = subDays(endDate, 6);

    try {
        const logsQuery = query(
            collection(db, "auditLogs"),
            where("timestamp", ">=", startDate),
            where("timestamp", "<=", endDate)
        );

        const logsSnapshot = await getDocs(logsQuery);
        const logs = logsSnapshot.docs.map(doc => doc.data() as { timestamp: Timestamp, actionType: string });
        
        const dateInterval = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) });
        const dailyCounts = new Map<string, { Requests: number, Suggestions: number, Swaps: number }>();

        // Initialize map for all days in the interval
        dateInterval.forEach(day => {
            dailyCounts.set(format(day, 'yyyy-MM-dd'), { Requests: 0, Suggestions: 0, Swaps: 0 });
        });
        
        // Aggregate logs by day
        logs.forEach(log => {
            const day = format(log.timestamp.toDate(), 'yyyy-MM-dd');
            const dayData = dailyCounts.get(day);
            if (dayData) {
                 if (log.actionType === 'CREATE_REQUEST') {
                    dayData.Requests += 1;
                } else if (log.actionType === 'SUBMIT_SUGGESTION') {
                    dayData.Suggestions += 1;
                } else if (log.actionType === 'REQUEST_FLIGHT_SWAP') {
                    dayData.Swaps += 1;
                }
            }
        });
        
        // Convert map to array and format for the chart
        const trendData = Array.from(dailyCounts.entries()).map(([date, counts]) => ({
            date: format(new Date(date), 'MMM d'), // Format for display
            ...counts
        }));
        
        return trendData;

    } catch (error) {
        console.error("Error fetching weekly trends:", error);
        return [];
    }
}
