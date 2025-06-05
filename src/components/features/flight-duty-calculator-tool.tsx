
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, PlusCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { calculateFlightDuty, type FlightDutyOutput, type FlightDutyInput } from "@/ai/flows/flight-duty-calculator-flow";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const flightSegmentSchema = z.object({
  departureAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  arrivalAirport: z.string().min(3, "Min 3 chars").max(10, "Max 10 chars").toUpperCase(),
  departureTimeUTC: z.string().datetime({ message: "Invalid datetime string! Must be UTC." }),
  arrivalTimeUTC: z.string().datetime({ message: "Invalid datetime string! Must be UTC." }),
});

const FormSchema = z.object({
  flightSegments: z.array(flightSegmentSchema).min(1, "At least one flight segment is required."),
  preFlightBriefingHours: z.coerce.number().min(0, "Min 0 hours").max(5, "Max 5 hours"),
  postFlightDebriefingHours: z.coerce.number().min(0, "Min 0 hours").max(5, "Max 5 hours"),
});

type FlightDutyFormValues = z.infer<typeof FormSchema>;

export function FlightDutyCalculatorTool() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [dutyResult, setDutyResult] = React.useState<FlightDutyOutput | null>(null);
  const { toast } = useToast();

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
        { departureAirport: "KJFK", arrivalAirport: "EGLL", departureTimeUTC: defaultSegmentTime(), arrivalTimeUTC: defaultSegmentTime() },
      ],
      preFlightBriefingHours: 1,
      postFlightDebriefingHours: 0.5,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "flightSegments",
  });

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
        preFlightBriefingHours: data.preFlightBriefingHours,
        postFlightDebriefingHours: data.postFlightDebriefingHours,
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
          <div>
            <FormLabel className="text-lg font-semibold">Flight Segments</FormLabel>
            <FormDescription className="mb-4">Add one or more flight segments. All times must be in UTC.</FormDescription>
            {fields.map((field, index) => (
              <Card key={field.id} className="mb-4 p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name={`flightSegments.${index}.departureAirport`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure Airport</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., KJFK" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`flightSegments.${index}.arrivalAirport`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Arrival Airport</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., EGLL" {...field} />
                        </FormControl>
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
                    aria-label="Remove flight segment"
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

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="preFlightBriefingHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-md font-semibold">Pre-Flight Briefing (Hours)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormDescription>Duration before first departure.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postFlightDebriefingHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-md font-semibold">Post-Flight Debriefing (Hours)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormDescription>Duration after last arrival.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
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
        </form>
      </Form>

      {dutyResult && (
        <Card className="mt-8 shadow-md bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <Sparkles className="mr-2 h-6 w-6 text-primary" />
              AI-Calculated Flight Duty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">Duty Period Start (UTC):</p>
                <p className="text-primary">{new Date(dutyResult.dutyPeriodStartUTC).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</p>
              </div>
              <div>
                <p className="font-semibold">Duty Period End (UTC):</p>
                <p className="text-primary">{new Date(dutyResult.dutyPeriodEndUTC).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</p>
              </div>
              <div>
                <p className="font-semibold">Total Duty Time:</p>
                <p><Clock className="inline h-4 w-4 mr-1" />{dutyResult.totalDutyTimeHours.toFixed(2)} hours</p>
              </div>
              <div>
                <p className="font-semibold">Total Flight Time:</p>
                <p><Clock className="inline h-4 w-4 mr-1" />{dutyResult.totalFlightTimeHours.toFixed(2)} hours</p>
              </div>
            </div>
             {dutyResult.maxFlightTimeExceeded && (
              <div className="p-3 rounded-md border border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-semibold">Potential Max Flight Time Exceeded based on generic rules.</p>
              </div>
            )}
            <Separator />
            <div>
              <p className="font-semibold mb-1">Summary & Compliance Notes:</p>
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

