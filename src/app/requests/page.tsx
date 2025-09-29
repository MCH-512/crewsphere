"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SendHorizonal, Loader2, AlertTriangle, Info, Zap, Inbox, ListTodo, MessageSquareText, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore"; // ✅ Import correct de Timestamp
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // ✅ Correction: AlertDescription au lieu de ShadAlertDescription
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import {
  requestFormSchema, 
  type RequestFormValues, 
  allRequestCategories, 
  requestCategoriesAndTypes, 
  urgencyLevels,
  type StoredUserRequest, 
  type RequestStatus, 
  getStatusBadgeVariant, 
  getUrgencyBadgeVariant, 
  getAdminResponseAlertVariant
} from "@/schemas/request-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import { submitUserRequest } from "@/services/request-service";

// --- Form Default Values ---
const defaultValues: Partial<RequestFormValues> = {
  requestCategory: "",
  specificRequestType: "",
  urgencyLevel: "Low",
  subject: "",
  details: "",
};

// --- Tab Components ---

const SubmitRequestTab = ({ refreshHistory }: { refreshHistory: () => void }) => {
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
  const watchedSpecificRequestType = form.watch("specificRequestType");
  const categoryHasSpecificTypes = !!(watchedRequestCategory && requestCategoriesAndTypes[watchedRequestCategory as keyof typeof requestCategoriesAndTypes]);
  const isLeaveCategory = watchedRequestCategory === "Leave & Absences";

  React.useEffect(() => {
    if (categoryHasSpecificTypes) {
      const newSpecificTypes = requestCategoriesAndTypes[watchedRequestCategory as keyof typeof requestCategoriesAndTypes];
      setSpecificTypes(newSpecificTypes);
      if (!newSpecificTypes.includes(form.getValues('specificRequestType') || '')) {
        form.setValue('specificRequestType', '', { shouldValidate: true });
      }
    } else {
      setSpecificTypes([]);
      form.setValue('specificRequestType', '', { shouldValidate: true });
    }
  }, [watchedRequestCategory, form, categoryHasSpecificTypes]);

  // Autofill subject when a specific request type is selected
  React.useEffect(() => {
    if (watchedSpecificRequestType && categoryHasSpecificTypes) {
      form.setValue('subject', watchedSpecificRequestType, { shouldValidate: true });
    }
  }, [watchedSpecificRequestType, form, categoryHasSpecificTypes]);

  async function handleFormSubmit(data: RequestFormValues) {
    setFormDataToSubmit(data);
    setShowConfirmDialog(true);
  }

  async function confirmSubmit() {
    if (!user || !formDataToSubmit) {
      toast({ title: "Error", description: "User not logged in or no data to submit.", variant: "destructive" });
      setShowConfirmDialog(false);
      return;
    }

    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
      await submitUserRequest(formDataToSubmit);

      toast({
        title: "Request Submitted Successfully",
        description: `Your ${formDataToSubmit.requestCategory.toLowerCase()} request for "${formDataToSubmit.subject || formDataToSubmit.specificRequestType}" has been saved.`,
      });
      form.reset(defaultValues);
      setSpecificTypes([]);
      setFormDataToSubmit(null);
      refreshHistory(); // Refresh the history tab
    } catch (error) {
      const e = error as Error;
      console.error("Error submitting request:", e);
      toast({ title: "Submission Failed", description: e.message || "Could not save your request.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>How It Works</AlertTitle>
        <AlertDescription>
          After submitting, your request will be routed to the appropriate department. You can track its status in the "My Submission History" tab.
        </AlertDescription>
      </Alert>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
          <FormField control={form.control} name="requestCategory" render={({ field }) => (
            <FormItem>
              <FormLabel>Request Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!user || isSubmitting}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select a request category" /></SelectTrigger></FormControl>
                <SelectContent>{allRequestCategories.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
              </Select>
              <FormDescription>Choose the category that best fits your request.</FormDescription>
              <FormMessage />
            </FormItem>
          )}/>

          {categoryHasSpecificTypes ? (
            <FormField control={form.control} name="specificRequestType" render={({ field }) => (
              <FormItem>
                <FormLabel>Specific Request Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={!user || isSubmitting || specificTypes.length === 0}>
                  <FormControl><SelectTrigger><SelectValue placeholder={specificTypes.length === 0 ? "N/A for selected category" : "Select specific type"} /></SelectTrigger></FormControl>
                  <SelectContent>{specificTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>This will automatically become the subject of your request.</FormDescription>
                <FormMessage />
              </FormItem>
            )}/>
          ) : (
            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <FormControl><Input placeholder="e.g., Question about my last payslip" {...field} value={field.value ?? ''} disabled={!user || isSubmitting || !watchedRequestCategory}/></FormControl>
                <FormDescription>A concise summary of your request.</FormDescription>
                <FormMessage />
              </FormItem>
            )}/>
          )}

          {isLeaveCategory && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            </div>
          )}

          <FormField control={form.control} name="urgencyLevel" render={({ field }) => (
            <FormItem>
              <FormLabel>Urgency Level</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!user || isSubmitting}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select urgency level" /></SelectTrigger></FormControl>
                <SelectContent>{urgencyLevels.map(({level, description}) => (<SelectItem key={level} value={level}>{level} - <span className="text-muted-foreground text-xs italic ml-2">{description}</span></SelectItem>))}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="details" render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Details</FormLabel>
              <FormControl><Textarea placeholder="Please provide all necessary information..." className="min-h-[150px]" {...field} disabled={!user || isSubmitting}/></FormControl>
              <FormDescription>Include dates, times, or any other relevant information.</FormDescription>
              <FormMessage />
            </FormItem>
          )}/>

          <Button type="submit" disabled={isSubmitting || !user || !form.formState.isValid} className="w-full sm:w-auto">
            {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>) : (<><SendHorizonal className="mr-2 h-4 w-4" />Submit Request</>)}
          </Button>
          {!form.formState.isValid && user && watchedRequestCategory && (<p className="text-sm text-destructive">Please fill all required fields correctly.</p>)}
        </form>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Request Submission</AlertDialogTitle>
            <AlertDialogDescription>Please review your request details before submitting.</AlertDialogDescription>
          </AlertDialogHeader>

          {formDataToSubmit?.urgencyLevel === 'Critical' && (
            <Alert variant="destructive" className="my-4">
              <Zap className="h-4 w-4" /><AlertTitle>Confirm Critical Urgency</AlertTitle>
              <AlertDescription>You have marked this as a critical request. This should only be used for emergencies impacting immediate flight operations.</AlertDescription>
            </Alert>
          )}

          {formDataToSubmit && (
            <div className="mt-2 text-sm text-left space-y-1 border p-3 rounded-md bg-muted/50">
              <div><strong>Category:</strong> {formDataToSubmit.requestCategory}</div>
              {formDataToSubmit.specificRequestType ? 
                <div><strong>Request:</strong> {formDataToSubmit.specificRequestType}</div>
                : <div><strong>Subject:</strong> {formDataToSubmit.subject}</div>
              }
              {isLeaveCategory && formDataToSubmit.startDate && (
                <div><strong>Dates:</strong> {format(new Date(formDataToSubmit.startDate), 'PPP')} to {format(new Date(formDataToSubmit.endDate!), 'PPP')}</div>
              )}
              <div><strong>Urgency:</strong> {formDataToSubmit.urgencyLevel}</div>
            </div>
          )}

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
};

// Interface for props with serialized dates
interface RequestHistoryTabProps {
  myRequests: StoredUserRequest[];
  isLoading: boolean;
  error: string | null;
  fetchMyRequests: () => void;
}

const RequestHistoryTab = ({ myRequests, isLoading, error, fetchMyRequests }: RequestHistoryTabProps) => {
  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading your request history...</p></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchMyRequests} disabled={isLoading} className="mt-4">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Try Again
        </Button>
      </div>
    );
  }

  if (myRequests.length === 0) {
    return (
      <AnimatedCard>
        <Card className="text-center p-6 shadow-md mt-6">
          <ListTodo className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-semibold text-lg text-muted-foreground">No requests submitted yet.</p>
          <p className="text-sm text-muted-foreground">Use the "Submit New Request" tab to create your first request.</p>
        </Card>
      </AnimatedCard>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {myRequests.map((request, index) => (
        <AnimatedCard key={request.id} delay={0.1 + index * 0.05}>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <CardTitle className="text-lg font-semibold">{request.subject}</CardTitle>
                <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize text-xs h-fit mt-1 sm:mt-0">{request.status.replace('-', ' ')}</Badge>
              </div>
              <div className="text-xs text-muted-foreground space-x-2 flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span>Category: <Badge variant="outline" className="px-1.5 py-0.5 text-xs">{request.requestType}</Badge></span>
                {request.specificRequestType && <span>| Type: <Badge variant="outline" className="px-1.5 py-0.5 text-xs">{request.specificRequestType}</Badge></span>}
                <span>
                  | Urgency:
                  <Badge variant={getUrgencyBadgeVariant(request.urgencyLevel)} className="capitalize px-1.5 py-0.5 text-xs ml-1 flex items-center gap-1">
                    {request.urgencyLevel === "Critical" && <Zap className="h-3 w-3" />}{request.urgencyLevel || "N/A"}
                  </Badge>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">
                Submitted: {request.createdAt ? format(request.createdAt.toDate(), "PPp") : 'N/A'}
                {request.updatedAt && request.updatedAt.toMillis() !== request.createdAt.toMillis() && (<span className="ml-2 italic">(Last updated: {format(request.updatedAt.toDate(), "PPpp")})</span>)}
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="details">
                  <AccordionTrigger className="text-sm py-2">View Submitted Details</AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <p className="text-sm whitespace-pre-wrap bg-secondary/30 p-3 rounded-md">{request.details}</p>
                  </AccordionContent>
                </AccordionItem>
                {request.adminResponse && (
                  <AccordionItem value="response">
                    <AccordionTrigger className="text-sm py-2 font-medium text-primary">
                      <span className="flex items-center gap-1"><MessageSquareText className="h-4 w-4" />Admin Response</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <Alert variant={getAdminResponseAlertVariant(request.status)}>
                        {request.status === "approved" && <CheckCircle className="h-4 w-4" />}
                        {request.status === "rejected" && <AlertTriangle className="h-4 w-4" />}
                        <AlertTitle className="font-semibold">Response from Admin:</AlertTitle>
                        <AlertDescription className="whitespace-pre-wrap text-foreground/90">{request.adminResponse}</AlertDescription>
                      </Alert>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>
        </AnimatedCard>
      ))}
    </div>
  );
};

// --- Main Page Component ---

export default function RequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myRequests, setMyRequests] = React.useState<StoredUserRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMyRequests = React.useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setError("You must be logged in to view your requests.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "requests"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoredUserRequest));
      setMyRequests(fetchedRequests);
    } catch (err) {
      const e = err as Error;
      console.error("Error fetching user requests:", e);
      setError("Failed to load your requests. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch your requests.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading && user) {
      fetchMyRequests();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading, fetchMyRequests]);

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Inbox className="mr-2 h-6 w-6 text-primary" />
              My Requests
            </CardTitle>
            <CardDescription>
              Submit new requests and track the status of your previous submissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!user && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Authentication Required</AlertTitle>
                <AlertDescription>
                  You must be logged in to submit or view requests.
                </AlertDescription>
              </Alert>
            )}

            {user && (
              <Tabs defaultValue="submit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="submit">Submit New Request</TabsTrigger>
                  <TabsTrigger value="history">My Submission History</TabsTrigger>
                </TabsList>
                <TabsContent value="submit">
                  <SubmitRequestTab refreshHistory={fetchMyRequests} />
                </TabsContent>
                <TabsContent value="history">
                  <RequestHistoryTab myRequests={myRequests} isLoading={isLoading} error={error} fetchMyRequests={fetchMyRequests} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  );
}