
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2 } from "lucide-react";
import { TrainingProgressPieChart, type TrainingChartDataPoint } from "@/components/features/charts/training-progress-pie-chart";

export function TrainingProgressChart({ initialData }: { initialData: TrainingChartDataPoint[] | null }) {
    const [trainingChartData] = React.useState(initialData);
    const [isLoading] = React.useState(!initialData);
    
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Mandatory Training Overview</CardTitle>
                <CardDescription>A summary of your required e-learning courses.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="flex items-center justify-center h-[250px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <TrainingProgressPieChart data={trainingChartData || []} />
                )}
            </CardContent>
        </Card>
    );
}
