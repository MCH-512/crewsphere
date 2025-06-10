
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, getMetadata } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";

const categories = ["Operations", "Safety", "HR", "Training", "Service", "Regulatory", "General", "Manuals", "Bulletins", "Forms"];
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
  "Other",
];

const documentUploadFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(100),
  category: z.string({ required_error: "Please select a category." }),
  source: z.string({ required_error: "Please select the document source." }),
  version: z.string().max(20).optional(),
  file: z.custom<FileList>((val) => val instanceof FileList && val.length > 0, "Please select a file to upload.")
    .refine((files) => files?.[0]?.size <= 10 * 1024 * 1024, `File size should be less than 10MB.`) // Max 10MB
});

type DocumentUploadFormValues = z.infer<typeof documentUploadFormSchema>;

export default function DocumentUploadPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<DocumentUploadFormValues>({
    resolver: zodResolver(documentUploadFormSchema),
    defaultValues: {
      title: "",
      category: "",
      source: "",
      version: "",
    },
  });

  async function onSubmit(data: DocumentUploadFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to upload documents.", variant: "destructive" });
      return;
    }
    if (!data.file || data.file.length === 0) {
        toast({ title: "No File", description: "Please select a file to upload.", variant: "destructive" });
        return;
    }

    const fileToUpload = data.file[0];
    setIsUploading(true);
    setUploadProgress(0);

    const uniqueFileName = `${new Date().getTime()}-${fileToUpload.name.replace(/\s+/g, '_')}`;
    const fileStoragePath = `documents/${uniqueFileName}`;
    const materialStorageRef = storageRef(storage, fileStoragePath);

    const uploadTask = uploadBytesResumable(materialStorageRef, fileToUpload);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload failed:", error);
        toast({ title: "Upload Failed", description: `Could not upload file: ${error.message}`, variant: "destructive" });
        setIsUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const metadata = await getMetadata(uploadTask.snapshot.ref);
          const fileSize = metadata.size;

          await addDoc(collection(db, "documents"), {
            title: data.title,
            category: data.category,
            source: data.source,
            version: data.version || "",
            downloadURL: downloadURL,
            fileName: uniqueFileName,
            fileType: fileToUpload.type,
            size: (fileSize / (1024 * 1024)).toFixed(2) + "MB", // Store size in MB
            documentContentType: 'file', // Mark as file type
            lastUpdated: serverTimestamp(),
            uploadedBy: user.uid,
            uploaderEmail: user.email,
          });

          toast({
            title: "Document Uploaded Successfully",
            description: `${data.title} has been uploaded and saved.`,
            action: <CheckCircle className="text-green-500" />,
          });
          form.reset();
          if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset file input
          }
          router.push("/admin/documents"); 
        } catch (error) {
          console.error("Error saving document metadata to Firestore:", error);
          toast({ title: "Saving Failed", description: "File uploaded, but could not save document details. Please check Firestore.", variant: "destructive" });
        } finally {
          setIsUploading(false);
        }
      }
    );
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
            <UploadCloud className="mr-3 h-7 w-7 text-primary" />
            Upload New Document File
          </CardTitle>
          <CardDescription>
            Fill in the details and select a file to upload it to the document library.
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
                    <FormLabel>Document Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Safety Procedures Manual" {...field} />
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
                      <FormLabel>Category</FormLabel>
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
                      <FormLabel>Provenance</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select the document source" />
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
                        <Input placeholder="e.g., v2.1, Rev A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              
              <FormField
                control={form.control}
                name="file"
                render={({ field: { onChange, value, ...rest } }) => ( 
                    <FormItem>
                        <FormLabel>Document File</FormLabel>
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
                        <FormDescription>Max file size: 10MB. Allowed types depend on system configuration (e.g., PDF, DOCX, XLSX).</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
                />

              {isUploading && (
                <div className="space-y-2">
                  <Label>Upload Progress</Label>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">{Math.round(uploadProgress)}%</p>
                </div>
              )}

              <Button type="submit" disabled={isUploading || !user || user.role !== 'admin'} className="w-full sm:w-auto">
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading File...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload File
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

