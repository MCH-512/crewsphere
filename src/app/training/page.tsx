
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, AlertTriangle, BookOpen } from "lucide-react";
import { StoredCourse } from "@/schemas/course-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

export default function TrainingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [courses, setCourses] = React.useState<StoredCourse[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                const q = query(
                    collection(db, "courses"),
                    where("published", "==", true),
                    orderBy("createdAt", "desc")
                );
                const querySnapshot = await getDocs(q);
                const fetchedCourses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
                setCourses(fetchedCourses);
            } catch (error) {
                console.error("Error fetching courses:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCourses();
    }, [user, authLoading, router]);

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (!user) {
        return null; // Redirecting
    }

    return (
        <div className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course, index) => (
                        <AnimatedCard key={course.id} delay={0.1 + index * 0.05}>
                            <Card className="shadow-sm h-full flex flex-col hover:shadow-lg transition-shadow overflow-hidden">
                                <div className="relative h-40 w-full">
                                    <Image 
                                      src={`https://placehold.co/600x400.png`} 
                                      alt={course.title}
                                      data-ai-hint={course.imageHint || "training manual"}
                                      fill
                                      style={{ objectFit: 'cover' }}
                                    />
                                </div>
                                <CardHeader>
                                    <Badge variant={course.mandatory ? "default" : "secondary"} className="mb-2 w-fit">
                                        {course.mandatory ? "Mandatory" : "Optional"}
                                    </Badge>
                                    <CardTitle className="text-lg">{course.title}</CardTitle>
                                    <CardDescription className="text-xs pt-1">{course.category}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-3">{course.description}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full">
                                        <Link href={`/training/${course.id}`}>
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            Start Course
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        </AnimatedCard>
                    ))}
                </div>
            )}
        </div>
    );
}
