
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Edit3 as EditIconMain, Loader2, AlertTriangle, CheckCircle, PlusCircle, UploadCloud, Eye, Award, FileText as FileTextIcon, LayoutList, HelpCircle, Trash2, ToggleRight, ToggleLeft, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteDoc,
  addDoc
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { 
  courseCategories,
  courseTypes,
  referenceBodyOptions,
  courseDurationOptions,
  questionTypes
} from "@/config/course-options";
import { 
  courseFormSchema,
  type CourseFormValues,
  defaultChapterValue, 
  defaultValues
} from "@/schemas/course-schema";
import {
  defaultQuestionFormValues,
  defaultQuestionOptionValue,
  type StoredQuestion
} from "@/schemas/quiz-question-schema";
import CourseContentBlock from "@/components/admin/course-content-block";
import { logAuditEvent } from "@/lib/audit-logger";
import { parseCourseContent } from "@/ai/flows/parse-course-content-flow";
import { QuestionBankDialog } from "@/components/admin/question-bank-dialog";


export default function EditComprehensiveCoursePage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [initialQuizId, setInitialQuizId] = React.useState<string | null>(null);
  const [initialCertRuleId, setInitialCertRuleId] = React.useState<string | null>(null);
  
  const [rawContentText, setRawContentText] = React.useState("");
  const [isParsingContent, setIsParsingContent] = React.useState(false);
  const [isBankDialogOpen, setIsBankDialogOpen] = React.useState(false);


  const courseEditForm = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: defaultValues, 
    mode: "onBlur",
  });

  const { fields: chapterFields, replace: replaceChapters, remove: removeChapter, append: appendChapter } = useFieldArray({
    control: courseEditForm.control,
    name: "chapters",
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion, replace: replaceQuestions } = useFieldArray({
    control: courseEditForm.control,
    name: "questions",
  });
  
  const handleAddQuestionsFromBank = (questionsToAdd: StoredQuestion[]) => {
    const formattedQuestions = questionsToAdd.map(q => ({
      ...q,
      options: q.options ? q.options.map(opt => ({ text: opt })) : [],
    }));
    appendQuestion(formattedQuestions as any, { shouldFocus: false });
    toast({
      title: "Questions Added",
      description: `${questionsToAdd.length} question(s) have been added to the quiz form.`,
    });
  };

  const watchedFormValues = courseEditForm.watch();
  const watchedQuestionType = (index: number) => courseEditForm.watch(`questions.${index}.questionType`);
  const existingQuestionIds = watchedFormValues.questions?.map(q => q.id).filter(Boolean) as string[] || [];


  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
      return;
    }

    if (courseId && user && user.role === 'admin') {
      const loadCourseData = async () => {
        setIsLoadingData(true);
        try {
          const courseDocRef = doc(db, "courses", courseId);
          const courseSnap = await getDoc(courseDocRef);

          if (!courseSnap.exists()) {
            toast({ title: "Not Found", description: "Course data could not be found.", variant: "destructive" });
            router.push("/admin/courses");
            return;
          }
          const courseData = courseSnap.data();
          setInitialQuizId(courseData.quizId || null);
          setInitialCertRuleId(courseData.certificateRuleId || null);

          let quizData = null;
          let fetchedQuestions: any[] = [];
          if (courseData.quizId) {
            const quizSnap = await getDoc(doc(db, "quizzes", courseData.quizId));
            if (quizSnap.exists()) {
              quizData = quizSnap.data();
              const questionsQuery = query(collection(db, "questions"), where("quizId", "==", courseData.quizId));
              const questionsSnap = await getDocs(questionsQuery);
              fetchedQuestions = questionsSnap.docs.map(d => ({id: d.id, ...d.data(), options: d.data().options.map((opt: string) => ({text: opt}))}));
            }
          }
          
          let certRuleData = null;
          if (courseData.certificateRuleId) {
            const certRuleSnap = await getDoc(doc(db, "certificateRules", courseData.certificateRuleId));
            if (certRuleSnap.exists()) certRuleData = certRuleSnap.data();
          }

          courseEditForm.reset({
            title: courseData.title || "",
            category: courseData.category || "",
            courseType: courseData.courseType || "Initial Training",
            referenceBody: courseData.referenceBody || "",
            description: courseData.description || "",
            duration: courseData.duration || "1 hour",
            mandatory: courseData.mandatory || false,
            published: courseData.published || false,
            imageHint: courseData.imageHint || "",
            existingFileUrl: courseData.fileURL || "",
            chapters: courseData.chapters && courseData.chapters.length > 0 ? courseData.chapters : [defaultChapterValue],
            quizTitle: quizData?.title || "",
            randomizeQuestions: quizData?.randomizeQuestions || false,
            randomizeAnswers: quizData?.randomizeAnswers || false,
            questions: fetchedQuestions.length > 0 ? fetchedQuestions : [defaultQuestionFormValues],
            passingThreshold: certRuleData?.passingThreshold || 80,
            certificateExpiryDays: certRuleData?.expiryDurationDays !== undefined ? certRuleData.expiryDurationDays : 365,
            certificateLogoUrl: certRuleData?.logoURL || "https://placehold.co/150x50.png",
            certificateSignature: certRuleData?.signatureTextOrURL || "Express Airline Training Department",
          });
          replaceChapters(courseData.chapters && courseData.chapters.length > 0 ? courseData.chapters.map((ch: any) => ({...ch})) : [defaultChapterValue]);
          replaceQuestions(fetchedQuestions.length > 0 ? fetchedQuestions : [defaultQuestionFormValues]);

        } catch (error) {
          console.error("Error loading course data:", error);
          toast({ title: "Loading Error", description: "Failed to load course data.", variant: "destructive" });
        } finally {
          setIsLoadingData(false);
        }
      };
      loadCourseData();
    }
  }, [courseId, user, authLoading, router, toast, courseEditForm, replaceChapters, replaceQuestions]);

  async function onCourseSubmit(data: CourseFormValues) {
    if (!user || user.role !== 'admin' || !courseId || !initialQuizId || !initialCertRuleId) {
      toast({ title: "Error", description: "Missing required information to update course.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(null);

    let fileDownloadURL: string | null = data.existingFileUrl || null;
    const fileToUpload = data.associatedFile?.[0];

    if (fileToUpload) {
      if (data.existingFileUrl) {
        try {
            const oldFileRef = storageRef(storage, data.existingFileUrl);
            await deleteObject(oldFileRef);
        } catch (e) {
            console.warn("Could not delete old file or it didn't exist:", e);
        }
      }

      const uniqueFileName = `${new Date().getTime()}-${fileToUpload.name.replace(/\s+/g, '_')}`;
      const fileStoragePath = `courseMaterials/${uniqueFileName}`;
      const materialStorageRef = storageRef(storage, fileStoragePath);
      const uploadTask = uploadBytesResumable(materialStorageRef, fileToUpload);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on("state_changed", (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          (error) => {
            console.error("Upload failed:", error);
            toast({ title: "File Upload Failed", description: error.message, variant: "destructive" });
            setIsSubmitting(false); reject(error);
          },
          async () => { fileDownloadURL = await getDownloadURL(uploadTask.snapshot.ref); resolve(); }
        );
      });
      if (!fileDownloadURL && fileToUpload) { setIsSubmitting(false); return; }
    }

    try {
      const batch = writeBatch(db);
      const courseDocRef = doc(db, "courses", courseId);
      const courseUpdatePayload = {
        title: data.title, category: data.category, courseType: data.courseType, referenceBody: data.referenceBody || null, description: data.description,
        duration: data.duration, mandatory: data.mandatory, published: data.published, fileURL: fileDownloadURL, imageHint: data.imageHint || data.category.toLowerCase().split(" ")[0] || "training",
        chapters: data.chapters || [],
        updatedAt: serverTimestamp(),
      };
      batch.update(courseDocRef, courseUpdatePayload);

      const quizDocRef = doc(db, "quizzes", initialQuizId);
      batch.update(quizDocRef, {
        title: data.quizTitle, randomizeQuestions: data.randomizeQuestions, randomizeAnswers: data.randomizeAnswers,
      });

      // Delete old questions
      const oldQuestionsQuery = query(collection(db, "questions"), where("quizId", "==", initialQuizId));
      const oldQuestionsSnap = await getDocs(oldQuestionsQuery);
      oldQuestionsSnap.forEach(qDoc => batch.delete(qDoc.ref));
      
      // Add new questions
      data.questions.forEach((question) => {
        const questionRef = doc(collection(db, "questions"));
        batch.set(questionRef, {
          ...question,
          quizId: initialQuizId,
          options: question.options ? question.options.map(opt => opt.text) : [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      const certRuleDocRef = doc(db, "certificateRules", initialCertRuleId);
      batch.update(certRuleDocRef, {
        passingThreshold: data.passingThreshold, expiryDurationDays: data.certificateExpiryDays,
        logoURL: data.certificateLogoUrl || null, signatureTextOrURL: data.certificateSignature,
      });

      await batch.commit();
      
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: "UPDATE_COURSE",
        entityType: "COURSE",
        entityId: courseId,
        details: { title: data.title, category: data.category, published: data.published },
      });

      toast({
        title: "Course Updated Successfully!", description: `Course "${data.title}" has been updated.`,
        action: <CheckCircle className="text-green-500" />,
      });
      router.push('/admin/courses');
    } catch (error) {
      console.error("Error updating course structure:", error);
      toast({ title: "Update Failed", description: "Could not update the course. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }
  
  const handleParseContent = async () => {
    if (!rawContentText.trim()) {
      toast({ title: "No Text Provided", description: "Please paste the course content into the box.", variant: "default" });
      return;
    }
    setIsParsingContent(true);
    try {
      const parsedChapters = await parseCourseContent({ rawText: rawContentText });
      if (parsedChapters && parsedChapters.length > 0) {
        replaceChapters(parsedChapters);
        toast({ title: "Content Structured!", description: "The course content has been automatically structured. Please review." });
        setRawContentText("");
      } else {
        toast({ title: "Parsing Incomplete", description: "The AI could not structure the content. Please try reformatting the text.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error parsing content:", error);
      toast({ title: "Parsing Failed", description: "An unexpected error occurred during content structuring.", variant: "destructive" });
    } finally {
      setIsParsingContent(false);
    }
  };

  if (authLoading || isLoadingData) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3">Loading course data...</p></div>;
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
            <EditIconMain className="mr-3 h-8 w-8 text-primary" />
            Edit Comprehensive Training Course
          </CardTitle>
          <CardDescription>
            Modify the details of the training course, its content, quiz settings, and certification rules.
          </CardDescription>
        </CardHeader>
      </Card>

      <Form {...courseEditForm}>
        <form onSubmit={courseEditForm.handleSubmit(onCourseSubmit)} className="space-y-10">
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold">1. Course Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={courseEditForm.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Course Title*</FormLabel><FormControl><Input placeholder="e.g., Advanced First Aid Onboard" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={courseEditForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select course category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courseCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={courseEditForm.control} name="courseType" render={({ field }) => (
                  <FormItem><FormLabel>Course Type*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course type" /></SelectTrigger></FormControl><SelectContent>{courseTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={courseEditForm.control} name="referenceBody" render={({ field }) => (
                  <FormItem><FormLabel>Reference Document/Body</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select reference body" /></SelectTrigger></FormControl><SelectContent>{referenceBodyOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormDescription>Optional. Specify the main reference document or body.</FormDescription><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={courseEditForm.control} name="duration" render={({ field }) => (
                    <FormItem><FormLabel>Estimated Duration*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select estimated duration" /></SelectTrigger></FormControl>
                            <SelectContent>{courseDurationOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                        </Select>
                    <FormMessage />
                    </FormItem>
                )} />
                <FormField control={courseEditForm.control} name="imageHint" render={({ field }) => (
                  <FormItem><FormLabel>Course Image Hint (Optional)</FormLabel><FormControl><Input placeholder="e.g., emergency exit, first aid" {...field} value={field.value || ""} /></FormControl><FormDescription>Keywords for course image (e.g., cockpit, safety vest).</FormDescription><FormMessage /></FormItem>
              )} />
              </div>
              <FormField control={courseEditForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description*</FormLabel><FormControl><Textarea placeholder="Detailed overview of the course..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={courseEditForm.control}
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
                <FormField
                    control={courseEditForm.control}
                    name="published"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel className="flex items-center">
                                {field.value ? <ToggleRight className="mr-2 h-5 w-5 text-green-500"/> : <ToggleLeft className="mr-2 h-5 w-5 text-muted-foreground"/>}
                                Course Visibility
                            </FormLabel>
                            <FormDescription>
                                {field.value ? "Published (visible to users)" : "Draft (hidden from users)"}
                            </FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Course visibility toggle" /></FormControl>
                    </FormItem>
                    )}
                />
              </div>
              <FormField control={courseEditForm.control} name="associatedFile" render={({ field: { onChange, value, ...rest }}) => (
                <FormItem>
                  <FormLabel className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" />Main Course Material (Optional)</FormLabel>
                   {watchedFormValues.existingFileUrl && (
                    <FormDescription>
                        Current file: <a href={watchedFormValues.existingFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{watchedFormValues.existingFileUrl.split('/').pop()?.split('?')[0].substring(14) || 'View File'}</a>. Uploading a new file will replace it.
                    </FormDescription>
                   )}
                  <FormControl><Input type="file" {...rest} onChange={(e) => onChange(e.target.files)} ref={fileInputRef} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" /></FormControl>
                  <FormDescription>Upload PDF, video, or other course material (max 10MB). Chapter-specific resources are managed below.</FormDescription>
                  {uploadProgress !== null && <Progress value={uploadProgress} className="w-full mt-2" />}
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
          
           <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-primary" />
                AI-Powered Content Structuring
              </CardTitle>
              <CardDescription>Paste formatted text from a manual below, and the AI will attempt to structure it into chapters and sections for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Paste your formatted content here..."
                className="min-h-[200px] font-mono text-xs"
                value={rawContentText}
                onChange={(e) => setRawContentText(e.target.value)}
              />
              <Button type="button" onClick={handleParseContent} disabled={isParsingContent || !rawContentText.trim()}>
                {isParsingContent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Structure Content
              </Button>
            </CardContent>
          </Card>


          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center"><LayoutList className="mr-2 h-5 w-5 text-primary" /> Course Content (Chapters)</CardTitle>
                <CardDescription>Define the hierarchical structure of your course content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {chapterFields.map((chapterItem, index) => (
                <CourseContentBlock
                  key={chapterItem.id}
                  control={courseEditForm.control}
                  name="chapters"
                  index={index}
                  removeSelf={() => chapterFields.length > 1 ? removeChapter(index) : toast({title: "Cannot Remove", description:"Course must have at least one chapter.", variant:"destructive"})}
                  level={0}
                />
              ))}
               <Button type="button" variant="outline" onClick={() => appendChapter(defaultChapterValue)}><PlusCircle className="mr-2 h-4 w-4" />Add Chapter</Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><HelpCircle className="mr-2 h-5 w-5 text-primary" /> Quiz Builder</CardTitle><CardDescription>Configure the main quiz and add its questions here.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <FormField control={courseEditForm.control} name="quizTitle" render={({ field }) => (
                <FormItem><FormLabel>Quiz Title*</FormLabel><FormControl><Input placeholder="e.g., Final Assessment for Advanced First Aid" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="space-y-2">
                <FormField control={courseEditForm.control} name="randomizeQuestions" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Randomize Question Order?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )} />
                <FormField control={courseEditForm.control} name="randomizeAnswers" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Randomize Answer Order (for MCQs)?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                )} />
              </div>
              <div className="space-y-4 pt-4 border-t">
                 <h3 className="text-lg font-medium">Quiz Questions</h3>
                 {questionFields.map((questionItem, index) => {
                    const type = watchedQuestionType(index);
                    const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({ control: courseEditForm.control, name: `questions.${index}.options` });
                    const optionsForSelect = courseEditForm.watch(`questions.${index}.options`)?.map(opt => opt.text).filter(Boolean) || [];

                    return (
                        <Card key={questionItem.id} className="p-4 bg-muted/50">
                            <div className="flex justify-between items-center mb-2">
                                <FormLabel className="font-semibold">Question {index + 1}</FormLabel>
                                <Button type="button" variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => removeQuestion(index)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                            <div className="space-y-3">
                                <FormField control={courseEditForm.control} name={`questions.${index}.questionText`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Question Text</FormLabel><FormControl><Textarea placeholder="Enter the question..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <div className="grid grid-cols-2 gap-4">
                                  <FormField control={courseEditForm.control} name={`questions.${index}.questionType`} render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{questionTypes.map(type => <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                  )}/>
                                   {type === 'mcq' && (
                                    <FormField control={courseEditForm.control} name={`questions.${index}.correctAnswer`} render={({ field }) => (
                                      <FormItem><FormLabel className="text-xs">Correct Answer</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select correct option"/></SelectTrigger></FormControl><SelectContent>{optionsForSelect.map((optText, i) => <SelectItem key={i} value={optText}>{optText}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                    )}/>
                                  )}
                                   {type === 'tf' && (
                                    <FormField control={courseEditForm.control} name={`questions.${index}.correctAnswer`} render={({ field }) => (
                                      <FormItem><FormLabel className="text-xs">Correct Answer</FormLabel><Select onValueChange={field.onChange} value={field.value || "True"}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                    )}/>
                                  )}
                                </div>
                                {type === 'mcq' && (<div className="space-y-2"><FormLabel className="text-xs">Options</FormLabel>{optionFields.map((opt, optIndex) => (<div key={opt.id} className="flex items-center gap-2"><FormField control={courseEditForm.control} name={`questions.${index}.options.${optIndex}.text`} render={({ field }) => (<FormItem className="flex-grow"><FormControl><Input placeholder={`Option ${optIndex + 1}`} {...field} /></FormControl><FormMessage /></FormItem>)}/><Button type="button" variant="ghost" size="icon" onClick={() => removeOption(optIndex)}><Trash2 className="h-4 w-4 text-destructive/70" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => appendOption(defaultQuestionOptionValue)}>Add Option</Button></div>)}
                                {type === 'short' && (<FormField control={courseEditForm.control} name={`questions.${index}.correctAnswer`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Correct Answer (Exact Match)</FormLabel><FormControl><Input placeholder="Enter the exact correct answer" {...field} /></FormControl><FormMessage /></FormItem>)} />)}
                            </div>
                        </Card>
                    )
                 })}
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => appendQuestion(defaultQuestionFormValues)}>
                        <PlusCircle className="mr-2 h-4 w-4"/>Add Manually
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setIsBankDialogOpen(true)}>
                        <HelpCircle className="mr-2 h-4 w-4" /> Add from Bank
                    </Button>
                  </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><Award className="mr-2 h-5 w-5 text-primary" /> Certification Rules</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={courseEditForm.control} name="passingThreshold" render={({ field }) => (
                  <FormItem><FormLabel>Passing Threshold (%)*</FormLabel><FormControl><Input type="number" placeholder="80" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={courseEditForm.control} name="certificateExpiryDays" render={({ field }) => (
                  <FormItem><FormLabel>Certificate Expiry (days)*</FormLabel><FormControl><Input type="number" placeholder="365" {...field} /></FormControl><FormDescription>0 for no expiry.</FormDescription><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={courseEditForm.control} name="certificateLogoUrl" render={({ field }) => (
                <FormItem><FormLabel>Certificate Logo URL (Optional)</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value || ""} /></FormControl><FormDescription>Link to your airline's logo. Default placeholder will be used if empty.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={courseEditForm.control} name="certificateSignature" render={({ field }) => (
                <FormItem><FormLabel>Certificate Signature Text/Authority*</FormLabel><FormControl><Input placeholder="Express Airline Training Department" {...field} /></FormControl><FormDescription>Text to display as the issuing authority or signature.</FormDescription><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><Eye className="mr-2 h-5 w-5 text-primary" /> Summary & Certificate Preview</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium mb-2">Dynamic Summary:</h3>
                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        <li>Course Title: {watchedFormValues.title || "Not set"}</li>
                        <li>Category: {watchedFormValues.category || "Not set"}</li>
                        <li>Mandatory: {watchedFormValues.mandatory ? "Yes" : "No"}</li>
                        <li>Published: {watchedFormValues.published ? "Yes (Visible)" : "No (Draft)"}</li>
                        <li>Chapters: {watchedFormValues.chapters?.length || 0}</li>
                        <li>Questions: {watchedFormValues.questions?.length || 0}</li>
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
            <Button type="submit" size="lg" disabled={isSubmitting || !courseEditForm.formState.isValid || isLoadingData} className="min-w-[180px]">
              {isSubmitting ? (
                <> <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Updating... </>
              ) : (
                <> <CheckCircle className="mr-2 h-5 w-5" /> Update Course </>
              )}
            </Button>
          </div>
          {!courseEditForm.formState.isValid && isSubmitting === false && (
            <p className="text-sm text-destructive text-right mt-2">Please fill all required fields and correct any errors before updating.</p>
          )}
        </form>
      </Form>

       {isBankDialogOpen && (
        <QuestionBankDialog
          isOpen={isBankDialogOpen}
          onOpenChange={setIsBankDialogOpen}
          onAddQuestions={handleAddQuestionsFromBank}
          existingQuestionIds={existingQuestionIds}
        />
      )}
    </div>
  );
}
