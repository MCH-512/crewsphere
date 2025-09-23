
"use server";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { TrainingProgressPieChart } from "@/components/features/charts/training-progress-pie-chart";
import { getTrainingChartData } from "@/services/dashboard-service";
import { z } from 'zod';

const EmptySchema = z.object({});

export async function TrainingProgressChart() {
    EmptySchema.parse({});
    const trainingChartData = await getTrainingChartData();
    
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Mandatory Training Overview</CardTitle>
                <CardDescription>A summary of your required e-learning courses.</CardDescription>
            </CardHeader>
            <CardContent>
                <TrainingProgressPieChart data={trainingChartData || []} />
            </CardContent>
        </Card>
    );
}
