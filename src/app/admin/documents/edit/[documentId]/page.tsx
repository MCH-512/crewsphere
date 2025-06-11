
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
import { FileEdit, Loader2, AlertTriangle, CheckCircle, Save, UploadCloud, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, getMetadata, deleteObject } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const categories = ["Operations", "Safety", "HR", "Training", "Service", "Regulatory", "General", "Manuals", "Bulletins", "Forms", "Procedures", "Memos"];
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

interface DocumentForEdit {
  id: string;
  title: string;
  category: string;
  source: string;
  version?: string;
  content?: string | null;
  downloadURL?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  size?: string | null;
  documentContentType: 'markdown' | 'file' | 'fileWithMarkdown';
  lastUpdated: Timestamp;
  uploadedBy: string;
  uploaderEmail?: string;
}

const documentFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(150),
  category: z.string({ required_error: "Please select a category." }),
  source: z.string({ required_error: "Please select the document source/type." }),
  version: z.string().max(20).optional(),
  content: z.string().max(20000, "Content is too long (max 20,000 chars).").optional(),
  file: z.custom<FileList>().optional()
    .refine((files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE_MB * 1024 * 1024, 
            `File size should be less than ${MAX_FILE_SIZE_MB}MB.`),
  existingFileUrl: z.string().optional(),
  existingFilePath: z.string().optional(),
  existingFileName: z.string().optional(),
}).superRefine((data, ctx) => {
  // For edit, it's valid if there's existing content OR an existing file OR new content OR a new file.
  if (!data.content?.trim() && (!data.file || data.file.length === 0) && !data.existingFileUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Document must have content or a file. Please add content or upload a new file if removing the existing one.",
      path: ["content"], 
    });
  }
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

export default function EditDocumentPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentDocumentType, setCurrentDocumentType] = React.useState<'markdown' | 'file' | 'fileWithMarkdown' | null>(null);


  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      category: "",
      source: "",
      version: "",
      content: "",
      existingFileUrl: "",
      existingFilePath: "",
      existingFileName: "",
    },
     mode: "onChange",
  });

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
      return;
    }

    if (documentId && user && user.role === 'admin') {
      const fetchDocumentData = async () => {
        setIsLoadingData(true);
        try {
          const docRef = doc(db, "documents", documentId);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            toast({ title: "Not Found", description: "Document data could not be found.", variant: "destructive" });
            router.push("/admin/documents");
            return;
          }
          const data = docSnap.data() as DocumentForEdit;
          form.reset({
            title: data.title,
            category: data.category,
            source: data.source,
            version: data.version || "",
            content: data.content || "",
            existingFileUrl: data.downloadURL || "",
            existingFilePath: data.filePath || "",
            existingFileName: data.fileName || "",
          });
          setCurrentDocumentType(data.documentContentType);
        } catch (error) {
          console.error("Error loading document data:", error);
          toast({ title: "Loading Error", description: "Failed to load document data for editing.", variant: "destructive" });
          router.push("/admin/documents");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchDocumentData();
    }
  }, [documentId, user, authLoading, router, toast, form]);

  const handleRemoveExistingFile = () => {
    form.setValue("existingFileUrl", "");
    form.setValue("existingFilePath", "");
    form.setValue("existingFileName", "");
    // if fileInputRef.current { fileInputRef.current.value = ""; } // This won't work for clearing selection, handled by form state
    toast({ title: "File Marked for Removal", description: "The existing file will be removed when you save changes. You can upload a new one if needed." });
  };

  async function onSubmit(data: DocumentFormValues) {
    if (!user || user.role !== 'admin' || !documentId) {
      toast({ title: "Unauthorized or Missing ID", description: "Cannot update document.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(null);

    const updatePayload: Partial<DocumentForEdit> = {
        title: data.title,
        category: data.category,
        source: data.source,
        version: data.version || "",
        content: data.content?.trim() || null,
        lastUpdated: serverTimestamp() as Timestamp,
    };

    const fileToUpload = data.file?.[0];
    let newFileUploaded = false;

    if (fileToUpload) { // A new file is being uploaded
      // Delete old file if it exists and a new one is being uploaded
      if (data.existingFilePath) {
        try {
          const oldFileRef = storageRef(storage, data.existingFilePath);
          await deleteObject(oldFileRef);
        } catch (e) {
          console.warn("Could not delete old file or it didn't exist:", e);
        }
      }

      const uniqueFileName = `${new Date().getTime()}-${fileToUpload.name.replace(/\s+/g, '_')}`;
      const newFileStoragePath = `documents/${uniqueFileName}`;
      const materialStorageRef = storageRef(storage, newFileStoragePath);
      const uploadTask = uploadBytesResumable(materialStorageRef, fileToUpload);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          (error) => {
            console.error("Upload failed:", error);
            toast({ title: "New File Upload Failed", description: error.message, variant: "destructive" });
            setIsSubmitting(false); reject(error);
          },
          async () => {
            try {
              updatePayload.downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const metadata = await getMetadata(uploadTask.snapshot.ref);
              updatePayload.filePath = newFileStoragePath;
              updatePayload.fileName = fileToUpload.name;
              updatePayload.fileType = fileToUpload.type;
              updatePayload.size = (metadata.size / (1024 * 1024)).toFixed(2) + "MB";
              newFileUploaded = true;
              resolve();
            } catch (metaError){
                console.error("Error getting new file metadata:", metaError);
                toast({ title: "New File Metadata Error", description: "Could not get new file metadata after upload.", variant: "destructive" });
                reject(metaError);
            }
          }
        );
      });
       if (!updatePayload.downloadURL) { setIsSubmitting(false); return; } // Upload failed
    } else if (!data.existingFileUrl && data.existingFilePath) {
      // No new file, and existingFileUrl is cleared, meaning user wants to delete existing file
      try {
        const oldFileRef = storageRef(storage, data.existingFilePath);
        await deleteObject(oldFileRef);
        updatePayload.downloadURL = null;
        updatePayload.filePath = null;
        updatePayload.fileName = null;
        updatePayload.fileType = null;
        updatePayload.size = null;
      } catch (e) {
        console.warn("Could not delete existing file:", e);
        toast({ title: "File Deletion Error", description: "Could not remove the existing file. Please try saving again.", variant: "warning" });
        // Continue with other updates if file deletion fails but user wants to proceed
      }
    } else if (data.existingFileUrl) {
        // Keep existing file details if no new file and existingFileUrl is present
        updatePayload.downloadURL = data.existingFileUrl;
        updatePayload.filePath = data.existingFilePath;
        updatePayload.fileName = data.existingFileName;
        // fileType and size would typically remain the same for an existing file
        // You might need to fetch them if they aren't stored in form state.
        // For simplicity, if they are not changing, we don't need to explicitly set them here
        // unless the document structure requires all fields.
    }


    // Determine documentContentType
    const hasContent = !!updatePayload.content?.trim();
    const hasFile = !!updatePayload.downloadURL;

    if (hasFile && hasContent) {
      updatePayload.documentContentType = 'fileWithMarkdown';
    } else if (hasFile) {
      updatePayload.documentContentType = 'file';
    } else if (hasContent) {
      updatePayload.documentContentType = 'markdown';
    } else {
      toast({ title: "Invalid Document", description: "Document must have either content or a file.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setCurrentDocumentType(updatePayload.documentContentType);


    try {
      const docRef = doc(db, "documents", documentId);
      await updateDoc(docRef, updatePayload);

      toast({
        title: "Document Updated Successfully",
        description: `The document "${data.title}" has been updated.`,
        action: <CheckCircle className="text-green-500" />,
      });
      router.push('/admin/documents');
    } catch (error) {
      console.error("Error updating document in Firestore:", error);
      toast({ title: "Update Failed", description: "Could not update the document. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading document data...</p>
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
            <FileEdit className="mr-3 h-7 w-7 text-primary" />
            Edit Document
          </CardTitle>
          <CardDescription>
            Modify the details of the existing document.
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                        <Input placeholder="e.g., v1.0, Issue Date 2024-07-30" {...field} value={field.value || ""} />
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
                        placeholder="Write the content of your document here..."
                        className="min-h-[250px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                     <FormDescription>Max 20,000 characters. Will be rendered as rich text.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
                />
            
            {form.getValues("existingFileUrl") && (
                <FormItem>
                    <FormLabel>Current File</FormLabel>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                        <Link href={form.getValues("existingFileUrl")!} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm truncate">
                            {form.getValues("existingFileName") || "View Current File"}
                        </Link>
                        <Button type="button" variant="destructive" size="sm" onClick={handleRemoveExistingFile}>
                            <Trash2 className="mr-1 h-3 w-3" /> Remove File
                        </Button>
                    </div>
                    <FormDescription>Removing the file will delete it upon saving changes. You can upload a new file below to replace it.</FormDescription>
                </FormItem>
            )}

              <FormField
                control={form.control}
                name="file"
                render={({ field: { onChange, value, ...rest } }) => ( 
                    <FormItem>
                        <FormLabel className="flex items-center"><UploadCloud className="mr-2 h-5 w-5" /> {form.getValues("existingFileUrl") ? "Upload New File to Replace" : "Attach File (Optional)"}</FormLabel>
                        <FormControl>
                            <Input 
                                type="file" 
                                {...rest} 
                                onChange={(e) => onChange(e.target.files)} 
                                ref={fileInputRef}
                                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            />
                        </FormControl>
                        <FormDescription>Max file size: {MAX_FILE_SIZE_MB}MB.</FormDescription>
                        {uploadProgress !== null && <Progress value={uploadProgress} className="w-full mt-2" />}
                        <FormMessage />
                    </FormItem>
                )}
                />
                <FormDescription className="text-destructive-foreground bg-destructive/80 p-2 rounded-md text-xs">
                    Important: Document must have either text content OR a file attachment (or both).
                </FormDescription>

              <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
              {!form.formState.isValid && user && (
                 <p className="text-sm text-destructive">Please fill all required fields and ensure either Content or a File (new or existing) is present.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

