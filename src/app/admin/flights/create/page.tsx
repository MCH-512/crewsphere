
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
import { Loader2, AlertTriangle, CheckCircle, PlusCircle, CalendarPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addDays, addMonths, getDay, isAfter, startOfDay, parseISO, formatISO } from "date-fns";

import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { searchAirports, type Airport } from "@/services/airport-service";

const DEBOUNCE_DELAY = 300; // milliseconds

const weekDays = [
  { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" },
  { id: 4, label: "Thu" }, { id: 5, label: "Fri" }, { id: 6, label: "Sat" },
  { id: 0, label: "Sun" } 
];

const aircraftTypes = ["B737-800", "B737-300", "B777", "A320", "A319", "A321", "A330", "ACMI"];

const flightRecurrenceFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Airport code must be 3-4 characters.").max(4).toUpperCase(),
  arrivalAirport: z.string().min(3, "Airport code must be 3-4 characters.").max(4).toUpperCase(),
  baseDepartureTimeUTC: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time. Use HH:MM UTC format."),
  baseArrivalTimeUTC: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time. Use HH:MM UTC format."),
  aircraftType: z.string({ required_error: "Please select an aircraft type."}).min(1, "Aircraft type is required."),
  status: z.enum(["Scheduled", "On Time", "Delayed", "Cancelled"], { required_error: "Please select a flight status." }),

  frequency: z.enum(["once", "daily", "weekly", "monthly", "custom"], { required_error: "Frequency is required." }),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid start date."}),
  
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),

  endsOn: z.enum(["never", "onDate", "afterOccurrences"], { required_error: "Please specify when the recurrence ends." }).default("never"),
  endDate: z.string().optional(),
  numberOfOccurrences: z.coerce.number().int().min(1).optional(),

  customDates: z.array(z.date()).optional(),
})
.superRefine((data, ctx) => {
  if (data.frequency === "weekly" && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select at least one day for weekly recurrence.", path: ["daysOfWeek"]});
  }
  if (data.endsOn === "onDate") {
    if (!data.endDate || data.endDate.trim() === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date is required if 'Ends on date' is selected.", path: ["endDate"]});
    } else if (data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date cannot be before start date.", path: ["endDate"]});
    }
  }
  if (data.endsOn === "afterOccurrences" && (!data.numberOfOccurrences || data.numberOfOccurrences < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Number of occurrences must be at least 1.", path: ["numberOfOccurrences"]});
  }
  if (data.frequency === "custom" && (!data.customDates || data.customDates.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select at least one date for custom frequency.", path: ["customDates"]});
  }

  if (data.endsOn !== "onDate") data.endDate = undefined;
  if (data.endsOn !== "afterOccurrences") data.numberOfOccurrences = undefined;
});

type FlightRecurrenceFormValues = z.infer<typeof flightRecurrenceFormSchema>;

const defaultValues: Partial<FlightRecurrenceFormValues> = {
  flightNumber: "",
  departureAirport: "",
  arrivalAirport: "",
  baseDepartureTimeUTC: "10:00",
  baseArrivalTimeUTC: "12:00",
  aircraftType: "",
  status: "Scheduled",
  frequency: "once",
  startDate: new Date().toISOString().split('T')[0],
  daysOfWeek: [],
  endsOn: "never",
  customDates: [],
};

const generateRecurrentDates = (values: FlightRecurrenceFormValues): Date[] => {
    const dates: Date[] = [];
    const { frequency, startDate: rawStartDate, daysOfWeek, endsOn, endDate: rawEndDate, numberOfOccurrences, customDates } = values;

    if (!rawStartDate) return [];
    
    const baseStartDate = startOfDay(parseISO(rawStartDate)); 
    const limitEndDate = rawEndDate ? startOfDay(parseISO(rawEndDate)) : null;

    if (frequency === "once") {
        if (limitEndDate && isAfter(baseStartDate, limitEndDate)) return [];
        dates.push(baseStartDate);
        return dates;
    }
    if (frequency === "custom") {
        return customDates 
            ? customDates.map(d => startOfDay(d)).filter(d => !limitEndDate || !isAfter(d, limitEndDate)) 
            : [];
    }

    let occurrences = 0;
    const maxOccurrences = endsOn === "afterOccurrences" ? numberOfOccurrences : Infinity;
    const hardLoopLimit = 5 * 365; 
    let iterationCount = 0;

    if (frequency === "daily" || frequency === "weekly") {
        let currentDate = new Date(baseStartDate);
        while (occurrences < maxOccurrences && iterationCount < hardLoopLimit) {
            iterationCount++;
            if (limitEndDate && isAfter(currentDate, limitEndDate)) {
                break;
            }

            let addThisDate = false;
            if (frequency === "daily") {
                addThisDate = true;
            } else if (frequency === "weekly") {
                if (daysOfWeek?.includes(getDay(currentDate))) {
                    addThisDate = true;
                }
            }

            if (addThisDate) {
                dates.push(new Date(currentDate));
                occurrences++;
            }
            
            currentDate = addDays(currentDate, 1);
        }
    } else if (frequency === "monthly") {
        for (let monthOffset = 0; occurrences < maxOccurrences && iterationCount < hardLoopLimit; monthOffset++) {
            iterationCount++; 
            const currentDate = addMonths(baseStartDate, monthOffset);
            
            if (limitEndDate && isAfter(currentDate, limitEndDate)) {
                break;
            }
            dates.push(new Date(currentDate));
            occurrences++;
        }
    }
    
    if (iterationCount >= hardLoopLimit && endsOn === "never" && (frequency === "daily" || frequency === "weekly" || frequency === "monthly")) {
        console.warn("Reached generation limit for 'never ending' recurrence (5 years).");
    }
    return dates;
};


export default function CreateFlightPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customSelectedDates, setCustomSelectedDates] = React.useState<Date[] | undefined>([]);

  const [departureSearchTerm, setDepartureSearchTerm] = React.useState("");
  const [arrivalSearchTerm, setArrivalSearchTerm] = React.useState("");
  const [departureSuggestions, setDepartureSuggestions] = React.useState<Airport[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = React.useState<Airport[]>([]);
  const [isLoadingDeparture, setIsLoadingDeparture] = React.useState(false);
  const [isLoadingArrival, setIsLoadingArrival] = React.useState(false);

  const form = useForm<FlightRecurrenceFormValues>({
    resolver: zodResolver(flightRecurrenceFormSchema),
    defaultValues,
    mode: "onChange",
  });
  
  const watchedFrequency = form.watch("frequency");
  const watchedEndsOn = form.watch("endsOn");

   React.useEffect(() => {
    form.setValue("customDates", customSelectedDates);
  }, [customSelectedDates, form]);

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
    }
  }, [user, authLoading, router, toast]);

  // Debounced search for departure airport
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

  // Debounced search for arrival airport
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


  async function onSubmit(data: FlightRecurrenceFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to create flights.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const generatedDates = generateRecurrentDates(data);
    let flightsCreatedCount = 0;
    let flightsFailedCount = 0;
    
    if (generatedDates.length === 0) {
        toast({ title: "No Dates to Schedule", description: "No flight dates were generated based on your recurrence rules.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const batch = writeBatch(db);

    for (const date of generatedDates) {
      try {
        const dateStr = formatISO(date, { representation: 'date' }); 
        const depDateTimeStr = `\${dateStr}T\${data.baseDepartureTimeUTC}:00.000Z`;
        const arrDateTimeStr = `\${dateStr}T\${data.baseArrivalTimeUTC}:00.000Z`;

        let departureDateTime = parseISO(depDateTimeStr);
        let arrivalDateTime = parseISO(arrDateTimeStr);
        
        if (arrivalDateTime <= departureDateTime) {
          arrivalDateTime = addDays(arrivalDateTime, 1);
        }
        
        const flightDocRef = doc(collection(db, "flights"));
        batch.set(flightDocRef, {
          flightNumber: data.flightNumber,
          departureAirport: data.departureAirport,
          arrivalAirport: data.arrivalAirport,
          aircraftType: data.aircraftType,
          status: data.status,
          scheduledDepartureDateTimeUTC: departureDateTime.toISOString(),
          scheduledArrivalDateTimeUTC: arrivalDateTime.toISOString(),
          purserReportSubmitted: false,
          purserReportId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        });
        flightsCreatedCount++;
      } catch (e) {
        flightsFailedCount++;
        console.error(`Error processing date \${date}:`, e);
      }
    }

    try {
        if (flightsCreatedCount > 0) {
            await batch.commit();
            toast({
                title: "Flight Creation Successful",
                description: `\${flightsCreatedCount} flight(s) created. \${flightsFailedCount > 0 ? `\${flightsFailedCount} failed.` : ''}`,
                action: flightsFailedCount > 0 ? <AlertTriangle className="text-destructive"/> : <CheckCircle className="text-green-500" />,
            });
            form.reset();
            setCustomSelectedDates([]);
            setDepartureSearchTerm("");
            setArrivalSearchTerm("");
            router.push('/admin/flights'); 
        } else if (flightsFailedCount > 0) {
             toast({ title: "Flight Creation Failed", description: `No flights created. \${flightsFailedCount} date(s) could not be processed. Check console.`, variant: "destructive" });
        } else {
            toast({ title: "No Flights to Create", description: "No dates were generated based on your rules.", variant: "default" });
        }
    } catch (error) {
        console.error("Error committing batch flight creation:", error);
        toast({ title: "Batch Creation Failed", description: "Could not save the flights. Please try again.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
            <CalendarPlus className="mr-3 h-7 w-7 text-primary" />
            Add New Flight(s) with Recurrence
          </CardTitle>
          <CardDescription>
            Define a flight template and specify recurrence rules to create multiple flight instances. All times are in UTC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Card><CardHeader><CardTitle className="text-lg">Base Flight Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="flightNumber" render={({ field }) => (<FormItem><FormLabel>Flight Number</FormLabel><FormControl><Input placeholder="e.g., BA245" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField
                      control={form.control}
                      name="aircraftType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aircraft Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormField control={form.control} name="baseDepartureTimeUTC" render={({ field }) => (<FormItem><FormLabel>Base Departure Time (UTC)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormDescription>HH:MM (24h)</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="baseArrivalTimeUTC" render={({ field }) => (<FormItem><FormLabel>Base Arrival Time (UTC)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormDescription>HH:MM (24h)</FormDescription><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status for Created Flights</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select flight status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="On Time">On Time</SelectItem><SelectItem value="Delayed">Delayed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              <Card><CardHeader><CardTitle className="text-lg">Recurrence Rules</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Start Date*</FormLabel>
                      <FormControl><Input type="date" {...field} className="w-full md:w-1/2" /></FormControl>
                      <FormDescription>The first date this flight will occur.</FormDescription><FormMessage />
                    </FormItem>)} />
                  
                  <FormField control={form.control} name="frequency" render={({ field }) => (
                    <FormItem><FormLabel>Frequency*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="once">Once (Only Start Date)</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly (Same day of month as start)</SelectItem>
                          <SelectItem value="custom">Custom Dates</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>)} />

                  {watchedFrequency === "weekly" && (
                    <FormField control={form.control} name="daysOfWeek" render={() => (
                      <FormItem><FormLabel>Repeat on (Weekly)*</FormLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 md:gap-3 items-center rounded-md border p-3">
                          {weekDays.map((day) => (
                            <FormField key={day.id} control={form.control} name="daysOfWeek"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value?.includes(day.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), day.id])
                                          : field.onChange(field.value?.filter((value) => value !== day.id));
                                      }} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">{day.label}</FormLabel>
                                </FormItem>
                              )} />
                          ))}
                        </div><FormMessage />
                      </FormItem>)} />
                  )}

                  {watchedFrequency === "custom" && (
                    <FormField control={form.control} name="customDates"
                      render={({ field }) => (
                        <FormItem className="flex flex-col items-start">
                          <FormLabel>Select Custom Dates*</FormLabel>
                          <Calendar mode="multiple" selected={customSelectedDates} onSelect={setCustomSelectedDates} className="rounded-md border self-center" />
                           <FormDescription>Selected Dates: {customSelectedDates && customSelectedDates.length > 0 ? customSelectedDates.map(d=>d.toLocaleDateString()).join(', ') : "None"}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                  )}

                  {watchedFrequency !== "once" && watchedFrequency !== "custom" && (
                    <FormField control={form.control} name="endsOn" render={({ field }) => (
                      <FormItem className="space-y-3"><FormLabel>Ends*</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="never" /></FormControl><FormLabel className="font-normal">Never</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="onDate" /></FormControl><FormLabel className="font-normal">On Date</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="afterOccurrences" /></FormControl><FormLabel className="font-normal">After Occurrences</FormLabel></FormItem>
                          </RadioGroup>
                        </FormControl><FormMessage />
                      </FormItem>)} />
                  )}

                  {watchedFrequency !== "once" && watchedFrequency !== "custom" && watchedEndsOn === "onDate" && (
                    <FormField control={form.control} name="endDate" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>End Date*</FormLabel>
                        <FormControl><Input type="date" {...field} className="w-full md:w-1/2" /></FormControl>
                        <FormMessage />
                      </FormItem>)} />
                  )}

                  {watchedFrequency !== "once" && watchedFrequency !== "custom" && watchedEndsOn === "afterOccurrences" && (
                     <FormField control={form.control} name="numberOfOccurrences" render={({ field }) => (
                        <FormItem><FormLabel>Number of Occurrences*</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g., 10" {...field} className="w-full md:w-1/2" /></FormControl>
                            <FormMessage />
                        </FormItem>)} />
                  )}
                </CardContent>
              </Card>

              <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Flights...</>
                ) : (
                  <><PlusCircle className="mr-2 h-4 w-4" />Create Flight(s)</>
                )}
              </Button>
              {!form.formState.isValid && user && (
                <p className="text-sm text-destructive">Please fill all required fields correctly and ensure recurrence rules are logical.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
