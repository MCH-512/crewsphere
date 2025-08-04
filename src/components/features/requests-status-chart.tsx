
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { RequestsStatusBarChart, type RequestsChartDataPoint } from "./charts/requests-status-bar-chart";

export function RequestsStatusChart() {
    const { user } = useAuth();
    const [requestsChartData, setRequestsChartData] = React.useState<RequestsChartDataPoint[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const getRequestsChartData = async () => {
            setIsLoading(true);
            try {
                const requestsQuery = query(collection(db, "requests"), where("userId", "==", user.uid));
                const requestsSnap = await getDocs(requestsQuery);
                const requestsByStatus = requestsSnap.docs.reduce((acc, doc) => {
                    const status = doc.data().status || 'unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
                
                const chartData = Object.entries(requestsByStatus).map(([status, count]) => ({
                    status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
                    count,
                }));
                setRequestsChartData(chartData);

            } catch (error) {
                console.error("Error fetching requests chart data:", error);
                setRequestsChartData([]);
            } finally {
                 setIsLoading(false);
            }
        };
        
        getRequestsChartData();

    }, [user]);

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><Inbox className="h-5 w-5 text-primary"/>Summary of My Requests</CardTitle>
                <CardDescription>A breakdown of your submissions by their current status.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center h-[250px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <RequestsStatusBarChart data={requestsChartData} />
                )}
            </CardContent>
        </Card>
    );
}
