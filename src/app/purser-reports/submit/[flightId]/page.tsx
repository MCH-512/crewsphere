
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { purserReportFormSchema, type PurserReportFormValues, optionalReportSections } from "@/schemas/purser-report-schema";
import { format, parseISO } from "date-fns";
import { getAirportByCode } from "@/services/airport-service";
import { logAuditEvent } from "@/lib/audit-logger";
import { type StoredFlight } from "@/schemas/flight-schema";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface FlightForReport {
  id: string;
  flightNumber: string;
  departureAirport: string;
  departureAirportIATA?: string;
  arrivalAirport: string;
  arrivalAirportIATA?: string;
  scheduledDepartureDateTimeUTC: string;
  aircraftType: string;
}

export default function SubmitPurserReportPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flightId = params.flightId as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [flightData, setFlightData] = React.useState<FlightForReport | null>(null);
  const [crewMembers, setCrewMembers] = React.useState<User[]>([]);

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
      passengerLoad: { total: 0, adults: 0, infants: 0 },
      confirmedCrewIds: [],
      crewNotes: "",
      generalFlightSummary: "",
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
      const depAirportInfo = await getAirportByCode(flight.departureAirport);
      const arrAirportInfo = await getAirportByCode(flight.arrivalAirport);
      
      const loadedFlightData: FlightForReport = {
        id: flightSnap.id, flightNumber: flight.flightNumber,
        departureAirport: flight.departureAirport, departureAirportIATA: depAirportInfo?.iata,
        arrivalAirport: flight.arrivalAirport, arrivalAirportIATA: arrAirportInfo?.iata,
        scheduledDepartureDateTimeUTC: flight.scheduledDepartureDateTimeUTC, aircraftType: flight.aircraftType,
      };

      setFlightData(loadedFlightData);

      // Fetch crew details
      if (flight.allCrewIds && flight.allCrewIds.length > 0) {
        const crewPromises = flight.allCrewIds.map(uid => getDoc(doc(db, "users", uid)));
        const crewDocs = await Promise.all(crewPromises);
        const fetchedCrew = crewDocs
            .map(snap => snap.exists() ? { uid: snap.id, ...snap.data() } as User : null)
            .filter((c): c is User => c !== null);
        setCrewMembers(fetchedCrew);
        
        form.setValue('confirmedCrewIds', fetchedCrew.map(c => c.uid));
      }

      form.reset({
        flightId: loadedFlightData.id, flightNumber: loadedFlightData.flightNumber, flightDate: loadedFlightData.scheduledDepartureDateTimeUTC,
        departureAirport: loadedFlightData.departureAirport, arrivalAirport: loadedFlightData.arrivalAirport, aircraftTypeRegistration: loadedFlightData.aircraftType,
        passengerLoad: { total: 0, adults: 0, infants: 0 },
        confirmedCrewIds: flight.allCrewIds || [],
        crewNotes: "",
        generalFlightSummary: "",
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
      
      const confirmedCrewDetails = crewMembers.filter(c => data.confirmedCrewIds.includes(c.uid))
          .map(c => ({ uid: c.uid, name: c.fullName || c.displayName, role: c.role || 'N/A' }));

      const reportData = { 
        ...data, 
        userId: user.uid, 
        userEmail: user.email, 
        crewRoster: confirmedCrewDetails,
        createdAt: serverTimestamp(), 
        status: 'submitted', 
        adminNotes: '' 
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
  
  if (isLoading || authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-muted-foreground">Loading Flight Data...</p></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center"><FileSignature className="mr-3 h-7 w-7 text-primary" />Purser Report for Flight {flightData?.flightNumber}</CardTitle>
            <CardDescription>{flightData?.departureAirportIATA || flightData?.departureAirport} to {flightData?.arrivalAirportIATA || flightData?.arrivalAirport} on {flightData ? format(parseISO(flightData.scheduledDepartureDateTimeUTC), "PPP") : '...'}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Passenger & Crew Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="passengerLoad.total" render={({ field }) => (<FormItem><FormLabel>Total Passengers</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="passengerLoad.adults" render={({ field }) => (<FormItem><FormLabel>Adults</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="passengerLoad.infants" render={({ field }) => (<FormItem><FormLabel>Infants</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField
                control={form.control}
                name="confirmedCrewIds"
                render={() => (
                    <FormItem>
                    <FormLabel>Confirm Crew on Duty*</FormLabel>
                    <FormDescription>Uncheck any crew member who was not on this flight.</FormDescription>
                    <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                        {crewMembers.map((member) => (
                        <FormField
                            key={member.uid}
                            control={form.control}
                            name="confirmedCrewIds"
                            render={({ field }) => {
                            const isChecked = field.value?.includes(member.uid);
                            return (
                                <FormItem
                                key={member.uid}
                                className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                <FormControl>
                                    <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                        return checked
                                        ? field.onChange([...(field.value || []), member.uid])
                                        : field.onChange(
                                            field.value?.filter(
                                                (value) => value !== member.uid
                                            )
                                            )
                                    }}
                                    />
                                </FormControl>
                                <FormLabel className={cn(
                                    "font-normal flex items-center gap-2 transition-opacity",
                                    !isChecked && "opacity-50 line-through"
                                )}>
                                     {member.fullName || member.displayName} ({member.email})
                                    <span className="text-muted-foreground capitalize text-xs p-1 bg-muted rounded-sm"> - {member.role}</span>
                                </FormLabel>
                                </FormItem>
                            )
                            }}
                        />
                        ))}
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="crewNotes"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Crew Notes (Optional)</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Note any last-minute crew changes or other roster-related observations..." {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-lg">General Flight Summary</CardTitle></CardHeader>
          <CardContent>
            <FormField control={form.control} name="generalFlightSummary" render={({ field }) => (<FormItem><FormLabel>General Summary*</FormLabel><FormControl><Textarea placeholder="Describe the overall flight experience, punctuality, and any general observations..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Detailed Observations (Optional)</CardTitle>
                <CardDescription>Expand any relevant sections below to add specific details.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                    {optionalReportSections.map(({ name, label, placeholder, icon: Icon }) => (
                        <AccordionItem value={name} key={name}>
                            <AccordionTrigger className="text-base hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <Icon className="h-5 w-5 text-primary" />
                                    {label}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <FormField
                                    control={form.control}
                                    name={name}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                        <Textarea
                                            placeholder={placeholder}
                                            {...field}
                                            className="min-h-[120px]"
                                        />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !form.formState.isValid} size="lg">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Report...</> : <><Send className="mr-2 h-4 w-4" /> Submit Report</>}
          </Button>
        </div>
      </form>
    </Form>
  );
}
