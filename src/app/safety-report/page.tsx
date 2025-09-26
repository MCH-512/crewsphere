
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Send, Loader2, Info } from "lucide-react";
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
import { AnimatedCard } from "@/components/motion/animated-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle } from "@/components/ui/alert";


export default function SafetyReportPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<SafetyReportFormValues>({
    resolver: zodResolver(safetyReportFormSchema),
    defaultValues: {
      eventDate: new Date().toISOString().substring(0, 16),
      flightNumber: "",
      aircraftRegistration: "",
      eventType: undefined,
      flightPhase: undefined,
      severity: undefined,
      description: "",
      isAnonymous: false,
    },
    mode: "onChange",
  });
  
  React.useEffect(() => {
    if (!authLoading && !user) {
        router.push('/login');
    }
  }, [user, authLoading, router]);

  async function onSubmit(data: SafetyReportFormValues) {
    setIsSubmitting(true);
    try {
      const result = await submitSafetyReport(data);
      if (result.success) {
        toast({
          title: "Report Submitted",
          description: result.message,
          variant: "success",
        });
        router.push("/");
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const e = error as Error;
      toast({
        title: "Submission Failed",
        description: e.message || "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || !user) {
     return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-3">
              <ShieldAlert className="h-7 w-7 text-primary" />
              Submit a Safety Report
            </CardTitle>
            <CardDescription>
              Report any event, hazard, or concern related to safety. Your submission is crucial for maintaining our safety standards.
            </CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={0.1}>
        <Card>
          <CardHeader>
             <Alert variant="info">
                <Info className="h-4 w-4"/>
                <AlertTitle>Important: Purpose of this Report</AlertTitle>
                <FormDescription className="text-foreground">
                    This form is for safety-related events only. For service issues, use Purser Reports. For general ideas, use the Suggestion Box. All submissions are reviewed by the Safety Management Team.
                </FormDescription>
            </Alert>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                 <FormField control={form.control} name="eventDate" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Date and Time of Event (UTC)</FormLabel>
                        <FormControl><Input type="datetime-local" {...field} /></FormControl>
                        <FormDescription>Please be as precise as possible.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <FormField control={form.control} name="flightNumber" render={({ field }) => (
                        <FormItem><FormLabel>Flight Number (if applicable)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="aircraftRegistration" render={({ field }) => (
                        <FormItem><FormLabel>Aircraft Registration (if known)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <FormField control={form.control} name="eventType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type of Event</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an event type"/></SelectTrigger></FormControl><SelectContent>{safetyReportEventTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="flightPhase" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phase of Flight (if applicable)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a flight phase"/></SelectTrigger></FormControl><SelectContent>{safetyReportFlightPhases.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                <FormField control={form.control} name="severity" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assessed Severity</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Assess the severity"/></SelectTrigger></FormControl><SelectContent>{safetyReportSeverityLevels.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
                        <FormDescription>Based on your judgment, what was the potential or actual severity of this event?</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detailed Description of the Event</FormLabel>
                    <FormControl><Textarea placeholder="Describe what happened in a clear, factual, and objective manner. Include what, where, when, who, and what actions were taken." className="min-h-[200px]" {...field} /></FormControl>
                    <FormDescription>Be as detailed as possible. Your report is a vital source of safety data.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="isAnonymous" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-muted/50">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Submit Anonymously</FormLabel>
                      <FormDescription>
                        If checked, your name and email will not be attached to this report. Anonymous reports are encouraged for sensitive issues.
                      </FormDescription>
                    </div>
                  </FormItem>
                )} />

                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting || !form.formState.isValid} size="lg">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        Submit Securely
                    </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  );
}
