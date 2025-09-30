
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Send, Loader2, Plane, MapPin, CheckCheck, EyeOff, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import {
  safetyReportFormSchema,
  type SafetyReportFormValues,
  eventTypes,
  flightPhases,
  contributingFactors,
} from "@/schemas/safety-report-schema";
import { submitSafetyReport } from "@/services/safety-report-service";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AnimatedCard } from "@/components/motion/animated-card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const steps = [
    { id: 1, title: 'Event Context', fields: ['eventDate', 'flightNumber', 'aircraftId', 'departureAerodrome', 'arrivalAerodrome'], icon: Plane },
    { id: 2, title: 'Event Details', fields: ['eventLocation', 'eventType', 'eventDescription'], icon: MapPin },
    { id: 3, title: 'Analysis & Follow-up', fields: ['contributingFactors', 'immediateActionsTaken', 'suggestionsForPrevention'], icon: CheckCheck },
    { id: 4, title: 'Confidentiality', fields: ['isConfidential'], icon: EyeOff },
];


export function SafetyReportClient() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const form = useForm<SafetyReportFormValues>({
    resolver: zodResolver(safetyReportFormSchema),
    defaultValues: {
      eventDate: new Date().toISOString().substring(0, 16),
      flightNumber: "", aircraftId: "", departureAerodrome: "", arrivalAerodrome: "",
      eventLocation: "", eventType: [], eventDescription: "",
      contributingFactors: [], immediateActionsTaken: "", suggestionsForPrevention: "",
      isConfidential: false,
    },
    mode: "onChange",
  });

  const triggerValidation = async (fields: (keyof SafetyReportFormValues)[]) => await form.trigger(fields);

  const nextStep = async () => {
    const fieldsToValidate = steps[currentStep].fields as (keyof SafetyReportFormValues)[];
    const isValid = await triggerValidation(fieldsToValidate);
    if (isValid) {
      if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1);
    } else {
      toast({ title: "Incomplete Section", description: "Please fill all required fields before continuing.", variant: "destructive" });
    }
  };

  const prevStep = () => { if (currentStep > 0) setCurrentStep(prev => prev - 1); };

  async function onSubmit() {
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

  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="text-center p-4"><CardTitle>Access Denied</CardTitle></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center"><ShieldAlert className="mr-3 h-7 w-7 text-primary" />Submit a Safety Report</CardTitle>
          <CardDescription>Report any event, hazard, or concern that has, or could have, implications for aviation safety. All submissions are treated with confidentiality.</CardDescription>
          <Progress value={progressPercentage} className="mt-4" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Step {currentStep + 1} of {steps.length}: <strong>{steps[currentStep].title}</strong></span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
        </CardHeader>
      </Card>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AnimatedCard delay={0.1} className={cn(currentStep !== 0 && "hidden")}>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Plane />Event Context</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="eventDate" render={({ field }) => (<FormItem><FormLabel>Event Date & Time (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., TU721" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="aircraftId" render={({ field }) => (<FormItem><FormLabel>Aircraft Registration (Optional)</FormLabel><FormControl><Input placeholder="e.g., TS-IMN" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="departureAerodrome" render={({ field }) => (<FormItem><FormLabel>Departure Aerodrome (ICAO)</FormLabel><FormControl><Input placeholder="e.g., DTTA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="arrivalAerodrome" render={({ field }) => (<FormItem><FormLabel>Arrival Aerodrome (ICAO)</FormLabel><FormControl><Input placeholder="e.g., LFPG" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={0.1} className={cn(currentStep !== 1 && "hidden")}>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPin />Event Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="eventLocation" render={({ field }) => (<FormItem><FormLabel>Phase of Flight / Location</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a phase or location"/></SelectTrigger></FormControl><SelectContent>{flightPhases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="eventType" render={({ field }) => (<FormItem><FormLabel className="text-base">Event Type (select all that apply)</FormLabel><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">{eventTypes.map((item) => (<FormField key={item} control={form.control} name="eventType" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item]) : field.onChange(field.value?.filter((value) => value !== item))} /></FormControl><FormLabel className="font-normal cursor-pointer w-full">{item}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="eventDescription" render={({ field }) => (<FormItem><FormLabel>Factual Description of the Event</FormLabel><FormControl><Textarea placeholder="Describe what happened with factual, objective details. Avoid assumptions or blame." className="min-h-[150px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={0.1} className={cn(currentStep !== 2 && "hidden")}>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckCheck />Analysis & Follow-up</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                 <FormField control={form.control} name="contributingFactors" render={({ field }) => (<FormItem><FormLabel className="text-base">Potential Contributing Factors (Optional)</FormLabel><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">{contributingFactors.map((item) => (<FormField key={item} control={form.control} name="contributingFactors" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item]) : field.onChange(field.value?.filter((value) => value !== item))} /></FormControl><FormLabel className="font-normal cursor-pointer w-full">{item}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="immediateActionsTaken" render={({ field }) => (<FormItem><FormLabel>Immediate Actions Taken (Optional)</FormLabel><FormControl><Textarea placeholder="Describe any actions taken by the crew to manage the situation." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="suggestionsForPrevention" render={({ field }) => (<FormItem><FormLabel>Suggestions for Prevention (Optional)</FormLabel><FormControl><Textarea placeholder="If you have any ideas on how to prevent this from happening again, please share them." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
            </Card>
          </AnimatedCard>
          
           <AnimatedCard delay={0.1} className={cn(currentStep !== 3 && "hidden")}>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><EyeOff />Confidentiality</CardTitle></CardHeader>
                <CardContent>
                    <FormField control={form.control} name="isConfidential" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none"><FormLabel>Submit this report confidentially</FormLabel>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">If checked, your name and email will be dissociated from this report for administrative review. Your identity will still be logged for audit purposes but will not be visible in the standard review process. This encourages open reporting in line with "Just Culture" principles.</p>
                        </div>
                      </FormItem>
                    )} />
                </CardContent>
            </Card>
           </AnimatedCard>

          <div className="flex justify-between mt-8">
            <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0 || isSubmitting}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button>
            {currentStep < steps.length - 1 ? 
                (<Button type="button" onClick={nextStep}>Next<ArrowRight className="ml-2 h-4 w-4" /></Button>) 
                : (<Button type="submit" disabled={isSubmitting || !form.formState.isValid} size="lg"><Send className="mr-2 h-4 w-4" />Submit Report</Button>)
            }
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

    