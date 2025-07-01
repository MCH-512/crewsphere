
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Loader2, AlertTriangle, CheckCircle, PlusCircle, Trash2, Edit3, RefreshCw, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, serverTimestamp, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  questionFormSchema,
  type QuestionFormValues,
  defaultQuestionFormValues,
  defaultQuestionOptionValue,
  type StoredQuestion,
  questionTypes as qTypesList
} from "@/schemas/quiz-question-schema";
import { courseCategories } from "@/config/course-options";
import { logAuditEvent } from "@/lib/audit-logger";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { parseQuestionFromText } from "@/ai/flows/parse-question-flow";

export default function QuestionBankPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [questions, setQuestions] = React.useState<StoredQuestion[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const [isFormDialogOpen, setIsFormDialogOpen] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [editingQuestion, setEditingQuestion] = React.useState<StoredQuestion | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [questionToDelete, setQuestionToDelete] = React.useState<StoredQuestion | null>(null);
    
    const [rawQuestionText, setRawQuestionText] = React.useState("");
    const [isParsing, setIsParsing] = React.useState(false);


    const form = useForm<QuestionFormValues>({
        resolver: zodResolver(questionFormSchema),
        defaultValues: defaultQuestionFormValues,
    });
    
    const { fields: mcqOptionFields, append: appendMcqOption, remove: removeMcqOption, replace: replaceMcqOptions } = useFieldArray({
      control: form.control,
      name: "options",
    });
    const watchedQuestionType = form.watch("questionType");
    
    const fetchQuestions = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "questions"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            const fetchedQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredQuestion));
            setQuestions(fetchedQuestions);
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch questions.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    React.useEffect(() => {
        if (!isFormDialogOpen) return;
        if (watchedQuestionType === "tf") {
            replaceMcqOptions([{ text: "True" }, { text: "False" }]);
            if (form.getValues("correctAnswer") !== "True" && form.getValues("correctAnswer") !== "False") {
              form.setValue("correctAnswer", "True");
            }
        } else if (watchedQuestionType === "mcq") {
            if (!mcqOptionFields || mcqOptionFields.length < 2) {
                replaceMcqOptions([defaultQuestionOptionValue, defaultQuestionOptionValue]);
            }
        }
    }, [watchedQuestionType, form, replaceMcqOptions, isFormDialogOpen, mcqOptionFields]);

    const openCreateDialog = () => {
        setIsEditMode(false);
        setEditingQuestion(null);
        form.reset(defaultQuestionFormValues);
        setIsFormDialogOpen(true);
    };

    const openEditDialog = (question: StoredQuestion) => {
        setIsEditMode(true);
        setEditingQuestion(question);
        form.reset({
            questionText: question.questionText,
            questionType: question.questionType,
            options: question.options ? question.options.map(opt => ({ text: opt })) : [],
            correctAnswer: question.correctAnswer,
        });
        setIsFormDialogOpen(true);
    };
    
    const handleSaveQuestion = async (data: QuestionFormValues) => {
        if (!user) return;
        setIsSaving(true);
        try {
            const payload = { ...data, options: data.options?.map(o => o.text) || [] };
            if (isEditMode && editingQuestion) {
                const questionRef = doc(db, "questions", editingQuestion.id);
                await updateDoc(questionRef, { ...payload, updatedAt: serverTimestamp() });
                toast({ title: "Question Updated", description: "The question has been successfully updated." });
                await logAuditEvent({ userId: user.uid, actionType: "UPDATE_QUESTION", entityId: editingQuestion.id, details: { text: data.questionText.substring(0, 50) }});
            } else {
                const docRef = await addDoc(collection(db, "questions"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
                toast({ title: "Question Created", description: "The new question has been added to the bank." });
                await logAuditEvent({ userId: user.uid, actionType: "CREATE_QUESTION", entityId: docRef.id, details: { text: data.questionText.substring(0, 50) }});
            }
            fetchQuestions();
            setIsFormDialogOpen(false);
        } catch (error) {
            toast({ title: "Save Failed", description: "An error occurred while saving the question.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteQuestion = async () => {
        if (!questionToDelete || !user) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(db, "questions", questionToDelete.id));
            toast({ title: "Question Deleted", description: "The question has been removed from the bank." });
            await logAuditEvent({ userId: user.uid, actionType: "DELETE_QUESTION", entityId: questionToDelete.id, details: { text: questionToDelete.questionText.substring(0, 50) }});
            fetchQuestions();
            setQuestionToDelete(null);
        } catch (error) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
     const handleParseAndOpen = async () => {
        if (!rawQuestionText.trim()) {
            toast({ title: "No Text Provided", description: "Please paste the question text into the box.", variant: "default" });
            return;
        }
        setIsParsing(true);
        try {
            const parsedData = await parseQuestionFromText({ rawText: rawQuestionText });

            setIsEditMode(false);
            setEditingQuestion(null);
            form.reset({
                questionText: parsedData.questionText,
                questionType: 'mcq',
                options: parsedData.options,
                correctAnswer: parsedData.correctAnswer,
                category: "",
            });
            setIsFormDialogOpen(true);
            setRawQuestionText("");
            toast({ title: "Question Parsed!", description: "The form has been pre-filled. Please review and save." });

        } catch (error) {
            console.error("Error parsing question:", error);
            toast({ title: "Parsing Failed", description: "The AI could not understand the format. Please check the text and try again.", variant: "destructive" });
        } finally {
            setIsParsing(false);
        }
    };

    if (authLoading || (isLoading && !user)) {
      return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (!user || user.role !== 'admin') {
       return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;
    }


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center gap-3"><HelpCircle className="h-7 w-7 text-primary" />Question Bank</CardTitle>
                        <CardDescription>Manage all quiz questions centrally. Questions added here can be used in any course quiz.</CardDescription>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchQuestions} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={openCreateDialog}><PlusCircle className="mr-2 h-4 w-4"/>Add New Question</Button>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-headline flex items-center gap-3">
                        <Sparkles className="h-6 w-6 text-accent" />
                        AI-Powered Quick Add
                    </CardTitle>
                    <CardDescription>
                        Paste a formatted question below and let AI pre-fill the creation form for you.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        placeholder="Paste your question here, e.g.&#10;What is the capital of France?&#10;A. London&#10;B. Paris&#10;C. Berlin&#10;✅ Correct answer: B. Paris"
                        className="min-h-[150px] font-mono text-xs"
                        value={rawQuestionText}
                        onChange={(e) => setRawQuestionText(e.target.value)}
                    />
                    <Button onClick={handleParseAndOpen} disabled={isParsing || !rawQuestionText.trim()}>
                        {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Parse and Create Question
                    </Button>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>Existing Questions</CardTitle>
                 </CardHeader>
                <CardContent>
                    {isLoading ? <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
                     : questions.length === 0 ? <p className="text-center text-muted-foreground py-8">No questions found in the bank. Add one to get started.</p>
                     : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader><TableRow><TableHead>Question Text</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead>Last Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {questions.map(q => (
                                        <TableRow key={q.id}>
                                            <TableCell className="font-medium max-w-sm truncate" title={q.questionText}>{q.questionText}</TableCell>
                                            <TableCell><Badge variant="outline">{q.category}</Badge></TableCell>
                                            <TableCell><Badge variant="secondary">{q.questionType.toUpperCase()}</Badge></TableCell>
                                            <TableCell className="text-xs">{q.updatedAt ? format(q.updatedAt.toDate(), "PPp") : "N/A"}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(q)}><Edit3 className="h-4 w-4"/></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => setQuestionToDelete(q)}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this question? This action is permanent.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel onClick={() => setQuestionToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteQuestion} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                     )
                    }
                </CardContent>
            </Card>

            <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>{isEditMode ? "Edit Question" : "Create New Question"}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveQuestion)} className="space-y-4 py-2">
                             <FormField control={form.control} name="questionText" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea placeholder="Enter the question..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="questionType" render={({ field }) => (<FormItem><FormLabel>Question Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{qTypesList.map(type => <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{courseCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                             </div>
                              {watchedQuestionType === 'mcq' && (<div className="space-y-2 pt-2"><FormLabel>Options (MCQ)</FormLabel>{mcqOptionFields.map((field, index) => (<div key={field.id} className="flex items-center gap-2"><FormField control={form.control} name={`options.${index}.text`} render={({ field: optionField }) => (<FormItem className="flex-grow"><FormControl><Input placeholder={`Option ${index + 1}`} {...optionField} /></FormControl><FormMessage /></FormItem>)}/><Button type="button" variant="ghost" size="icon" onClick={() => mcqOptionFields.length > 2 && removeMcqOption(index)} disabled={mcqOptionFields.length <= 2}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => appendMcqOption(defaultQuestionOptionValue)}><PlusCircle className="mr-2 h-4 w-4" />Add Option</Button></div>)}
                             <FormField control={form.control} name="correctAnswer" render={({ field }) => {
                                const options = form.watch("options")?.map(o => o.text).filter(Boolean) || [];
                                if (watchedQuestionType === 'tf') return (<FormItem><FormLabel>Correct Answer (True/False)</FormLabel><Select onValueChange={field.onChange} value={field.value || "True"}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent></Select><FormMessage /></FormItem>);
                                if (watchedQuestionType === 'mcq') {
                                    return (<FormItem><FormLabel>Correct Answer (MCQ)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={options.length > 0 ? "Select correct option" : "Add options first"}/></SelectTrigger></FormControl><SelectContent>{options.map((optText, i) => <SelectItem key={i} value={optText}>{optText}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
                                }
                                return (<FormItem><FormLabel>Correct Answer (Short Answer)</FormLabel><FormControl><Input placeholder="Enter the exact correct answer" {...field} /></FormControl><FormMessage /></FormItem>);
                             }}/>
                            <DialogFooter className="pt-4"><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditMode ? "Save Changes" : "Create Question"}</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
