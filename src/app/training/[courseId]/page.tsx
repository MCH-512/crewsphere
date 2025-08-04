
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft, CheckCircle, Clock, BookOpen, ListChecks } from "lucide-react";
import { StoredCourse } from "@/schemas/course-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function CourseDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const courseId = params.courseId as string;

    const [course, setCourse] = React.useState<StoredCourse | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [readChapters, setReadChapters] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!courseId) return;
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchCourse = async () => {
            setIsLoading(true);
            try {
                const courseDocRef = doc(db, "courses", courseId);
                const docSnap = await getDoc(courseDocRef);

                if (docSnap.exists() && docSnap.data().published) {
                    setCourse({ id: docSnap.id, ...docSnap.data() } as StoredCourse);
                } else {
                    setError("Course not found or is not available.");
                }
            } catch (err) {
                console.error("Error fetching course:", err);
                setError("Failed to load the course.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchCourse();
    }, [courseId, user, authLoading, router]);
    
    const handleChapterToggle = (chapterTitle: string, isChecked: boolean) => {
        setReadChapters(prev => 
            isChecked 
                ? [...prev, chapterTitle]
                : prev.filter(title => title !== chapterTitle)
        );
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
            </div>
             <Card className="shadow-lg overflow-hidden">
                 <div className="relative h-60 w-full">
                    <Image
                        src={course.imageUrl || `https://placehold.co/800x400.png`}
                        alt={course.title}
                        data-ai-hint={course.imageHint || "training manual"}
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
