
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const requestCategoriesAndTypes = {
  "Roster & Availability": [
    "Roster change request",
    "Temporary unavailability (exam, pregnancy, etc.)",
    "Flight swap between colleagues",
    "Request for exceptional day off",
    "Roster error reporting",
    "Positioning flight or deadhead request"
  ],
  "Leave & Absences": [
    "Annual leave request",
    "Sick leave request",
    "Maternity/Paternity leave",
    "Unplanned absence – urgent notice",
    "Special leave request (bereavement, wedding, etc.)",
    "Rest days tracking"
  ],
  "Human Resources": [
    "Update of personal data",
    "HR complaint or conflict",
    "Follow-up on individual interview",
    "Request for administrative letter (certificate, etc.)",
    "Bank details change",
    "Unfair treatment complaint"
  ],
  "Training & Qualifications": [
    "Enrollment in a training session",
    "Issue with license validity",
    "Training postponement or cancellation",
    "Access issue with e-learning platform",
    "Equivalency or exemption request",
    "Training/exam result complaint"
  ],
  "Uniform & Equipment": [
    "Uniform order or replacement",
    "Size issue or uniform defect report",
    "Lost or stolen equipment",
    "Replenishment of allocated items",
    "Problem with service shoes",
    "Uniform delivery delay"
  ],
  "Payroll & Compensation": [
    "Salary calculation request",
    "Missing or incorrect flight allowance",
    "Payslip clarification request",
    "Unreceived daily allowances",
    "Travel expense reimbursement issue",
    "Request for adjustment (flown hours, standby, etc.)"
  ],
  "Mobility & Special Assignments": [
    "Application for special assignment (event, VIP flight...)",
    "Voluntary transfer to another base",
    "Temporary mission request",
    "Interest in Cabin Crew Ambassador Program",
    "Temporary transfer request",
    "Post-assignment feedback"
  ],
  "App Access & Technical Issues": [
    "Crew app login issue",
    "Roster display bug",
    "Access denied to some features",
    "Schedule synchronization error",
    "E-learning portal issue",
    "Password reset / 2FA problem"
  ],
  "Meetings & Support": [
    "Request meeting with manager",
    "Need for emotional or psychological support",
    "Request for mediation or support session",
    "Follow-up after difficult flight",
    "Request for coaching or mentoring",
    "Feedback group participation"
  ]
};

const requestCategoryKeys = Object.keys(requestCategoriesAndTypes) as (keyof typeof requestCategoriesAndTypes)[];
const allRequestCategories = [...requestCategoryKeys, "General Inquiry", "Other"];

const requestFormSchema = z.object({
  requestCategory: z.string({
    required_error: "Please select a request category.",
  }),
  specificRequestType: z.string().optional(),
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
}).superRefine((data, ctx) => {
  if (requestCategoriesAndTypes[data.requestCategory as keyof typeof requestCategoriesAndTypes] && (!data.specificRequestType || data.specificRequestType.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select a specific request type for this category.",
      path: ["specificRequestType"],
    });
  }
});

type RequestFormValues = z.infer<typeof requestFormSchema>;

const defaultValues: Partial<RequestFormValues> = {
  requestCategory: "",
  specificRequestType: "",
  urgencyLevel: "Low",
  subject: "",
  details: "",
};

const urgencyLevels: RequestFormValues["urgencyLevel"][] = ["Low", "Medium", "High", "Critical"];

export default function RequestsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [specificTypes, setSpecificTypes] = React.useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [formDataToSubmit, setFormDataToSubmit] = React.useState<RequestFormValues | null>(null);


  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const watchedRequestCategory = form.watch("requestCategory");

  React.useEffect(() => {
    if (watchedRequestCategory && requestCategoriesAndTypes[watchedRequestCategory as keyof typeof requestCategoriesAndTypes]) {
      setSpecificTypes(requestCategoriesAndTypes[watchedRequestCategory as keyof typeof requestCategoriesAndTypes]);
    } else {
      setSpecificTypes([]);
    }
    form.setValue('specificRequestType', '', { shouldValidate: true });
  }, [watchedRequestCategory, form]);

  async function handleFormSubmit(data: RequestFormValues) {
    setFormDataToSubmit(data);
    setShowConfirmDialog(true);
  }

  async function confirmSubmit() {
    if (!user || !formDataToSubmit) {
      toast({
        title: "Error",
        description: "User not logged in or no data to submit.",
        variant: "destructive",
      });
      setShowConfirmDialog(false);
      return;
    }

    setIsSubmitting(true);
    setShowConfirmDialog(false);
    try {
      const requestData = {
        userId: user.uid,
        userEmail: user.email,
        requestType: formDataToSubmit.requestCategory, 
        specificRequestType: formDataToSubmit.specificRequestType || null,
        urgencyLevel: formDataToSubmit.urgencyLevel,
        subject: formDataToSubmit.subject,
        details: formDataToSubmit.details,
        createdAt: serverTimestamp(),
        status: "pending",
      };
      await addDoc(collection(db, "requests"), requestData);

      toast({
        title: "Request Submitted Successfully",
        description: `Your ${formDataToSubmit.requestCategory.toLowerCase()} request for "${formDataToSubmit.subject}" has been saved.`,
      });
      form.reset();
      setSpecificTypes([]); 
      setFormDataToSubmit(null);
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
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="requestCategory"
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
                          {allRequestCategories.map((type) => (
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
                  name="specificRequestType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specific Request Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""} 
                        disabled={!user || isSubmitting || specificTypes.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={specificTypes.length === 0 ? "N/A for selected category" : "Select specific type"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {specificTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Specify the type if applicable for the chosen category.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
              
              <Button type="submit" disabled={isSubmitting || !user || !form.formState.isValid} className="w-full sm:w-auto">
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
               {!form.formState.isValid && user && (
                 <p className="text-sm text-destructive">Please fill all required fields correctly before submitting.</p>
               )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Request Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this request?
            </AlertDialogDescription>
            {/* The details block is now a SIBLING to AlertDialogDescription, within AlertDialogHeader */}
            {formDataToSubmit && (
              <div className="mt-4 text-sm text-left space-y-1 border p-3 rounded-md bg-muted/50">
                <div><strong>Category:</strong> {formDataToSubmit.requestCategory}</div>
                {formDataToSubmit.specificRequestType && <div><strong>Type:</strong> {formDataToSubmit.specificRequestType}</div>}
                <div><strong>Urgency:</strong> {formDataToSubmit.urgencyLevel}</div>
                <div><strong>Subject:</strong> {formDataToSubmit.subject}</div>
                {formDataToSubmit.details && <div><strong>Details (start):</strong> {formDataToSubmit.details.substring(0, 100)}{formDataToSubmit.details.length > 100 ? "..." : ""}</div>}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFormDataToSubmit(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
