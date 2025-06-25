
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
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, writeBatch } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { purserReportFormSchema, type PurserReportFormValues } from "@/schemas/purser-report-schema";
import { format, parseISO } from "date-fns";
import { getAirportByCode } from "@/services/airport-service";
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

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
      passengerLoad: { total: 0, adults: 0, infants: 0 },
      crewMembers: "",
      generalFlightSummary: "",
    },
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

      if (!flightSnap.exists()) {
        toast({ title: "Flight not found", description: "The selected flight could not be found.", variant: "destructive" });
        router.push("/purser-reports");
        return;
      }
      
      const data = flightSnap.data();
      const depAirportInfo = await getAirportByCode(data.departureAirport);
      const arrAirportInfo = await getAirportByCode(data.arrivalAirport);
      
      const loadedFlightData: FlightForReport = {
        id: flightSnap.id,
        flightNumber: data.flightNumber,
        departureAirport: data.departureAirport,
        departureAirportIATA: depAirportInfo?.iata,
        arrivalAirport: data.arrivalAirport,
        arrivalAirportIATA: arrAirportInfo?.iata,
        scheduledDepartureDateTimeUTC: data.scheduledDepartureDateTimeUTC,
        aircraftType: data.aircraftType,
      };

      setFlightData(loadedFlightData);
      form.reset({
        flightId: loadedFlightData.id,
        flightNumber: loadedFlightData.flightNumber,
        flightDate: loadedFlightData.scheduledDepartureDateTimeUTC,
        departureAirport: loadedFlightData.departureAirport,
        arrivalAirport: loadedFlightData.arrivalAirport,
        aircraftTypeRegistration: loadedFlightData.aircraftType,
        passengerLoad: { total: 0, adults: 0, infants: 0 },
        crewMembers: "",
        generalFlightSummary: "",
      });
      setIsLoading(false);
    };

    fetchFlightData();
  }, [flightId, user, authLoading, router, toast, form]);

  async function onSubmit(data: PurserReportFormValues) {
    if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in to submit a report.", variant: "destructive" });
      return;
    }
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
      };
      batch.set(reportRef, reportData);

      const flightRef = doc(db, "flights", data.flightId);
      batch.update(flightRef, { purserReportSubmitted: true, purserReportId: reportRef.id });

      await batch.commit();

      toast({
        title: "Report Submitted",
        description: "Your purser report has been successfully submitted.",
      });
      router.push("/my-purser-reports");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({ title: "Submission Failed", description: "Could not submit your report. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading Flight Data...</p>
      </div>
    );
  }

  const optionalSections: { name: keyof PurserReportFormValues, label: string, placeholder: string }[] = [
    { name: 'safetyIncidents', label: 'Safety Incidents', placeholder: 'Describe any safety-related incidents or concerns...' },
    { name: 'securityIncidents', label: 'Security Incidents', placeholder: 'Describe any security-related incidents or concerns...' },
    { name: 'medicalIncidents', label: 'Medical Incidents', placeholder: 'Describe any medical incidents, treatments administered, or requests for medical assistance...' },
    { name: 'passengerFeedback', label: 'Significant Passenger Feedback', placeholder: 'Note any notable positive or negative feedback from passengers...' },
    { name: 'cateringNotes', label: 'Catering Notes', placeholder: 'Note any issues with catering, stock levels, or special meal requests...' },
    { name: 'maintenanceIssues', label: 'Maintenance or Equipment Issues', placeholder: 'Describe any technical issues or malfunctioning cabin equipment...' },
    { name: 'crewPerformanceNotes', label: 'Crew Performance Notes', placeholder: 'Note any exceptional performance or areas for improvement within the crew...' },
    { name: 'otherObservations', label: 'Other Observations', placeholder: 'Any other notes or observations relevant to the flight...' },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <FileSignature className="mr-3 h-7 w-7 text-primary" />
              Purser Report for Flight {flightData?.flightNumber}
            </CardTitle>
            <CardDescription>
              {flightData?.departureAirportIATA || flightData?.departureAirport} to {flightData?.arrivalAirportIATA || flightData?.arrivalAirport} on {flightData ? format(parseISO(flightData.scheduledDepartureDateTimeUTC), "PPP") : '...'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-lg">Passenger & Crew Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="passengerLoad.total" render={({ field }) => (<FormItem><FormLabel>Total Passengers</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="passengerLoad.adults" render={({ field }) => (<FormItem><FormLabel>Adults</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="passengerLoad.infants" render={({ field }) => (<FormItem><FormLabel>Infants</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <FormField control={form.control} name="crewMembers" render={({ field }) => (<FormItem><FormLabel>Crew Members on Duty</FormLabel><FormControl><Textarea placeholder="List all crew members, e.g., John Doe (Purser), Jane Smith (Cabin Crew)..." {...field} /></FormControl><FormDescription>Please list names and roles.</FormDescription><FormMessage /></FormItem>)} />
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader><CardTitle className="text-lg">Flight Summary & Observations</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="generalFlightSummary" render={({ field }) => (<FormItem><FormLabel>General Flight Summary*</FormLabel><FormControl><Textarea placeholder="Describe the overall flight experience, punctuality, and any general observations..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <Accordion type="multiple" className="w-full">
                  {optionalSections.map((section) => (
                    <AccordionItem value={section.name} key={section.name}>
                       <AccordionTrigger>{section.label} (Optional)</AccordionTrigger>
                       <AccordionContent>
                         <FormField
                           control={form.control}
                           name={section.name as any}
                           render={({ field }) => (
                             <FormItem>
                               <FormControl>
                                 <Textarea placeholder={section.placeholder} {...field} />
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
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Report...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Submit Report
                </>
              )}
            </Button>
        </div>
      </form>
    </Form>
  );
}

