
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
import { SendHorizonal, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const requestFormSchema = z.object({
  requestType: z.string({
    required_error: "Please select a request type.",
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
  subject: "",
  details: "",
};

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
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "requests"), {
        ...data,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        status: "pending", 
      });

      toast({
        title: "Request Submitted Successfully",
        description: `Your ${data.requestType.toLowerCase()} for "${data.subject}" has been saved.`,
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="requestType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a request type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Leave Request">Leave Request</SelectItem>
                        <SelectItem value="Schedule Change">Schedule Change</SelectItem>
                        <SelectItem value="Maintenance Report">Maintenance Report</SelectItem>
                        <SelectItem value="IT Support">IT Support</SelectItem>
                        <SelectItem value="General Inquiry">General Inquiry</SelectItem>
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
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Annual leave for July" {...field} />
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
               {!user && (
                <p className="text-sm text-destructive">Please log in to submit a request.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

