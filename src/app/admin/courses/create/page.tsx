
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck, Loader2, AlertTriangle, CheckCircle, PlusCircle, Trash2, Edit3, UploadCloud, Eye, Award, FileText as FileTextIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import Image from "next/image";

const courseCategories = [
  "General Information",
  "Safety Equipment",
  "Standard Operating Procedures (SOPs)",
  "Emergency Procedures",
  "First Aid",
  "Dangerous Goods (DG)",
  "Safety Management System (SMS)",
  "Crew Resource Management (CRM)",
  "Aircraft Type Rating",
  "Fatigue Risk Management System (FRMS)",
  "Flight Time Limitations (FTL)",
  "Civil Aviation Security (AVSEC)",
  "Etiquette and Personal Development",
  "Cabin Crew Instructor Training",
  "Cabin Senior (Purser) Training",
  "Brand & Grooming",
  "Onboard Service",
  "Premium Service & Customer Relationship",
  "Drills Briefing",
  "General Knowledge",
];

const courseTypes = [
  "Initial Training", 
  "Recurrent Training", 
  "Specialized Training", 
  "Commercial Training", 
  "Other Training"
];
const questionTypes = ["mcq", "tf", "short"]; // Multiple Choice, True/False, Short Answer

const mcqOptionSchema = z.object({
  text: z.string().min(1, "Option text cannot be empty."),
  isCorrect: z.boolean().default(false),
});

const questionSchema = z.object({
  text: z.string().min(5, "Question text must be at least 5 characters."),
  questionType: z.enum(["mcq", "tf", "short"], { required_error: "Please select a question type." }),
  options: z.array(mcqOptionSchema).optional(), // For MCQ
  correctAnswerBoolean: z.boolean().optional(), // For True/False
  correctAnswerText: z.string().optional(), // For Short Answer
  weight: z.coerce.number().min(1, "Weight must be at least 1.").default(1),
});

const courseFormSchema = z.object({
  // Course Details
  title: z.string().min(5, "Title must be at least 5 characters.").max(150),
  category: z.string({ required_error: "Please select a course category." }),
  courseType: z.string({ required_error: "Please select a course type." }),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  duration: z.string().min(1, "Duration is required (e.g., 60 minutes, 2 hours)."),
  associatedFile: z.custom<FileList>().optional(),
  imageHint: z.string().max(50).optional().describe("Keywords for course image (e.g., emergency exit)"),

  // Quiz Details
  quizTitle: z.string().min(5, "Quiz Title must be at least 5 characters.").max(100),
  questions: z.array(questionSchema).min(1, "At least one question is required for the quiz."),
  randomizeQuestions: z.boolean().default(false),
  randomizeAnswers: z.boolean().default(false), // Primarily for MCQs

  // Certification Rules
  passingThreshold: z.coerce.number().min(0).max(100, "Threshold must be between 0 and 100.").default(80),
  certificateExpiryDays: z.coerce.number().int().min(0, "Expiry days must be 0 or more (0 for no expiry).").default(365), // 0 for no expiry
  certificateLogoUrl: z.string().url("Must be a valid URL or leave empty.").optional().or(z.literal("")),
  certificateSignature: z.string().min(2, "Signature text/URL is required.").default("Express Airline Training Department"),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

const defaultQuestionValue: z.infer<typeof questionSchema> = {
  text: "",
  questionType: "mcq",
  options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }],
  weight: 1,
};

const defaultValues: Partial<CourseFormValues> = {
  title: "",
  category: "",
  courseType: "Initial Training",
  description: "",
  duration: "60 minutes",
  imageHint: "",
  quizTitle: "",
  questions: [defaultQuestionValue],
  randomizeQuestions: false,
  randomizeAnswers: false,
  passingThreshold: 80,
  certificateExpiryDays: 365,
  certificateLogoUrl: "https://placehold.co/150x50.png", 
  certificateSignature: "Express Airline Training Department",
};

export default function CreateComprehensiveCoursePage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const watchedFormValues = form.watch();

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
    }
  }, [user, authLoading, router, toast]);

  const handleAddMcqOption = (questionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`) || [];
    form.setValue(`questions.${questionIndex}.options`, [...currentOptions, { text: "", isCorrect: false }]);
  };

  const handleRemoveMcqOption = (questionIndex: number, optionIndex: number) => {
    const currentOptions = form.getValues(`questions.${questionIndex}.options`) || [];
    if (currentOptions.length > 2) { 
      const newOptions = currentOptions.filter((_, idx) => idx !== optionIndex);
      form.setValue(`questions.${questionIndex}.options`, newOptions);
    } else {
      toast({ title: "Cannot Remove", description: "MCQ questions must have at least two options.", variant: "destructive" });
    }
  };

  async function onSubmit(data: CourseFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to create courses.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(null);

    let fileDownloadURL: string | null = null;
    const fileToUpload = data.associatedFile?.[0];

    if (fileToUpload) {
      const uniqueFileName = `${new Date().getTime()}-${fileToUpload.name.replace(/\s+/g, '_')}`;
      const fileStoragePath = `courseMaterials/${uniqueFileName}`;
      const materialStorageRef = storageRef(storage, fileStoragePath);
      const uploadTask = uploadBytesResumable(materialStorageRef, fileToUpload);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          (error) => {
            console.error("Upload failed:", error);
            toast({ title: "File Upload Failed", description: error.message, variant: "destructive" });
            setIsSubmitting(false);
            reject(error);
          },
          async () => {
            fileDownloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve();
          }
        );
      });
      if (!fileDownloadURL) { 
         setIsSubmitting(false);
         return; 
      }
    }

    try {
      const batch = writeBatch(db);

      const courseRef = doc(collection(db, "courses"));
      batch.set(courseRef, {
        title: data.title,
        category: data.category,
        courseType: data.courseType,
        description: data.description,
        duration: data.duration,
        fileURL: fileDownloadURL,
        imageHint: data.imageHint || data.category.toLowerCase().split(" ")[0] || "training",
        published: false, 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      });

      const quizRef = doc(collection(db, "quizzes"));
      batch.set(quizRef, {
        courseId: courseRef.id,
        title: data.quizTitle,
        randomizeQuestions: data.randomizeQuestions,
        randomizeAnswers: data.randomizeAnswers,
        createdAt: serverTimestamp(),
      });
      batch.update(courseRef, { quizId: quizRef.id }); 

      data.questions.forEach(q => {
        const questionRef = doc(collection(db, "questions"));
        const questionData: any = {
          quizId: quizRef.id,
          text: q.text,
          questionType: q.questionType,
          weight: q.weight,
        };
        if (q.questionType === 'mcq') {
          questionData.options = q.options?.map(opt => ({ text: opt.text, isCorrect: opt.isCorrect })) || [];
        } else if (q.questionType === 'tf') {
          questionData.correctAnswerBoolean = q.correctAnswerBoolean || false;
        } else if (q.questionType === 'short') {
          questionData.correctAnswerText = q.correctAnswerText || "";
        }
        batch.set(questionRef, questionData);
      });

      const certRuleRef = doc(collection(db, "certificateRules"));
      batch.set(certRuleRef, {
        courseId: courseRef.id,
        passingThreshold: data.passingThreshold,
        expiryDurationDays: data.certificateExpiryDays,
        logoURL: data.certificateLogoUrl || null,
        signatureTextOrURL: data.certificateSignature,
        createdAt: serverTimestamp(),
      });
      batch.update(courseRef, { certificateRuleId: certRuleRef.id }); 

      await batch.commit();

      toast({
        title: "Course Created Successfully!",
        description: `Course "${data.title}" with its quiz and certification rules has been saved.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset(defaultValues); 
      if (fileInputRef.current) fileInputRef.current.value = ""; 
      router.push('/admin/courses');
    } catch (error) {
      console.error("Error creating course structure in Firestore:", error);
      toast({ title: "Creation Failed", description: "Could not create the course structure. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <CardTitle className="text-2xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center">
            <BookOpenCheck className="mr-3 h-8 w-8 text-primary" />
            Create Comprehensive Training Course
          </CardTitle>
          <CardDescription>
            Define all aspects of your new training course, including quiz and certification, in one place.
          </CardDescription>
        </CardHeader>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          {/* Section 1: Course Details */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold">1. Course Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Course Title*</FormLabel><FormControl><Input placeholder="e.g., Advanced First Aid Onboard" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course category" /></SelectTrigger></FormControl><SelectContent>{courseCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="courseType" render={({ field }) => (
                  <FormItem><FormLabel>Course Type*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course type" /></SelectTrigger></FormControl><SelectContent>{courseTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="duration" render={({ field }) => (
                  <FormItem><FormLabel>Estimated Duration*</FormLabel><FormControl><Input placeholder="e.g., 90 minutes, 3 hours" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description*</FormLabel><FormControl><Textarea placeholder="Detailed overview of the course..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="imageHint" render={({ field }) => (
                  <FormItem><FormLabel>Course Image Hint (Optional)</FormLabel><FormControl><Input placeholder="e.g., emergency exit, first aid" {...field} /></FormControl><FormDescription>Keywords for course image (e.g., cockpit, safety vest).</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="associatedFile" render={({ field: { onChange, value, ...rest }}) => (
                <FormItem>
                  <FormLabel className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" />Associated Material (Optional)</FormLabel>
                  <FormControl><Input type="file" {...rest} onChange={(e) => onChange(e.target.files)} ref={fileInputRef} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" /></FormControl>
                  <FormDescription>Upload PDF, video, or other course material (max 10MB).</FormDescription>
                  {uploadProgress !== null && <Progress value={uploadProgress} className="w-full mt-2" />}
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Section 2: Quiz Builder */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold">2. Quiz Builder</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="quizTitle" render={({ field }) => (
                <FormItem><FormLabel>Quiz Title*</FormLabel><FormControl><Input placeholder="e.g., Final Assessment for Advanced First Aid" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="space-y-2">
                <FormField control={form.control} name="randomizeQuestions" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Randomize Question Order?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="randomizeAnswers" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Randomize Answer Order (for MCQs)?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )} />
              </div>

              {questionFields.map((questionItem, index) => (
                <Card key={questionItem.id} className="p-4 space-y-4 border-dashed">
                  <div className="flex justify-between items-center">
                    <FormLabel className="text-md font-medium">Question {index + 1}</FormLabel>
                    <Button type="button" variant="ghost" size="icon" onClick={() => questionFields.length > 1 ? removeQuestion(index) : toast({title: "Cannot Remove", description:"Quiz must have at least one question.", variant:"destructive"})} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormField control={form.control} name={`questions.${index}.text`} render={({ field }) => (
                    <FormItem><FormLabel>Question Text*</FormLabel><FormControl><Textarea placeholder="Enter the question..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name={`questions.${index}.questionType`} render={({ field }) => (
                      <FormItem><FormLabel>Question Type*</FormLabel>
                        <Select onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue(`questions.${index}.options`, value === 'mcq' ? [{text: "", isCorrect: false},{text: "", isCorrect: false}] : undefined);
                            form.setValue(`questions.${index}.correctAnswerBoolean`, value === 'tf' ? false : undefined);
                            form.setValue(`questions.${index}.correctAnswerText`, value === 'short' ? "" : undefined);
                        }} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                          <SelectContent>{questionTypes.map(type => (<SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>))}</SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`questions.${index}.weight`} render={({ field }) => (
                      <FormItem><FormLabel>Weight*</FormLabel><FormControl><Input type="number" placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  {form.watch(`questions.${index}.questionType`) === 'mcq' && (
                    <div className="space-y-3">
                      <FormLabel>MCQ Options* (Select correct answer/s)</FormLabel>
                      {form.watch(`questions.${index}.options`)?.map((optionItem, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2 p-2 border rounded-md">
                          <FormField control={form.control} name={`questions.${index}.options.${optionIndex}.isCorrect`} render={({ field }) => (
                            <FormItem className="flex items-center"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="mr-2 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-muted" /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`questions.${index}.options.${optionIndex}.text`} render={({ field }) => (
                            <FormItem className="flex-grow"><FormControl><Input placeholder={`Option ${optionIndex + 1}`} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveMcqOption(index, optionIndex)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => handleAddMcqOption(index)}><PlusCircle className="mr-2 h-4 w-4" />Add Option</Button>
                    </div>
                  )}
                  {form.watch(`questions.${index}.questionType`) === 'tf' && (
                    <FormField control={form.control} name={`questions.${index}.correctAnswerBoolean`} render={({ field }) => (
                      <FormItem><FormLabel>Correct Answer*</FormLabel>
                        <Select onValueChange={(val) => field.onChange(val === 'true')} value={String(field.value)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select True or False" /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="true">True</SelectItem><SelectItem value="false">False</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                  )}
                  {form.watch(`questions.${index}.questionType`) === 'short' && (
                    <FormField control={form.control} name={`questions.${index}.correctAnswerText`} render={({ field }) => (
                      <FormItem><FormLabel>Correct Answer Text* (Case-sensitive)</FormLabel><FormControl><Input placeholder="Enter exact answer" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={() => appendQuestion(defaultQuestionValue)}><PlusCircle className="mr-2 h-4 w-4" />Add Question</Button>
            </CardContent>
          </Card>

          {/* Section 3: Certification Rules */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold">3. Certification Rules</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="passingThreshold" render={({ field }) => (
                  <FormItem><FormLabel>Passing Threshold (%)*</FormLabel><FormControl><Input type="number" placeholder="80" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="certificateExpiryDays" render={({ field }) => (
                  <FormItem><FormLabel>Certificate Expiry (days)*</FormLabel><FormControl><Input type="number" placeholder="365" {...field} /></FormControl><FormDescription>0 for no expiry.</FormDescription><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="certificateLogoUrl" render={({ field }) => (
                <FormItem><FormLabel>Certificate Logo URL (Optional)</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormDescription>Link to your airline's logo. Default placeholder will be used if empty.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="certificateSignature" render={({ field }) => (
                <FormItem><FormLabel>Certificate Signature Text/Authority*</FormLabel><FormControl><Input placeholder="Express Airline Training Department" {...field} /></FormControl><FormDescription>Text to display as the issuing authority or signature.</FormDescription><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>
          
          {/* Section 4: Summary & Preview */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold">4. Summary & Certificate Preview</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium mb-2">Dynamic Summary:</h3>
                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        <li>Course Title: {watchedFormValues.title || "Not set"}</li>
                        <li>Category: {watchedFormValues.category || "Not set"}</li>
                        <li>Quiz Questions: {watchedFormValues.questions?.length || 0}</li>
                        <li>Passing Score: {watchedFormValues.passingThreshold}%</li>
                        <li>Certificate Valid For: {watchedFormValues.certificateExpiryDays === 0 ? "No Expiry" : `${watchedFormValues.certificateExpiryDays} days`}</li>
                    </ul>
                </div>
                <div className="mt-6">
                    <h3 className="text-lg font-medium mb-2">Certificate Preview (Simplified):</h3>
                    <div className="border-2 border-dashed border-primary p-6 rounded-lg bg-secondary/30 aspect-[8.5/5.5] max-w-md mx-auto flex flex-col items-center justify-around" data-ai-hint="certificate award">
                        <Image src={watchedFormValues.certificateLogoUrl || "https://placehold.co/150x50.png"} alt="Airline Logo" width={120} height={40} className="mb-4" data-ai-hint="company logo"/>
                        <h4 className="text-2xl font-bold text-center text-primary">Certificate of Completion</h4>
                        <p className="text-sm text-center my-2">This certifies that</p>
                        <p className="text-xl font-semibold text-center">[User Name Placeholder]</p>
                        <p className="text-sm text-center my-2">has successfully completed the course</p>
                        <p className="text-lg font-medium text-center">&quot;{watchedFormValues.title || "Course Title Placeholder"}&quot;</p>
                        <p className="text-xs text-center mt-3">Date of Completion: [Dynamic Date Placeholder]</p>
                        <p className="text-xs text-center mt-3">Signature: {watchedFormValues.certificateSignature}</p>
                    </div>
                </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-6">
            <Button type="submit" size="lg" disabled={isSubmitting || !form.formState.isValid} className="min-w-[180px]">
              {isSubmitting ? (
                <> <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Publishing... </>
              ) : (
                <> <CheckCircle className="mr-2 h-5 w-5" /> Publish Course </>
              )}
            </Button>
          </div>
          {!form.formState.isValid && isSubmitting === false && (
            <p className="text-sm text-destructive text-right mt-2">Please fill all required fields and correct any errors before publishing.</p>
          )}
        </form>
      </Form>
    </div>
  );
}
