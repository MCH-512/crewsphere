
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, ClipboardList, AlertTriangle } from "lucide-react";
import { generatePurserReport, type PurserReportOutput, type PurserReportInput } from "@/ai/flows/purser-report-flow";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const purserReportFormSchema = z.object({
  flightNumber: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars"),
  flightDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format. Use YYYY-MM-DD." }),
  departureAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  arrivalAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  aircraftTypeRegistration: z.string().min(3, "Min 3 chars").max(20, "Max 20 chars"),
  crewMembers: z.string().min(10, "Please list crew members."),
  passengerLoad: z.object({
    total: z.coerce.number().int().min(0, "Min 0 passengers"),
    adults: z.coerce.number().int().min(0, "Min 0 adults"),
    children: z.coerce.number().int().min(0, "Min 0 children"),
    infants: z.coerce.number().int().min(0, "Min 0 infants"),
  }),
  generalFlightSummary: z.string().min(10, "Min 10 characters for summary."),
  safetyIncidents: z.string().optional(),
  securityIncidents: z.string().optional(),
  medicalIncidents: z.string().optional(),
  passengerFeedback: z.string().optional(),
  cateringNotes: z.string().optional(),
  maintenanceIssues: z.string().optional(),
  otherObservations: z.string().optional(),
});

type PurserReportFormValues = z.infer<typeof purserReportFormSchema>;

export function PurserReportTool() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [reportResult, setReportResult] = React.useState<PurserReportOutput | null>(null);
  const { toast } = useToast();

  const defaultDate = () => new Date().toISOString().split('T')[0];

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
      flightNumber: "BA245",
      flightDate: defaultDate(),
      departureAirport: "LHR",
      arrivalAirport: "JFK",
      aircraftTypeRegistration: "B789 G-ABCD",
      crewMembers: "Purser: J.Smith, CS: A.Lee, C.Davis, FA: M.Jones, K.Patel",
      passengerLoad: { total: 200, adults: 180, children: 15, infants: 5 },
      generalFlightSummary: "Flight was on time and smooth. Cabin service completed efficiently.",
      safetyIncidents: "",
      securityIncidents: "",
      medicalIncidents: "",
      passengerFeedback: "",
      cateringNotes: "",
      maintenanceIssues: "",
      otherObservations: "",
    },
  });

  async function onSubmit(data: PurserReportFormValues) {
    setIsLoading(true);
    setReportResult(null);
    try {
      const input: PurserReportInput = {
        ...data,
        flightDate: new Date(data.flightDate).toISOString().split('T')[0], // Ensure date is in YYYY-MM-DD
      };
      const result = await generatePurserReport(input);
      setReportResult(result);
      toast({
        title: "Purser Report Generated",
        description: "AI-generated report is ready for review.",
      });
    } catch (error) {
      console.error("Error generating Purser Report:", error);
      let errorMessage = "Failed to generate Purser Report. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Flight Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="flightNumber" render={({ field }) => (
                  <FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input placeholder="e.g., BA245" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="flightDate" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="aircraftTypeRegistration" render={({ field }) => (
                  <FormItem><FormLabel>Aircraft Type & Registration</FormLabel><FormControl><Input placeholder="e.g., B789 G-ABCD" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="departureAirport" render={({ field }) => (
                  <FormItem><FormLabel>Departure Airport</FormLabel><FormControl><Input placeholder="e.g., LHR" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="arrivalAirport" render={({ field }) => (
                  <FormItem><FormLabel>Arrival Airport</FormLabel><FormControl><Input placeholder="e.g., JFK" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
               <FormField control={form.control} name="crewMembers" render={({ field }) => (
                <FormItem><FormLabel>Crew Members (Names & Roles)</FormLabel><FormControl><Textarea placeholder="Purser: J.Smith, CS: A.Lee, FA: M.Jones..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Passenger Load</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField control={form.control} name="passengerLoad.total" render={({ field }) => (
                <FormItem><FormLabel>Total</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="passengerLoad.adults" render={({ field }) => (
                <FormItem><FormLabel>Adults</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="passengerLoad.children" render={({ field }) => (
                <FormItem><FormLabel>Children</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="passengerLoad.infants" render={({ field }) => (
                <FormItem><FormLabel>Infants</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="generalFlightSummary" render={({ field }) => (
                <FormItem><FormLabel>General Flight Summary</FormLabel><FormControl><Textarea placeholder="Overall flight conduct, punctuality, service notes..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="safetyIncidents" render={({ field }) => (
                <FormItem><FormLabel>Safety Incidents/Observations</FormLabel><FormControl><Textarea placeholder="Detail any safety-related events or concerns..." {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="securityIncidents" render={({ field }) => (
                <FormItem><FormLabel>Security Incidents/Observations</FormLabel><FormControl><Textarea placeholder="Detail any security-related events..." {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="medicalIncidents" render={({ field }) => (
                <FormItem><FormLabel>Medical Incidents</FormLabel><FormControl><Textarea placeholder="Describe any medical events and actions taken..." {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="passengerFeedback" render={({ field }) => (
                <FormItem><FormLabel>Passenger Feedback (Notable)</FormLabel><FormControl><Textarea placeholder="Summarize significant positive or negative feedback..." {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cateringNotes" render={({ field }) => (
                <FormItem><FormLabel>Catering Notes</FormLabel><FormControl><Textarea placeholder="Comments on meal service, quality, quantity, issues..." {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="maintenanceIssues" render={({ field }) => (
                <FormItem><FormLabel>Maintenance Issues Noted</FormLabel><FormControl><Textarea placeholder="Describe any aircraft defects or issues observed..." {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="otherObservations" render={({ field }) => (
                <FormItem><FormLabel>Other Observations/Information</FormLabel><FormControl><Textarea placeholder="Any other relevant details not covered above..." {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>
          
          <Button type="submit" disabled={isLoading || !form.formState.isValid} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Purser Report
              </>
            )}
          </Button>
        </form>
      </Form>

      {reportResult && (
        <Card className="mt-8 shadow-md bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <ClipboardList className="mr-2 h-6 w-6 text-primary" />
              AI-Generated Purser Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Full Report:</h3>
              <div className="prose prose-sm max-w-none dark:prose-invert text-foreground p-4 border rounded-md bg-background">
                <pre className="whitespace-pre-wrap font-sans text-sm">{reportResult.formattedReport}</pre>
              </div>
            </div>
            {reportResult.keyHighlights && reportResult.keyHighlights.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Key Highlights:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {reportResult.keyHighlights.map((highlight, index) => (
                    <li key={index} className="p-2 border-l-4 border-primary bg-background rounded-r-md">{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

