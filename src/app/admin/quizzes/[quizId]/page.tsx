
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { CheckSquare, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StoredQuestion } from "@/schemas/quiz-question-schema";
import { StoredQuiz } from "@/schemas/course-schema";
import { Badge } from "@/components/ui/badge";

export default function QuizDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const quizId = params.quizId as string;

    const [quiz, setQuiz] = React.useState<StoredQuiz | null>(null);
    const [questions, setQuestions] = React.useState<StoredQuestion[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchQuizAndQuestions = React.useCallback(async () => {
        if (!quizId) return;
        setIsLoading(true);
        setError(null);
        try {
            const quizDocRef = doc(db, "quizzes", quizId);
            const quizSnap = await getDoc(quizDocRef);

            if (!quizSnap.exists()) {
                setError("Quiz not found.");
                toast({ title: "Error", description: "The requested quiz could not be found.", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            setQuiz({ id: quizSnap.id, ...quizSnap.data() } as StoredQuiz);

            const q = query(collection(db, "questions"), where("quizId", "==", quizId), orderBy("createdAt", "asc"));
            const questionsSnap = await getDocs(q);
            setQuestions(questionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StoredQuestion)));

        } catch (err) {
            console.error("Error fetching quiz details:", err);
            setError("Failed to load quiz details.");
        } finally {
            setIsLoading(false);
        }
    }, [quizId, toast]);
    
    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchQuizAndQuestions();
        }
    }, [user, authLoading, router, fetchQuizAndQuestions]);

    if (isLoading || authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-4"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><CardTitle>{error}</CardTitle></div>;
    if (!quiz) return <div className="text-center p-4"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><CardTitle>Quiz data not available.</CardTitle></div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Button variant="outline" onClick={() => router.push('/admin/quizzes')}><ArrowLeft className="mr-2 h-4 w-4"/>Back to All Quizzes</Button>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center"><CheckSquare className="mr-3 h-7 w-7 text-primary" />{quiz.title}</CardTitle>
                    <CardDescription>Associated Course ID: {quiz.courseId}</CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Questions ({questions.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {questions.map((q, index) => (
                        <div key={q.id} className="p-4 border rounded-md bg-muted/50">
                            <p className="font-semibold">{index + 1}. {q.questionText}</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                                {q.options.map((opt, i) => (
                                    <li key={i} className={opt === q.correctAnswer ? "font-bold text-green-600" : ""}>
                                        {opt}
                                        {opt === q.correctAnswer && <Badge variant="success" className="ml-2">Correct</Badge>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    {questions.length === 0 && <p className="text-muted-foreground">No questions found for this quiz.</p>}
                </CardContent>
            </Card>
        </div>
    )
}

    