
import "server-only";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { getCurrentUser } from "@/lib/session";
import { TrainingProgressPieChart, type TrainingChartDataPoint } from "@/components/features/charts/training-progress-pie-chart";

async function getTrainingChartData(userId: string | undefined): Promise<TrainingChartDataPoint[]> {
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
                <TrainingProgressPieChart data={trainingChartData} />
            </CardContent>
        </Card>
    );
}
