
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { BookOpenCheck, Loader2, AlertTriangle, CheckCircle, PlusCircle, UploadCloud, Eye, Award, FileText as FileTextIcon, LayoutList, Wand2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
  courseCategories, 
  courseTypes, 
  referenceBodyOptions, 
  courseDurationOptions 
} from "@/config/course-options";
import { 
  courseFormSchema, 
  type CourseFormValues, 
  defaultChapterValue, 
  defaultValues as initialDefaultValues
} from "@/schemas/course-schema";
import CourseContentBlock from "@/components/admin/course-content-block";
import { generateCourseOutline, type CourseGenerationInput, type CourseGenerationOutput } from "@/ai/flows/course-generator-flow";
// Removed ReactMarkdown as it's not used directly for display in this form
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";


export default function CreateComprehensiveCoursePage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isAiGenerating, setIsAiGenerating] = React.useState(false);
  const [aiGeneratedCourse, setAiGeneratedCourse] = React.useState<CourseGenerationOutput | null>(null); 
  const [aiGenerationError, setAiGenerationError] = React.useState<string | null>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: initialDefaultValues,
    mode: "onBlur",
  });

  const { fields: chapterFields, append: appendChapter, remove: removeChapter, replace: replaceChapters } = useFieldArray({
    control: form.control,
    name: "chapters",
  });

  const watchedFormValues = form.watch();

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
    }
  }, [user, authLoading, router, toast]);

  async function handleAiGenerateAndPrefill() {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to use the course generator.", variant: "destructive" });
      return;
    }
    const { title, category, courseType, referenceBody, duration, targetAudience, numberOfChapters, detailLevel } = form.getValues();
    
    if (!title || title.trim().length < 5) {
        toast({ title: "Course Title Required", description: "Please enter a valid Course Title (min 5 chars) before generating with AI.", variant: "destructive" });
        form.setFocus("title");
        return;
    }
    if (!category) {
      toast({ title: "Category Required", description: "Please select a Course Category before generating with AI.", variant: "destructive" });
      form.setFocus("category");
      return;
    }
     if (!courseType) {
      toast({ title: "Course Type Required", description: "Please select a Course Type before generating with AI.", variant: "destructive" });
      form.setFocus("courseType");
      return;
    }
    if (!duration) {
      toast({ title: "Duration Required", description: "Please select an Estimated Duration before generating with AI.", variant: "destructive" });
      form.setFocus("duration");
      return;
    }


    setIsAiGenerating(true);
    setAiGeneratedCourse(null);
    setAiGenerationError(null);
    try {
      const input: CourseGenerationInput = {
        courseTopic: title,
        courseCategory: category,
        courseType: courseType,
        referenceDocuments: referenceBody || undefined,
        durationEstimate: duration || undefined,
        targetAudience: targetAudience,
        numberOfChapters: numberOfChapters,
        detailLevel: detailLevel,
      };
      const result = await generateCourseOutline(input);
      
      form.setValue("title", result.courseTitle, { shouldValidate: true });
      form.setValue("description", result.description, { shouldValidate: true });
      
      if (courseCategories.includes(result.suggestedCategory)) {
        form.setValue("category", result.suggestedCategory, { shouldValidate: true });
      } else {
        toast({ title: "Category Note", description: `AI suggested category "${result.suggestedCategory}" is not standard. Current selection retained or please select manually.`, variant: "default" });
      }
      
      const newChapters = result.chapters.map(ch => ({
        id: ch.id || `gen_ch_${Math.random().toString(36).substr(2, 9)}`,
        title: ch.title,
        description: ch.description || "",
        content: ch.content || "",
        resources: [], 
        children: [],   
      }));
      replaceChapters(newChapters.length > 0 ? newChapters : [defaultChapterValue]);

      form.setValue("quizTitle", `Final Assessment for ${result.courseTitle}`, { shouldValidate: true });
      
      if (result.certificateSettings) {
        form.setValue("passingThreshold", result.certificateSettings.passingScore, { shouldValidate: true });
        form.setValue("certificateExpiryDays", result.certificateSettings.expiryDays, { shouldValidate: true });
        form.setValue("certificateSignature", result.certificateSettings.issuingAuthority, { shouldValidate: true });
      }
      
      setAiGeneratedCourse(result); 
      toast({ title: "AI Draft Generated & Form Pre-filled!", description: "Review and complete the remaining details. AI suggestions for Quiz & Certificate are below." });
    } catch (error) {
      console.error("Error generating AI course outline:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setAiGenerationError(errorMessage);
      toast({ title: "AI Generation Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsAiGenerating(false);
    }
  }


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
        referenceBody: data.referenceBody || null,
        description: data.description,
        duration: data.duration,
        mandatory: data.mandatory,
        fileURL: fileDownloadURL, 
        imageHint: data.imageHint || data.category.toLowerCase().split(" ")[0] || "training",
        chapters: data.chapters.map(ch => ({...ch, description: ch.description || ""})) || [], // Ensure description is saved
        published: data.published, 
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
        description: `Course "${data.title}" with its content and certification rules has been saved.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset(initialDefaultValues);
      setAiGeneratedCourse(null); 
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
            Define initial course parameters, then use AI to generate a draft for description, chapters, quiz title, and more. Review and complete the rest.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

          <Card className="shadow-lg border-primary/50">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center">
                <Wand2 className="mr-2 h-6 w-6 text-primary" />
                Step 1: Define Course Blueprint & Generate with AI
              </CardTitle>
              <CardDescription>
                Provide the core details for your course. The AI will use these to draft the title, description, chapters, quiz, and certificate settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Course Title / Topic (for AI)*</FormLabel><FormControl><Input placeholder="e.g., Advanced CRM Techniques for International Flights" {...field} /></FormControl><FormDescription>This will be used as the primary topic for AI generation.</FormDescription><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Course Category*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course category" /></SelectTrigger></FormControl><SelectContent>{courseCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="courseType" render={({ field }) => (
                  <FormItem><FormLabel>Course Type*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course type" /></SelectTrigger></FormControl><SelectContent>{courseTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="referenceBody" render={({ field }) => (
                  <FormItem><FormLabel>Reference Document/Body</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select reference body" /></SelectTrigger></FormControl><SelectContent>{referenceBodyOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormDescription>Optional. Main reference for content generation.</FormDescription><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="duration" render={({ field }) => (
                    <FormItem><FormLabel>Estimated Duration*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select estimated duration" /></SelectTrigger></FormControl>
                            <SelectContent>{courseDurationOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                        </Select>
                    <FormMessage />
                    </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="targetAudience"
                  render={({ field }) => (
                    <FormItem><FormLabel>Target Audience (for AI)*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Cabin Crew">Cabin Crew</SelectItem><SelectItem value="Pilot">Pilot</SelectItem>
                          <SelectItem value="Ground Staff">Ground Staff</SelectItem><SelectItem value="All Crew">All Crew</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent></Select><FormMessage />
                    </FormItem>)}
                />
                <FormField control={form.control} name="numberOfChapters"
                  render={({ field }) => (
                    <FormItem><FormLabel>Number of Chapters (for AI)*</FormLabel>
                      <FormControl><Input type="number" min="1" max="10" {...field} 
                        value={field.value}
                        onChange={e => field.onChange(parseInt(e.target.value,10) || 1)}
                      /></FormControl>
                      <FormDescription>(1-10)</FormDescription><FormMessage />
                    </FormItem>)}
                />
                <FormField control={form.control} name="detailLevel"
                  render={({ field }) => (
                    <FormItem><FormLabel>Detail Level (for AI)*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select detail level" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="overview">Overview</SelectItem><SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent></Select><FormMessage />
                    </FormItem>)}
                />
              </div>
              <Button type="button" onClick={handleAiGenerateAndPrefill} disabled={isAiGenerating} className="w-full sm:w-auto">
                {isAiGenerating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating & Pre-filling...</>) : (<><Sparkles className="mr-2 h-4 w-4" /> Generate Draft with AI</>)}
              </Button>
              {aiGenerationError && !isAiGenerating && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>AI Generation Error</AlertTitle><ShadAlertDescription>{aiGenerationError}</ShadAlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          <Separator />
          <CardHeader className="px-0 -mb-4">
            <CardTitle className="text-xl font-semibold flex items-center">
                 Step 2: Review AI Draft & Complete Course Details
            </CardTitle>
            <CardDescription>
                The AI has pre-filled the Course Title, Description, Chapters, and Quiz Title below. Review, edit, and complete the remaining sections. AI suggestions for specific quiz questions and certificate settings are available below for your reference.
            </CardDescription>
          </CardHeader>


          {/* Section 1: Course Details (Main form, now pre-filled by AI) */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold">1. Course Details (Review & Finalize)</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Title, Category, CourseType, ReferenceBody, Duration are now part of Step 1 for AI input */}
              {/* Description will be pre-filled by AI */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (AI Pre-filled)*</FormLabel><FormControl><Textarea placeholder="AI will generate this. Review and edit as needed..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="imageHint" render={({ field }) => (
                    <FormItem><FormLabel>Course Image Hint (Optional)</FormLabel><FormControl><Input placeholder="e.g., emergency exit, first aid" {...field} value={field.value || ""} /></FormControl><FormDescription>Keywords for course image (e.g., cockpit, safety vest).</FormDescription><FormMessage /></FormItem>
                )} />
                 <FormField
                    control={form.control}
                    name="published"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                        <FormLabel>Publish Course</FormLabel>
                        <FormDescription>If checked, the course will be visible to users immediately upon creation.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                    )}
                />
               </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="mandatory"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                        <FormLabel>Is this course mandatory?</FormLabel>
                        <FormDescription>Indicates if completion is required for personnel.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                    )}
                />
                <FormField control={form.control} name="associatedFile" render={({ field: { onChange, value, ...rest }}) => (
                <FormItem>
                  <FormLabel className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" />Main Course Material (Optional)</FormLabel>
                  <FormControl><Input type="file" {...rest} onChange={(e) => onChange(e.target.files)} ref={fileInputRef} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" /></FormControl>
                  <FormDescription>Upload a global PDF, video, or other material if applicable (max 10MB). Chapter-specific resources can be added below.</FormDescription>
                  {uploadProgress !== null && <Progress value={uploadProgress} className="w-full mt-2" />}
                  <FormMessage />
                </FormItem>
              )} />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center"><LayoutList className="mr-2 h-5 w-5 text-primary" /> Course Content (AI Pre-filled Chapters - Review & Finalize)</CardTitle>
                <CardDescription>Review and edit the chapters generated by AI. Each chapter now has a title, description, and detailed content. Add resources and sub-sections as needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {chapterFields.map((chapterItem, index) => (
                <CourseContentBlock
                  key={chapterItem.id}
                  control={form.control} 
                  name="chapters"         
                  index={index}            
                  removeSelf={() => chapterFields.length > 1 ? removeChapter(index) : toast({title: "Cannot Remove", description:"Course must have at least one chapter.", variant:"destructive"})}
                  level={0}                
                />
              ))}
              <Button type="button" variant="outline" onClick={() => appendChapter(defaultChapterValue)}><PlusCircle className="mr-2 h-4 w-4" />Add Chapter Manually</Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><FileTextIcon className="mr-2 h-5 w-5 text-primary" /> Main Course Quiz Settings (Review & Finalize)</CardTitle><CardDescription>Configure the main quiz. The title is pre-filled based on the AI-generated course title. AI suggestions for questions are below.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="quizTitle" render={({ field }) => (
                <FormItem><FormLabel>Quiz Title (AI Pre-filled)*</FormLabel><FormControl><Input placeholder="AI will generate this. Review and edit as needed." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="space-y-2">
                <FormField control={form.control} name="randomizeQuestions" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Randomize Question Order?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="randomizeAnswers" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Randomize Answer Order (for MCQs)?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )} />
              </div>
              <FormDescription>Note: Specific quiz questions are managed separately after course creation. Use AI suggestions below as a guide.</FormDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><Award className="mr-2 h-5 w-5 text-primary" /> Certification Rules (AI Pre-filled - Review & Finalize)</CardTitle><CardDescription>AI suggestions for certification have been pre-filled below.</CardDescription></CardHeader>
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
                <FormItem><FormLabel>Certificate Logo URL (Optional)</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value || ""} /></FormControl><FormDescription>Link to your airline's logo. Default placeholder will be used if empty.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="certificateSignature" render={({ field }) => (
                <FormItem><FormLabel>Certificate Signature Text/Authority*</FormLabel><FormControl><Input placeholder="Express Airline Training Department" {...field} /></FormControl><FormDescription>Text to display as the issuing authority or signature.</FormDescription><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Display AI Suggestions for Quiz & Certificate */}
          {aiGeneratedCourse && (aiGeneratedCourse.mainQuiz || aiGeneratedCourse.certificateSettings) && (
            <Accordion type="single" collapsible className="w-full mt-6" defaultValue="ai-suggestions">
              <AccordionItem value="ai-suggestions">
                <AccordionTrigger>
                  <div className="flex items-center text-lg font-semibold">
                    <Sparkles className="mr-2 h-5 w-5 text-blue-500" /> AI Suggestions for Quiz (Reference Only)
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Card className="shadow-none border-0">
                    <CardContent className="pt-4 space-y-4">
                      {aiGeneratedCourse.mainQuiz && aiGeneratedCourse.mainQuiz.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 text-md">Suggested Quiz Questions ({aiGeneratedCourse.mainQuiz.length}):</h4>
                          <ScrollArea className="h-[250px] p-3 border rounded-md bg-muted/20">
                            {aiGeneratedCourse.mainQuiz.map((q, i) => (
                              <div key={i} className="mb-3 pb-2 border-b last:border-b-0 text-sm">
                                <p className="font-medium">Q{i + 1} ({q.type.toUpperCase()}): <span className="font-normal">{q.question}</span></p>
                                {q.options && q.options.length > 0 && (
                                  <ul className="list-disc list-inside pl-5 text-xs mt-1">
                                    {q.options.map((opt, oi) => <li key={oi}>{opt}</li>)}
                                  </ul>
                                )}
                                <p className="text-xs text-green-700 dark:text-green-400 mt-1">Correct Answer: {q.correctAnswer}</p>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-4">
                        Note: These are AI suggestions. You will need to configure the quiz questions via the quiz management interface for this course after creation.
                      </p>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><Eye className="mr-2 h-5 w-5 text-primary" /> Summary & Certificate Preview</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium mb-2">Dynamic Summary:</h3>
                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        <li>Course Title: {watchedFormValues.title || "Not set"}</li>
                        <li>Category: {watchedFormValues.category || "Not set"}</li>
                        <li>Mandatory: {watchedFormValues.mandatory ? "Yes" : "No"}</li>
                        <li>Chapters: {watchedFormValues.chapters?.length || 0}</li>
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
                <> <CheckCircle className="mr-2 h-5 w-5" /> Save Course </>
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
