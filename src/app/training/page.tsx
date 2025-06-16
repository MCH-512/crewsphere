
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
import { Loader2, Sparkles, Wand2, AlertTriangle, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { generateCourseOutline, type CourseGenerationInput, type CourseGenerationOutput } from "@/ai/flows/course-generator-flow";
import ReactMarkdown from "react-markdown";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";

const courseGeneratorFormSchema = z.object({
  courseTopic: z.string().min(5, "Course topic must be at least 5 characters.").max(150, "Topic too long"),
  targetAudience: z.enum(["Cabin Crew", "Pilot", "Ground Staff", "All Crew", "Other"]).default("All Crew"),
  numberOfChapters: z.coerce.number().int().min(1).max(10).default(5),
  detailLevel: z.enum(["overview", "standard", "detailed"]).default("standard"),
});

type CourseGeneratorFormValues = z.infer<typeof courseGeneratorFormSchema>;

export default function AICourseGeneratorPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedCourse, setGeneratedCourse] = React.useState<CourseGenerationOutput | null>(null);
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const form = useForm<CourseGeneratorFormValues>({
    resolver: zodResolver(courseGeneratorFormSchema),
    defaultValues: {
      courseTopic: "",
      targetAudience: "All Crew",
      numberOfChapters: 5,
      detailLevel: "standard",
    },
  });

  async function onSubmit(data: CourseGeneratorFormValues) {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to use the course generator.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setGeneratedCourse(null);
    setGenerationError(null);
    setCopied(false);
    try {
      const result = await generateCourseOutline(data);
      setGeneratedCourse(result);
      toast({ title: "Course Outline Generated!", description: "Review the AI-suggested course structure below." });
    } catch (error) {
      console.error("Error generating course outline:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setGenerationError(errorMessage);
      toast({ title: "Generation Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }
  
  const handleCopyToClipboard = () => {
    if (generatedCourse) {
      // Basic text representation for copy
      let textToCopy = `Course Title: ${generatedCourse.courseTitle}\n`;
      textToCopy += `Suggested Category: ${generatedCourse.suggestedCategory}\n`;
      textToCopy += `Description: ${generatedCourse.description}\n\n`;
      textToCopy += `Chapters:\n`;
      generatedCourse.chapters.forEach((chapter, index) => {
        textToCopy += `\nChapter ${index + 1}: ${chapter.title}\n`;
        textToCopy += `Content:\n${chapter.content}\n`;
      });

      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopied(true);
          toast({ title: "Copied to Clipboard", description: "Course outline copied as text." });
          setTimeout(() => setCopied(false), 3000);
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          toast({ title: "Copy Failed", description: "Could not copy to clipboard.", variant: "destructive" });
        });
    }
  };


  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Wand2 className="mr-3 h-7 w-7 text-primary" />
            AI Course Outline Generator
          </CardTitle>
          <CardDescription>
            Describe your desired course topic, and let AI draft an initial outline including chapters and content suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {!user ? (
             <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Login Required</AlertTitle>
                <ShadAlertDescription>You need to be logged in to use the AI Course Generator.</ShadAlertDescription>
             </Alert>
           ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="courseTopic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Topic</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Advanced CRM Techniques, Emergency Evacuation Procedures" {...field} />
                    </FormControl>
                    <FormDescription>What is the main subject of the course you want to create?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Cabin Crew">Cabin Crew</SelectItem>
                          <SelectItem value="Pilot">Pilot</SelectItem>
                          <SelectItem value="Ground Staff">Ground Staff</SelectItem>
                          <SelectItem value="All Crew">All Crew</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numberOfChapters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Chapters</FormLabel>
                      <FormControl><Input type="number" min="1" max="10" {...field} /></FormControl>
                      <FormDescription>(1-10)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="detailLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detail Level</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select detail level" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="overview">Overview</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isGenerating || !user} className="w-full sm:w-auto">
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Outline...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate Course Outline</>
                )}
              </Button>
            </form>
          </Form>
           )}
        </CardContent>
      </Card>

      {generationError && !isGenerating && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Generation Error</AlertTitle>
          <ShadAlertDescription>{generationError}</ShadAlertDescription>
        </Alert>
      )}

      {generatedCourse && !isGenerating && (
        <Card className="shadow-md">
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
                <CardTitle className="text-xl font-headline flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-primary"/>
                AI-Generated Course Outline
                </CardTitle>
                <CardDescription>Review the suggested structure. You can copy this to use as a basis for a new course.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyToClipboard} disabled={copied}>
              {copied ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied!" : "Copy Outline"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-md bg-background">
                <h3 className="text-lg font-semibold">{generatedCourse.courseTitle}</h3>
                <p className="text-sm text-muted-foreground"><strong>Suggested Category:</strong> {generatedCourse.suggestedCategory}</p>
                <p className="text-sm mt-1">{generatedCourse.description}</p>
            </div>
            
            <h4 className="text-md font-semibold pt-2">Suggested Chapters:</h4>
            {generatedCourse.chapters.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-2">
                {generatedCourse.chapters.map((chapter, index) => (
                  <AccordionItem value={`chapter-${index}`} key={chapter.id || index} className="border bg-card rounded-md">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                        Chapter {index + 1}: {chapter.title}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3 pt-1">
                      <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                        <ReactMarkdown>{chapter.content}</ReactMarkdown>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="text-sm text-muted-foreground">No chapters were generated for this topic.</p>
            )}
            <CardFooter className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                    This outline is a starting point. You can refine and expand upon it in the course creation tool.
                    For now, copy the outline and paste it into the relevant fields when creating a new course.
                </p>
            </CardFooter>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
