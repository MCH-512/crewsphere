
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle, Save, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { formatISO, parseISO, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { logAuditEvent } from "@/lib/audit-logger";

import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { searchAirports, type Airport } from "@/services/airport-service";

const DEBOUNCE_DELAY = 300; 

const aircraftTypes = ["B737-800", "B737-300", "B777", "A320", "A319", "A321", "A330", "ACMI"];

const flightEditFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Airport code must be 3-4 characters.").max(4).toUpperCase(),
  arrivalAirport: z.string().min(3, "Airport code must be 3-4 characters.").max(4).toUpperCase(),
  scheduledDepartureDateTimeUTC: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid departure datetime."}),
  scheduledArrivalDateTimeUTC: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid arrival datetime."}),
  aircraftType: z.string({ required_error: "Please select an aircraft type."}).min(1, "Aircraft type is required."),
  status: z.enum(["Scheduled", "On Time", "Delayed", "Cancelled"], { required_error: "Please select a flight status." }),
})
.superRefine((data, ctx) => {
    const departureTime = new Date(data.scheduledDepartureDateTimeUTC).getTime();
    const arrivalTime = new Date(data.scheduledArrivalDateTimeUTC).getTime();
    if (arrivalTime <= departureTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Arrival datetime must be after departure datetime.",
            path: ["scheduledArrivalDateTimeUTC"],
        });
    }
});

type FlightEditFormValues = z.infer<typeof flightEditFormSchema>;

interface FlightDocumentForEdit {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDepartureDateTimeUTC: string; 
  scheduledArrivalDateTimeUTC: string; 
  aircraftType: string;
  status: "Scheduled" | "On Time" | "Delayed" | "Cancelled";
  purserReportSubmitted?: boolean;
  purserReportId?: string | null;
}

export default function EditFlightPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flightId = params.flightId as string;

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentFlightData, setCurrentFlightData] = React.useState<FlightDocumentForEdit | null>(null);

  const [departureSearchTerm, setDepartureSearchTerm] = React.useState("");
  const [arrivalSearchTerm, setArrivalSearchTerm] = React.useState("");
  const [departureSuggestions, setDepartureSuggestions] = React.useState<Airport[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = React.useState<Airport[]>([]);
  const [isLoadingDeparture, setIsLoadingDeparture] = React.useState(false);
  const [isLoadingArrival, setIsLoadingArrival] = React.useState(false);

  const form = useForm<FlightEditFormValues>({
    resolver: zodResolver(flightEditFormSchema),
    defaultValues: {
      flightNumber: "",
      departureAirport: "",
      arrivalAirport: "",
      scheduledDepartureDateTimeUTC: "",
      scheduledArrivalDateTimeUTC: "",
      aircraftType: "",
      status: "Scheduled",
    },
  });

  const toDatetimeLocalInputString = (isoString: string): string => {
    if (!isoString) return "";
    try {
      const date = parseISO(isoString);
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (e) {
      console.warn("Error formatting date for input:", e);
      return ""; 
    }
  };

  React.useEffect(() => {
    if (!departureSearchTerm || departureSearchTerm.length < 2) {
      setDepartureSuggestions([]);
      return;
    }
    setIsLoadingDeparture(true);
    const handler = setTimeout(async () => {
      try {
        const results = await searchAirports(departureSearchTerm);
        setDepartureSuggestions(results);
      } catch (error) {
        console.error("Error searching departure airports:", error);
        toast({ title: "Airport Search Error", description: "Could not fetch departure airport suggestions.", variant: "destructive" });
      } finally {
        setIsLoadingDeparture(false);
      }
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(handler);
  }, [departureSearchTerm, toast]);

  React.useEffect(() => {
    if (!arrivalSearchTerm || arrivalSearchTerm.length < 2) {
      setArrivalSuggestions([]);
      return;
    }
    setIsLoadingArrival(true);
    const handler = setTimeout(async () => {
      try {
        const results = await searchAirports(arrivalSearchTerm);
        setArrivalSuggestions(results);
      } catch (error) {
        console.error("Error searching arrival airports:", error);
        toast({ title: "Airport Search Error", description: "Could not fetch arrival airport suggestions.", variant: "destructive" });
      } finally {
        setIsLoadingArrival(false);
      }
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(handler);
  }, [arrivalSearchTerm, toast]);


  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
      return;
    }

    if (flightId && user && user.role === 'admin') {
      const fetchFlightData = async () => {
        setIsLoadingData(true);
        try {
          const flightDocRef = doc(db, "flights", flightId);
          const flightSnap = await getDoc(flightDocRef);

          if (!flightSnap.exists()) {
            toast({ title: "Not Found", description: "Flight data could not be found.", variant: "destructive" });
            router.push("/admin/flights");
            return;
          }
          const flightDataFromDb = { id: flightSnap.id, ...flightSnap.data()} as FlightDocumentForEdit;
          setCurrentFlightData(flightDataFromDb);
          form.reset({
            flightNumber: flightDataFromDb.flightNumber,
            departureAirport: flightDataFromDb.departureAirport,
            arrivalAirport: flightDataFromDb.arrivalAirport,
            scheduledDepartureDateTimeUTC: toDatetimeLocalInputString(flightDataFromDb.scheduledDepartureDateTimeUTC),
            scheduledArrivalDateTimeUTC: toDatetimeLocalInputString(flightDataFromDb.scheduledArrivalDateTimeUTC),
            aircraftType: flightDataFromDb.aircraftType,
            status: flightDataFromDb.status,
          });
        } catch (error) {
          console.error("Error loading flight data:", error);
          toast({ title: "Loading Error", description: "Failed to load flight data for editing.", variant: "destructive" });
          router.push("/admin/flights");
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchFlightData();
    }
  }, [flightId, user, authLoading, router, toast, form]);

  async function onSubmit(data: FlightEditFormValues) {
    if (!user || user.role !== 'admin' || !flightId || !currentFlightData) {
      toast({ title: "Unauthorized or Missing ID", description: "Cannot update flight.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const flightDocRef = doc(db, "flights", flightId);
      const updatePayload = {
        flightNumber: data.flightNumber,
        departureAirport: data.departureAirport,
        arrivalAirport: data.arrivalAirport,
        scheduledDepartureDateTimeUTC: new Date(data.scheduledDepartureDateTimeUTC).toISOString(),
        scheduledArrivalDateTimeUTC: new Date(data.scheduledArrivalDateTimeUTC).toISOString(),
        aircraftType: data.aircraftType,
        status: data.status,
        purserReportSubmitted: currentFlightData.purserReportSubmitted || false,
        purserReportId: currentFlightData.purserReportId || null,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(flightDocRef, updatePayload);

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email || "N/A",
        actionType: "UPDATE_FLIGHT",
        entityType: "FLIGHT",
        entityId: flightId,
        details: { flightNumber: data.flightNumber, route: `${data.departureAirport}-${data.arrivalAirport}`, status: data.status },
      });

      toast({
        title: "Flight Updated Successfully",
        description: `Flight ${data.flightNumber} has been updated.`,
        action: <CheckCircle className="text-green-500" />,
      });
      router.push('/admin/flights');
    } catch (error) {
      console.error("Error updating flight in Firestore:", error);
      toast({ title: "Update Failed", description: "Could not update the flight. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading flight data...</p>
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Edit3 className="mr-3 h-7 w-7 text-primary" />
            Edit Flight Details
          </CardTitle>
          <CardDescription>
            Modify the details of this specific flight instance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input placeholder="e.g., BA245" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField
                      control={form.control}
                      name="aircraftType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aircraft Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select aircraft type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {aircraftTypes.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="departureAirport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departure Airport</FormLabel>
                          <CustomAutocompleteAirport
                            value={field.value}
                            onSelect={(airport) => form.setValue("departureAirport", airport ? (airport.icao || airport.iata) : "", { shouldValidate: true })}
                            placeholder="Search departure airport..."
                            airports={departureSuggestions}
                            isLoading={isLoadingDeparture}
                            onInputChange={setDepartureSearchTerm}
                            currentSearchTerm={departureSearchTerm}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arrivalAirport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Arrival Airport</FormLabel>
                           <CustomAutocompleteAirport
                            value={field.value}
                            onSelect={(airport) => form.setValue("arrivalAirport", airport ? (airport.icao || airport.iata) : "", { shouldValidate: true })}
                            placeholder="Search arrival airport..."
                            airports={arrivalSuggestions}
                            isLoading={isLoadingArrival}
                            onInputChange={setArrivalSearchTerm}
                            currentSearchTerm={arrivalSearchTerm}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="scheduledDepartureDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Scheduled Departure (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormDescription>Date and Time in UTC</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="scheduledArrivalDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Scheduled Arrival (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormDescription>Date and Time in UTC</FormDescription><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select flight status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="On Time">On Time</SelectItem><SelectItem value="Delayed">Delayed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                
                {currentFlightData && (
                  <FormItem>
                    <FormLabel>Purser Report Status</FormLabel>
                    <div className="flex items-center gap-2">
                      {currentFlightData.purserReportSubmitted ? (
                        <Badge variant="success">
                           Submitted
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                           Pending
                        </Badge>
                      )}
                      {currentFlightData.purserReportId && (
                         <p className="text-xs text-muted-foreground">(Report ID: {currentFlightData.purserReportId.substring(0,10)}...)</p>
                      )}
                    </div>
                    <FormDescription>This status is updated automatically when a Purser Report is submitted for this flight.</FormDescription>
                  </FormItem>
                )}
              
              <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
               {!form.formState.isValid && (
                <p className="text-sm text-destructive mt-2">Please fill all required fields correctly.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
