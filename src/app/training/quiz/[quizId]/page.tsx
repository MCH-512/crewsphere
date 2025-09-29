
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle, XCircle, FileQuestion, Send, Award, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StoredQuestion } from "@/schemas/quiz-question-schema";
import { StoredQuiz, StoredCertificateRule, StoredCourse } from "@/schemas/course-schema";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { logAuditEvent } from "@/lib/audit-logger";
import Link from "next/link";

type QuizState = 'instructions' | 'taking' | 'submitted';

export default function QuizPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const quizId = params.quizId as string;

    const [quizData, setQuizData] = React.useState<StoredQuiz | null>(null);
    const [certRule, setCertRule] = React.useState<StoredCertificateRule | null>(null);
    const [questions, setQuestions] = React.useState<StoredQuestion[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    
    const [quizState, setQuizState] = React.useState<QuizState>('instructions');
    const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
    const [userAnswers, setUserAnswers] = React.useState<Record<string, string>>({}); // { questionId: selectedOption }
    const [score, setScore] = React.useState<number | null>(null);
    const [newAttemptId, setNewAttemptId] = React.useState<string | null>(null);


    const fetchQuizDetails = React.useCallback(async () => {
        if (!quizId) return;
        setIsLoading(true);
        setError(null);
        try {
            const quizDocRef = doc(db, "quizzes", quizId);
            const quizSnap = await getDoc(quizDocRef);
            if (!quizSnap.exists()) throw new Error("Quiz not found.");
            const quiz = { id: quizSnap.id, ...quizSnap.data() } as StoredQuiz;
            setQuizData(quiz);

            const coursesQuery = query(collection(db, "courses"), where("quizId", "==", quizId), limit(1));
            const courseSnap = await getDocs(coursesQuery);
            if (courseSnap.empty) throw new Error("Associated course not found.");
            const course = courseSnap.docs[0].data() as StoredCourse;

            if (!course.certificateRuleId) throw new Error("Certification rules not defined for this course.");
            const certRuleRef = doc(db, "certificateRules", course.certificateRuleId);
            const certRuleSnap = await getDoc(certRuleRef);
            if (!certRuleSnap.exists()) throw new Error("Certification rules not found.");
            setCertRule({ id: certRuleSnap.id, ...certRuleSnap.data() } as StoredCertificateRule);

            const questionsQuery = query(collection(db, "questions"), where("quizId", "==", quizId), orderBy("createdAt", "asc"));
            const questionsSnap = await getDocs(questionsQuery);
            setQuestions(questionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StoredQuestion)));

        } catch (err: unknown) {
            const e = err as Error;
            console.error("Error fetching quiz details:", e);
            setError(e.message || "Failed to load quiz details.");
            toast({ title: "Loading Error", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [quizId, toast]);
    
    React.useEffect(() => {
        if (!authLoading && user) fetchQuizDetails();
        else if (!authLoading && !user) router.push('/login');
    }, [user, authLoading, router, fetchQuizDetails]);

    const handleAnswerSelect = (questionId: string, answer: string) => {
        setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleSubmitQuiz = async () => {
        if (!user || !quizData || !certRule) return;

        let correctAnswers = 0;
        questions.forEach(q => {
            if (userAnswers[q.id] === q.correctAnswer) {
                correctAnswers++;
            }
        });
        const calculatedScore = (correctAnswers / questions.length) * 100;
        setScore(calculatedScore);
        
        const passed = calculatedScore >= certRule.passingThreshold;

        try {
            // Log the audit event for system tracking
            await logAuditEvent({
                userId: user.uid,
                userEmail: user.email!,
                actionType: "COMPLETE_QUIZ",
                entityType: "QUIZ_ATTEMPT",
                entityId: quizData.id,
                details: {
                    score: calculatedScore,
                    passed: passed,
                    courseId: quizData.courseId,
                },
            });

            // Save the quiz attempt for user progress tracking
            const attemptData = {
                userId: user.uid,
                courseId: quizData.courseId,
                quizId: quizData.id,
                score: calculatedScore,
                status: passed ? 'passed' : 'failed',
                completedAt: serverTimestamp(),
                answers: userAnswers,
            };
            const newDocRef = await addDoc(collection(db, "userQuizAttempts"), attemptData);
            setNewAttemptId(newDocRef.id);

            toast({
                title: "Quiz Results Saved",
                description: `Your score of ${calculatedScore.toFixed(0)}% has been recorded.`,
                variant: passed ? "success" : "default",
            });
            setQuizState('submitted');

        } catch (error) {
            console.error("Error saving quiz attempt:", error);
            toast({
                title: "Save Error",
                description: "There was a problem saving your quiz results. Please contact support.",
                variant: "destructive",
            });
        }
    };

    if (isLoading || authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (error) return <div className="text-center p-4"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><CardTitle>{error}</CardTitle></div>;
    if (!quizData || !certRule || questions.length === 0) return <div className="text-center p-4"><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><CardTitle>Quiz data is incomplete or missing.</CardTitle></div>;


    if (quizState === 'instructions') {
        return (
            <Card className="max-w-2xl mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2"><FileQuestion className="h-6 w-6 text-primary"/>{quizData.title}</CardTitle>
                    <CardDescription>Ready to test your knowledge?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>This quiz consists of <strong>{questions.length} questions</strong>.</p>
                    <p>You need a score of <strong>{certRule.passingThreshold}%</strong> or higher to pass.</p>
                    <p>Good luck!</p>
                </CardContent>
                <CardFooter>
                    <Button size="lg" onClick={() => setQuizState('taking')}>Start Quiz</Button>
                </CardFooter>
            </Card>
        );
    }
    
    if (quizState === 'taking') {
        const currentQuestion = questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        return (
            <Card className="max-w-3xl mx-auto shadow-lg">
                <CardHeader>
                    <Progress value={progress} className="w-full" />
                    <CardDescription className="text-center pt-2">Question {currentQuestionIndex + 1} of {questions.length}</CardDescription>
                    <CardTitle className="text-xl pt-4">{currentQuestion.questionText}</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup
                        onValueChange={(value) => handleAnswerSelect(currentQuestion.id, value)}
                        value={userAnswers[currentQuestion.id] || ""}
                        className="space-y-3"
                    >
                        {currentQuestion.options.map((option, index) => (
                            <div key={index} className="flex items-center space-x-3 border rounded-md p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                                <RadioGroupItem value={option} id={`${currentQuestion.id}-opt-${index}`} />
                                <Label htmlFor={`${currentQuestion.id}-opt-${index}`} className="flex-1 cursor-pointer">{option}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentQuestionIndex(prev => prev - 1)} disabled={currentQuestionIndex === 0}>Previous</Button>
                    {currentQuestionIndex < questions.length - 1 ? (
                        <Button onClick={() => setCurrentQuestionIndex(prev => prev + 1)} disabled={!userAnswers[currentQuestion.id]}>Next</Button>
                    ) : (
                        <Button onClick={handleSubmitQuiz} className="bg-green-600 hover:bg-green-700" disabled={!userAnswers[currentQuestion.id]}><Send className="mr-2 h-4 w-4"/>Submit Quiz</Button>
                    )}
                </CardFooter>
            </Card>
        );
    }
    
    if (quizState === 'submitted' && score !== null) {
        const passed = score >= certRule.passingThreshold;
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <Card className={cn("shadow-lg", passed ? "bg-green-500/10 border-green-500" : "bg-destructive/10 border-destructive")}>
                    <CardHeader className="text-center">
                        {passed ? <CheckCircle className="mx-auto h-16 w-16 text-green-600" /> : <XCircle className="mx-auto h-16 w-16 text-destructive" />}
                        <CardTitle className="text-3xl mt-4">{passed ? "Congratulations, You Passed!" : "Quiz Failed"}</CardTitle>
                        <CardDescription className={cn("text-lg", passed ? "text-green-700" : "text-destructive-foreground")}>Your score: <strong>{score.toFixed(0)}%</strong> (Required: {certRule.passingThreshold}%)</CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center gap-4">
                        <Button onClick={() => router.push('/training')}>Return to E-Learning Center</Button>
                        {passed && newAttemptId && (
                           <Button asChild>
                               <Link href={`/training/certificate/${newAttemptId}`}>
                                   <Award className="mr-2 h-4 w-4" /> View Certificate
                               </Link>
                           </Button>
                        )}
                         {!passed && (
                           <Button onClick={() => window.location.reload()}>
                               <RefreshCw className="mr-2 h-4 w-4" /> Retake Quiz
                           </Button>
                        )}
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Review Your Answers</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {questions.map((q, qIndex) => {
                            const userAnswer = userAnswers[q.id];
                            const isCorrect = userAnswer === q.correctAnswer;
                            return (
                                <div key={q.id} className="p-4 border rounded-md">
                                    <p className="font-semibold">{qIndex + 1}. {q.questionText}</p>
                                    <div className="mt-2 space-y-2 text-sm">
                                        {q.options.map((opt, optIndex) => {
                                            const isUserAnswer = userAnswer === opt;
                                            const isCorrectAnswer = q.correctAnswer === opt;
                                            return (
                                                <div key={`${q.id}-opt-${optIndex}`} className={cn("p-2 rounded-md flex items-center gap-2", 
                                                    isCorrectAnswer && "bg-green-500/10 text-green-800 font-semibold",
                                                    isUserAnswer && !isCorrectAnswer && "bg-destructive/10 text-destructive line-through"
                                                )}>
                                                    {isCorrectAnswer ? <CheckCircle className="h-4 w-4 text-green-600"/> : isUserAnswer ? <XCircle className="h-4 w-4 text-destructive"/> : <div className="h-4 w-4"/>}
                                                    {opt}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {!isCorrect && <p className="text-xs text-muted-foreground mt-2">Your answer: {userAnswer || "Not answered"}</p>}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return null; // Should not be reached