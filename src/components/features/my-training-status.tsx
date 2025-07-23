
"use server";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { GraduationCap, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { StoredCourse } from "@/schemas/course-schema";
import { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { getCurrentUser } from "@/lib/session";

async function getTrainingStatus(userId: string | undefined): Promise<{ totalMandatory: number; completed: number; nextCourseId?: string; }> {
    if (!userId) {
        return { totalMandatory: 0, completed: 0 };
    }
    
    const coursesQuery = query(collection(db, "courses"), where("published", "==", true), where("mandatory", "==", true));
    const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", userId), where("status", "==", "passed"));
    const [coursesSnapshot, attemptsSnapshot] = await Promise.all([getDocs(coursesQuery), getDocs(attemptsQuery)]);

    const mandatoryCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
    const passedCourseIds = new Set(attemptsSnapshot.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
    
    const completedCount = mandatoryCourses.filter(c => passedCourseIds.has(c.id)).length;
    const outstandingCourses = mandatoryCourses.filter(c => !passedCourseIds.has(c.id));
    
    return {
        totalMandatory: mandatoryCourses.length,
        completed: completedCount,
        nextCourseId: outstandingCourses.length > 0 ? outstandingCourses[0].id : undefined
    };
}


export async function MyTrainingStatusCard() {
    const user = await getCurrentUser();
    const stats = await getTrainingStatus(user?.uid);
    const coursesToDo = stats.totalMandatory - stats.completed;

    return (
        <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    My Training Status
                </CardTitle>
                 <CardDescription>Your mandatory training progress.</CardDescription>
            </CardHeader>
            <CardContent>
                {coursesToDo > 0 ? (
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="h-8 w-8 text-yellow-500 mt-1" />
                        <div>
                            <p className="font-semibold text-lg">{coursesToDo} mandatory course(s) to complete</p>
                            <p className="text-sm text-muted-foreground">Stay up-to-date with your required training to ensure compliance and safety.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-4">
                        <CheckCircle className="h-8 w-8 text-green-600 mt-1" />
                         <div>
                            <p className="font-semibold text-lg">All mandatory training complete!</p>
                            <p className="text-sm text-muted-foreground">Excellent work. You are fully compliant with all training requirements.</p>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button asChild className="w-full">
                    <Link href={coursesToDo > 0 && stats.nextCourseId ? `/training/${stats.nextCourseId}` : '/training'}>
                        {coursesToDo > 0 ? 'Start Next Course' : 'Go to E-Learning Center'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
