
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
import { Calendar as CalendarIcon, Loader2, AlertTriangle, CheckCircle, Save, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { formatISO, parseISO, format } from "date-fns";

const flightEditFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Airport code must be 3 characters.").max(4).toUpperCase(),
  arrivalAirport: z.string().min(3, "Airport code must be 3 characters.").max(4).toUpperCase(),
  scheduledDepartureDateTimeUTC: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid departure datetime."}),
  scheduledArrivalDateTimeUTC: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid arrival datetime."}),
  aircraftType: z.string().min(3, "Aircraft type must be at least 3 characters.").max(50),
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
  scheduledDepartureDateTimeUTC: string; // Stored as ISO string
  scheduledArrivalDateTimeUTC: string; // Stored as ISO string
  aircraftType: string;
  status: "Scheduled" | "On Time" | "Delayed" | "Cancelled";
}

export default function EditFlightPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const flightId = params.flightId as string;

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
      // Format to 'YYYY-MM-DDTHH:mm' which is expected by datetime-local
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (e) {
      console.warn("Error formatting date for input:", e);
      return ""; // Fallback or handle error
    }
  };


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
          const flightData = flightSnap.data() as Omit<FlightDocumentForEdit, 'id'>;
          form.reset({
            flightNumber: flightData.flightNumber,
            departureAirport: flightData.departureAirport,
            arrivalAirport: flightData.arrivalAirport,
            scheduledDepartureDateTimeUTC: toDatetimeLocalInputString(flightData.scheduledDepartureDateTimeUTC),
            scheduledArrivalDateTimeUTC: toDatetimeLocalInputString(flightData.scheduledArrivalDateTimeUTC),
            aircraftType: flightData.aircraftType,
            status: flightData.status,
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
    if (!user || user.role !== 'admin' || !flightId) {
      toast({ title: "Unauthorized or Missing ID", description: "Cannot update flight.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const flightDocRef = doc(db, "flights", flightId);
      await updateDoc(flightDocRef, {
        ...data,
        scheduledDepartureDateTimeUTC: new Date(data.scheduledDepartureDateTimeUTC).toISOString(),
        scheduledArrivalDateTimeUTC: new Date(data.scheduledArrivalDateTimeUTC).toISOString(),
        updatedAt: serverTimestamp(),
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
                    <FormField control={form.control} name="aircraftType" render={({ field }) => (<FormItem><FormLabel>Aircraft Type</FormLabel><FormControl><Input placeholder="e.g., Boeing 787-9" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="departureAirport" render={({ field }) => (<FormItem><FormLabel>Departure Airport (ICAO/IATA)</FormLabel><FormControl><Input placeholder="e.g., EGLL" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="arrivalAirport" render={({ field }) => (<FormItem><FormLabel>Arrival Airport (ICAO/IATA)</FormLabel><FormControl><Input placeholder="e.g., KJFK" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="scheduledDepartureDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Scheduled Departure (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormDescription>Date and Time in UTC</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="scheduledArrivalDateTimeUTC" render={({ field }) => (<FormItem><FormLabel>Scheduled Arrival (UTC)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormDescription>Date and Time in UTC</FormDescription><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select flight status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="On Time">On Time</SelectItem><SelectItem value="Delayed">Delayed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
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
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
