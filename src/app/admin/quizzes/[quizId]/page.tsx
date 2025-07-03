
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { CheckSquare, Loader2, AlertTriangle, ArrowLeft, PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StoredQuestion } from "@/schemas/quiz-question-schema";
import { StoredQuiz } from "@/schemas/course-schema";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { questionFormSchema, type QuestionFormValues } from "@/schemas/quiz-question-schema";
import { logAuditEvent } from "@/lib/audit-logger";

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

    const [isManageQuestionDialogOpen, setIsManageQuestionDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentQuestion, setCurrentQuestion] = React.useState<StoredQuestion | null>(null);

    const form = useForm<QuestionFormValues>({
        resolver: zodResolver(questionFormSchema),
        defaultValues: {
            questionText: "",
            options: ["", "", "", ""],
            correctAnswer: "",
        },
    });

    const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
        control: form.control,
        name: "options"
    });

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

        } catch (err: any) {
            console.error("Error fetching quiz details:", err);
            setError(err.message || "Failed to load quiz details.");
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
    
    const handleOpenDialog = (questionToEdit?: StoredQuestion) => {
        if (questionToEdit) {
            setIsEditMode(true);
            setCurrentQuestion(questionToEdit);
            form.reset({
                questionText: questionToEdit.questionText,
                options: questionToEdit.options,
                correctAnswer: questionToEdit.correctAnswer,
            });
        } else {
            setIsEditMode(false);
            setCurrentQuestion(null);
            form.reset({ questionText: "", options: ["", "", "", ""], correctAnswer: "" });
        }
        setIsManageQuestionDialogOpen(true);
    };

    const handleFormSubmit = async (data: QuestionFormValues) => {
        if (!user || !quiz) return;
        setIsSubmitting(true);
        try {
            if (isEditMode && currentQuestion) {
                const questionRef = doc(db, "questions", currentQuestion.id);
                await updateDoc(questionRef, { ...data, updatedAt: serverTimestamp() });
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'UPDATE_QUESTION', entityId: currentQuestion.id, details: { quizId } });
                toast({ title: "Question Updated", description: "The question has been updated successfully." });
            } else {
                const questionData = { ...data, quizId: quiz.id, questionType: 'mcq', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
                const newQuestionRef = await addDoc(collection(db, "questions"), questionData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'CREATE_QUESTION', entityId: newQuestionRef.id, details: { quizId } });
                toast({ title: "Question Created", description: "The new question has been added to the quiz." });
            }
            fetchQuizAndQuestions();
            setIsManageQuestionDialogOpen(false);
        } catch (error) {
            console.error("Error submitting question:", error);
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteQuestion = async (questionId: string) => {
        if (!user || !window.confirm("Are you sure you want to delete this question? This action cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, "questions", questionId));
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'DELETE_QUESTION', entityId: questionId, details: { quizId } });
            toast({ title: "Question Deleted", description: "The question has been permanently removed." });
            fetchQuizAndQuestions();
        } catch (error) {
            console.error("Error deleting question:", error);
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

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
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle className="text-lg">Questions ({questions.length})</CardTitle>
                    <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Add Question</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {questions.map((q, index) => (
                        <div key={q.id} className="p-4 border rounded-md bg-muted/50 group relative">
                            <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDialog(q)}><Edit className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
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
                    {questions.length === 0 && <p className="text-muted-foreground text-center py-6">No questions found for this quiz. Add one to get started.</p>}
                </CardContent>
            </Card>

            <Dialog open={isManageQuestionDialogOpen} onOpenChange={setIsManageQuestionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Question" : "Add New Question"}</DialogTitle>
                        <DialogDescription>
                            {isEditMode ? "Update the question details below." : "Fill out the form to add a new question to this quiz."}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                             <FormField control={form.control} name="questionText" render={({ field }) => (
                                <FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            
                            <div className="space-y-2">
                                <FormLabel>Answer Options</FormLabel>
                                {optionFields.map((field, index) => (
                                    <FormField key={field.id} control={form.control} name={`options.${index}`} render={({ field }) => (
                                        <FormItem className="flex items-center gap-2">
                                            <FormControl><Input {...field} placeholder={`Option ${index + 1}`} /></FormControl>
                                            {optionFields.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                ))}
                                {optionFields.length < 5 && <Button type="button" variant="outline" size="sm" onClick={() => appendOption("")}>Add Option</Button>}
                            </div>

                             <FormField control={form.control} name="correctAnswer" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Correct Answer</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select the correct option" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {form.watch('options').filter(opt => opt?.trim()).map((opt, index) => (
                                                <SelectItem key={index} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    {isEditMode ? "Save Changes" : "Add Question"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

        </div>
    )
}
