
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
import { Loader2, Sparkles, ClipboardList, Users, PlusCircle, Trash2, MessageSquareQuote, PlaneTakeoff } from "lucide-react";
import { generatePurserReport, type PurserReportOutput, type PurserReportInput } from "@/ai/flows/purser-report-flow";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, where, doc, getDoc, updateDoc } from "firebase/firestore"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, parseISO } from "date-fns";

interface CrewUser {
  uid: string;
  name: string;
}

interface FlightForSelection {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDepartureDateTimeUTC: string; // ISO string
  aircraftType: string;
  // Potential future fields for crew UIDs if available directly in list:
  // assignedCaptainUid?: string;
  // assignedPurserUid?: string;
  // ... etc.
}

// Define a more detailed flight document structure, assuming these fields exist in Firestore for a single flight.
// This is a SUPPOSITION for the pre-filling logic.
interface FullFlightData extends FlightForSelection {
    assignedCaptainUid?: string;
    assignedFirstOfficerUid?: string;
    assignedPurserUid?: string;
    assignedCabinCrewR1Uid?: string;
    assignedCabinCrewL2Uid?: string;
    assignedCabinCrewR2Uid?: string;
    // other flight details...
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

type CrewRoleForEval = 'R1' | 'L2' | 'R2';
interface AddedCrewEvaluation {
    id: string;
    crewMemberRole: CrewRoleForEval;
    crewMemberName: string;
    evaluation: string;
}

const passengerLoadSchema = z.object({
  total: z.coerce.number().int().min(0, "Min 0 passengers"),
  adults: z.coerce.number().int().min(0, "Min 0 adults"),
  children: z.coerce.number().int().min(0, "Min 0 children"),
  infants: z.coerce.number().int().min(0, "Min 0 infants"),
}).superRefine((data, ctx) => {
  const sumOfParts = data.adults + data.children + data.infants;
  if (data.total < sumOfParts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total (${data.total}) cannot be less than the sum of Adults, Children, and Infants (${sumOfParts}).`,
      path: ["total"],
    });
  }
});


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

  passengerLoad: passengerLoadSchema, 
  generalFlightSummary: z.string().min(10, "Min 10 characters for summary."),
});

type PurserReportFormValues = z.infer<typeof purserReportFormSchema>;

export function PurserReportTool() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [reportResult, setReportResult] = React.useState<PurserReportOutput | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [availableFlights, setAvailableFlights] = React.useState<FlightForSelection[]>([]);
  const [isLoadingFlights, setIsLoadingFlights] = React.useState(true);
  const [selectedFlightIdState, setSelectedFlightIdState] = React.useState<string | null>(null);

  const [pilotsList, setPilotsList] = React.useState<CrewUser[]>([]);
  const [isLoadingPilots, setIsLoadingPilots] = React.useState(true);
  
  const [supervisingCrewList, setSupervisingCrewList] = React.useState<CrewUser[]>([]);
  const [isLoadingSupervisingCrew, setIsLoadingSupervisingCrew] = React.useState(true);

  const [cabinCrewList, setCabinCrewList] = React.useState<CrewUser[]>([]);
  const [isLoadingCabinCrew, setIsLoadingCabinCrew] = React.useState(true);

  const [addedSections, setAddedSections] = React.useState<AddedSection[]>([]);
  const [currentSectionType, setCurrentSectionType] = React.useState<ReportSectionType | "">("");
  const [currentSectionContent, setCurrentSectionContent] = React.useState("");

  const [addedCrewEvaluations, setAddedCrewEvaluations] = React.useState<AddedCrewEvaluation[]>([]);
  const [currentEvalCrewMemberRole, setCurrentEvalCrewMemberRole] = React.useState<CrewRoleForEval | "">("");
  const [currentEvalContent, setCurrentEvalContent] = React.useState("");

  const defaultDate = () => new Date().toISOString().split('T')[0];

  const form = useForm<PurserReportFormValues>({
    resolver: zodResolver(purserReportFormSchema),
    defaultValues: {
      flightNumber: "",
      flightDate: defaultDate(),
      departureAirport: "",
      arrivalAirport: "",
      aircraftTypeRegistration: "",
      captainName: PLACEHOLDER_NONE_VALUE, 
      firstOfficerName: PLACEHOLDER_NONE_VALUE,
      purserName: PLACEHOLDER_NONE_VALUE, 
      cabinCrewR1: PLACEHOLDER_NONE_VALUE,
      cabinCrewL2: PLACEHOLDER_NONE_VALUE,
      cabinCrewR2: PLACEHOLDER_NONE_VALUE,
      otherCrewMembers: "",
      passengerLoad: { total: 0, adults: 0, children: 0, infants: 0 },
      generalFlightSummary: "",
    },
    mode: "onChange", 
  });

  React.useEffect(() => {
    const fetchInitialFlights = async () => {
      setIsLoadingFlights(true);
      try {
        const flightsQuery = query(collection(db, "flights"), orderBy("scheduledDepartureDateTimeUTC", "desc"), limit(50)); 
        const querySnapshot = await getDocs(flightsQuery);
        const fetchedFlightsData: FlightForSelection[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedFlightsData.push({
            id: doc.id,
            flightNumber: data.flightNumber,
            departureAirport: data.departureAirport,
            arrivalAirport: data.arrivalAirport,
            scheduledDepartureDateTimeUTC: data.scheduledDepartureDateTimeUTC,
            aircraftType: data.aircraftType,
          });
        });
        setAvailableFlights(fetchedFlightsData);
      } catch (error) {
        console.error("Error fetching available flights:", error);
        toast({ title: "Error", description: "Could not load available flights.", variant: "destructive" });
      } finally { setIsLoadingFlights(false); }
    };
    if (user) { fetchInitialFlights(); }
  }, [toast, user]);

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
        let rolesToQuery: string[] = [];
        if (Array.isArray(roles) && roles.includes("purser") && roles.includes("instructor")) {
            rolesToQuery = ["purser", "Purser", "instructor", "Instructor"]; 
        } else if (typeof roles === 'string') {
            rolesToQuery = [roles, roles.charAt(0).toUpperCase() + roles.slice(1)]; 
        } else if (Array.isArray(roles)) {
            rolesToQuery = roles.flatMap(role => [role, role.charAt(0).toUpperCase() + role.slice(1)]);
        }
        q = query(usersCollectionRef, where("role", "in", rolesToQuery), where("accountStatus", "==", "active"));
        const querySnapshot = await getDocs(q);
        const fetchedCrew: CrewUser[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedCrew.push({ uid: doc.id, name: data.fullName || data.displayName || `Unnamed User (${doc.id.substring(0,5)})` });
        });
        setList(fetchedCrew.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error(`Error fetching crew for role(s) ${JSON.stringify(roles)}:`, error);
        const roleName = Array.isArray(roles) ? roles.join('/') : roles;
        toast({ title: "Error", description: `Could not load ${roleName} list.`, variant: "destructive" });
      } finally { setLoading(false); }
    };
   if (user) {
      fetchCrew("pilote", setPilotsList, setIsLoadingPilots);
      fetchCrew(["purser", "instructor"], setSupervisingCrewList, setIsLoadingSupervisingCrew); 
      fetchCrew("cabin crew", setCabinCrewList, setIsLoadingCabinCrew);
    }
  }, [toast, user]);

  const handleFlightSelection = async (flightId: string) => {
    if (flightId === "_MANUAL_ENTRY_") {
        form.reset({ 
            ...form.getValues(), 
            flightNumber: "", 
            flightDate: defaultDate(), 
            departureAirport: "", 
            arrivalAirport: "", 
            aircraftTypeRegistration: "",
            captainName: PLACEHOLDER_NONE_VALUE,
            firstOfficerName: PLACEHOLDER_NONE_VALUE,
            purserName: PLACEHOLDER_NONE_VALUE,
            cabinCrewR1: PLACEHOLDER_NONE_VALUE,
            cabinCrewL2: PLACEHOLDER_NONE_VALUE,
            cabinCrewR2: PLACEHOLDER_NONE_VALUE,
        });
        setSelectedFlightIdState(null); 
        return;
    }
    const selectedFlightBasic = availableFlights.find(f => f.id === flightId);
    if (selectedFlightBasic) {
        // Pre-fill basic flight info
        form.setValue("flightNumber", selectedFlightBasic.flightNumber);
        form.setValue("flightDate", new Date(selectedFlightBasic.scheduledDepartureDateTimeUTC).toISOString().split('T')[0]);
        form.setValue("departureAirport", selectedFlightBasic.departureAirport);
        form.setValue("arrivalAirport", selectedFlightBasic.arrivalAirport);
        form.setValue("aircraftTypeRegistration", selectedFlightBasic.aircraftType); 
        setSelectedFlightIdState(flightId);

        // Attempt to pre-fill crew info by fetching full flight document
        // This assumes the flight document in Firestore contains assignedXxxUid fields
        try {
            const flightDocRef = doc(db, "flights", flightId);
            const flightSnap = await getDoc(flightDocRef);
            if (flightSnap.exists()) {
                const fullFlightData = flightSnap.data() as FullFlightData;

                const findAndSetCrew = (uid: string | undefined, list: CrewUser[], fieldName: keyof PurserReportFormValues) => {
                    if (uid) {
                        const crewMember = list.find(member => member.uid === uid);
                        if (crewMember) {
                            form.setValue(fieldName, crewMember.name);
                        } else {
                            form.setValue(fieldName, PLACEHOLDER_NONE_VALUE);
                        }
                    } else {
                        form.setValue(fieldName, PLACEHOLDER_NONE_VALUE);
                    }
                };
                
                findAndSetCrew(fullFlightData.assignedCaptainUid, pilotsList, 'captainName');
                findAndSetCrew(fullFlightData.assignedFirstOfficerUid, pilotsList, 'firstOfficerName');
                findAndSetCrew(fullFlightData.assignedPurserUid, supervisingCrewList, 'purserName');
                findAndSetCrew(fullFlightData.assignedCabinCrewR1Uid, cabinCrewList, 'cabinCrewR1');
                findAndSetCrew(fullFlightData.assignedCabinCrewL2Uid, cabinCrewList, 'cabinCrewL2');
                findAndSetCrew(fullFlightData.assignedCabinCrewR2Uid, cabinCrewList, 'cabinCrewR2');
            } else {
                // Reset crew fields if full flight data not found, keeping basic flight info
                form.setValue('captainName', PLACEHOLDER_NONE_VALUE);
                form.setValue('firstOfficerName', PLACEHOLDER_NONE_VALUE);
                form.setValue('purserName', PLACEHOLDER_NONE_VALUE);
                form.setValue('cabinCrewR1', PLACEHOLDER_NONE_VALUE);
                form.setValue('cabinCrewL2', PLACEHOLDER_NONE_VALUE);
                form.setValue('cabinCrewR2', PLACEHOLDER_NONE_VALUE);
            }
        } catch (error) {
            console.error("Error fetching full flight data for crew pre-fill:", error);
            toast({title: "Crew Pre-fill Incomplete", description: "Could not fetch detailed crew assignments for this flight. Please select manually.", variant: "default"});
             // Reset crew fields on error as well
            form.setValue('captainName', PLACEHOLDER_NONE_VALUE);
            form.setValue('firstOfficerName', PLACEHOLDER_NONE_VALUE);
            form.setValue('purserName', PLACEHOLDER_NONE_VALUE);
            form.setValue('cabinCrewR1', PLACEHOLDER_NONE_VALUE);
            form.setValue('cabinCrewL2', PLACEHOLDER_NONE_VALUE);
            form.setValue('cabinCrewR2', PLACEHOLDER_NONE_VALUE);
        }
    } else {
         setSelectedFlightIdState(null);
    }
  };


  const handleAddSection = () => {
    if (!currentSectionType) { toast({ title: "Missing Type", description: "Please select a section type.", variant: "destructive" }); return; }
    if (!currentSectionContent.trim()) { toast({ title: "Missing Content", description: "Please enter content for the section.", variant: "destructive" }); return; }
    setAddedSections([...addedSections, { id: Date.now().toString(), type: currentSectionType, content: currentSectionContent.trim() }]);
    setCurrentSectionType(""); setCurrentSectionContent("");
  };
  const handleRemoveSection = (id: string) => setAddedSections(addedSections.filter(section => section.id !== id));

  const handleAddCrewEvaluation = () => {
    if (!currentEvalCrewMemberRole) { toast({ title: "Missing Crew Role", description: "Please select a crew member role to evaluate.", variant: "destructive" }); return; }
    if (!currentEvalContent.trim()) { toast({ title: "Missing Evaluation", description: "Please enter evaluation notes.", variant: "destructive" }); return; }
    const crewMemberName = form.getValues( currentEvalCrewMemberRole === 'R1' ? 'cabinCrewR1' : currentEvalCrewMemberRole === 'L2' ? 'cabinCrewL2' : 'cabinCrewR2' ) || "Unspecified Crew";
    if (crewMemberName === PLACEHOLDER_NONE_VALUE || !crewMemberName.trim()){
         toast({ title: "Crew Not Assigned", description: `No crew member is assigned to role ${currentEvalCrewMemberRole}. Please select a crew member first.`, variant: "destructive" }); return;
    }
    setAddedCrewEvaluations([...addedCrewEvaluations, { id: Date.now().toString(), crewMemberRole: currentEvalCrewMemberRole, crewMemberName: crewMemberName, evaluation: currentEvalContent.trim() }]);
    setCurrentEvalCrewMemberRole(""); setCurrentEvalContent("");
  };
  const handleRemoveCrewEvaluation = (id: string) => setAddedCrewEvaluations(addedCrewEvaluations.filter(evalItem => evalItem.id !== id));

  async function onSubmit(data: PurserReportFormValues) {
    if (!user) { toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" }); return; }
    if (addedSections.length === 0 && !data.generalFlightSummary && addedCrewEvaluations.length === 0) {
        toast({ title: "Empty Report", description: "Provide a general summary, report section, or crew evaluation.", variant: "default" }); return;
    }
    setIsLoading(true); setReportResult(null);
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
    const dynamicSections: Partial<Omit<PurserReportInput, 'crewPerformanceNotes'>> = {};
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
    
    const baseAiInput: PurserReportInput = {
      flightNumber: data.flightNumber, flightDate: new Date(data.flightDate).toISOString().split('T')[0], departureAirport: data.departureAirport, arrivalAirport: data.arrivalAirport,
      aircraftTypeRegistration: data.aircraftTypeRegistration, crewMembers: crewMembersString, passengerLoad: { total: Number(data.passengerLoad.total), adults: Number(data.passengerLoad.adults), children: Number(data.passengerLoad.children), infants: Number(data.passengerLoad.infants) },
      generalFlightSummary: data.generalFlightSummary, ...dynamicSections,
    };

    const aiInput: PurserReportInput = { ...baseAiInput };
    if (addedCrewEvaluations.length > 0) {
      aiInput.crewPerformanceNotes = addedCrewEvaluations.map(ev => `Evaluation for ${ev.crewMemberRole} (${ev.crewMemberName}):\n${ev.evaluation}`).join("\n\n---\n\n");
    }

    let savedReportId: string | null = null;
    try {
      const generatedReport = await generatePurserReport(aiInput);
      setReportResult(generatedReport);
      toast({ title: "Purser Report Generated by AI", description: "Review below. Saving to database..." });
      const reportDataToSave = { reportInput: aiInput, reportOutput: generatedReport, userId: user.uid, userEmail: user.email, createdAt: serverTimestamp(), status: "submitted", associatedFlightId: selectedFlightIdState || null };
      const docRef = await addDoc(collection(db, "purserReports"), reportDataToSave);
      savedReportId = docRef.id;
      if (selectedFlightIdState && savedReportId) {
        const flightDocRef = doc(db, "flights", selectedFlightIdState);
        await updateDoc(flightDocRef, { purserReportSubmitted: true, purserReportId: savedReportId });
      }
      toast({ title: "Purser Report Saved", description: "Report generated and saved." });
      form.reset(); setAddedSections([]); setAddedCrewEvaluations([]); setCurrentSectionType(""); setCurrentSectionContent(""); setCurrentEvalCrewMemberRole(""); setCurrentEvalContent(""); setSelectedFlightIdState(null);
    } catch (error) {
      console.error("Error in Purser Report process:", error);
      let errorMessage = "An error occurred. Please try again.";
      if (error instanceof Error) { errorMessage = reportResult ? `AI report generated, but failed to save (Report ID: ${savedReportId || 'N/A'}): ${error.message}` : `Failed to generate AI Report: ${error.message}`; }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally { setIsLoading(false); }
  }
  
  const availableEvalRoles: {label: string, value: CrewRoleForEval}[] = [];
  if (form.getValues('cabinCrewR1') && form.getValues('cabinCrewR1') !== PLACEHOLDER_NONE_VALUE) availableEvalRoles.push({label: `R1: ${form.getValues('cabinCrewR1')}`, value: 'R1'});
  if (form.getValues('cabinCrewL2') && form.getValues('cabinCrewL2') !== PLACEHOLDER_NONE_VALUE) availableEvalRoles.push({label: `L2: ${form.getValues('cabinCrewL2')}`, value: 'L2'});
  if (form.getValues('cabinCrewR2') && form.getValues('cabinCrewR2') !== PLACEHOLDER_NONE_VALUE) availableEvalRoles.push({label: `R2: ${form.getValues('cabinCrewR2')}`, value: 'R2'});

  const purserSelectPlaceholder = isLoadingSupervisingCrew ? "Loading Supervising Crew..." : supervisingCrewList.length === 0 ? "No Supervising Crew Available" : "Select Purser/Instructor";
  const purserDisabledItemText = isLoadingSupervisingCrew ? "Loading..." : supervisingCrewList.length === 0 ? "No Supervising Crew Available" : "Select Supervising Crew";

  const roleForEval = currentEvalCrewMemberRole;
  let nameOfCrewBeingEvaluated: string | null = null;
  if (roleForEval) {
      const fieldName = roleForEval === 'R1' ? 'cabinCrewR1' : roleForEval === 'L2' ? 'cabinCrewL2' : 'cabinCrewR2';
      const name = form.getValues(fieldName as keyof PurserReportFormValues) as string;
      if (name && name !== PLACEHOLDER_NONE_VALUE) {
          nameOfCrewBeingEvaluated = name;
      }
  }


  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Accordion type="single" collapsible defaultValue="flight-info" className="w-full space-y-4">
            
            <AccordionItem value="flight-info" className="border-none">
              <AccordionTrigger className="text-xl font-semibold p-4 bg-card rounded-t-lg hover:no-underline shadow-sm">
                <div className="flex items-center"><PlaneTakeoff className="mr-2 h-5 w-5 text-primary"/>Flight Information</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-card rounded-b-lg border-t-0 shadow-sm">
                <div className="space-y-4">
                  <FormItem>
                    <FormLabel>Select Existing Flight (Optional)</FormLabel>
                    <Select onValueChange={handleFlightSelection} value={selectedFlightIdState || "_MANUAL_ENTRY_"} disabled={isLoadingFlights}>
                      <FormControl><SelectTrigger><SelectValue placeholder={isLoadingFlights ? "Loading flights..." : "Choose a flight or enter manually"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="_MANUAL_ENTRY_">Enter Details Manually / Not Listed</SelectItem>
                        {availableFlights.map(flight => (<SelectItem key={flight.id} value={flight.id}>{flight.flightNumber}: {flight.departureAirport} to {flight.arrivalAirport} ({format(parseISO(flight.scheduledDepartureDateTimeUTC), "MMM d, yyyy HH:mm")} UTC)</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Choosing a flight will pre-fill the fields below. Assigned crew may also be pre-filled if available in flight data.</FormDescription>
                  </FormItem>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input placeholder="e.g., BA245" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="flightDate" render={({ field }) => (<FormItem><FormLabel>Flight Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="aircraftTypeRegistration" render={({ field }) => (<FormItem><FormLabel>Aircraft & Registration</FormLabel><FormControl><Input placeholder="e.g., B789 G-ABCD" {...field} /></FormControl><FormDescription>e.g., B787 G-XYZC</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="departureAirport" render={({ field }) => (<FormItem><FormLabel>Departure Airport</FormLabel><FormControl><Input placeholder="e.g., LHR" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="arrivalAirport" render={({ field }) => (<FormItem><FormLabel>Arrival Airport</FormLabel><FormControl><Input placeholder="e.g., JFK" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="crew-info" className="border-none">
              <AccordionTrigger className="text-xl font-semibold p-4 bg-card rounded-t-lg hover:no-underline shadow-sm">
                <div className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Crew Information</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-card rounded-b-lg border-t-0 shadow-sm">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField control={form.control} name="captainName" render={({ field }) => (<FormItem><FormLabel>Captain</FormLabel><Select onValueChange={(v) => field.onChange(v === PLACEHOLDER_NONE_VALUE ? "" : v)} value={field.value || PLACEHOLDER_NONE_VALUE} disabled={isLoadingPilots}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingPilots ? "Loading..." : "Select Captain"} /></SelectTrigger></FormControl><SelectContent><SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>{pilotsList.map(p => (<SelectItem key={p.uid} value={p.name}>{p.name}</SelectItem>))}</SelectContent></Select><FormDescription>Optional</FormDescription><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="firstOfficerName" render={({ field }) => (<FormItem><FormLabel>First Officer</FormLabel><Select onValueChange={(v) => field.onChange(v === PLACEHOLDER_NONE_VALUE ? "" : v)} value={field.value || PLACEHOLDER_NONE_VALUE} disabled={isLoadingPilots}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingPilots ? "Loading..." : "Select F/O"} /></SelectTrigger></FormControl><SelectContent><SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>{pilotsList.map(p => (<SelectItem key={p.uid} value={p.name}>{p.name}</SelectItem>))}</SelectContent></Select><FormDescription>Optional</FormDescription><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="purserName" render={({ field }) => ( <FormItem> <FormLabel>Supervising Crew*</FormLabel> <Select onValueChange={field.onChange} value={field.value || PLACEHOLDER_NONE_VALUE} disabled={isLoadingSupervisingCrew || (!isLoadingSupervisingCrew && supervisingCrewList.length === 0)} > <FormControl><SelectTrigger><SelectValue placeholder={purserSelectPlaceholder} /></SelectTrigger></FormControl> <SelectContent> <SelectItem value={PLACEHOLDER_NONE_VALUE} disabled> {purserDisabledItemText} </SelectItem> {supervisingCrewList.map(c => (<SelectItem key={c.uid} value={c.name}>{c.name}</SelectItem>))} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={form.control} name="cabinCrewR1" render={({ field }) => (<FormItem><FormLabel>Cabin Crew (R1)</FormLabel><Select onValueChange={(v) => field.onChange(v === PLACEHOLDER_NONE_VALUE ? "" : v)} value={field.value || PLACEHOLDER_NONE_VALUE} disabled={isLoadingCabinCrew}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingCabinCrew ? "Loading..." : "Select R1"} /></SelectTrigger></FormControl><SelectContent><SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>{cabinCrewList.map(c => (<SelectItem key={c.uid} value={c.name}>{c.name}</SelectItem>))}</SelectContent></Select><FormDescription>Optional</FormDescription><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="cabinCrewL2" render={({ field }) => (<FormItem><FormLabel>Cabin Crew (L2)</FormLabel><Select onValueChange={(v) => field.onChange(v === PLACEHOLDER_NONE_VALUE ? "" : v)} value={field.value || PLACEHOLDER_NONE_VALUE} disabled={isLoadingCabinCrew}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingCabinCrew ? "Loading..." : "Select L2"} /></SelectTrigger></FormControl><SelectContent><SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>{cabinCrewList.map(c => (<SelectItem key={c.uid} value={c.name}>{c.name}</SelectItem>))}</SelectContent></Select><FormDescription>Optional</FormDescription><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="cabinCrewR2" render={({ field }) => (<FormItem><FormLabel>Cabin Crew (R2)</FormLabel><Select onValueChange={(v) => field.onChange(v === PLACEHOLDER_NONE_VALUE ? "" : v)} value={field.value || PLACEHOLDER_NONE_VALUE} disabled={isLoadingCabinCrew}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingCabinCrew ? "Loading..." : "Select R2"} /></SelectTrigger></FormControl><SelectContent><SelectItem value={PLACEHOLDER_NONE_VALUE}>Not Assigned / Other</SelectItem>{cabinCrewList.map(c => (<SelectItem key={c.uid} value={c.name}>{c.name}</SelectItem>))}</SelectContent></Select><FormDescription>Optional</FormDescription><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={form.control} name="otherCrewMembers" render={({ field }) => (<FormItem><FormLabel>Other Crew / Notes</FormLabel><FormControl><Textarea placeholder="Names and roles of other crew members, or notes on general crew matters..." {...field} /></FormControl><FormDescription>E.g., Relief crew, trainees, or notes on teamwork, communication, etc.</FormDescription><FormMessage /></FormItem>)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="passenger-load" className="border-none">
              <AccordionTrigger className="text-xl font-semibold p-4 bg-card rounded-t-lg hover:no-underline shadow-sm">
                <div className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Passenger Load</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-card rounded-b-lg border-t-0 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField control={form.control} name="passengerLoad.total" render={({ field }) => (<FormItem><FormLabel>Total Passengers</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="passengerLoad.adults" render={({ field }) => (<FormItem><FormLabel>Adults</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="passengerLoad.children" render={({ field }) => (<FormItem><FormLabel>Children</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="passengerLoad.infants" render={({ field }) => (<FormItem><FormLabel>Infants</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="general-summary" className="border-none">
              <AccordionTrigger className="text-xl font-semibold p-4 bg-card rounded-t-lg hover:no-underline shadow-sm">
                <div className="flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>General Flight Summary</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-card rounded-b-lg border-t-0 shadow-sm">
                 <FormField control={form.control} name="generalFlightSummary" render={({ field }) => (<FormItem><FormLabel>Summary Content</FormLabel><FormControl><Textarea placeholder="Overall flight conduct, punctuality, atmosphere, IFE status, any general incidents or positive feedback..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="report-sections" className="border-none">
              <AccordionTrigger className="text-xl font-semibold p-4 bg-card rounded-t-lg hover:no-underline shadow-sm">
                <div className="flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>Specific Report Sections</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-card rounded-b-lg border-t-0 shadow-sm space-y-6">
                <div className="space-y-4 p-4 border rounded-md"><h3 className="text-md font-semibold">Add Report Section</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <FormItem><FormLabel>Section Type</FormLabel><Select value={currentSectionType} onValueChange={(v) => setCurrentSectionType(v as ReportSectionType)}><FormControl><SelectTrigger><SelectValue placeholder="Select section type" /></SelectTrigger></FormControl><SelectContent>{reportSectionTypes.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent></Select></FormItem>
                    <Button type="button" onClick={handleAddSection} className="self-end" disabled={!currentSectionType || !currentSectionContent.trim()}><PlusCircle className="mr-2 h-4 w-4"/> Add Section</Button>
                </div><FormItem><FormLabel>Section Content</FormLabel><Textarea placeholder="Details for selected section..." className="min-h-[100px]" value={currentSectionContent} onChange={(e) => setCurrentSectionContent(e.target.value)}/></FormItem></div>
                {addedSections.length > 0 && (<div className="space-y-3"><h3 className="text-md font-semibold mt-4">Added Sections:</h3>{addedSections.map(s => (<Card key={s.id} className="p-3 bg-muted/50"><div className="flex justify-between items-center mb-1"><CardTitle className="text-sm font-medium">{s.type}</CardTitle><Button variant="ghost" size="icon" onClick={() => handleRemoveSection(s.id)} className="h-6 w-6 text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></Button></div><p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content}</p></Card>))}</div>)}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="crew-evaluations" className="border-none">
              <AccordionTrigger className="text-xl font-semibold p-4 bg-card rounded-t-lg hover:no-underline shadow-sm">
                <div className="flex items-center"><MessageSquareQuote className="mr-2 h-5 w-5 text-primary"/>Crew Performance Evaluation</div>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-card rounded-b-lg border-t-0 shadow-sm space-y-6">
                 <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="text-md font-semibold">Add Crew Evaluation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <FormItem>
                            <FormLabel>Crew Member Role</FormLabel>
                            <Select value={currentEvalCrewMemberRole} onValueChange={(v) => setCurrentEvalCrewMemberRole(v as CrewRoleForEval)} disabled={availableEvalRoles.length === 0}>
                                <FormControl><SelectTrigger><SelectValue placeholder={availableEvalRoles.length === 0 ? "Assign R1/L2/R2 first" : "Select crew role"} /></SelectTrigger></FormControl>
                                <SelectContent>{availableEvalRoles.map(r => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}</SelectContent>
                            </Select>
                        </FormItem>
                        <Button type="button" onClick={handleAddCrewEvaluation} className="self-end" disabled={!currentEvalCrewMemberRole || !currentEvalContent.trim()}><PlusCircle className="mr-2 h-4 w-4"/>Add Evaluation</Button>
                    </div>
                    {currentEvalCrewMemberRole && nameOfCrewBeingEvaluated && (
                        <p className="text-sm font-medium mb-1 text-muted-foreground">
                            Enter evaluation for: <strong className="text-primary">{nameOfCrewBeingEvaluated}</strong> ({currentEvalCrewMemberRole})
                        </p>
                    )}
                    <FormItem>
                        <FormLabel>Evaluation Notes {nameOfCrewBeingEvaluated ? `for ${nameOfCrewBeingEvaluated}` : '(for selected role)'}</FormLabel>
                        <Textarea placeholder="Performance notes, commendations, areas for improvement..." className="min-h-[100px]" value={currentEvalContent} onChange={(e) => setCurrentEvalContent(e.target.value)}/>
                    </FormItem>
                </div>
                {addedCrewEvaluations.length > 0 && (<div className="space-y-3 mt-4"><h3 className="text-md font-semibold">Added Evaluations:</h3>{addedCrewEvaluations.map(ev => (<Card key={ev.id} className="p-3 bg-muted/50"><div className="flex justify-between items-center mb-1"><CardTitle className="text-sm font-medium">{ev.crewMemberRole}: {ev.crewMemberName}</CardTitle><Button variant="ghost" size="icon" onClick={() => handleRemoveCrewEvaluation(ev.id)} className="h-6 w-6 text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></Button></div><p className="text-sm text-muted-foreground whitespace-pre-wrap">{ev.evaluation}</p></Card>))}</div>)}
              </AccordionContent>
            </AccordionItem>

          </Accordion>
          
          <Button type="submit" disabled={isLoading || !form.formState.isValid || !user} className="w-full sm:w-auto mt-8">
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating & Saving...</>) : (<><Sparkles className="mr-2 h-4 w-4" />Generate & Save AI Report</>)}
          </Button>
          {!user && (<p className="text-sm text-destructive">Please log in to submit.</p>)}
        </form>
      </Form>

      {reportResult && (
        <Card className="mt-8 shadow-md bg-secondary/30">
          <CardHeader><CardTitle className="text-xl font-headline flex items-center"><ClipboardList className="mr-2 h-6 w-6 text-primary" />AI-Generated Purser Report</CardTitle><CardDescription>Review the AI generated report. This has been saved.</CardDescription></CardHeader>
          <CardContent className="space-y-6"><div><h3 className="font-semibold text-lg mb-2">Full Report (Markdown):</h3><div className="prose prose-sm max-w-none dark:prose-invert text-foreground p-4 border rounded-md bg-background"><pre className="whitespace-pre-wrap font-sans text-sm">{reportResult.formattedReport}</pre></div></div>
          {reportResult.keyHighlights && reportResult.keyHighlights.length > 0 && (<div><h3 className="font-semibold text-lg mb-2">Key Highlights:</h3><ul className="list-disc pl-5 space-y-1 text-sm">{reportResult.keyHighlights.map((h, i) => (<li key={i} className="p-2 border-l-4 border-primary bg-background rounded-r-md">{h}</li>))}</ul></div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

