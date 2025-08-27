
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { GraduationCap, AlertTriangle, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { StoredCourse } from "@/schemas/course-schema";
import { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { useAuth } from "@/contexts/auth-context";

export function MyTrainingStatusCard() {
    const { user } = useAuth();
    const [stats, setStats] = React.useState<{ totalMandatory: number; completed: number; nextCourseId?: string; } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const getTrainingStatus = async () => {
            setIsLoading(true);
            const coursesQuery = query(collection(db, "courses"), where("published", "==", true), where("mandatory", "==", true));
            // Corrected query with user ID filter
            const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", user.uid), where("status", "==", "passed"));
            
            try {
                const [coursesSnapshot, attemptsSnapshot] = await Promise.all([getDocs(coursesQuery), getDocs(attemptsQuery)]);
                console.log(`Fetched ${coursesSnapshot.size} mandatory courses and ${attemptsSnapshot.size} passed attempts for user ${user.uid}.`);

                const mandatoryCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
                const passedCourseIds = new Set(attemptsSnapshot.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
                
                const completedCount = mandatoryCourses.filter(c => passedCourseIds.has(c.id)).length;
                const outstandingCourses = mandatoryCourses.filter(c => !passedCourseIds.has(c.id));
                
                setStats({
                    totalMandatory: mandatoryCourses.length,
                    completed: completedCount,
                    nextCourseId: outstandingCourses.length > 0 ? outstandingCourses[0].id : undefined
                });
            } catch(e) {
                console.error("Error fetching training status: ", e);
                setStats(null); // Set to null on error
            } finally {
                setIsLoading(false);
            }
        }

        getTrainingStatus();
    }, [user]);

    const coursesToDo = stats ? stats.totalMandatory - stats.completed : 0;

    return (
        <Card className="h-full shadow-md hover:shadow-lg transition-shadow flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    My Training Status
                </CardTitle>
                 <CardDescription>Your mandatory training progress.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                {isLoading ? (
                     <div className="flex items-start gap-4">
                        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mt-1" />
                         <div>
                            <p className="font-semibold text-lg">Loading status...</p>
                            <p className="text-sm text-muted-foreground">Checking your training records.</p>
                        </div>
                    </div>
                ) : !stats ? (
                     <div className="flex items-start gap-4">
                        <AlertTriangle className="h-6 w-6 text-destructive mt-1" />
                         <div>
                            <p className="font-semibold text-lg">Could not load status</p>
                            <p className="text-sm text-muted-foreground">There was an error fetching your data.</p>
                        </div>
                    </div>
                ) : coursesToDo > 0 ? (
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
                    <Link href={(coursesToDo > 0 && stats?.nextCourseId) ? `/training/${stats.nextCourseId}` : '/training'}>
                        {coursesToDo > 0 ? 'Start Next Course' : 'Go to E-Learning Center'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
