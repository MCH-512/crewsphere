
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature, Loader2, Send, Users, PersonStanding, Wrench, Shield, Utensils, Plane, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { purserReportFormSchema, type PurserReportFormValues, briefingChecklistOptions, atmosphereChecklistOptions, passengersToReportOptions, cabinConditionOptions, technicalIssuesOptions, safetyDemoOptions, safetyChecksOptions, crossCheckOptions, servicePerformanceOptions, delayCausesOptions, cockpitCommunicationOptions, incidentTypesOptions } from "@/schemas/purser-report-schema";
import { format, parseISO } from "date-fns";
import { getAirportByCode } from "@/services/airport-service";
import { logAuditEvent } from "@/lib/audit-logger";
import { type StoredFlight } from "@/schemas/flight-schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const CheckboxGroup = ({ control, name, label, options }: { control: any; name: any; label: string; options: readonly string[] }) => (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel className="text-base">{label}</FormLabel>
          <div className="grid grid-cols-2 gap-2">
            {options.map((item) => (
              <FormField
                key={item}
                control={control}
                name={name}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(item)}
                        onCheckedChange={(checked) => {
                          return checked
                            ? field.onChange([...(field.value || []), item])
                            : field.onChange(field.value?.filter((value: string) => value !== item));
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{item}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
);

export default function SubmitPurserReportPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flightId = params.flightId as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [flightData, setFlightData] = React.useState<FlightForReport | null>(null);

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
        flightId: "", flightNumber: "", flightDate: "", route: "", aircraftType: "",
        aircraftRegistration: "", picName: "", foName: "", sccmName: "",
        cabinCrewOnBoard: [], passengerCount: 0, briefing: [], atmosphere: [],
        positivePoints: "", improvementPoints: "", followUpRecommended: false,
        passengersToReport: [], passengerBehaviorNotes: "", passengerComplaint: false,
        cabinConditionBoarding: [], cabinConditionArrival: [], technicalIssues: [],
        cabinActionsTaken: "", safetyDemo: [], safetyChecks: [], crossCheck: [],
        safetyAnomalies: "", servicePerformance: [], cateringShortage: false,
        servicePassengerFeedback: "", delayCauses: [], cockpitCommunication: "",
        groundHandlingRemarks: "", specificIncident: false, incidentTypes: [],
        incidentDetails: "",
    },
    mode: "onChange",
  });


  React.useEffect(() => {
    if (!flightId || authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

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
      const [depAirportInfo, arrAirportInfo] = await Promise.all([
        getAirportByCode(flight.departureAirport),
        getAirportByCode(flight.arrivalAirport),
      ]);
      
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
        flightId: loadedFlightData.id,
        flightNumber: loadedFlightData.flightNumber,
        flightDate: loadedFlightData.scheduledDepartureDateTimeUTC,
        route: `${loadedFlightData.departureAirport} → ${loadedFlightData.arrivalAirport}`,
        aircraftType: loadedFlightData.aircraftType,
        aircraftRegistration: flight.aircraftType, // Placeholder
        picName: loadedFlightData.defaultPicName,
        foName: loadedFlightData.defaultFoName,
        sccmName: loadedFlightData.defaultSccmName,
        cabinCrewOnBoard: crewMembers.filter(c => flight.cabinCrewIds.includes(c.uid)).map(c => c.displayName || c.email!),
      });
      setIsLoading(false);
    };

    fetchFlightData();
  }, [flightId, user, authLoading, router, toast, form]);

  async function onSubmit(data: PurserReportFormValues) {
    if (!user) { toast({ title: "Not Authenticated", description: "You must be logged in to submit a report.", variant: "destructive" }); return; }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
      const reportRef = doc(collection(db, "purserReports"));
      
      const reportData = { 
        ...data, 
        userId: user.uid, 
        userEmail: user.email, 
        createdAt: serverTimestamp(), 
        status: 'submitted', 
        adminNotes: '',
        crewRoster: (data.cabinCrewOnBoard || []).map(name => ({ name, role: 'cabin crew', uid: '' })),
        departureAirport: flightData?.departureAirport,
        arrivalAirport: flightData?.arrivalAirport
      };

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
  const selectedPic = form.watch("picName");
  
  if (isLoading || authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-muted-foreground">Loading Flight Data...</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center"><FileSignature className="mr-3 h-7 w-7 text-primary" />Purser Report Submission</CardTitle>
            <CardDescription>Fill all relevant flight information in a clear, fast, and standardized manner.</CardDescription>
          </CardHeader>
        </Card>

        {/* Section 1: General Flight Info */}
        <Card><CardHeader><CardTitle>General Flight Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormItem><FormLabel>Flight Number</FormLabel><Input readOnly value={flightData?.flightNumber} /></FormItem>
            <FormItem><FormLabel>Flight Date</FormLabel><Input readOnly value={flightData ? format(parseISO(flightData.scheduledDepartureDateTimeUTC), "PPP") : ''} /></FormItem>
            <FormItem><FormLabel>Route</FormLabel><Input readOnly value={`${flightData?.departureAirport} → ${flightData?.arrivalAirport}`} /></FormItem>
            <FormItem><FormLabel>Aircraft Type</FormLabel><Input readOnly value={flightData?.aircraftType} /></FormItem>
             <FormField control={form.control} name="picName" render={({ field }) => (
                <FormItem><FormLabel>PIC Name</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{pilotsOnFlight.map(p => <SelectItem key={p.uid} value={p.displayName || p.email!}>{p.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="foName" render={({ field }) => (
                <FormItem><FormLabel>FO Name</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{pilotsOnFlight.filter(p => p.displayName !== selectedPic).map(p => <SelectItem key={p.uid} value={p.displayName || p.email!}>{p.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="sccmName" render={({ field }) => (
                <FormItem><FormLabel>SCCM Name</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{sccmOnFlight.map(p => <SelectItem key={p.uid} value={p.displayName || p.email!}>{p.displayName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="cabinCrewOnBoard" render={({ field }) => (
                <FormItem className="md:col-span-2">
                    <FormLabel>Cabin Crew on board</FormLabel>
                    <FormControl><Input readOnly value={field.value?.join(', ') || 'N/A'}/></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
          </CardContent>
        </Card>

        {/* Section 2: Crew */}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users/>Crew – Performance & Coordination</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CheckboxGroup control={form.control} name="briefing" label="Briefing" options={briefingChecklistOptions} />
            <CheckboxGroup control={form.control} name="atmosphere" label="Working Atmosphere" options={atmosphereChecklistOptions} />
            <FormField control={form.control} name="positivePoints" render={({ field }) => (<FormItem><FormLabel>Positive points of the day</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="improvementPoints" render={({ field }) => (<FormItem><FormLabel>Weak points / Follow-up needed</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="followUpRecommended" render={({ field }) => (<FormItem><FormLabel>Follow-up recommended</FormLabel><Select onValueChange={(v) => field.onChange(v === 'true')} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>
        
        {/* Section 3: Passengers */}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><PersonStanding/>Passengers – Specificities & Behavior</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="passengerCount" render={({ field }) => (<FormItem><FormLabel>Total number of passengers</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} /></FormControl><FormMessage /></FormItem>)} />
            <CheckboxGroup control={form.control} name="passengersToReport" label="Passengers to report" options={passengersToReportOptions} />
            <FormField control={form.control} name="passengerBehaviorNotes" render={({ field }) => (<FormItem><FormLabel>Passenger behavior notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="passengerComplaint" render={({ field }) => (<FormItem><FormLabel>Complaint reported by passenger</FormLabel><Select onValueChange={(v) => field.onChange(v === 'true')} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>
        
        {/* Section 4: Cabin */}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wrench/>Cabin – Condition & Cleanliness</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CheckboxGroup control={form.control} name="cabinConditionBoarding" label="Cabin condition at boarding" options={cabinConditionOptions} />
            <CheckboxGroup control={form.control} name="cabinConditionArrival" label="Cabin condition on arrival" options={cabinConditionOptions.slice(0, 2)} />
            <CheckboxGroup control={form.control} name="technicalIssues" label="Technical issues" options={technicalIssuesOptions} />
            <FormField control={form.control} name="cabinActionsTaken" render={({ field }) => (<FormItem><FormLabel>Actions taken or observations</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        {/* Section 5: Safety */}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shield/>Safety – Procedures & Checks</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CheckboxGroup control={form.control} name="safetyDemo" label="Safety demo" options={safetyDemoOptions} />
            <CheckboxGroup control={form.control} name="safetyChecks" label="Safety checks" options={safetyChecksOptions} />
            <CheckboxGroup control={form.control} name="crossCheck" label="Cross-check" options={crossCheckOptions} />
            <FormField control={form.control} name="safetyAnomalies" render={({ field }) => (<FormItem><FormLabel>Safety anomalies observed</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>
        
        {/* Section 6: In-Flight Service */}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Utensils/>In-Flight Service</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CheckboxGroup control={form.control} name="servicePerformance" label="Service performance" options={servicePerformanceOptions} />
            <FormField control={form.control} name="cateringShortage" render={({ field }) => (<FormItem><FormLabel>Catering shortage</FormLabel><Select onValueChange={(v) => field.onChange(v === 'true')} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="servicePassengerFeedback" render={({ field }) => (<FormItem><FormLabel>Passenger feedback</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>
        
        {/* Section 7: Operational Events */}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plane/>Operational Events</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CheckboxGroup control={form.control} name="delayCauses" label="Delay causes" options={delayCausesOptions} />
            <FormField control={form.control} name="cockpitCommunication" render={({ field }) => (<FormItem><FormLabel>Cockpit communication</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{cockpitCommunicationOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="groundHandlingRemarks" render={({ field }) => (<FormItem><FormLabel>Remarks regarding ground handling</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        {/* Section 8: Specific Incidents */}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle/>Specific Incidents</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="specificIncident" render={({ field }) => (<FormItem><FormLabel>Incident to report</FormLabel><Select onValueChange={(v) => field.onChange(v === 'true')} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            {form.watch('specificIncident') && (
              <>
                <CheckboxGroup control={form.control} name="incidentTypes" label="Type of incident" options={incidentTypesOptions} />
                <FormField control={form.control} name="incidentDetails" render={({ field }) => (<FormItem><FormLabel>Factual details (what, who, when)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Report...</> : <><Send className="mr-2 h-4 w-4" /> Submit Report</>}
          </Button>
        </div>
      </form>
    </Form>
    </div>
  );
}
