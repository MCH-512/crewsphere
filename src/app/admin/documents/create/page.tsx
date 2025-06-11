
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus, Loader2, AlertTriangle, CheckCircle, Save, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, getMetadata } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

const categories = [
  "SOPs (Standard Operating Procedures)",
  "SEP (Safety & Emergency Procedures)",
  "CRM & FRMS",
  "AVSEC (Aviation Security)",
  "Cabin & Service Operations",
  "Dangerous Goods (DGR)",
  "Manuels",
  "Training & Formations",
  "Règlementation & Références"
];
const documentSources = [
  "Operations Manual (OMA)",
  "Operations Manual (OMD)",
  "Cabin Safety Manual (CSM)",
  "EASA",
  "IATA",
  "ICAO",
  "DGAC",
  "Cabin Procedures Manual (CPM)",
  "Compagnie procedures",
  "Relevant Tunisian laws",
  "Internal Memo",
  "Safety Bulletin",
  "Operational Notice",
  "Other",
];

const MAX_FILE_SIZE_MB = 15;

const documentFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(150),
  category: z.string({ required_error: "Please select a category." }),
  source: z.string({ required_error: "Please select the document source/type." }),
  version: z.string().max(20).optional(),
  content: z.string().max(20000, "Content is too long (max 20,000 chars).").optional(),
  file: z.custom<FileList>().optional()
    .refine((files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE_MB * 1024 * 1024, 
            `File size should be less than ${MAX_FILE_SIZE_MB}MB.`),
}).superRefine((data, ctx) => {
  if (!data.content?.trim() && (!data.file || data.file.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either document content (Markdown) or a file attachment is required.",
      path: ["content"], 
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A file attachment is required if no content is provided.",
      path: ["file"],
    });
  }
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

export default function CreateDocumentPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      category: "",
      source: "",
      version: "",
      content: "",
    },
    mode: "onChange",
  });

  async function onSubmit(data: DocumentFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to create documents.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(null);

    let fileDownloadURL: string | null = null;
    let fileStoragePath: string | null = null;
    let originalFileName: string | null = null;
    let fileType: string | null = null;
    let fileSizeMB: string | null = null;
    let documentContentType: 'markdown' | 'file' | 'fileWithMarkdown' = 'markdown';

    const fileToUpload = data.file?.[0];

    if (fileToUpload) {
      const uniqueFileName = `${new Date().getTime()}-${fileToUpload.name.replace(/\s+/g, '_')}`;
      fileStoragePath = `documents/${uniqueFileName}`;
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
            try {
              fileDownloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const metadata = await getMetadata(uploadTask.snapshot.ref);
              originalFileName = fileToUpload.name;
              fileType = fileToUpload.type;
              fileSizeMB = (metadata.size / (1024 * 1024)).toFixed(2) + "MB";
              resolve();
            } catch (metaError) {
              console.error("Error getting file metadata:", metaError);
              toast({ title: "File Metadata Error", description: "Could not get file metadata after upload.", variant: "destructive" });
              reject(metaError);
            }
          }
        );
      });
      if (!fileDownloadURL) { // If upload failed and didn't resolve URL
         setIsSubmitting(false);
         return; 
      }
    }

    if (fileDownloadURL && data.content?.trim()) {
      documentContentType = 'fileWithMarkdown';
    } else if (fileDownloadURL) {
      documentContentType = 'file';
    } else if (data.content?.trim()) {
      documentContentType = 'markdown';
    } else {
      // This case should be caught by Zod superRefine, but as a safeguard:
      toast({ title: "Invalid Data", description: "Document must have content or a file.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      await addDoc(collection(db, "documents"), {
        title: data.title,
        category: data.category,
        source: data.source,
        version: data.version || "",
        content: data.content?.trim() || null,
        downloadURL: fileDownloadURL,
        filePath: fileStoragePath,
        fileName: originalFileName,
        fileType: fileType,
        size: fileSizeMB,
        documentContentType: documentContentType,
        lastUpdated: serverTimestamp(),
        uploadedBy: user.uid,
        uploaderEmail: user.email,
      });

      toast({
        title: "Document Created Successfully",
        description: `The document "${data.title}" has been saved.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset();
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.push("/admin/documents");
    } catch (error) {
      console.error("Error creating document in Firestore:", error);
      toast({ title: "Creation Failed", description: "Could not create the document. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
    }
  }, [user, authLoading, router, toast]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FilePlus className="mr-3 h-7 w-7 text-primary" />
            Create New Document
          </CardTitle>
          <CardDescription>
            Fill in the details for the new document. You can provide text content (Markdown), attach a file, or both.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title*</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., New Boarding Procedure Update" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provenance / Type*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select the document source or type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentSources.map(src => (
                            <SelectItem key={src} value={src}>{src}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>E.g., Internal Memo, Safety Bulletin, Procedure Update.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., v1.0, Issue Date 2024-07-30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content (Markdown accepted)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write the content of your document here. Use Markdown for formatting (e.g., # Heading, *bold*, - list item)."
                        className="min-h-[250px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Max 20,000 characters. Will be rendered as rich text.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
                />

              <FormField
                control={form.control}
                name="file"
                render={({ field: { onChange, value, ...rest } }) => ( 
                    <FormItem>
                        <FormLabel className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" />Attach File (Optional)</FormLabel>
                        <FormControl>
                            <Input 
                                type="file" 
                                {...rest} 
                                onChange={(e) => onChange(e.target.files)} 
                                ref={fileInputRef}
                                className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary/10 file:text-primary
                                hover:file:bg-primary/20"
                            />
                        </FormControl>
                        <FormDescription>Max file size: {MAX_FILE_SIZE_MB}MB. (e.g., PDF, DOCX, XLSX, Images).</FormDescription>
                        {uploadProgress !== null && <Progress value={uploadProgress} className="w-full mt-2" />}
                        <FormMessage />
                    </FormItem>
                )}
                />
            <FormDescription className="text-destructive-foreground bg-destructive/80 p-2 rounded-md text-xs">
                Important: You must provide either text content OR attach a file (or both).
            </FormDescription>

              <Button type="submit" disabled={isSubmitting || !user || user.role !== 'admin' || !form.formState.isValid} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Document...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Document
                  </>
                )}
              </Button>
              {!form.formState.isValid && user && (
                 <p className="text-sm text-destructive">Please fill all required fields (Title, Category, Source) and ensure either Content or a File is provided.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
