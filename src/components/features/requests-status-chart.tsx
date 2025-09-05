
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Loader2 } from "lucide-react";
import { RequestsStatusBarChart, type RequestsChartDataPoint } from "./charts/requests-status-bar-chart";

export function RequestsStatusChart({ initialData }: { initialData: RequestsChartDataPoint[] | null }) {
    const [requestsChartData] = React.useState(initialData);
    const [isLoading] = React.useState(!initialData);

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
                    <RequestsStatusBarChart data={requestsChartData || []} />
                )}
            </CardContent>
        </Card>
    );
}
