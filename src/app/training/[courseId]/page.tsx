"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft, CheckCircle, Clock, BookOpen, ListChecks, Award } from "lucide-react";
import { StoredCourse, StoredUserQuizAttempt } from "@/schemas/course-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import placeholderImages from "@/app/lib/placeholder-images.json";

export default function CourseDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const courseId = params.courseId as string;

    const [course, setCourse] = React.useState<StoredCourse | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [readChapters, setReadChapters] = React.useState<string[]>([]);
    const [lastAttempt, setLastAttempt] = React.useState<StoredUserQuizAttempt | null>(null);

    React.useEffect(() => {
        if (!courseId || authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchCourseAndProgress = async () => {
            setIsLoading(true);
            try {
                const courseDocRef = doc(db, "courses", courseId);
                const courseSnap = await getDoc(courseDocRef);

                if (courseSnap.exists() && courseSnap.data().published) {
                    setCourse({ id: courseSnap.id, ...courseSnap.data() } as StoredCourse);
                } else {
                    setError("Course not found or is not available.");
                    setIsLoading(false);
                    return;
                }

                // Load user progress for this specific course
                const userProgressRef = doc(db, "userProgress", user.uid, "courses", courseId);
                const progressSnap = await getDoc(userProgressRef);
                if (progressSnap.exists()) {
                    setReadChapters(progressSnap.data().readChapters || []);
                }
                
                // Fetch last quiz attempt
                const attemptsRef = collection(db, "userQuizAttempts");
                const q = query(
                    attemptsRef,
                    where("userId", "==", user.uid),
                    where("courseId", "==", courseId),
                    orderBy("completedAt", "desc"),
                    limit(1)
                );
                const attemptsSnapshot = await getDocs(q);
                if (!attemptsSnapshot.empty) {
                    setLastAttempt(attemptsSnapshot.docs[0].data() as StoredUserQuizAttempt);
                }


            } catch (err) {
                console.error("Error fetching course:", err);
                setError("Failed to load the course.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchCourseAndProgress();
    }, [courseId, user, authLoading, router]);

     const handleChapterToggle = async (chapterTitle: string, isChecked: boolean) => {
        if (!user) return;

        const updatedReadChapters = isChecked
            ? [...readChapters, chapterTitle]
            : readChapters.filter(title => title !== chapterTitle);
        
        setReadChapters(updatedReadChapters);

        try {
            const userProgressRef = doc(db, "userProgress", user.uid, "courses", courseId);
            // Use set with merge:true to create or update the document
            await setDoc(userProgressRef, { readChapters: updatedReadChapters }, { merge: true });
        } catch (error) {
            toast({ title: "Error", description: "Could not save your progress.", variant: "destructive"});
            // Revert optimistic update on failure
            setReadChapters(readChapters);
        }
    };

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (error) {
        return (
            <div className="text-center py-10">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                <p className="mt-4 text-lg">{error}</p>
                <Button onClick={() => router.push('/training')} className="mt-4">Back to Training</Button>
            </div>
        );
    }
    
    if (!course) {
        return null;
    }

    const allChaptersRead = course.chapters && readChapters.length === course.chapters.length;
    const chaptersToReadCount = course.chapters ? course.chapters.length - readChapters.length : 0;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => router.push('/training')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to E-Learning Center</Button>
                 {lastAttempt?.status === 'passed' && lastAttempt.id && (
                    <Button variant="success" asChild>
                        <Link href={`/training/certificate/${lastAttempt.id}`}><Award className="mr-2 h-4 w-4"/>View Certificate</Link>
                    </Button>
                )}
            </div>
             <Card className="shadow-lg overflow-hidden">
                 <div className="relative h-60 w-full">
                    <Image
                        src={course.imageUrl || placeholderImages.course.default.src}
                        alt={course.title}
                        data-ai-hint={course.imageHint || placeholderImages.course.default.hint}
                        fill
                        style={{ objectFit: 'cover' }}
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-6">
                        <Badge variant={course.mandatory ? "default" : "secondary"}>{course.mandatory ? "Mandatory" : "Optional"}</Badge>
                        <CardTitle className="text-3xl font-headline text-primary-foreground mt-2">{course.title}</CardTitle>
                        <CardDescription className="text-primary-foreground/80">{course.category}</CardDescription>
                    </div>
                </div>
                <CardContent className="p-6">
                    <p className="text-muted-foreground whitespace-pre-wrap">{course.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
                        <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Duration: {course.duration}</div>
                        {course.referenceBody && <div className="flex items-center gap-1.5"><BookOpen className="h-4 w-4"/> Reference: {course.referenceBody}</div>}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary"/>Course Content & Chapters</CardTitle>
                    <CardDescription>
                        Read each chapter, then mark it as complete to unlock the final quiz. 
                        {chaptersToReadCount > 0 && ` You have ${chaptersToReadCount} chapter(s) left.`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Accordion type="multiple" className="w-full">
                    {course.chapters && course.chapters.map((chapter, index) => (
                        <AccordionItem value={`item-${index}`} key={index}>
                            <AccordionTrigger>
                               <div className="flex items-center space-x-3">
                                   <Checkbox 
                                        id={`chapter-${index}`} 
                                        onCheckedChange={(checked) => handleChapterToggle(chapter.title, !!checked)}
                                        checked={readChapters.includes(chapter.title)}
                                        onClick={(e) => e.stopPropagation()} // Prevent trigger from firing on checkbox click
                                    />
                                    <Label htmlFor={`chapter-${index}`} className="text-base font-medium cursor-pointer">
                                       {index + 1}. {chapter.title}
                                    </Label>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground pl-12 py-4">
                               <p>{chapter.content}</p>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                   </Accordion>
                </CardContent>
            </Card>
            
            <div className="flex justify-end">
                 <Button size="lg" asChild disabled={!allChaptersRead}>
                    <Link href={`/training/quiz/${course.quizId}`}>
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Start Quiz
                    </Link>
                </Button>
            </div>
             {!allChaptersRead && (
                <p className="text-sm text-right text-muted-foreground -mt-4">
                    Complete all chapters to enable the quiz.
                </p>
            )}

        </div>
    );
}