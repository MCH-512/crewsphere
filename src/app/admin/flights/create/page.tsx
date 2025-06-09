
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
import { Plane, Loader2, AlertTriangle, CheckCircle, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

const flightFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Airport code must be 3 characters.").max(4).toUpperCase(),
  arrivalAirport: z.string().min(3, "Airport code must be 3 characters.").max(4).toUpperCase(),
  scheduledDepartureDateTimeUTC: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid departure date/time." }),
  scheduledArrivalDateTimeUTC: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid arrival date/time." }),
  aircraftType: z.string().min(3, "Aircraft type must be at least 3 characters.").max(50),
  status: z.enum(["Scheduled", "On Time", "Delayed", "Cancelled"], { required_error: "Please select a flight status." }),
});

type FlightFormValues = z.infer<typeof flightFormSchema>;

const defaultValues: Partial<FlightFormValues> = {
  flightNumber: "",
  departureAirport: "",
  arrivalAirport: "",
  scheduledDepartureDateTimeUTC: new Date().toISOString().slice(0, 16),
  scheduledArrivalDateTimeUTC: new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16), // Default to 2 hours later
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
    try {
      await addDoc(collection(db, "flights"), {
        ...data,
        scheduledDepartureDateTimeUTC: new Date(data.scheduledDepartureDateTimeUTC).toISOString(),
        scheduledArrivalDateTimeUTC: new Date(data.scheduledArrivalDateTimeUTC).toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      });

      toast({
        title: "Flight Created Successfully",
        description: `Flight ${data.flightNumber} has been added to the schedule.`,
        action: <CheckCircle className="text-green-500" />,
      });
      form.reset();
      router.push('/admin/flights'); // Redirect to the flights list page
    } catch (error) {
      console.error("Error creating flight in Firestore:", error);
      toast({ title: "Creation Failed", description: "Could not create the flight. Please try again.", variant: "destructive" });
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
            <PlusCircle className="mr-3 h-7 w-7 text-primary" />
            Add New Flight
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new flight to the system. All times are in UTC.
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
                        <Input placeholder="e.g., Boeing 787-9, Airbus A320neo" {...field} />
                      </FormControl>
                      <FormDescription>You can include registration if desired, e.g., "Boeing 787-9 (G-ABCD)".</FormDescription>
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
                  name="scheduledDepartureDateTimeUTC"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Departure (UTC)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>Date and Time in UTC.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledArrivalDateTimeUTC"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Arrival (UTC)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>Date and Time in UTC.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
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

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Flight...
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Flight
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

    