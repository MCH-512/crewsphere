
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { useAuth } from "@/contexts/auth-context";
import { TrainingProgressPieChart, type TrainingChartDataPoint } from "@/components/features/charts/training-progress-pie-chart";


export function TrainingProgressChart() {
    const { user } = useAuth();
    const [trainingChartData, setTrainingChartData] = React.useState<TrainingChartDataPoint[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        
        const getTrainingChartData = async () => {
            setIsLoading(true);
            try {
                const mandatoryCoursesQuery = query(collection(db, "courses"), where("mandatory", "==", true), where("published", "==", true));
                const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", user.uid), where("status", "==", "passed"));
                
                const [coursesSnap, attemptsSnap] = await Promise.all([getDocs(mandatoryCoursesQuery), getDocs(attemptsQuery)]);
                
                const mandatoryCoursesCount = coursesSnap.size;
                const passedCourseIds = new Set(attemptsSnap.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
                const completedCount = coursesSnap.docs.filter(doc => passedCourseIds.has(doc.id)).length;
                
                const chartData = [
                    { name: 'Completed', count: completedCount, fill: 'var(--color-completed)' },
                    { name: 'Pending', count: mandatoryCoursesCount - completedCount, fill: 'var(--color-pending)' },
                ];
                setTrainingChartData(chartData);

            } catch (error) {
                console.error("Error fetching training chart data:", error);
                setTrainingChartData([]);
            } finally {
                setIsLoading(false);
            }
        };

        getTrainingChartData();

    }, [user]);

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
                    <TrainingProgressPieChart data={trainingChartData} />
                )}
            </CardContent>
        </Card>
    );
}
