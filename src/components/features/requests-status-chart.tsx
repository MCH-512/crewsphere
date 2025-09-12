
"use server";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import { RequestsStatusBarChart } from "./charts/requests-status-bar-chart";
import { getRequestsChartData } from "@/services/dashboard-service";


export async function RequestsStatusChart() {
    const requestsChartData = await getRequestsChartData();

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><Inbox className="h-5 w-5 text-primary"/>Summary of My Requests</CardTitle>
                <CardDescription>A breakdown of your submissions by their current status.</CardDescription>
            </CardHeader>
            <CardContent>
                <RequestsStatusBarChart data={requestsChartData || []} />
            </CardContent>
        </Card>
    );
}
