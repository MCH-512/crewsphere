
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
import { SendHorizonal, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Alert, AlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";

const requestFormSchema = z.object({
  requestType: z.string({
    required_error: "Please select a request type.",
  }),
  urgencyLevel: z.enum(["Low", "Medium", "High", "Critical"], {
    required_error: "Please select an urgency level.",
  }),
  subject: z.string().min(5, {
    message: "Subject must be at least 5 characters.",
  }).max(100, {
    message: "Subject must not be longer than 100 characters.",
  }),
  details: z.string().min(10, {
    message: "Details must be at least 10 characters.",
  }).max(1000, {
    message: "Details must not be longer than 1000 characters.",
  }),
});

type RequestFormValues = z.infer<typeof requestFormSchema>;

const defaultValues: Partial<RequestFormValues> = {
  requestType: "",
  urgencyLevel: "Low",
  subject: "",
  details: "",
};

const requestTypes = [
  "Roster & Availability",
  "Leave & Absences",
  "Human Resources",
  "Training & Qualifications",
  "Uniform & Equipment",
  "Payroll & Compensation",
  "Mobility & Special Assignments",
  "App Access & Technical Issues",
  "Meetings & Support",
  "General Inquiry",
  "Other",
];

const urgencyLevels: RequestFormValues["urgencyLevel"][] = ["Low", "Medium", "High", "Critical"];

export default function RequestsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues,
    mode: "onChange",
  });

  async function onSubmit(data: RequestFormValues) {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to submit a request.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const requestData = {
        ...data,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        status: "pending",
      };
      await addDoc(collection(db, "requests"), requestData);

      toast({
        title: "Request Submitted Successfully",
        description: `Your ${data.requestType.toLowerCase()} request for "${data.subject}" has been saved.`,
      });
      form.reset();
    } catch (error) {
      console.error("Error submitting request to Firestore:", error);
      toast({
        title: "Submission Failed",
        description: "Could not save your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <SendHorizonal className="mr-2 h-6 w-6 text-primary" />
            Submit a New Request
          </CardTitle>
          <CardDescription>
            Please fill out the form below to submit your request. Provide as much detail as possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Authentication Required</AlertTitle>
              <ShadAlertDescription>
                You must be logged in to submit a request. Please log in to continue.
              </ShadAlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="requestType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!user || isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a request category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {requestTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the category that best fits your request.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="urgencyLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgency Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!user || isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select urgency level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {urgencyLevels.map((level) => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How urgent is this request?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Annual leave for July" {...field} disabled={!user || isSubmitting}/>
                    </FormControl>
                    <FormDescription>
                      A concise summary of your request.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide all necessary information related to your request..."
                        className="min-h-[150px]"
                        {...field}
                        disabled={!user || isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Describe your request in detail. Include dates, times, locations, or any other relevant information.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting || !user} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <SendHorizonal className="mr-2 h-4 w-4" />
                    Submit Request
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
