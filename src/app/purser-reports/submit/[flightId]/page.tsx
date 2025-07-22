
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature, Loader2, Send, Users, PersonStanding, Wrench, Shield, Utensils, Plane, AlertTriangle, ArrowLeft, ArrowRight, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { purserReportFormSchema, type PurserReportFormValues, passengersToReportOptions, technicalIssuesOptions, safetyChecksOptions, incidentTypesOptions } from "@/schemas/purser-report-schema";
import { format, parseISO } from "date-fns";
import { getAirportByCode } from "@/services/airport-service";
import { logAuditEvent } from "@/lib/audit-logger";
import { type StoredFlight } from "@/schemas/flight-schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { summarizeReport } from "@/ai/flows/summarize-report-flow";
import { CheckboxGroup } from "@/components/custom/custom-checkbox-group";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FlightForReport {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDepartureDateTimeUTC: string;
  aircraftType: string;
  crewMembers: User[];
  defaultPicName: string;
  defaultFoName: string;
  defaultSccmName: string;
}

const steps = [
    { id: 1, title: 'Flight Info', fields: ['flightNumber', 'flightDate', 'route', 'aircraftType', 'picName', 'foName', 'sccmName'], icon: Plane },
    { id: 2, title: 'Crew', fields: ['positivePoints', 'improvementPoints', 'actionRequired'], icon: Users },
    { id: 3, title: 'Passengers & Cabin', fields: ['passengerCount', 'passengersToReport', 'technicalIssues'], icon: PersonStanding },
    { id: 4, title: 'Safety & Service', fields: ['safetyChecks', 'safetyAnomalies', 'servicePassengerFeedback'], icon: Shield },
    { id: 5, title: 'Incidents', fields: ['specificIncident', 'incidentTypes', 'incidentDetails'], icon: AlertTriangle },
];

export default function SubmitPurserReportPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flightId = params.flightId as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [flightData, setFlightData] = React.useState<FlightForReport | null>(null);
  const [currentStep, setCurrentStep] = React.useState(0);

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
        flightId: "", flightNumber: "", flightDate: "", route: "", aircraftType: "", picName: "", foName: "", sccmName: "",
        cabinCrewOnBoard: [], passengerCount: 0,
        positivePoints: "", improvementPoints: "", actionRequired: false,
        passengersToReport: [],
        technicalIssues: [],
        safetyChecks: [], safetyAnomalies: "",
        servicePassengerFeedback: "",
        specificIncident: false, incidentTypes: [], incidentDetails: "",
    },
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!flightId || authLoading) return;
    if (!user) { router.push("/login"); return; }

    const fetchFlightData = async () => {
      setIsLoading(true);
      const flightDocRef = doc(db, "flights", flightId);
      const flightSnap = await getDoc(flightDocRef);

      if (!flightSnap.exists() || flightSnap.data().purserReportSubmitted) {
        toast({ title: "Report Not Available", description: "This flight is not available for reporting or a report has already been submitted.", variant: "destructive" });
        router.push("/purser-reports");
        return;
      }
      
      const flight = flightSnap.data() as StoredFlight;
      const [depAirportInfo, arrAirportInfo] = await Promise.all([ getAirportByCode(flight.departureAirport), getAirportByCode(flight.arrivalAirport), ]);
      
      const crewPromises = (flight.allCrewIds || []).map(uid => getDoc(doc(db, "users", uid)));
      const crewDocs = await Promise.all(crewPromises);
      const crewMembers = crewDocs.map(snap => snap.exists() ? { uid: snap.id, ...snap.data() } as User : null).filter(Boolean) as User[];
      
      const pilots = crewMembers.filter(c => flight.pilotIds.includes(c.uid));
      const purser = crewMembers.find(c => c.uid === flight.purserId);

      const loadedFlightData: FlightForReport = {
        id: flightSnap.id, flightNumber: flight.flightNumber,
        departureAirport: depAirportInfo?.name || flight.departureAirport,
        arrivalAirport: arrAirportInfo?.name || flight.arrivalAirport,
        scheduledDepartureDateTimeUTC: flight.scheduledDepartureDateTimeUTC,
        aircraftType: flight.aircraftType,
        crewMembers: crewMembers,
        defaultPicName: pilots[0]?.displayName || '',
        defaultFoName: pilots[1]?.displayName || '',
        defaultSccmName: purser?.displayName || '',
      };

      setFlightData(loadedFlightData);

      form.reset({
        ...form.control._defaultValues,
        flightId: loadedFlightData.id, 
        flightNumber: loadedFlightData.flightNumber,
        flightDate: loadedFlightData.scheduledDepartureDateTimeUTC,
        route: `${loadedFlightData.departureAirport} → ${loadedFlightData.arrivalAirport}`,
        aircraftType: loadedFlightData.aircraftType, 
        picName: loadedFlightData.defaultPicName, 
        foName: loadedFlightData.defaultFoName,
        sccmName: loadedFlightData.defaultSccmName,
        cabinCrewOnBoard: crewMembers.filter(c => flight.cabinCrewIds.includes(c.uid)).map(c => c.displayName || c.email!),
      });
      setIsLoading(false);
    };

    fetchFlightData();
  }, [flightId, user, authLoading, router, toast, form]);

  const triggerValidation = async (fields: (keyof PurserReportFormValues)[]) => {
    return await form.trigger(fields);
  };

  const nextStep = async () => {
    const fieldsToValidate = steps[currentStep].fields as (keyof PurserReportFormValues)[];
    const isValid = await triggerValidation(fieldsToValidate);
    if (isValid) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    } else {
        toast({ title: "Incomplete Section", description: "Please fill all required fields before continuing.", variant: "destructive"})
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev + 1);
    }
  };

  async function onSubmit(data: PurserReportFormValues) {
    if (!user || !flightData) { toast({ title: "Not Authenticated", description: "You must be logged in to submit a report.", variant: "destructive" }); return; }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
      const reportRef = doc(collection(db, "purserReports"));

      const reportData: any = { 
        ...data, 
        userId: user.uid, 
        userEmail: user.email, 
        createdAt: serverTimestamp(), 
        status: 'submitted', 
        adminNotes: '',
        departureAirport: flightData.departureAirport, 
        arrivalAirport: flightData.arrivalAirport,
      };
      
      toast({ title: "Generating AI Summary...", description: "Please wait while we analyze your report." });
      const reportContent = `Flight report for ${data.flightNumber} (${data.route}) on ${format(parseISO(data.flightDate), "PPP")}. Passengers: ${data.passengerCount}. Positives: ${data.positivePoints}. Improvements: ${data.improvementPoints}. Passenger notes: ${data.passengersToReport?.join(', ')}. Cabin issues: ${data.technicalIssues?.join(', ')}. Safety anomalies: ${data.safetyAnomalies}. Service feedback: ${data.servicePassengerFeedback}. Incident: ${data.specificIncident ? `Yes, ${data.incidentTypes?.join(', ')} - ${data.incidentDetails}` : 'No'}.`;
      
      const summaryResult = await summarizeReport({ reportContent });

      if (summaryResult && summaryResult.summary) {
          reportData.aiSummary = summaryResult.summary;
          reportData.aiKeyPoints = summaryResult.keyPoints;
          reportData.aiPotentialRisks = summaryResult.potentialRisks;
      } else {
          console.warn("AI summary generation failed or returned empty, submitting report without it.");
          toast({ title: "AI Summary Skipped", description: "Could not generate AI summary, but your report will still be submitted.", variant: "default" });
      }

      batch.set(reportRef, reportData);
      const flightRef = doc(db, "flights", data.flightId);
      batch.update(flightRef, { purserReportSubmitted: true, purserReportId: reportRef.id });
      
      await batch.commit();
      await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'SUBMIT_PURSER_REPORT', entityType: 'PURSER_REPORT', entityId: reportRef.id, details: { flightNumber: data.flightNumber } });

      toast({ title: "Report Submitted", description: "Your purser report has been successfully submitted." });
      router.push("/purser-reports/history");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({ title: "Submission Failed", description: "Could not submit your report.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  }

  const pilotsOnFlight = flightData?.crewMembers.filter(c => c.role === 'pilote') || [];
  const sccmOnFlight = flightData?.crewMembers.filter(c => ['purser', 'admin', 'instructor'].includes(c.role || '')) || [];
  const selectedPicName = form.watch("picName");
  const selectedFoName = form.watch("foName");
  const progressPercentage = ((currentStep + 1) / steps.length) * 100;
  
  if (isLoading || authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-muted-foreground">Loading Flight Data...</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center"><FileSignature className="mr-3 h-7 w-7 text-primary" />Purser Report Submission</CardTitle>
            <CardDescription>Fill all relevant flight information in a clear, fast, and standardized manner.</CardDescription>
            <Progress value={progressPercentage} className="mt-4"/>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Step {currentStep + 1} of {steps.length}: <strong>{steps[currentStep].title}</strong></span>
                <span>{Math.round(progressPercentage)}% Complete</span>
            </div>
          </CardHeader>
        </Card>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Step 1: General Flight Info */}
                <div className={cn(currentStep !== 0 && "hidden")}>
                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plane/>General Flight Information</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormItem><FormLabel>Flight Number</FormLabel><Input readOnly value={flightData?.flightNumber} /></FormItem>
                        <FormItem><FormLabel>Flight Date</FormLabel><Input readOnly value={flightData ? format(parseISO(flightData.scheduledDepartureDateTimeUTC), "PPP") : ''} /></FormItem>
                        <FormItem><FormLabel>Route</FormLabel><Input readOnly value={`${flightData?.departureAirport} → ${flightData?.arrivalAirport}`} /></FormItem>
                        <FormItem><FormLabel>Aircraft Type</FormLabel><Input readOnly value={flightData?.aircraftType} /></FormItem>
                        <FormField control={form.control} name="picName" render={({ field }) => (<FormItem><FormLabel>PIC Name</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{pilotsOnFlight.filter(p => p.displayName !== selectedFoName).map(p => <SelectItem key={p.uid} value={p.displayName || p.email!}>{p.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="foName" render={({ field }) => (<FormItem><FormLabel>FO Name</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{pilotsOnFlight.filter(p => p.displayName !== selectedPicName).map(p => <SelectItem key={p.uid} value={p.displayName || p.email!}>{p.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="sccmName" render={({ field }) => (<FormItem><FormLabel>SCCM Name</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{sccmOnFlight.map(p => <SelectItem key={p.uid} value={p.displayName || p.email!}>{p.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormItem className="md:col-span-2"><FormLabel>Cabin Crew on board</FormLabel><div className="p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground">{form.getValues('cabinCrewOnBoard').join(', ')}</div></FormItem>
                    </CardContent></Card>
                </div>
                
                {/* Step 2: Crew */}
                <div className={cn(currentStep !== 1 && "hidden")}>
                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users/>Crew Coordination</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="positivePoints" render={({ field }) => (<FormItem><FormLabel>Positive points to report (teamwork, initiative, etc.)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="improvementPoints" render={({ field }) => (<FormItem><FormLabel>Points for improvement or follow-up</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="actionRequired" render={({ field }) => (<FormItem><FormLabel>Does this section require a specific action from management?</FormLabel><Select onValueChange={(v) => field.onChange(v === 'true')} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </CardContent></Card>
                </div>
                
                {/* Step 3: Passengers & Cabin */}
                 <div className={cn(currentStep !== 2 && "hidden")}>
                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><PersonStanding/>Passengers & Cabin</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="passengerCount" render={({ field }) => (<FormItem><FormLabel>Total number of passengers</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>)} />
                        <CheckboxGroup control={form.control} name="passengersToReport" label="Specific passenger types on board" options={passengersToReportOptions} />
                        <CheckboxGroup control={form.control} name="technicalIssues" label="Technical issues observed in the cabin" options={technicalIssuesOptions} />
                    </CardContent></Card>
                </div>

                {/* Step 4: Safety & Service */}
                <div className={cn(currentStep !== 3 && "hidden")}>
                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shield/>Safety & Service</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <CheckboxGroup control={form.control} name="safetyChecks" label="Safety checks performed" options={safetyChecksOptions} />
                        <FormField control={form.control} name="safetyAnomalies" render={({ field }) => (<FormItem><FormLabel>Safety anomalies observed (if any)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="servicePassengerFeedback" render={({ field }) => (<FormItem><FormLabel>Notable passenger feedback on service (positive or negative)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent></Card>
                </div>

                 {/* Step 5: Specific Incidents */}
                <div className={cn(currentStep !== 4 && "hidden")}>
                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle/>Specific Incidents</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="specificIncident" render={({ field }) => (<FormItem><FormLabel>Was there a specific incident to report?</FormLabel><Select onValueChange={(v) => field.onChange(v === 'true')} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        {form.watch('specificIncident') && (
                        <>
                            <CheckboxGroup control={form.control} name="incidentTypes" label="Type of incident" options={incidentTypesOptions} />
                            <FormField control={form.control} name="incidentDetails" render={({ field }) => (<FormItem><FormLabel>Factual details of the incident (what, who, when, actions taken)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </>
                        )}
                    </CardContent></Card>
                </div>
                
                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8">
                    <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                    
                    {currentStep < steps.length - 1 ? (
                        <Button type="button" onClick={nextStep}>
                            Next <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button type="submit" disabled={isSubmitting || !form.formState.isValid} size="lg">
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : <><Send className="mr-2 h-4 w-4" /> Submit Report</>}
                        </Button>
                    )}
                </div>
            </form>
        </Form>
    </div>
  );
}
