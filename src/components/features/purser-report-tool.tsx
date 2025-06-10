
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
import { Loader2, Sparkles, ClipboardList, Users } from "lucide-react";
import { generatePurserReport, type PurserReportOutput, type PurserReportInput } from "@/ai/flows/purser-report-flow";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CrewUser {
  uid: string;
  name: string;
}

const PLACEHOLDER_NONE_VALUE = "_NONE_"; // Sentinel value for no selection

const purserReportFormSchema = z.object({
  flightNumber: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars"),
  flightDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format. Use YYYY-MM-DD." }),
  departureAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  arrivalAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  aircraftTypeRegistration: z.string().min(3, "Min 3 chars").max(20, "Max 20 chars").describe("e.g., B789 G-XYZC"),
  
  captainName: z.string().optional(),
  firstOfficerName: z.string().optional(),
  purserName: z.string().refine(val => val !== PLACEHOLDER_NONE_VALUE && val.trim() !== "", { message: "Supervising crew (Purser/Instructor) selection is required."}),
  cabinCrewR1: z.string().optional(),
  cabinCrewL2: z.string().optional(),
  cabinCrewR2: z.string().optional(),
  otherCrewMembers: z.string().optional(),

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
  const { user } = useAuth();
  
  const [pilotsList, setPilotsList] = React.useState<CrewUser[]>([]);
  const [isLoadingPilots, setIsLoadingPilots] = React.useState(true);
  
  const [supervisingCrewList, setSupervisingCrewList] = React.useState<CrewUser[]>([]);
  const [isLoadingSupervisingCrew, setIsLoadingSupervisingCrew] = React.useState(true);

  const [cabinCrewList, setCabinCrewList] = React.useState<CrewUser[]>([]);
  const [isLoadingCabinCrew, setIsLoadingCabinCrew] = React.useState(true);

  const defaultDate = () => new Date().toISOString().split('T')[0];

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
      flightNumber: "BA245",
      flightDate: defaultDate(),
      departureAirport: "LHR",
      arrivalAirport: "JFK",
      aircraftTypeRegistration: "B789 G-ABCD",
      
      captainName: PLACEHOLDER_NONE_VALUE, 
      firstOfficerName: PLACEHOLDER_NONE_VALUE,
      purserName: PLACEHOLDER_NONE_VALUE, 
      cabinCrewR1: PLACEHOLDER_NONE_VALUE,
      cabinCrewL2: PLACEHOLDER_NONE_VALUE,
      cabinCrewR2: PLACEHOLDER_NONE_VALUE,
      otherCrewMembers: "",

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

  React.useEffect(() => {
    const fetchCrew = async (
      roles: string | string[], 
      setList: React.Dispatch<React.SetStateAction<CrewUser[]>>, 
      setLoading: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
      setLoading(true);
      try {
        const usersCollectionRef = collection(db, "users");
        let q;
        if (Array.isArray(roles)) {
          q = query(usersCollectionRef, where("role", "in", roles), where("accountStatus", "==", "active"));
        } else {
          q = query(usersCollectionRef, where("role", "==", roles), where("accountStatus", "==", "active"));
        }
        
        const querySnapshot = await getDocs(q);
        const fetchedCrew: CrewUser[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedCrew.push({
            uid: doc.id,
            name: data.fullName || data.displayName || `Unnamed User (${doc.id.substring(0,5)})`,
          });
        });
        setList(fetchedCrew.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error(`Error fetching crew for role(s) ${JSON.stringify(roles)}:`, error);
        const roleName = Array.isArray(roles) ? roles.join('/') : roles;
        toast({
          title: "Error",
          description: `Could not load ${roleName} list for selection.`,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchCrew("pilote", setPilotsList, setIsLoadingPilots);
    fetchCrew(["purser", "instructor"], setSupervisingCrewList, setIsLoadingSupervisingCrew);
    fetchCrew("cabin crew", setCabinCrewList, setIsLoadingCabinCrew);
  }, [toast]);

  async function onSubmit(data: PurserReportFormValues) {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to submit a purser report.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setReportResult(null);

    const crewDetailsParts = [
      data.captainName && data.captainName !== PLACEHOLDER_NONE_VALUE ? `Captain: ${data.captainName}` : null,
      data.firstOfficerName && data.firstOfficerName !== PLACEHOLDER_NONE_VALUE  ? `First Officer: ${data.firstOfficerName}` : null,
      data.purserName && data.purserName !== PLACEHOLDER_NONE_VALUE ? `Supervising Crew: ${data.purserName}` : null,
      data.cabinCrewR1 && data.cabinCrewR1 !== PLACEHOLDER_NONE_VALUE ? `R1: ${data.cabinCrewR1}` : null,
      data.cabinCrewL2 && data.cabinCrewL2 !== PLACEHOLDER_NONE_VALUE ? `L2: ${data.cabinCrewL2}` : null,
      data.cabinCrewR2 && data.cabinCrewR2 !== PLACEHOLDER_NONE_VALUE ? `R2: ${data.cabinCrewR2}` : null,
      data.otherCrewMembers ? `Other Crew: ${data.otherCrewMembers}` : null,
    ];
    const crewMembersString = crewDetailsParts.filter(Boolean).join('\n');

    const aiInput: PurserReportInput = {
      flightNumber: data.flightNumber,
      flightDate: new Date(data.flightDate).toISOString().split('T')[0],
      departureAirport: data.departureAirport,
      arrivalAirport: data.arrivalAirport,
      aircraftTypeRegistration: data.aircraftTypeRegistration,
      crewMembers: crewMembersString,
      passengerLoad: {
        total: Number(data.passengerLoad.total),
        adults: Number(data.passengerLoad.adults),
        children: Number(data.passengerLoad.children),
        infants: Number(data.passengerLoad.infants),
      },
      generalFlightSummary: data.generalFlightSummary,
      safetyIncidents: data.safetyIncidents,
      securityIncidents: data.securityIncidents,
      medicalIncidents: data.medicalIncidents,
      passengerFeedback: data.passengerFeedback,
      cateringNotes: data.cateringNotes,
      maintenanceIssues: data.maintenanceIssues,
      otherObservations: data.otherObservations,
    };

    try {
      const generatedReport = await generatePurserReport(aiInput);
      setReportResult(generatedReport);
      toast({
        title: "Purser Report Generated by AI",
        description: "Report is ready for review below. Now saving to database...",
      });

      await addDoc(collection(db, "purserReports"), {
        reportInput: aiInput,
        reportOutput: generatedReport,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        status: "submitted", 
      });

      toast({
        title: "Purser Report Saved",
        description: "Your report has been successfully generated and saved to the database.",
      });

    } catch (error) {
      console.error("Error in Purser Report process:", error);
      let errorMessage = "An error occurred during the Purser Report process. Please try again.";
      if (error instanceof Error) {
        if (reportResult) { 
            errorMessage = `AI report generated, but failed to save to database: ${error.message}`;
        } else { 
            errorMessage = `Failed to generate AI Purser Report: ${error.message}`;
        }
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
              <CardDescription>Enter the core details of the flight.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="flightNumber" render={({ field }) => (
                  <FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input placeholder="e.g., BA245" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="flightDate" render={({ field }) => (
                  <FormItem><FormLabel>Flight Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="aircraftTypeRegistration" render={({ field }) => (
                  <FormItem><FormLabel>Aircraft Type & Registration</FormLabel><FormControl><Input placeholder="e.g., B789 G-ABCD" {...field} /></FormControl><FormDescription>Type and registration (e.g., B787 G-XYZC)</FormDescription><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="departureAirport" render={({ field }) => (
                  <FormItem><FormLabel>Departure Airport (From)</FormLabel><FormControl><Input placeholder="e.g., LHR" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="arrivalAirport" render={({ field }) => (
                  <FormItem><FormLabel>Arrival Airport (To)</FormLabel><FormControl><Input placeholder="e.g., JFK" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Crew Information</CardTitle>
              <CardDescription>List the operating crew members for this flight.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="captainName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Captain's Name</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_NONE_VALUE ? "" : value)} 
                        value={field.value || PLACEHOLDER_NONE_VALUE} 
                        disabled={isLoadingPilots}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingPilots ? "Loading pilots..." : "Select Captain"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>
                          {pilotsList.map((pilot) => (
                            <SelectItem key={pilot.uid} value={pilot.name}>
                              {pilot.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Optional. Select from available pilots.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="firstOfficerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Officer's Name</FormLabel>
                       <Select 
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_NONE_VALUE ? "" : value)} 
                        value={field.value || PLACEHOLDER_NONE_VALUE} 
                        disabled={isLoadingPilots}
                       >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingPilots ? "Loading pilots..." : "Select First Officer"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           <SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>
                          {pilotsList.map((pilot) => (
                            <SelectItem key={pilot.uid} value={pilot.name}>
                              {pilot.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Optional. Select from available pilots.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField 
                  control={form.control} 
                  name="purserName" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supervising Crew (Purser/Instructor)*</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || PLACEHOLDER_NONE_VALUE}
                        disabled={isLoadingSupervisingCrew}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingSupervisingCrew ? "Loading crew..." : "Select Purser or Instructor"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PLACEHOLDER_NONE_VALUE} disabled>Select Supervising Crew</SelectItem>
                          {supervisingCrewList.map((crew) => (
                            <SelectItem key={crew.uid} value={crew.name}>
                              {crew.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="cabinCrewR1" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cabin Crew (R1)</FormLabel>
                    <Select 
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_NONE_VALUE ? "" : value)} 
                        value={field.value || PLACEHOLDER_NONE_VALUE} 
                        disabled={isLoadingCabinCrew}
                    >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingCabinCrew ? "Loading crew..." : "Select R1"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>
                          {cabinCrewList.map((crew) => (
                            <SelectItem key={crew.uid} value={crew.name}>
                              {crew.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormDescription>Optional</FormDescription><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cabinCrewL2" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cabin Crew (L2)</FormLabel>
                    <Select 
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_NONE_VALUE ? "" : value)} 
                        value={field.value || PLACEHOLDER_NONE_VALUE} 
                        disabled={isLoadingCabinCrew}
                    >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingCabinCrew ? "Loading crew..." : "Select L2"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>
                          {cabinCrewList.map((crew) => (
                            <SelectItem key={crew.uid} value={crew.name}>
                              {crew.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormDescription>Optional</FormDescription><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cabinCrewR2" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cabin Crew (R2)</FormLabel>
                     <Select 
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_NONE_VALUE ? "" : value)} 
                        value={field.value || PLACEHOLDER_NONE_VALUE} 
                        disabled={isLoadingCabinCrew}
                     >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingCabinCrew ? "Loading crew..." : "Select R2"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>
                          {cabinCrewList.map((crew) => (
                            <SelectItem key={crew.uid} value={crew.name}>
                              {crew.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormDescription>Optional</FormDescription><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="otherCrewMembers" render={({ field }) => (
                <FormItem><FormLabel>Other Crew Members / Notes</FormLabel><FormControl><Textarea placeholder="List any additional crew or specific roles/notes..." {...field} /></FormControl><FormDescription>Optional. E.g., L1: S. King, Additional FA: P. White (if not in lists)</FormDescription><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Passenger Load</CardTitle>
              <CardDescription>Specify the number of passengers by category.</CardDescription>
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
              <CardTitle className="text-xl">Report Sections</CardTitle>
              <CardDescription>Provide details for each relevant section of the report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="generalFlightSummary" render={({ field }) => (
                <FormItem><FormLabel>General Flight Summary</FormLabel><FormControl><Textarea placeholder="Overall flight conduct, punctuality, service notes..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="safetyIncidents" render={({ field }) => (
                <FormItem><FormLabel>Safety Incidents/Observations</FormLabel><FormControl><Textarea placeholder="Detail any safety-related events or concerns..." className="min-h-[100px]" {...field} /></FormControl><FormDescription>Optional. E.g., turbulence, equipment malfunctions affecting safety.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="securityIncidents" render={({ field }) => (
                <FormItem><FormLabel>Security Incidents/Observations</FormLabel><FormControl><Textarea placeholder="Detail any security-related events..." className="min-h-[100px]" {...field} /></FormControl><FormDescription>Optional. E.g., unruly passengers, security breaches.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="medicalIncidents" render={({ field }) => (
                <FormItem><FormLabel>Medical Incidents</FormLabel><FormControl><Textarea placeholder="Describe any medical events and actions taken..." className="min-h-[100px]" {...field} /></FormControl><FormDescription>Optional. E.g., passenger fainted, first aid administered.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="passengerFeedback" render={({ field }) => (
                <FormItem><FormLabel>Passenger Feedback (Notable)</FormLabel><FormControl><Textarea placeholder="Summarize significant positive or negative feedback..." className="min-h-[100px]" {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cateringNotes" render={({ field }) => (
                <FormItem><FormLabel>Catering Notes</FormLabel><FormControl><Textarea placeholder="Comments on meal service, quality, quantity, issues..." className="min-h-[100px]" {...field} /></FormControl><FormDescription>Optional</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="maintenanceIssues" render={({ field }) => (
                <FormItem><FormLabel>Maintenance Issues Noted</FormLabel><FormControl><Textarea placeholder="Describe any aircraft defects or issues observed..." className="min-h-[100px]" {...field} /></FormControl><FormDescription>Optional. E.g., broken seat recline, IFE malfunction.</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="otherObservations" render={({ field }) => (
                <FormItem><FormLabel>Other Observations/Information</FormLabel><FormControl><Textarea placeholder="Any other relevant details not covered above..." className="min-h-[100px]" {...field} /></FormControl><FormDescription>Optional. E.g., ground handling issues, customs/immigration delays.</FormDescription><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>
          
          <Button type="submit" disabled={isLoading || !form.formState.isValid || !user} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating & Saving...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate & Save AI Report
              </>
            )}
          </Button>
          {!user && (
            <p className="text-sm text-destructive">Please log in to submit a purser report.</p>
          )}
        </form>
      </Form>

      {reportResult && (
        <Card className="mt-8 shadow-md bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <ClipboardList className="mr-2 h-6 w-6 text-primary" />
              AI-Generated Purser Report
            </CardTitle>
            <CardDescription>Review the report generated by AI. This has been saved to the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Full Report (Markdown):</h3>
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

