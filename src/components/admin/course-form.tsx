
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { collection, writeBatch, doc, serverTimestamp, where, getDoc, query, orderBy, getDocs } from "firebase/firestore";
import { Loader2, ArrowLeft, ArrowRight, BookOpen, ListOrdered, Shield, FileQuestion, Send, Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { courseFormSchema, type CourseFormValues, courseCategories, courseTypes } from "@/schemas/course-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StoredQuiz, StoredCertificateRule, type StoredCourse } from "@/schemas/course-schema";
import { generateCourseImage } from "@/ai/flows/generate-course-image-flow";
import { generateQuizFromContent } from "@/ai/flows/generate-quiz-flow";
import type { StoredQuestion } from "@/schemas/quiz-question-schema";
import { Progress } from "@/components/ui/progress";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";

interface CourseFormProps {
    isEditMode: boolean;
    currentCourse: StoredCourse | null;
    onFormSubmitSuccess: () => void;
}

const steps = [
    { id: 1, title: 'Course Details', fields: ['title', 'description', 'category', 'courseType', 'referenceBody', 'duration', 'imageHint', 'mandatory', 'published'], icon: BookOpen },
    { id: 2, title: 'Chapters', fields: ['chapters'], icon: ListOrdered },
    { id: 3, title: 'Quiz & Certificate', fields: ['quizTitle', 'passingThreshold', 'certificateExpiryDays'], icon: Shield },
    { id: 4, title: 'Quiz Questions', fields: ['questions'], icon: FileQuestion },
];

export function CourseForm({ isEditMode, currentCourse, onFormSubmitSuccess }: CourseFormProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState(0);

    const form = useForm<CourseFormValues>({
        resolver: zodResolver(courseFormSchema),
        defaultValues: {
            title: "", description: "", category: undefined, courseType: undefined,
            referenceBody: "", duration: "", mandatory: true, published: false, imageHint: "",
            chapters: [{ title: "", content: "" }],
            questions: [{ questionText: "", options: ["", "", "", ""], correctAnswer: "" }],
            quizTitle: "", passingThreshold: 80, certificateExpiryDays: 365
        },
        mode: "onChange",
    });

    const { fields: chapterFields, append: appendChapter, remove: removeChapter } = useFieldArray({ control: form.control, name: "chapters" });
    const { fields: questionFields, append: appendQuestion, remove: removeQuestion, replace: replaceQuestions } = useFieldArray({ control: form.control, name: "questions" });

    React.useEffect(() => {
        const loadCourseData = async () => {
            setIsLoading(true);
            if (isEditMode && currentCourse) {
                try {
                    const quizSnap = await getDoc(doc(db, "quizzes", currentCourse.quizId));
                    const certRuleSnap = await getDoc(doc(db, "certificateRules", currentCourse.certificateRuleId));
                    const questionsQuery = query(collection(db, "questions"), where("quizId", "==", currentCourse.quizId), orderBy("createdAt", "asc"));
                    const questionsSnapshot = await getDocs(questionsQuery);

                    const quizData = quizSnap.data() as StoredQuiz;
                    const certRuleData = certRuleSnap.data() as StoredCertificateRule;
                    const questionsData = questionsSnapshot.docs.map(d => d.data() as StoredQuestion);

                    form.reset({
                        title: currentCourse.title, description: currentCourse.description,
                        category: currentCourse.category, courseType: currentCourse.courseType,
                        referenceBody: currentCourse.referenceBody, duration: currentCourse.duration,
                        mandatory: currentCourse.mandatory, published: currentCourse.published,
                        imageHint: currentCourse.imageHint,
                        quizTitle: quizData.title,
                        passingThreshold: certRuleData.passingThreshold,
                        certificateExpiryDays: certRuleData.expiryDurationDays,
                        chapters: currentCourse.chapters.map(c => ({ title: c.title, content: c.content || "" })),
                        questions: questionsData.length > 0 ? questionsData.map(q => ({ questionText: q.questionText, options: q.options, correctAnswer: q.correctAnswer })) : [{ questionText: "", options: ["", "", "", ""], correctAnswer: "" }],
                    });
                } catch (error) {
                    toast({ title: "Error", description: "Could not load course data for editing.", variant: "destructive"});
                }
            } else {
                form.reset({
                    title: "", description: "", category: undefined, courseType: undefined,
                    referenceBody: "", duration: "", mandatory: true, published: false, imageHint: "",
                    chapters: [{ title: "", content: "" }],
                    questions: [{ questionText: "", options: ["", "", "", ""], correctAnswer: "" }],
                    quizTitle: "", passingThreshold: 80, certificateExpiryDays: 365,
                });
            }
            setIsLoading(false);
        };

        loadCourseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, currentCourse]);
    

    const handleFormSubmit = async (data: CourseFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        let imageUrl: string | undefined = undefined;

        try {
            const courseRef = isEditMode && currentCourse ? doc(db, "courses", currentCourse.id) : doc(collection(db, "courses"));
            
            if (data.imageHint && (!currentCourse?.imageUrl || data.imageHint !== currentCourse.imageHint)) {
                toast({ title: "Generating AI Image...", description: "This may take a moment. Please wait." });
                try {
                    const result = await generateCourseImage({ prompt: data.imageHint });
                    if (result.imageDataUri) {
                        const storageRef = ref(storage, `course-images/${courseRef.id}/${Date.now()}.png`);
                        await uploadString(storageRef, result.imageDataUri, 'data_url');
                        imageUrl = await getDownloadURL(storageRef);
                        toast({ title: "AI Image Generated", description: "The course image has been successfully created." });
                    }
                } catch (imageError) {
                    console.error("AI Image generation/upload failed:", imageError);
                    toast({ title: "AI Image Skipped", description: "Could not generate AI image. The course will be saved without a new image.", variant: "default" });
                }
            }

            const batch = writeBatch(db);
            const quizRef = isEditMode && currentCourse ? doc(db, "quizzes", currentCourse.quizId) : doc(collection(db, "quizzes"));
            const certRuleRef = isEditMode && currentCourse ? doc(db, "certificateRules", currentCourse.certificateRuleId) : doc(collection(db, "certificateRules"));

            if (isEditMode && currentCourse) {
                 const questionsQuery = query(collection(db, "questions"), where("quizId", "==", currentCourse.quizId));
                 const questionsSnapshot = await getDocs(questionsQuery);
                 questionsSnapshot.forEach(doc => batch.delete(doc.ref));
            }
            data.questions.forEach((q) => {
                const questionRef = doc(collection(db, "questions"));
                batch.set(questionRef, { ...q, quizId: quizRef.id, questionType: 'mcq', createdAt: serverTimestamp() });
            });


            if (isEditMode && currentCourse) {
                const updateData: Partial<StoredCourse> = {
                    title: data.title, description: data.description, category: data.category,
                    courseType: data.courseType, referenceBody: data.referenceBody, duration: data.duration,
                    mandatory: data.mandatory, published: data.published, imageHint: data.imageHint,
                    chapters: data.chapters.filter(c => c.title.trim() !== ""),
                    updatedAt: serverTimestamp(),
                };
                if (imageUrl) updateData.imageUrl = imageUrl;

                batch.update(courseRef, updateData as any);
                batch.update(quizRef, { title: data.quizTitle });
                batch.update(certRuleRef, { passingThreshold: data.passingThreshold, expiryDurationDays: data.certificateExpiryDays });
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: 'UPDATE_COURSE', entityType: "COURSE", entityId: currentCourse.id, details: { title: data.title }});
                toast({ title: "Course Updated", description: `"${data.title}" has been updated successfully.` });
            
            } else {
                batch.set(courseRef, {
                    title: data.title, description: data.description, category: data.category,
                    courseType: data.courseType, referenceBody: data.referenceBody, duration: data.duration,
                    mandatory: data.mandatory, published: data.published, imageHint: data.imageHint,
                    chapters: data.chapters.filter(c => c.title.trim() !== ""),
                    quizId: quizRef.id, certificateRuleId: certRuleRef.id,
                    imageUrl: imageUrl || null,
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                });

                batch.set(quizRef, { courseId: courseRef.id, title: data.quizTitle, createdAt: serverTimestamp() });
                batch.set(certRuleRef, { courseId: courseRef.id, passingThreshold: data.passingThreshold, expiryDurationDays: data.certificateExpiryDays, createdAt: serverTimestamp() });
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: 'CREATE_COURSE', entityType: "COURSE", entityId: courseRef.id, details: { title: data.title }});
                toast({ title: "Course Created", description: `"${data.title}" has been saved.` });
            }
            
            await batch.commit();
            onFormSubmitSuccess();
        } catch (error) {
            console.error(error);
            toast({ title: isEditMode ? "Update Failed" : "Creation Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleGenerateQuiz = async () => {
        const courseTitle = form.getValues('title');
        const chapters = form.getValues('chapters');
        
        if (!courseTitle || chapters.every(c => !c.content?.trim())) {
            toast({ title: "Cannot Generate Quiz", description: "Please provide a course title and some chapter content first.", variant: "destructive" });
            return;
        }

        setIsGeneratingQuiz(true);
        toast({ title: "Generating Quiz with AI...", description: "This might take a moment. The form will be populated with new questions." });
        
        try {
            const result = await generateQuizFromContent({
                courseTitle,
                courseContent: chapters.map(c => `Chapter: ${c.title}\n${c.content}`).join('\n\n'),
                questionCount: 5,
            });

            if (result && result.questions.length > 0) {
                replaceQuestions(result.questions);
                toast({ title: "Quiz Generated!", description: `${result.questions.length} questions have been added to the form.` });
            } else {
                throw new Error("AI returned no questions.");
            }

        } catch (error) {
            console.error("Quiz generation failed:", error);
            toast({ title: "Quiz Generation Failed", description: "The AI could not generate questions. Please try again.", variant: "destructive" });
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const triggerValidation = async (fields: (keyof CourseFormValues)[]) => {
        return await form.trigger(fields);
    };

    const nextStep = async () => {
        const fieldsToValidate = steps[currentStep].fields as (keyof CourseFormValues)[];
        const isValid = await triggerValidation(fieldsToValidate);
        if (isValid) {
          if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
          }
        } else {
            toast({ title: "Incomplete Section", description: "Please fill all required fields before continuing.", variant: "destructive"})
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const progressPercentage = ((currentStep + 1) / steps.length) * 100;
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-[70vh]"><Loader2 className="h-10 w-10 animate-spin"/></div>
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>{isEditMode ? "Edit Course" : "Create New Course"}</DialogTitle>
                <DialogDescription>{isEditMode ? "Update course details, chapters, and quiz questions below." : "Fill out all details for the new course."}</DialogDescription>
                 <Progress value={progressPercentage} className="mt-4"/>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Step {currentStep + 1} of {steps.length}: <strong>{steps[currentStep].title}</strong></span>
                    <span>{Math.round(progressPercentage)}% Complete</span>
                </div>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                    <ScrollArea className="h-[60vh] p-4">

                        {/* Step 1: Course Details */}
                        <AnimatedCard delay={0.1} className={cn(currentStep !== 0 && "hidden")}>
                             <div className="space-y-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2"><BookOpen/>Course Details</h3>
                                <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Course Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="min-h-[100px]" /></FormControl><FormMessage /></FormItem>} />
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="category" render={({ field }) => <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course category" /></SelectTrigger></FormControl><SelectContent>{courseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                                    <FormField control={form.control} name="courseType" render={({ field }) => <FormItem><FormLabel>Course Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course type" /></SelectTrigger></FormControl><SelectContent>{courseTypes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                                    <FormField control={form.control} name="referenceBody" render={({ field }) => <FormItem><FormLabel>Reference</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                    <FormField control={form.control} name="duration" render={({ field }) => <FormItem><FormLabel>Duration</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                    <FormField control={form.control} name="imageHint" render={({ field }) => <FormItem><FormLabel>AI Image Hint</FormLabel><FormControl><Input {...field} placeholder="e.g. cockpit, safety manual" /></FormControl><FormMessage /></FormItem>} />
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                   <FormField control={form.control} name="mandatory" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Mandatory</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
                                   <FormField control={form.control} name="published" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Published</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
                                </div>
                            </div>
                        </AnimatedCard>
                        
                        {/* Step 2: Chapters */}
                         <AnimatedCard delay={0.1} className={cn(currentStep !== 1 && "hidden")}>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2"><ListOrdered/>Chapters</h3>
                                {chapterFields.map((field, index) => (
                                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeChapter(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        <FormField control={form.control} name={`chapters.${index}.title`} render={({ field }) => (<FormItem><FormLabel>Chapter {index + 1} Title</FormLabel><FormControl><Input {...field} placeholder={`Title for chapter ${index + 1}`} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name={`chapters.${index}.content`} render={({ field }) => (<FormItem><FormLabel>Chapter {index + 1} Content</FormLabel><FormControl><Textarea {...field} placeholder="Write the chapter content here..." className="min-h-[120px]" /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendChapter({ title: "", content: "" })}>Add Chapter</Button>
                            </div>
                        </AnimatedCard>

                        {/* Step 3: Quiz & Certificate */}
                        <AnimatedCard delay={0.1} className={cn(currentStep !== 2 && "hidden")}>
                             <div className="space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2"><Shield/>Quiz & Certificate Settings</h3>
                                 <FormField control={form.control} name="quizTitle" render={({ field }) => <FormItem><FormLabel>Quiz Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                                 <div className="grid md:grid-cols-2 gap-4">
                                    <Controller
                                        control={form.control}
                                        name="passingThreshold"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Passing Score (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Controller
                                        control={form.control}
                                        name="certificateExpiryDays"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Certificate Expiry (Days)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                 </div>
                            </div>
                        </AnimatedCard>
                        
                        {/* Step 4: Quiz Questions */}
                        <AnimatedCard delay={0.1} className={cn(currentStep !== 3 && "hidden")}>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-lg flex items-center gap-2"><FileQuestion/>Quiz Questions</h3>
                                    <Button type="button" variant="outline" onClick={handleGenerateQuiz} disabled={isGeneratingQuiz}>
                                        {isGeneratingQuiz ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                        Generate with AI
                                    </Button>
                                </div>
                                {questionFields.map((field, index) => {
                                    const options = form.watch(`questions.${index}.options`);
                                    return (
                                        <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-muted/30">
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeQuestion(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            <FormField control={form.control} name={`questions.${index}.questionText`} render={({ field }) => (<FormItem><FormLabel>Question {index + 1}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`questions.${index}.options.0`} render={({ field }) => (<FormItem><FormLabel>Option A</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`questions.${index}.options.1`} render={({ field }) => (<FormItem><FormLabel>Option B</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`questions.${index}.options.2`} render={({ field }) => (<FormItem><FormLabel>Option C</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`questions.${index}.options.3`} render={({ field }) => (<FormItem><FormLabel>Option D</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            </div>
                                             <FormField control={form.control} name={`questions.${index}.correctAnswer`} render={({ field }) => (
                                                <FormItem><FormLabel>Correct Answer</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select the correct option" /></SelectTrigger></FormControl>
                                                    <SelectContent>{options.filter(opt => opt?.trim()).map((opt, i) => (<SelectItem key={i} value={opt}>{opt}</SelectItem>))}</SelectContent>
                                                </Select><FormMessage /></FormItem>
                                            )}/>
                                        </div>
                                    )
                                })}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendQuestion({ questionText: "", options: ["", "", "", ""], correctAnswer: "" })}>Add Question</Button>
                            </div>
                        </AnimatedCard>

                    </ScrollArea>
                    <DialogFooter className="mt-4 pt-4 border-t flex justify-between w-full">
                        <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                        </Button>
                        
                        {currentStep < steps.length - 1 ? (
                            <Button type="button" onClick={nextStep}>
                                Next <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                {isEditMode ? "Save Changes" : "Create Course"}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </Form>
        </>
    );
}
