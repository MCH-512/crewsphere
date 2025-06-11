
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Loader2, AlertTriangle, CheckCircle, PlusCircle, CalendarPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";

const flightFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Airport code must be 3 characters.").max(4).toUpperCase(),
  arrivalAirport: z.string().min(3, "Airport code must be 3 characters.").max(4).toUpperCase(),
  baseDepartureTimeUTC: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time. Use HH:MM UTC format."),
  baseArrivalTimeUTC: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time. Use HH:MM UTC format."),
  flightDates: z.string().min(10, "Please enter at least one date in YYYY-MM-DD format."),
  aircraftType: z.string().min(3, "Aircraft type must be at least 3 characters.").max(50),
  status: z.enum(["Scheduled", "On Time", "Delayed", "Cancelled"], { required_error: "Please select a flight status." }),
});

type FlightFormValues = z.infer<typeof flightFormSchema>;

const defaultValues: Partial<FlightFormValues> = {
  flightNumber: "",
  departureAirport: "",
  arrivalAirport: "",
  baseDepartureTimeUTC: "10:00",
  baseArrivalTimeUTC: "12:00",
  flightDates: new Date().toISOString().split('T')[0], // Default to today's date
  aircraftType: "",
  status: "Scheduled",
};

export default function CreateFlightPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FlightFormValues>({
    resolver: zodResolver(flightFormSchema),
    defaultValues,
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      toast({ title: "Access Denied", description: "You need admin privileges to access this page.", variant: "destructive"});
    }
  }, [user, authLoading, router, toast]);

  async function onSubmit(data: FlightFormValues) {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "You do not have permission to create flights.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const datesArray = data.flightDates.split('\n').map(d => d.trim()).filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d));
    let flightsCreatedCount = 0;
    let flightsFailedCount = 0;
    
    if (datesArray.length === 0) {
        toast({ title: "No Valid Dates", description: "Please enter at least one valid date in YYYY-MM-DD format.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const batch = writeBatch(db);

    for (const dateStr of datesArray) {
      try {
        const depDateTimeStr = `${dateStr}T${data.baseDepartureTimeUTC}:00Z`;
        const arrDateTimeStr = `${dateStr}T${data.baseArrivalTimeUTC}:00Z`;

        let departureDateTime = new Date(depDateTimeStr);
        let arrivalDateTime = new Date(arrDateTimeStr);

        if (isNaN(departureDateTime.getTime()) || isNaN(arrivalDateTime.getTime())) {
            console.warn(`Invalid date/time constructed for date ${dateStr} with times ${data.baseDepartureTimeUTC}/${data.baseArrivalTimeUTC}`);
            flightsFailedCount++;
            continue;
        }
        
        // Adjust arrival date if arrival time is on or before departure time (suggesting next day arrival)
        if (arrivalDateTime <= departureDateTime) {
          arrivalDateTime.setDate(arrivalDateTime.getDate() + 1);
        }
        
        const flightDocRef = doc(collection(db, "flights"));
        const flightDataForFirestore = {
          flightNumber: data.flightNumber,
          departureAirport: data.departureAirport,
          arrivalAirport: data.arrivalAirport,
          aircraftType: data.aircraftType,
          status: data.status,
          scheduledDepartureDateTimeUTC: departureDateTime.toISOString(),
          scheduledArrivalDateTimeUTC: arrivalDateTime.toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        };
        batch.set(flightDocRef, flightDataForFirestore);
        flightsCreatedCount++;
      } catch (e) {
        flightsFailedCount++;
        console.error(`Error processing date ${dateStr}:`, e);
      }
    }

    try {
        if (flightsCreatedCount > 0) {
            await batch.commit();
            toast({
                title: "Flight Creation Successful",
                description: `${flightsCreatedCount} flight(s) created. ${flightsFailedCount > 0 ? `${flightsFailedCount} failed.` : ''}`,
                action: flightsFailedCount > 0 ? <AlertTriangle className="text-destructive"/> : <CheckCircle className="text-green-500" />,
            });
            form.reset();
            router.push('/admin/flights'); 
        } else if (flightsFailedCount > 0) {
             toast({ title: "Flight Creation Failed", description: `No flights created. ${flightsFailedCount} date(s) could not be processed. Check console.`, variant: "destructive" });
        } else {
            // This case should be caught by the initial datesArray.length check, but as a fallback
            toast({ title: "No Flights to Create", description: "No valid dates were provided to create flights.", variant: "default" });
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
            Add New Flight(s)
          </CardTitle>
          <CardDescription>
            Define a flight template and specify dates to create multiple flight instances. All times are in UTC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="flightNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flight Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., BA245, UAL175" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="aircraftType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aircraft Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Boeing 787-9" {...field} />
                      </FormControl>
                      <FormDescription>You can include registration if desired.</FormDescription>
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
                      <FormLabel>Departure Airport (ICAO/IATA)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., EGLL, LHR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="arrivalAirport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrival Airport (ICAO/IATA)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., KJFK, JFK" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="baseDepartureTimeUTC"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Departure Time (UTC)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormDescription>Format: HH:MM (24-hour).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="baseArrivalTimeUTC"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Arrival Time (UTC)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormDescription>Format: HH:MM (24-hour).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="flightDates"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Dates (UTC)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter dates in YYYY-MM-DD format, one date per line. Example:
2024-08-01
2024-08-03
2024-08-05"
                        className="min-h-[120px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Each date will create a separate flight instance using the times and details above.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status for Created Flights</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select flight status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="On Time">On Time</SelectItem>
                        <SelectItem value="Delayed">Delayed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Flights...
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Flight(s)
                  </>
                )}
              </Button>
              {!form.formState.isValid && user && (
                <p className="text-sm text-destructive">Please fill all required fields correctly before submitting.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
    
