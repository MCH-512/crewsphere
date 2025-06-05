
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

const courseCategories = [
  "Safety & Emergency",
  "Regulatory & Compliance",
  "Customer Service Excellence",
  "Technical Operations",
  "General Aviation Knowledge",
  "Health & Wellbeing",
  "Security Procedures",
];

const courseFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(150),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  category: z.string({ required_error: "Please select a course category." }),
  imageHint: z.string().max(50).optional().describe("Keywords for placeholder image (e.g., emergency exit, customer service)"),
  quizId: z.string().min(3, "Quiz ID must be at least 3 characters.").max(50),
  quizTitle: z.string().min(5, "Quiz Title must be at least 5 characters.").max(100),
  mandatory: z.boolean().default(false),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

const defaultValues: Partial<CourseFormValues> = {
  title: "",
  description: "",
  category: "",
  imageHint: "",
  quizId: "",
  quizTitle: "",
  mandatory: false,
};

export default function CreateCoursePage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues,
  });

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
    try {
      await addDoc(collection(db, "courses"), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      toast({
        title: "Course Created Successfully",
        description: `The course "${data.title}" has been added.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset();
      router.push('/admin/courses'); // Redirect to the courses list page
    } catch (error) {
      console.error("Error creating course in Firestore:", error);
      toast({ title: "Creation Failed", description: "Could not create the course. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

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
            <BookOpenCheck className="mr-3 h-7 w-7 text-primary" />
            Create New Training Course
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new course to the training catalog.
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
                    <FormLabel>Course Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Advanced First Aid Onboard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed overview of the course content, objectives, and target audience..."
                        className="min-h-[120px]"
                        {...field}
                      />
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
                  )}
                />
                 <FormField
                  control={form.control}
                  name="imageHint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image Hint (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., emergency exit, first aid" {...field} />
                      </FormControl>
                      <FormDescription>Keywords for dashboard placeholder image.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="quizId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Associated Quiz ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., QUIZ001, SEP_RECURRENT_Q1" {...field} />
                      </FormControl>
                      <FormDescription>Unique identifier for the quiz linked to this course.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quizTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Associated Quiz Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., SEP Recurrent Assessment" {...field} />
                      </FormControl>
                      <FormDescription>Display title for the quiz.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="mandatory"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Mandatory Course</FormLabel>
                      <FormDescription>
                        Is this course required for all relevant personnel?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Course...
                  </>
                ) : (
                  <>
                    <BookOpenCheck className="mr-2 h-4 w-4" />
                    Create Course
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
