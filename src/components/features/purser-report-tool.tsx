
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
import { Loader2, Sparkles, ClipboardList, Users, PlusCircle, Trash2 } from "lucide-react";
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

const PLACEHOLDER_NONE_VALUE = "_NONE_"; 

const reportSectionTypes = [
  "Safety Incidents",
  "Security Incidents",
  "Medical Incidents",
  "Passenger Feedback",
  "Catering Notes",
  "Maintenance Issues",
  "Other Observations",
] as const;
type ReportSectionType = typeof reportSectionTypes[number];

interface AddedSection {
  id: string;
  type: ReportSectionType;
  content: string;
}

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
  // Dynamic sections will be handled outside the main form schema for Zod, managed by local state
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

  // State for dynamic sections
  const [addedSections, setAddedSections] = React.useState<AddedSection[]>([]);
  const [currentSectionType, setCurrentSectionType] = React.useState<ReportSectionType | "">("");
  const [currentSectionContent, setCurrentSectionContent] = React.useState("");

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

  const handleAddSection = () => {
    if (!currentSectionType) {
      toast({ title: "Missing Type", description: "Please select a section type.", variant: "destructive" });
      return;
    }
    if (!currentSectionContent.trim()) {
      toast({ title: "Missing Content", description: "Please enter content for the section.", variant: "destructive" });
      return;
    }
    setAddedSections([...addedSections, { id: Date.now().toString(), type: currentSectionType, content: currentSectionContent.trim() }]);
    setCurrentSectionType("");
    setCurrentSectionContent("");
  };

  const handleRemoveSection = (id: string) => {
    setAddedSections(addedSections.filter(section => section.id !== id));
  };


  async function onSubmit(data: PurserReportFormValues) {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to submit a purser report.",
        variant: "destructive",
      });
      return;
    }
    if (addedSections.length === 0 && !data.generalFlightSummary) {
        toast({ title: "Empty Report", description: "Please provide a general flight summary or add at least one report section.", variant: "default" });
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

    const dynamicSections: Partial<PurserReportInput> = {};
    addedSections.forEach(section => {
        switch (section.type) {
            case "Safety Incidents": dynamicSections.safetyIncidents = (dynamicSections.safetyIncidents ? dynamicSections.safetyIncidents + "\n\n---\n\n" : "") + section.content; break;
            case "Security Incidents": dynamicSections.securityIncidents = (dynamicSections.securityIncidents ? dynamicSections.securityIncidents + "\n\n---\n\n" : "") + section.content; break;
            case "Medical Incidents": dynamicSections.medicalIncidents = (dynamicSections.medicalIncidents ? dynamicSections.medicalIncidents + "\n\n---\n\n" : "") + section.content; break;
            case "Passenger Feedback": dynamicSections.passengerFeedback = (dynamicSections.passengerFeedback ? dynamicSections.passengerFeedback + "\n\n---\n\n" : "") + section.content; break;
            case "Catering Notes": dynamicSections.cateringNotes = (dynamicSections.cateringNotes ? dynamicSections.cateringNotes + "\n\n---\n\n" : "") + section.content; break;
            case "Maintenance Issues": dynamicSections.maintenanceIssues = (dynamicSections.maintenanceIssues ? dynamicSections.maintenanceIssues + "\n\n---\n\n" : "") + section.content; break;
            case "Other Observations": dynamicSections.otherObservations = (dynamicSections.otherObservations ? dynamicSections.otherObservations + "\n\n---\n\n" : "") + section.content; break;
        }
    });


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
      ...dynamicSections, // Spread the dynamically created sections
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
       form.reset(); // Reset main form
       setAddedSections([]); // Clear dynamic sections
       setCurrentSectionType("");
       setCurrentSectionContent("");


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
              <CardDescription>Provide details for each relevant section of the report by adding them below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="generalFlightSummary" render={({ field }) => (
                <FormItem><FormLabel>General Flight Summary</FormLabel><FormControl><Textarea placeholder="Overall flight conduct, punctuality, service notes..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Separator />
              <div className="space-y-4 p-4 border rounded-md">
                <h3 className="text-md font-semibold">Add Report Section</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <FormItem>
                        <FormLabel>Section Type</FormLabel>
                        <Select value={currentSectionType} onValueChange={(value) => setCurrentSectionType(value as ReportSectionType)}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select section type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {reportSectionTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                     <Button type="button" onClick={handleAddSection} className="self-end" disabled={!currentSectionType || !currentSectionContent.trim()}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Section
                    </Button>
                </div>
                <FormItem>
                    <FormLabel>Section Content</FormLabel>
                    <Textarea 
                        placeholder="Enter details for the selected section type..." 
                        className="min-h-[100px]" 
                        value={currentSectionContent}
                        onChange={(e) => setCurrentSectionContent(e.target.value)}
                    />
                </FormItem>
              </div>
              
              {addedSections.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-md font-semibold">Added Sections:</h3>
                  {addedSections.map((section) => (
                    <Card key={section.id} className="p-3 bg-muted/50">
                      <div className="flex justify-between items-center mb-1">
                        <CardTitle className="text-sm font-medium">{section.type}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveSection(section.id)} className="h-6 w-6 text-destructive hover:text-destructive/80">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.content}</p>
                    </Card>
                  ))}
                </div>
              )}

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

    