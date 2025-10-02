
'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, getDocs, query, where, getCountFromServer, Timestamp, orderBy } from "firebase/firestore";
import type { AdminDashboardStats } from "@/config/nav";
import { getCurrentUser } from "@/lib/session";
import { startOfDay, subDays, format, eachDayOfInterval } from 'date-fns';
import { unstable_cache as cache } from 'next/cache';
import { z } from 'zod';

const EmptySchema = z.object({});


export interface WeeklyTrendDataPoint {
    date: string;
    Requests: number;
    Suggestions: number;
    Swaps: number;
}

/**
 * Fetches and aggregates key statistics for the admin dashboard.
 * This function performs several count queries in parallel and is cached.
 * @returns A promise that resolves to an AdminDashboardStats object or null on error.
 */
export const getAdminDashboardStats = cache(
    async (): Promise<AdminDashboardStats | null> => {
        EmptySchema.parse({}); // Zod validation
        const user = await getCurrentUser();
        if (!user || user.role !== 'admin' || !isConfigValid || !db) {
            return {
                pendingRequests: 0, pendingDocValidations: 0, newSuggestions: 0,
                pendingSwaps: 0, pendingReports: 0, activeAlerts: 0, openPullRequests: 0,
            };
        }

        try {
            const requestsQuery = query(collection(db, "requests"), where("status", "in", ["pending", "in-progress"]));
            const validationsQuery = query(collection(db, "userDocuments"), where("status", "==", "pending-validation"));
            const suggestionsQuery = query(collection(db, "suggestions"), where("status", "==", "new"));
            const swapsQuery = query(collection(db, "flightSwaps"), where("status", "==", "pending_approval"));
            const reportsQuery = query(collection(db, "purserReports"), where("status", "==", "submitted"));
            const alertsQuery = query(collection(db, "alerts"), where("isActive", "==", true));

            const [
                requestsSnapshot, validationsSnapshot, suggestionsSnapshot,
                swapsSnapshot, reportsSnapshot, alertsSnapshot
            ] = await Promise.all([
                getCountFromServer(requestsQuery), getCountFromServer(validationsQuery),
                getCountFromServer(suggestionsQuery), getCountFromServer(swapsQuery),
                getCountFromServer(reportsQuery), getCountFromServer(alertsQuery),
            ]);

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
            return {
                pendingRequests: 0, pendingDocValidations: 0, newSuggestions: 0,
                pendingSwaps: 0, pendingReports: 0, activeAlerts: 0, openPullRequests: 0,
            };
        }
    },
    ['admin-dashboard-stats'], // Cache key
    {
        revalidate: 60, // Revalidate every 60 seconds
        tags: ['admin-dashboard', 'stats'], // Tags for on-demand revalidation
    }
);


/**
 * Fetches and aggregates daily counts for key activities over the last 7 days.
 * This function is cached for 1 hour to improve performance and reduce costs.
 * @returns A promise that resolves to an array of daily trend data.
 */
export const getAdminDashboardWeeklyTrends = cache(
    async (): Promise<WeeklyTrendDataPoint[]> => {
        EmptySchema.parse({}); // Zod validation
        const user = await getCurrentUser();
        if (!user || user.role !== 'admin' || !isConfigValid || !db) {
            return [];
        }

        const endDate = new Date();
        const startDate = startOfDay(subDays(endDate, 6)); // Get data for the last 7 days including today

        try {
            const logsQuery = query(
                collection(db, "auditLogs"),
                where("timestamp", ">=", startDate),
                where("timestamp", "<=", endDate),
                where("actionType", "in", ["CREATE_REQUEST", "SUBMIT_SUGGESTION", "REQUEST_FLIGHT_SWAP"]),
                orderBy("timestamp", "asc")
            );

            const logsSnapshot = await getDocs(logsQuery);
            const logs = logsSnapshot.docs.map(doc => doc.data() as { timestamp: Timestamp, actionType: string });
            
            const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
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
            // Return an empty array on error to prevent the page from crashing.
            return [];
        }
    },
    ['admin-weekly-trends'], // Cache key
    {
        revalidate: 3600, // Revalidate every hour
        tags: ['admin-dashboard', 'trends'], // Tags for on-demand revalidation
    }
);
