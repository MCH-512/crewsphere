
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, PlusCircle, XCircle, Clock, AlertTriangle, Users, Shield, Info } from "lucide-react";
import { calculateFlightDuty, type FlightDutyOutput, type FlightDutyInput } from "@/ai/flows/flight-duty-calculator-flow";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";
import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { searchAirports, type Airport } from "@/services/airport-service";

const DEBOUNCE_DELAY = 300; // milliseconds

const flightSegmentSchema = z.object({
  departureAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  arrivalAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  departureTimeUTC: z.string().datetime({ message: "Invalid datetime string! Must be UTC." }),
  arrivalTimeUTC: z.string().datetime({ message: "Invalid datetime string! Must be UTC." }),
});

const FormSchema = z.object({
  flightSegments: z.array(flightSegmentSchema).min(1, "At least one flight segment is required."),
  reportTimeOffsetHours: z.coerce.number().min(0, "Min 0 hours").max(5, "Max 5 hours"),
  postDutyActivitiesHours: z.coerce.number().min(0, "Min 0 hours").max(5, "Max 5 hours"),
  numberOfCrew: z.coerce.number().int().min(1, "Min 1 crew member").max(25, "Max 25 crew members"),
  crewType: z.enum(["PNT", "PNC"], { required_error: "Crew type is required."}),
  acclimatizationStatus: z.enum(["Acclimaté", "Non Acclimaté", "Inconnu"], { required_error: "Acclimatization status is required."}),
});

type FlightDutyFormValues = z.infer<typeof FormSchema>;

export function FlightDutyCalculatorTool() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [dutyResult, setDutyResult] = React.useState<FlightDutyOutput | null>(null);
  const { toast } = useToast();

  const [departureSearchTerm, setDepartureSearchTerm] = React.useState("");
  const [arrivalSearchTerm, setArrivalSearchTerm] = React.useState("");
  const [departureSuggestions, setDepartureSuggestions] = React.useState<Airport[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = React.useState<Airport[]>([]);
  const [isLoadingDeparture, setIsLoadingDeparture] = React.useState(false);
  const [isLoadingArrival, setIsLoadingArrival] = React.useState(false);


  const defaultSegmentTime = () => {
    const now = new Date();
    now.setMinutes(0);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now.toISOString();
  }

  const form = useForm<FlightDutyFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      flightSegments: [
        { departureAirport: "", arrivalAirport: "", departureTimeUTC: defaultSegmentTime(), arrivalTimeUTC: defaultSegmentTime() },
      ],
      reportTimeOffsetHours: 1,
      postDutyActivitiesHours: 0.5,
      numberOfCrew: 2,
      crewType: "PNT",
      acclimatizationStatus: "Acclimaté",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "flightSegments",
  });

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

  async function onSubmit(data: FlightDutyFormValues) {
    setIsLoading(true);
    setDutyResult(null);
    try {
      const input: FlightDutyInput = {
        flightSegments: data.flightSegments.map(segment => ({
            ...segment,
            departureTimeUTC: new Date(segment.departureTimeUTC).toISOString(),
            arrivalTimeUTC: new Date(segment.arrivalTimeUTC).toISOString(),
        })),
        reportTimeOffsetHours: data.reportTimeOffsetHours,
        postDutyActivitiesHours: data.postDutyActivitiesHours,
        numberOfCrew: data.numberOfCrew,
        crewType: data.crewType,
        acclimatizationStatus: data.acclimatizationStatus,
      };
      const result = await calculateFlightDuty(input);
      setDutyResult(result);
      toast({
        title: "Flight Duty Calculated",
        description: "AI analysis of duty period is complete.",
      });
    } catch (error) {
      console.error("Error calculating flight duty:", error);
      let errorMessage = "Failed to calculate flight duty. Please try again.";
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
          {/* Crew and General Duty Parameters */}
          <Card>
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Crew & Duty Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                        control={form.control}
                        name="crewType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Crew Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select crew type" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="PNT">PNT (Flight Crew)</SelectItem>
                                <SelectItem value="PNC">PNC (Cabin Crew)</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="numberOfCrew"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Number of Crew</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Total in this group.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="acclimatizationStatus"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Acclimatization</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Acclimaté">Acclimaté</SelectItem>
                                <SelectItem value="Non Acclimaté">Non Acclimaté</SelectItem>
                                <SelectItem value="Inconnu">Inconnu</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <FormField
                    control={form.control}
                    name="reportTimeOffsetHours"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Report Time / Pre-Flight Duties (Hours)</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                        <FormDescription>Time before first departure.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="postDutyActivitiesHours"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Post-Flight Duties (Hours)</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                        <FormDescription>Time after last arrival.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            </CardContent>
          </Card>
          
          <Separator />

          <div>
            <FormLabel className="text-lg font-semibold">Flight Segments</FormLabel>
            <FormDescription className="mb-4">Add one or more flight segments. All times must be in UTC.</FormDescription>
            {fields.map((field, index) => (
              <Card key={field.id} className="mb-4 p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name={`flightSegments.${index}.departureAirport`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Departure Airport</FormLabel>
                        <CustomAutocompleteAirport
                          value={formField.value}
                          onSelect={(airport) => form.setValue(`flightSegments.${index}.departureAirport`, airport ? (airport.icao || airport.iata) : "", { shouldValidate: true })}
                          placeholder="Search departure..."
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
                    name={`flightSegments.${index}.arrivalAirport`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Arrival Airport</FormLabel>
                        <CustomAutocompleteAirport
                          value={formField.value}
                          onSelect={(airport) => form.setValue(`flightSegments.${index}.arrivalAirport`, airport ? (airport.icao || airport.iata) : "", { shouldValidate: true })}
                          placeholder="Search arrival..."
                          airports={arrivalSuggestions}
                          isLoading={isLoadingArrival}
                          onInputChange={setArrivalSearchTerm}
                          currentSearchTerm={arrivalSearchTerm}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`flightSegments.${index}.departureTimeUTC`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure Time (UTC)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} 
                            value={field.value ? new Date(new Date(field.value).getTime() - new Date(field.value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                            onChange={e => field.onChange(new Date(e.target.value).toISOString())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`flightSegments.${index}.arrivalTimeUTC`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Arrival Time (UTC)</FormLabel>
                        <FormControl>
                           <Input type="datetime-local" {...field} 
                            value={field.value ? new Date(new Date(field.value).getTime() - new Date(field.value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                            onChange={e => field.onChange(new Date(e.target.value).toISOString())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                    className="mb-1"
                    aria-label={`Remove flight segment ${index + 1}`}
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ departureAirport: "", arrivalAirport: "", departureTimeUTC: defaultSegmentTime(), arrivalTimeUTC: defaultSegmentTime() })}
              className="mt-2"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Flight Segment
            </Button>
          </div>
          
          <Button type="submit" disabled={isLoading || !form.formState.isValid} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculating Duty...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Calculate Flight Duty
              </>
            )}
          </Button>
          {!form.formState.isValid && (<p className="text-sm text-destructive mt-2">Please fill all required fields correctly.</p>)}
        </form>
      </Form>

      {dutyResult && (
        <Card className="mt-8 shadow-md bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <Sparkles className="mr-2 h-6 w-6 text-primary" />
              AI-Calculated Flight Duty Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                <Card className="p-4 bg-card">
                  <p className="font-semibold text-muted-foreground">Duty Period Start (UTC)</p>
                  <p className="text-lg font-bold text-primary">{new Date(dutyResult.dutyPeriodStartUTC).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}</p>
                </Card>
                <Card className="p-4 bg-card">
                  <p className="font-semibold text-muted-foreground">Duty Period End (UTC)</p>
                  <p className="text-lg font-bold text-primary">{new Date(dutyResult.dutyPeriodEndUTC).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}</p>
                </Card>
                <Card className="p-4 bg-card col-span-1 md:col-span-2 lg:col-span-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4"/>Total Duty</p>
                    <p className="text-lg font-bold">{dutyResult.totalDutyTimeHours.toFixed(2)} hrs</p>
                  </div>
                   <div>
                    <p className="font-semibold text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4"/>Total Flight</p>
                    <p className="text-lg font-bold">{dutyResult.totalFlightTimeHours.toFixed(2)} hrs</p>
                  </div>
                </Card>
            </div>
            
            {dutyResult.dutyTimeExceeded ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Potential Duty Time Exceeded</AlertTitle>
                <ShadAlertDescription>
                  The calculated total duty time ({dutyResult.totalDutyTimeHours.toFixed(2)} hrs) exceeds the AI's estimated maximum allowable duty time ({dutyResult.maxDutyTimeHours.toFixed(2)} hrs).
                </ShadAlertDescription>
              </Alert>
            ) : (
                 <Alert variant="success">
                    <Shield className="h-5 w-5"/>
                    <AlertTitle>Within Estimated Limits</AlertTitle>
                    <ShadAlertDescription>
                        The calculated total duty time ({dutyResult.totalDutyTimeHours.toFixed(2)} hrs) is within the AI's estimated maximum allowable duty time ({dutyResult.maxDutyTimeHours.toFixed(2)} hrs).
                    </ShadAlertDescription>
                 </Alert>
            )}

            <div className="space-y-4 pt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-md flex items-center gap-2"><Info className="h-4 w-4 text-primary"/>Flight Time Compliance Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{dutyResult.flightTimeComplianceNotes}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-md flex items-center gap-2"><Info className="h-4 w-4 text-primary"/>Duty Time Compliance Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{dutyResult.dutyTimeComplianceNotes}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-md flex items-center gap-2"><Info className="h-4 w-4 text-primary"/>Rest Requirements Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{dutyResult.restRequirementsNotes}</p></CardContent>
                </Card>
            </div>
            
            <Separator />
            <div>
              <p className="font-semibold mb-1 text-lg">Overall Summary:</p>
              <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                <p className="whitespace-pre-wrap">{dutyResult.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
