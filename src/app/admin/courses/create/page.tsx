
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
import { BookOpenCheck, Loader2, AlertTriangle, CheckCircle, PlusCircle, UploadCloud, Eye, Award, FileText as FileTextIcon, LayoutList } from "lucide-react";
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
  defaultValues 
} from "@/schemas/course-schema";
import CourseContentBlock from "@/components/admin/course-content-block"; // Import the new component

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

  const { fields: chapterFields, append: appendChapter, remove: removeChapter } = useFieldArray({
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
        fileURL: fileDownloadURL, // Main course file URL
        imageHint: data.imageHint || data.category.toLowerCase().split(" ")[0] || "training",
        chapters: data.chapters || [], // Save hierarchical chapters
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

      // Questions are no longer manually created here. They would be AI-generated.

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
        description: `Course "${data.title}" with its content and certification rules has been saved. Quiz questions will be managed separately or AI-generated.`,
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
            Define all aspects of your new training course, including hierarchical content, quiz settings, and certification.
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
                <FormField control={form.control} name="referenceBody" render={({ field }) => (
                  <FormItem><FormLabel>Reference Document/Body</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select reference body" /></SelectTrigger></FormControl><SelectContent>{referenceBodyOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormDescription>Optional. Specify the main reference document or body.</FormDescription><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="duration" render={({ field }) => (
                    <FormItem><FormLabel>Estimated Duration*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select estimated duration" /></SelectTrigger></FormControl>
                            <SelectContent>{courseDurationOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                        </Select>
                    <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="imageHint" render={({ field }) => (
                  <FormItem><FormLabel>Course Image Hint (Optional)</FormLabel><FormControl><Input placeholder="e.g., emergency exit, first aid" {...field} value={field.value || ""} /></FormControl><FormDescription>Keywords for course image (e.g., cockpit, safety vest).</FormDescription><FormMessage /></FormItem>
              )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description*</FormLabel><FormControl><Textarea placeholder="Detailed overview of the course..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
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
            </CardContent>
          </Card>
          
          {/* Section 1.5: Course Content (Chapters) */}
          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center"><LayoutList className="mr-2 h-5 w-5 text-primary" /> Course Content (Chapters)</CardTitle>
                <CardDescription>Define the hierarchical structure of your course content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {chapterFields.map((chapterItem, index) => (
                <CourseContentBlock
                  key={chapterItem.id}
                  control={form.control} // Pass control
                  name="chapters"         // Pass the name of the field array
                  index={index}            // Pass the index of this specific chapter
                  removeSelf={() => chapterFields.length > 1 ? removeChapter(index) : toast({title: "Cannot Remove", description:"Course must have at least one chapter.", variant:"destructive"})}
                  level={0}                // Top-level chapters are level 0
                />
              ))}
              <Button type="button" variant="outline" onClick={() => appendChapter(defaultChapterValue)}><PlusCircle className="mr-2 h-4 w-4" />Add Chapter</Button>
            </CardContent>
          </Card>

          {/* Section 2: Quiz Settings */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><FileTextIcon className="mr-2 h-5 w-5 text-primary" /> Main Course Quiz Settings</CardTitle><CardDescription>Configure the main quiz. Questions will be AI-generated based on course content or managed externally.</CardDescription></CardHeader>
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
              <FormDescription>Note: Specific quiz questions are no longer managed here. They will be linked via the Quiz ID generated or handled by an AI generation process.</FormDescription>
            </CardContent>
          </Card>

          {/* Section 3: Certification Rules */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-semibold flex items-center"><Award className="mr-2 h-5 w-5 text-primary" /> Certification Rules</CardTitle></CardHeader>
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
          
          {/* Section 4: Summary & Preview */}
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
