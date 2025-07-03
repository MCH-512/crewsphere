
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CheckSquare, Loader2, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StoredQuiz, StoredCourse } from "@/schemas/course-schema";
import Link from 'next/link';

interface QuizWithCourseTitle extends StoredQuiz {
    courseTitle?: string;
}

export default function AdminQuizzesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [quizzes, setQuizzes] = React.useState<QuizWithCourseTitle[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const fetchQuizzes = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            
            const quizzesData = await Promise.all(snapshot.docs.map(async (quizDoc) => {
                const quizData = { id: quizDoc.id, ...quizDoc.data() } as StoredQuiz;
                let courseTitle = "N/A";
                if (quizData.courseId) {
                    const courseSnap = await getDoc(doc(db, "courses", quizData.courseId));
                    if (courseSnap.exists()) {
                        courseTitle = (courseSnap.data() as StoredCourse).title;
                    }
                }
                return { ...quizData, courseTitle };
            }));

            setQuizzes(quizzesData);
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Could not fetch quizzes.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchQuizzes();
        }
    }, [user, authLoading, router, fetchQuizzes]);


    if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!user || user.role !== 'admin') return <div className="text-center p-4"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><CardTitle>Access Denied</CardTitle></div>;


    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><CheckSquare className="mr-3 h-7 w-7 text-primary" />Quiz Management</CardTitle>
                        <CardDescription>View all quizzes and their associated courses.</CardDescription>
                    </div>
                     <Button variant="outline" onClick={fetchQuizzes} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader><TableRow><TableHead>Quiz Title</TableHead><TableHead>Associated Course</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {quizzes.map(quiz => (
                                <TableRow key={quiz.id}>
                                    <TableCell className="font-medium">{quiz.title}</TableCell>
                                    <TableCell>{quiz.courseTitle}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="sm">
                                            <Link href={`/admin/quizzes/${quiz.id}`}><Eye className="mr-2 h-4 w-4"/>View Details</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     {quizzes.length === 0 && <p className="text-center text-muted-foreground p-8">No quizzes found. Create a course to generate a quiz.</p>}
                </CardContent>
            </Card>
        </div>
    );
}

    