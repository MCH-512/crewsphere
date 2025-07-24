
"use client";

import * as React from "react";
import { Pie, PieChart, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";

const trainingChartConfig = {
  count: { label: "Courses" },
  completed: { label: "Completed", color: "hsl(var(--chart-2))" },
  pending: { label: "Pending", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

export interface TrainingChartDataPoint {
    name: string;
    count: number;
    fill: string;
}

interface TrainingProgressPieChartProps {
    data: TrainingChartDataPoint[];
}

export function TrainingProgressPieChart({ data }: TrainingProgressPieChartProps) {
    if (data.every(d => d.count === 0)) {
        return (
            <div className="flex items-center justify-center h-[250px]">
                <p className="text-muted-foreground">No mandatory training data available.</p>
            </div>
        );
    }
    
    return (
        <ChartContainer config={trainingChartConfig} className="min-h-[250px] w-full">
            <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="count" />} />
                <Pie data={data} dataKey="count" nameKey="name" innerRadius={60} strokeWidth={5}>
                    {data.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
        </ChartContainer>
    );
}
