
import "server-only";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getCurrentUser } from "@/lib/session";
import { RequestsStatusBarChart, type RequestsChartDataPoint } from "./charts/requests-status-bar-chart";

async function getRequestsChartData(userId: string | undefined): Promise<RequestsChartDataPoint[]> {
    if (!userId) return [];
    
    try {
        const requestsQuery = query(collection(db, "requests"), where("userId", "==", userId));
        const requestsSnap = await getDocs(requestsQuery);
        const requestsByStatus = requestsSnap.docs.reduce((acc, doc) => {
            const status = doc.data().status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(requestsByStatus).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
            count,
        }));
    } catch (error) {
        console.error("Error fetching requests chart data:", error);
        return [];
    }
}

export async function RequestsStatusChart() {
    const user = await getCurrentUser();
    const requestsChartData = await getRequestsChartData(user?.uid);

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><Inbox className="h-5 w-5 text-primary"/>My Requests Status</CardTitle>
                <CardDescription>A summary of your recent submissions.</CardDescription>
            </CardHeader>
            <CardContent>
                <RequestsStatusBarChart data={requestsChartData} />
            </CardContent>
        </Card>
    );
}
