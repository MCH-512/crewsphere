
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StickyNote, Loader2, AlertTriangle, CheckCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

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

const noteFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(150),
  category: z.string({ required_error: "Please select a category." }),
  source: z.string({ required_error: "Please select the document source/type." }),
  version: z.string().max(20).optional(),
  content: z.string().min(10, "Content must be at least 10 characters.").max(10000, "Content is too long."), // Max 10,000 chars
});

type NoteFormValues = z.infer<typeof noteFormSchema>;

export default function CreateNotePage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: "",
      category: "",
      source: "",
      version: "",
      content: "",
    },
  });

  async function onSubmit(data: NoteFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to create notes.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "documents"), {
        title: data.title,
        category: data.category,
        source: data.source,
        version: data.version || "",
        content: data.content,
        documentContentType: 'text', // Mark as text type
        // No downloadURL, fileName, fileType, size for text documents
        lastUpdated: serverTimestamp(),
        uploadedBy: user.uid,
        uploaderEmail: user.email,
      });

      toast({
        title: "Note Created Successfully",
        description: `The note "${data.title}" has been saved.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset();
      router.push("/admin/documents");
    } catch (error) {
      console.error("Error creating note in Firestore:", error);
      toast({ title: "Creation Failed", description: "Could not create the note. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
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
            <StickyNote className="mr-3 h-7 w-7 text-primary" />
            Create New Note / Procedure
          </CardTitle>
          <CardDescription>
            Fill in the details and write the content for the new textual document.
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
                    <FormLabel>Title</FormLabel>
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
                      <FormLabel>Provenance / Type</FormLabel>
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
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write the content of your note or procedure here. Markdown is not currently supported for direct text input, please use plain text."
                        className="min-h-[300px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Enter the full text. Max 10,000 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
                />

              <Button type="submit" disabled={isSubmitting || !user || user.role !== 'admin'} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Note...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Note / Procedure
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
