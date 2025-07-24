
"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const requestsChartConfig = {
  count: { label: "Count", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

export interface RequestsChartDataPoint {
    status: string;
    count: number;
}

interface RequestsStatusBarChartProps {
    data: RequestsChartDataPoint[];
}

export function RequestsStatusBarChart({ data }: RequestsStatusBarChartProps) {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[250px]">
                <p className="text-muted-foreground">No request data to display.</p>
            </div>
        );
    }
    
    const chartData = data.map(item => ({ ...item, fill: "var(--color-count)" }));

    return (
        <ChartContainer config={requestsChartConfig} className="min-h-[250px] w-full">
            <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="status" tickLine={false} tickMargin={10} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={8} />
            </BarChart>
        </ChartContainer>
    );
}
