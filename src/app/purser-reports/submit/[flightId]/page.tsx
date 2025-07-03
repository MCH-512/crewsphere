
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature, Loader2, Send, PlusCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, writeBatch } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { purserReportFormSchema, type PurserReportFormValues, optionalReportSections } from "@/schemas/purser-report-schema";
import { format, parseISO } from "date-fns";
import { getAirportByCode } from "@/services/airport-service";
import { Separator } from "@/components/ui/separator";
import { logAuditEvent } from "@/lib/audit-logger";

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

type OptionalSectionName = typeof optionalReportSections[number]['name'];

export default function SubmitPurserReportPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flightId = params.flightId as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [flightData, setFlightData] = React.useState<FlightForReport | null>(null);
  const [visibleSections, setVisibleSections] = React.useState<Set<OptionalSectionName>>(new Set());

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
      passengerLoad: { total: 0, adults: 0, infants: 0 },
      crewMembers: "",
      generalFlightSummary: "",
    },
    mode: "onChange",
  });

  const toggleSection = (sectionName: OptionalSectionName) => {
    setVisibleSections(prev => {
        const newSet = new Set(prev);
        if (newSet.has(sectionName)) {
            newSet.delete(sectionName);
            form.setValue(sectionName, undefined);
        } else {
            newSet.add(sectionName);
        }
        return newSet;
    });
  };

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
      
      const data = flightSnap.data();
      const depAirportInfo = await getAirportByCode(data.departureAirport);
      const arrAirportInfo = await getAirportByCode(data.arrivalAirport);
      
      const loadedFlightData: FlightForReport = {
        id: flightSnap.id, flightNumber: data.flightNumber,
        departureAirport: data.departureAirport, departureAirportIATA: depAirportInfo?.iata,
        arrivalAirport: data.arrivalAirport, arrivalAirportIATA: arrAirportInfo?.iata,
        scheduledDepartureDateTimeUTC: data.scheduledDepartureDateTimeUTC, aircraftType: data.aircraftType,
      };

      setFlightData(loadedFlightData);
      form.reset({
        flightId: loadedFlightData.id, flightNumber: loadedFlightData.flightNumber, flightDate: loadedFlightData.scheduledDepartureDateTimeUTC,
        departureAirport: loadedFlightData.departureAirport, arrivalAirport: loadedFlightData.arrivalAirport, aircraftTypeRegistration: loadedFlightData.aircraftType,
        passengerLoad: { total: 0, adults: 0, infants: 0 }, crewMembers: "", generalFlightSummary: "",
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
      const reportData = { ...data, userId: user.uid, userEmail: user.email, createdAt: new Date(), status: 'submitted', adminNotes: '' };
      batch.set(reportRef, reportData);

      const flightRef = doc(db, "flights", data.flightId);
      batch.update(flightRef, { purserReportSubmitted: true, purserReportId: reportRef.id });
      
      await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: 'SUBMIT_PURSER_REPORT', entityType: 'PURSER_REPORT', entityId: reportRef.id, details: { flightNumber: data.flightNumber } });

      await batch.commit();
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
            <FormField control={form.control} name="crewMembers" render={({ field }) => (<FormItem><FormLabel>Crew Members on Duty*</FormLabel><FormControl><Textarea placeholder="List all crew members, e.g., John Doe (Purser), Jane Smith (Cabin Crew)..." {...field} /></FormControl><FormDescription>Please list names and roles.</FormDescription><FormMessage /></FormItem>)} />
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
            <CardDescription>Add sections for any specific incidents or notes that occurred during the flight.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {optionalReportSections.map(({ name, label, icon: Icon }) => (
                    <Button key={name} type="button" variant={visibleSections.has(name) ? "secondary" : "outline"} onClick={() => toggleSection(name)}>
                        <Icon className="mr-2 h-4 w-4"/> {label}
                    </Button>
                ))}
            </div>
            <Separator />
            <div className="space-y-6">
            {optionalReportSections.map(({ name, label, placeholder, icon: Icon }) => (
              visibleSections.has(name) && (
                <div key={name} className="space-y-2 border-l-4 pl-4 py-2 border-primary/50 bg-muted/30 rounded-r-md">
                   <div className="flex justify-between items-center">
                    <FormLabel className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary"/>{label}</FormLabel>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => toggleSection(name)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                  <FormField
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea placeholder={placeholder} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )
            ))}
            </div>
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
