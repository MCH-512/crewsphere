
import "server-only";

import * as React from "react";
import { Pie, PieChart, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { getCurrentUser } from "@/lib/session";

const trainingChartConfig = {
  count: { label: "Courses" },
  completed: { label: "Completed", color: "hsl(var(--chart-2))" },
  pending: { label: "Pending", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig

async function getTrainingChartData(userId: string | undefined): Promise<any[]> {
    if (!userId) return [];

    try {
        const mandatoryCoursesQuery = query(collection(db, "courses"), where("mandatory", "==", true), where("published", "==", true));
        const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", userId), where("status", "==", "passed"));
        
        const [coursesSnap, attemptsSnap] = await Promise.all([getDocs(mandatoryCoursesQuery), getDocs(attemptsQuery)]);
        
        const mandatoryCoursesCount = coursesSnap.size;
        const passedCourseIds = new Set(attemptsSnap.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
        const completedCount = coursesSnap.docs.filter(doc => passedCourseIds.has(doc.id)).length;
        
        return [
            { name: 'Completed', count: completedCount, fill: 'var(--color-completed)' },
            { name: 'Pending', count: mandatoryCoursesCount - completedCount, fill: 'var(--color-pending)' },
        ];
    } catch (error) {
        console.error("Error fetching training chart data:", error);
        return [];
    }
}

export async function TrainingProgressChart() {
    const user = await getCurrentUser();
    const trainingChartData = await getTrainingChartData(user?.uid);

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Mandatory Training Progress</CardTitle>
                <CardDescription>An overview of your required e-learning courses.</CardDescription>
            </CardHeader>
            <CardContent>
                {trainingChartData.some(d => d.count > 0) ? (
                    <ChartContainer config={trainingChartConfig} className="min-h-[250px] w-full">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent nameKey="count" />} />
                            <Pie data={trainingChartData} dataKey="count" nameKey="name" innerRadius={60} strokeWidth={5}>
                                <Cell key="cell-0" fill="var(--color-completed)" />
                                <Cell key="cell-1" fill="var(--color-pending)" />
                            </Pie>
                            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                    </ChartContainer>
                ) : (
                    <div className="flex items-center justify-center h-[250px]">
                        <p className="text-muted-foreground">No mandatory training data available.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

