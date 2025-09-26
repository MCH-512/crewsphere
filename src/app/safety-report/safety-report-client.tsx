
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { 
  safetyReportFormSchema, 
  type SafetyReportFormValues, 
  safetyReportEventTypes,
  safetyReportFlightPhases, 
  safetyReportSeverityLevels 
} from "@/schemas/safety-report-schema";
import { submitSafetyReport } from "@/services/safety-report-service";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export function SafetyReportClient() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const form = useForm<SafetyReportFormValues>({
    resolver: zodResolver(safetyReportFormSchema),
    defaultValues: {
      eventDate: new Date().toISOString().slice(0, 16),
      flightNumber: "",
      aircraftRegistration: "",
      description: "",
      isAnonymous: false,
    },
    mode: "onChange",
  });

  async function onSubmit(values: SafetyReportFormValues) {
    setShowConfirmDialog(true);
  }

  async function handleConfirmSubmit() {
    if (!user) {
        toast({ title: "Not Authenticated", description: "You must be logged in to submit a report.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    setShowConfirmDialog(false);
    
    try {
        await submitSafetyReport(form.getValues());
        toast({
            title: "Safety Report Submitted",
            description: "Thank you for your contribution to safety. Your report has been securely submitted.",
            variant: "success",
            duration: 7000
        });
        router.push("/");
    } catch (error) {
        const e = error as Error;
        toast({ title: "Submission Failed", description: e.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="text-center p-4"><CardTitle>Access Denied</CardTitle></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-headline flex items-center"><ShieldAlert className="mr-3 h-7 w-7 text-primary" />Submit a Safety Report</CardTitle>
              <CardDescription>Report any event, hazard, or concern that has, or could have, implications for aviation safety. All submissions are treated with confidentiality.</CardDescription>
            </CardHeader>
        </Card>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle className="text-lg">Event Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="eventDate" render={({ field }) => (<FormItem><FormLabel>Event Date & Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., TU721" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="aircraftRegistration" render={({ field }) => (<FormItem><FormLabel>Aircraft Registration (Optional)</FormLabel><FormControl><Input placeholder="e.g., TS-IMN" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            
                            <FormField control={form.control} name="eventType" render={({ field }) => (<FormItem><FormLabel>Event Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an event type"/></SelectTrigger></FormControl><SelectContent>{safetyReportEventTypes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="flightPhase" render={({ field }) => (<FormItem><FormLabel>Phase of Flight / Location</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a phase or location"/></SelectTrigger></FormControl><SelectContent>{safetyReportFlightPhases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="severity" render={({ field }) => (<FormItem><FormLabel>Severity</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Assess the event's severity"/></SelectTrigger></FormControl><SelectContent>{safetyReportSeverityLevels.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>

                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Factual Description of the Event</FormLabel><FormControl><Textarea placeholder="Describe what happened with factual, objective details. Avoid assumptions or blame." className="min-h-[150px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-lg">Confidentiality</CardTitle></CardHeader>
                    <CardContent>
                        <FormField control={form.control} name="isAnonymous" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none"><FormLabel>Submit this report anonymously</FormLabel>
                              <FormMessage />
                              <p className="text-xs text-muted-foreground">If checked, your name and email will not be included in the report. This ensures your identity is protected.</p>
                            </div>
                          </FormItem>
                        )} />
                    </CardContent>
                </Card>
                
                <div className="flex justify-end mt-8">
                   <Button type="submit" disabled={isSubmitting || !form.formState.isValid} size="lg"><Send className="mr-2 h-4 w-4" />Submit Report</Button>
                </div>
            </form>
        </Form>
      
       <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Safety Report Submission</AlertDialogTitle>
                <AlertDialogDescription>Submitting this report sends it directly to the safety department for investigation. Thank you for your commitment to safety.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowConfirmDialog(false)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm & Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
