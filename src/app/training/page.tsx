
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, AlertTriangle, BookOpen, CheckCircle, XCircle, RefreshCw, Award } from "lucide-react";
import { StoredCourse } from "@/schemas/course-schema";
import { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface CourseWithProgress extends StoredCourse {
    progress?: StoredUserQuizAttempt;
}

const CourseProgressCard = ({ course }: { course: CourseWithProgress }) => {
    const status = course.progress?.status;
    const score = course.progress?.score;
    const completedAt = course.progress?.completedAt?.toDate();

    return (
        <AnimatedCard>
             <Card className="shadow-sm h-full flex flex-col hover:shadow-lg transition-shadow overflow-hidden">
                <div className="relative h-40 w-full">
                    <Image 
                      src={course.imageUrl || `https://placehold.co/600x400.png`}
                      alt={course.title}
                      data-ai-hint={course.imageHint || "training manual"}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                     {status && (
                        <Badge variant={status === 'passed' ? 'success' : 'destructive'} className="absolute top-2 right-2 capitalize font-semibold">
                           {status}
                        </Badge>
                     )}
                </div>
                <CardHeader>
                    <Badge variant={course.mandatory ? "destructive" : "secondary"} className="mb-2 w-fit">
                        {course.mandatory ? "Mandatory" : "Optional"}
                    </Badge>
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <CardDescription className="text-xs pt-1">{course.category}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-3">{course.description}</p>
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-2 pt-4">
                    {status === 'passed' && completedAt && (
                        <div className="flex items-center text-xs text-success-foreground font-medium p-2 rounded-md bg-success/90">
                            <CheckCircle className="mr-2 h-4 w-4"/>
                            <span>Passed on {format(completedAt, 'PP')}</span>
                        </div>
                    )}
                     {status === 'failed' && score !== undefined && (
                        <div className="flex items-center text-xs text-destructive-foreground font-medium p-2 rounded-md bg-destructive">
                            <XCircle className="mr-2 h-4 w-4"/>
                            <span>Failed (Score: {score.toFixed(0)}%)</span>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                        {status === 'passed' && course.progress?.id ? (
                            <>
                                <Button asChild variant="outline" className="flex-1">
                                    <Link href={`/training/${course.id}`}><BookOpen className="mr-2 h-4 w-4" />Review</Link>
                                </Button>
                                <Button asChild className="flex-1">
                                    <Link href={`/training/certificate/${course.progress.id}`}>
                                        <Award className="mr-2 h-4 w-4" />Certificate
                                    </Link>
                                </Button>
                            </>
                        ) : status === 'failed' ? (
                             <Button asChild className="w-full">
                                 <Link href={`/training/quiz/${course.quizId}`}><RefreshCw className="mr-2 h-4 w-4" />Retake Quiz</Link>
                             </Button>
                        ) : (
                             <Button asChild className="w-full">
                                <Link href={`/training/${course.id}`}><BookOpen className="mr-2 h-4 w-4" />Start Course</Link>
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </AnimatedCard>
    );
};


export default function TrainingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [courses, setCourses] = React.useState<CourseWithProgress[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchCoursesAndProgress = async () => {
            setIsLoading(true);
            try {
                // Fetch all published courses
                const coursesQuery = query(
                    collection(db, "courses"),
                    where("published", "==", true),
                    orderBy("createdAt", "desc")
                );
                
                // Fetch all quiz attempts for the user
                const attemptsQuery = query(
                    collection(db, "userQuizAttempts"),
                    where("userId", "==", user.uid),
                    orderBy("completedAt", "desc")
                );

                const [coursesSnapshot, attemptsSnapshot] = await Promise.all([
                    getDocs(coursesQuery),
                    getDocs(attemptsQuery)
                ]);

                const fetchedCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
                const fetchedAttempts = attemptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserQuizAttempt));
                
                // Create a map to store the latest attempt for each course
                const latestAttempts = new Map<string, StoredUserQuizAttempt>();
                for (const attempt of fetchedAttempts) {
                    if (!latestAttempts.has(attempt.courseId)) {
                        latestAttempts.set(attempt.courseId, attempt);
                    }
                }

                // Merge progress into courses
                const coursesWithProgress: CourseWithProgress[] = fetchedCourses.map(course => ({
                    ...course,
                    progress: latestAttempts.get(course.id),
                }));

                setCourses(coursesWithProgress);

            } catch (error) {
                console.error("Error fetching courses and progress:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCoursesAndProgress();
    }, [user, authLoading, router]);

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (!user) {
        return null; // Redirecting
    }

    const mandatoryCourses = courses.filter(c => c.mandatory);
    const optionalCourses = courses.filter(c => !c.mandatory);

    return (
        <div className="space-y-8">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <GraduationCap className="mr-3 h-7 w-7 text-primary" />
                            E-Learning Center
                        </CardTitle>
                        <CardDescription>Browse and complete your assigned and optional training courses.</CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            {courses.length === 0 ? (
                <AnimatedCard delay={0.1}>
                    <Card className="text-center py-12">
                        <CardContent>
                            <p className="text-muted-foreground mb-4">No training courses are currently available.</p>
                        </CardContent>
                    </Card>
                </AnimatedCard>
            ) : (
                <div className="space-y-8">
                    {/* Mandatory Courses Section */}
                    <section>
                        <h2 className="text-2xl font-bold tracking-tight mb-4">Mandatory Courses</h2>
                        <Separator className="mb-6"/>
                        {mandatoryCourses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {mandatoryCourses.map((course, index) => (
                                    <CourseProgressCard key={course.id} course={course} />
                                ))}
                            </div>
                        ) : (
                             <p className="text-muted-foreground text-center py-8">No mandatory courses assigned.</p>
                        )}
                    </section>
                    
                     {/* Optional Courses Section */}
                    {optionalCourses.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold tracking-tight mb-4">Optional Courses</h2>
                             <Separator className="mb-6"/>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {optionalCourses.map((course, index) => (
                                     <CourseProgressCard key={course.id} course={course} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
    
