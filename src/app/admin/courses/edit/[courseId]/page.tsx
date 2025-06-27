
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { Edit3 as EditIconMain, Loader2, AlertTriangle, CheckCircle, PlusCircle, UploadCloud, Eye, Award, FileText as FileTextIcon, LayoutList, HelpCircle, Trash2, ToggleRight, ToggleLeft, Edit3 as EditQuestionIcon } from "lucide-react";
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
  addDoc,
  Timestamp,
  orderBy,
  updateDoc
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogPrimitiveDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogPrimitiveTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  courseCategories,
  courseTypes,
  referenceBodyOptions,
  courseDurationOptions,
} from "@/config/course-options";
import { 
  courseFormSchema,
  type CourseFormValues,
  defaultChapterValue, 
  defaultValues as initialFormDefaultValues 
} from "@/schemas/course-schema";
import CourseContentBlock from "@/components/admin/course-content-block";
import { 
  questionFormSchema, 
  type QuestionFormValues, 
  defaultQuestionFormValues,
  defaultQuestionOptionValue,
  type QuestionType,
  type StoredQuestion,
  questionTypes as qTypesList
} from "@/schemas/quiz-question-schema";
import { Separator } from "@/components/ui/separator";
import { logAuditEvent } from "@/lib/audit-logger";

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

  const [quizQuestions, setQuizQuestions] = React.useState<StoredQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = React.useState(false);
  
  const [isEditingQuestion, setIsEditingQuestion] = React.useState(false);
  const [editingQuestionId, setEditingQuestionId] = React.useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = React.useState<StoredQuestion | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = React.useState(false);
  const [isDeletingQuestion, setIsDeletingQuestion] = React.useState(false);
  const [isQuestionManagerOpen, setIsQuestionManagerOpen] = React.useState(false);


  const courseEditForm = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: initialFormDefaultValues, 
    mode: "onBlur",
  });

  const { fields: chapterFields, append: appendChapter, remove: removeChapter, replace: replaceChapters } = useFieldArray({
    control: courseEditForm.control,
    name: "chapters",
  });

  const addQuestionForm = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: defaultQuestionFormValues,
    mode: "onChange",
  });

  const { fields: mcqOptionFields, append: appendMcqOption, remove: removeMcqOption, replace: replaceMcqOptions } = useFieldArray({
    control: addQuestionForm.control,
    name: "options",
  });
  
  const watchedQuestionType = addQuestionForm.watch("questionType");

  React.useEffect(() => {
    if (!isEditingQuestion) { 
        if (watchedQuestionType === "tf") {
            replaceMcqOptions([{ text: "True" }, { text: "False" }]);
            addQuestionForm.setValue("correctAnswer", "True"); 
        } else if (watchedQuestionType === "mcq") {
            const currentOptions = addQuestionForm.getValues("options");
            if (!currentOptions || currentOptions.length === 0) {
                replaceMcqOptions([defaultQuestionOptionValue, defaultQuestionOptionValue]);
            }
        } else if (watchedQuestionType === "short") {
            replaceMcqOptions([]);
        }
    }
  }, [watchedQuestionType, addQuestionForm, replaceMcqOptions, isEditingQuestion]);


  const fetchQuizQuestions = React.useCallback(async (quizId: string) => {
    if (!quizId) return;
    setIsLoadingQuestions(true);
    try {
      const q = query(collection(db, "questions"), where("quizId", "==", quizId), orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const questions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredQuestion));
      setQuizQuestions(questions);
    } catch (error) {
      console.error("Error fetching quiz questions:", error);
      toast({ title: "Error", description: "Could not load quiz questions.", variant: "destructive" });
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [toast]);


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
          if (courseData.quizId) {
            const quizSnap = await getDoc(doc(db, "quizzes", courseData.quizId));
            if (quizSnap.exists()) quizData = quizSnap.data();
            fetchQuizQuestions(courseData.quizId); 
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
            passingThreshold: certRuleData?.passingThreshold || 80,
            certificateExpiryDays: certRuleData?.expiryDurationDays !== undefined ? certRuleData.expiryDurationDays : 365,
            certificateLogoUrl: certRuleData?.logoURL || "https://placehold.co/150x50.png",
            certificateSignature: certRuleData?.signatureTextOrURL || "Express Airline Training Department",
          });
          replaceChapters(courseData.chapters && courseData.chapters.length > 0 ? courseData.chapters.map((ch: any) => ({...ch})) : [defaultChapterValue]);

        } catch (error) {
          console.error("Error loading course data:", error);
          toast({ title: "Loading Error", description: "Failed to load course data.", variant: "destructive" });
        } finally {
          setIsLoadingData(false);
        }
      };
      loadCourseData();
    }
  }, [courseId, user, authLoading, router, toast, courseEditForm, replaceChapters, fetchQuizQuestions]);

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

  const handleSaveQuestion = async (data: QuestionFormValues) => {
    if (!user || !initialQuizId) {
      toast({ title: "Error", description: "Cannot save question. Quiz ID or user missing.", variant: "destructive" });
      return;
    }
    setIsSavingQuestion(true);
    try {
      const questionPayload = {
        quizId: initialQuizId,
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.options ? data.options.map(opt => opt.text) : [],
        correctAnswer: data.correctAnswer,
        updatedAt: serverTimestamp(),
      };

      let action: "CREATE" | "UPDATE" = "CREATE";
      let qId = "";

      if (isEditingQuestion && editingQuestionId) {
        await updateDoc(doc(db, "questions", editingQuestionId), questionPayload);
        toast({ title: "Question Updated", description: "Question saved successfully." });
        action = "UPDATE";
        qId = editingQuestionId;
      } else {
        const newQuestionRef = await addDoc(collection(db, "questions"), { ...questionPayload, createdAt: serverTimestamp() });
        toast({ title: "Question Added", description: "New question saved successfully." });
        qId = newQuestionRef.id;
      }
      
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: action === "CREATE" ? "CREATE_QUIZ_QUESTION" : "UPDATE_QUIZ_QUESTION",
        entityType: "QUIZ_QUESTION",
        entityId: qId,
        details: { courseId: courseId, quizId: initialQuizId, questionText: data.questionText.substring(0, 50) + "..." },
      });

      addQuestionForm.reset(defaultQuestionFormValues);
      replaceMcqOptions([defaultQuestionOptionValue, defaultQuestionOptionValue]); 
      setIsEditingQuestion(false);
      setEditingQuestionId(null);
      fetchQuizQuestions(initialQuizId);
    } catch (error) {
      console.error("Error saving question:", error);
      toast({ title: `Failed to ${isEditingQuestion ? 'Update' : 'Add'} Question`, description: "Could not save the question.", variant: "destructive" });
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleOpenEditQuestionDialog = (question: StoredQuestion) => {
    setIsEditingQuestion(true);
    setEditingQuestionId(question.id);
    addQuestionForm.reset({
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options ? question.options.map(opt => ({ text: opt })) : [],
      correctAnswer: question.correctAnswer,
    });
  };

  const handleCancelEditQuestion = () => {
    setIsEditingQuestion(false);
    setEditingQuestionId(null);
    addQuestionForm.reset(defaultQuestionFormValues);
    replaceMcqOptions([defaultQuestionOptionValue, defaultQuestionOptionValue]);
  };
  
  const confirmDeleteQuestion = async () => {
    if (!questionToDelete || !initialQuizId || !user) return;
    setIsDeletingQuestion(true);
    try {
        await deleteDoc(doc(db, "questions", questionToDelete.id));
        
        await logAuditEvent({
            userId: user.uid,
            userEmail: user.email || "N/A",
            actionType: "DELETE_QUIZ_QUESTION",
            entityType: "QUIZ_QUESTION",
            entityId: questionToDelete.id,
            details: { courseId: courseId, quizId: initialQuizId, questionText: questionToDelete.questionText.substring(0, 50) + "..." },
        });

        toast({ title: "Question Deleted", description: `Question "${questionToDelete.questionText.substring(0,30)}..." has been deleted.` });
        fetchQuizQuestions(initialQuizId);
        setQuestionToDelete(null); 
    } catch (error) {
        console.error("Error deleting question:", error);
        toast({ title: "Deletion Failed", description: "Could not delete the question.", variant: "destructive" });
    } finally {
        setIsDeletingQuestion(false);
    }
  };
  
  const watchedFormValues = courseEditForm.watch();

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
                  <FormItem><FormLabel>Category*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select course category" /></SelectTrigger></FormControl><SelectContent>{courseCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
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
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><FileTextIcon className="mr-2 h-5 w-5 text-primary" /> Main Course Quiz Settings</CardTitle><CardDescription>Configure the main quiz parameters.</CardDescription></CardHeader>
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
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center">
                <HelpCircle className="mr-2 h-5 w-5 text-primary" /> Quiz Questions
              </CardTitle>
              <CardDescription>
                Manage the questions for the &quot;{courseEditForm.getValues('quizTitle')}&quot; quiz.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    There are currently {quizQuestions.length} question(s) in this quiz.
                </p>
                <Button type="button" onClick={() => setIsQuestionManagerOpen(true)}>
                    <EditQuestionIcon className="mr-2 h-4 w-4" /> Open Question Manager
                </Button>
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
      
      <Dialog open={isQuestionManagerOpen} onOpenChange={setIsQuestionManagerOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Manage Quiz Questions for &quot;{courseEditForm.getValues('quizTitle')}&quot;</DialogTitle>
                <DialogDescription>
                    Add new questions or edit existing ones. Changes are saved individually.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-4 -mr-4">
              <div className="py-4 space-y-6">
                <Form {...addQuestionForm}>
                  <form onSubmit={addQuestionForm.handleSubmit(handleSaveQuestion)} className="space-y-4 p-4 border rounded-md">
                      <h4 className="text-md font-medium mb-2">{isEditingQuestion ? `Editing: ${quizQuestions.find(q=>q.id === editingQuestionId)?.questionText.substring(0,50)}...` : "Add New Question"}</h4>
                      <FormField control={addQuestionForm.control} name="questionText" render={({ field }) => (
                          <FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea placeholder="Enter the question..." {...field} /></FormControl><FormMessage /></FormItem>
                      )}/>
                      <FormField control={addQuestionForm.control} name="questionType" render={({ field }) => (
                          <FormItem><FormLabel>Question Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{qTypesList.map(type => <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                      )}/>
                      {watchedQuestionType === 'mcq' && (
                        <div className="space-y-2"><FormLabel>Options (MCQ)</FormLabel>
                          {mcqOptionFields.map((optionField, optIndex) => (
                            <div key={optionField.id} className="flex items-center gap-2">
                              <FormField control={addQuestionForm.control} name={`options.${optIndex}.text`} render={({ field }) => (<FormItem className="flex-grow"><FormControl><Input placeholder={`Option ${optIndex + 1}`} {...field} /></FormControl><FormMessage /></FormItem>)}/>
                              <Button type="button" variant="ghost" size="icon" onClick={() => mcqOptionFields.length > 2 && removeMcqOption(optIndex)} disabled={mcqOptionFields.length <= 2}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={() => appendMcqOption(defaultQuestionOptionValue)}><PlusCircle className="mr-2 h-4 w-4" /> Add Option</Button>
                        </div>
                      )}
                      <FormField control={addQuestionForm.control} name="correctAnswer" render={({ field }) => {
                          if (watchedQuestionType === 'tf') {
                            return (<FormItem><FormLabel>Correct Answer (True/False)</FormLabel><Select onValueChange={field.onChange} value={field.value || "True"}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent></Select><FormMessage /></FormItem>);
                          }
                          if (watchedQuestionType === 'mcq') {
                            const options = addQuestionForm.getValues("options")?.map(opt => opt.text).filter(Boolean) || [];
                            return (<FormItem><FormLabel>Correct Answer (MCQ)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={options.length > 0 ? "Select correct option" : "Add options first"}/></SelectTrigger></FormControl><SelectContent>{options.map((optText, i) => <SelectItem key={i} value={optText}>{optText}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>);
                          }
                          return (<FormItem><FormLabel>Correct Answer (Short Answer)</FormLabel><FormControl><Input placeholder="Enter the exact correct answer" {...field} /></FormControl><FormMessage /></FormItem>);
                      }}/>
                      <div className="flex gap-2">
                          <Button type="submit" disabled={isSavingQuestion} size="sm">{isSavingQuestion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditingQuestion ? "Update Question" : "Add Question to Quiz"}</Button>
                          {isEditingQuestion && (<Button type="button" variant="outline" size="sm" onClick={handleCancelEditQuestion} disabled={isSavingQuestion}>Cancel Edit</Button>)}
                      </div>
                    </form>
                  </Form>
                <Separator className="my-6"/>
                <div>
                  <h4 className="text-md font-medium mb-3">Existing Questions ({quizQuestions.length})</h4>
                  {isLoadingQuestions ? (<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-sm text-muted-foreground">Loading questions...</p></div>
                  ) : quizQuestions.length === 0 ? (<p className="text-sm text-muted-foreground">No questions added to this quiz yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {quizQuestions.map((q, index) => (
                        <Card key={q.id} className="p-3 bg-muted/40 text-sm flex justify-between items-start">
                          <div>
                            <p className="font-medium">Q{index + 1}: {q.questionText}</p>
                            <p className="text-xs text-muted-foreground">Type: {q.questionType.toUpperCase()} | Answer: <span className="font-mono text-primary">{q.correctAnswer}</span></p>
                            {q.questionType === 'mcq' && q.options && q.options.length > 0 && (<p className="text-xs text-muted-foreground">Options: {q.options.join('; ')}</p>)}
                          </div>
                          <div className="flex gap-1 flex-shrink-0 ml-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditQuestionDialog(q)}><EditQuestionIcon className="h-4 w-4 text-blue-600"/></Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQuestionToDelete(q)}><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                              </AlertDialog>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
             <DialogFooter className="mt-auto pt-4 border-t">
              <DialogClose asChild>
                <Button type="button" variant="outline">Close Manager</Button>
              </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      {questionToDelete && (
        <AlertDialog open={!!questionToDelete} onOpenChange={(open) => !open && setQuestionToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogPrimitiveTitle>Confirm Question Deletion</AlertDialogPrimitiveTitle>
                    <AlertDialogPrimitiveDescription>
                        Are you sure you want to delete the question: "{questionToDelete.questionText.substring(0,50)}..."?
                        This action cannot be undone.
                    </AlertDialogPrimitiveDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setQuestionToDelete(null)} disabled={isDeletingQuestion}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteQuestion} disabled={isDeletingQuestion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeletingQuestion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Question
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
