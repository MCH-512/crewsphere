
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Waypoints, PlaneTakeoff, PlaneLanding, UserCheck, Bed, Clock, Trash2, PlusCircle, Calculator } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// --- Time Helper Functions ---
const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const addMinutes = (time: string, mins: number): string => {
    const totalMinutes = timeToMinutes(time) + mins;
    return minutesToTime(totalMinutes);
};

const formatDuration = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
};

// --- Form Schema and Types ---
const formSchema = z.object({
  reportTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM format"),
  preFlightDuty: z.number().min(0, "Must be >= 0").default(60),
  flights: z.array(
    z.object({
      duration: z.number().min(1, "Must be > 0"),
      turnaround: z.number().min(0, "Must be >= 0").default(30),
    })
  ).min(1, "At least one flight sector is required."),
  postFlightDuty: z.number().min(0, "Must be >= 0").default(30),
});
type FormValues = z.infer<typeof formSchema>;

interface TimelineEvent {
    time: string;
    title: string;
    description: string;
    icon: React.ElementType;
}

// --- Page Component ---
export default function FlightTimelineCalculatorPage() {
    const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
    const [summary, setSummary] = React.useState<{ fdp: string, totalDuty: string } | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            reportTime: "08:00",
            preFlightDuty: 60,
            flights: [{ duration: 120, turnaround: 30 }],
            postFlightDuty: 30,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "flights",
    });

    const onSubmit = (data: FormValues) => {
        const events: TimelineEvent[] = [];
        let currentTime = data.reportTime;

        // 1. Report for Duty
        events.push({
            time: currentTime,
            title: "Report for Duty",
            description: `Pre-flight duties begin (${data.preFlightDuty} min)`,
            icon: UserCheck,
        });

        // 2. Departure
        currentTime = addMinutes(currentTime, data.preFlightDuty);
        events.push({
            time: currentTime,
            title: "Flight 1 Departure",
            description: `Block time starts. Flight duration: ${data.flights[0].duration} min.`,
            icon: PlaneTakeoff,
        });

        // Loop through flights and turnarounds
        data.flights.forEach((flight, index) => {
            // Arrival
            currentTime = addMinutes(currentTime, flight.duration);
            events.push({
                time: currentTime,
                title: `Flight ${index + 1} Arrival`,
                description: "On-blocks.",
                icon: PlaneLanding,
            });

            // Turnaround or Post-flight duty
            if (index < data.flights.length - 1) {
                const nextTurnaround = data.flights[index].turnaround;
                events.push({
                    time: currentTime,
                    title: "Turnaround Start",
                    description: `Ground time: ${nextTurnaround} min.`,
                    icon: Clock,
                });
                currentTime = addMinutes(currentTime, nextTurnaround);
                events.push({
                    time: currentTime,
                    title: `Flight ${index + 2} Departure`,
                    description: `Block time starts. Flight duration: ${data.flights[index+1].duration} min.`,
                    icon: PlaneTakeoff,
                });
            }
        });

        // End of FDP (on-blocks of last flight)
        const fdpEndTime = events[events.length -1].time;
        const fdpMinutes = timeToMinutes(fdpEndTime) - timeToMinutes(data.reportTime);

        // Post-flight duty
        currentTime = addMinutes(fdpEndTime, data.postFlightDuty);
        events.push({
            time: currentTime,
            title: "End of Duty",
            description: `Post-flight duties end (${data.postFlightDuty} min). Rest period begins.`,
            icon: Bed,
        });
        
        const totalDutyMinutes = timeToMinutes(currentTime) - timeToMinutes(data.reportTime);
        
        setTimeline(events);
        setSummary({
            fdp: formatDuration(fdpMinutes),
            totalDuty: formatDuration(totalDutyMinutes),
        });
    };

    // Calculate on initial load
    React.useEffect(() => {
        onSubmit(form.getValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center">
                        <Waypoints className="mr-3 h-7 w-7 text-primary" />
                        Flight Timeline Calculator
                    </CardTitle>
                    <CardDescription>
                        Visualize a flight duty period by entering report times and durations.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                <AnimatedCard className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" />Input Parameters</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField control={form.control} name="reportTime" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Report Time (Local)</FormLabel>
                                            <FormControl><Input type="time" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="preFlightDuty" render={({ field }) => (
                                            <FormItem><FormLabel>Pre-Flight (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="postFlightDuty" render={({ field }) => (
                                            <FormItem><FormLabel>Post-Flight (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    
                                    <Separator />
                                    
                                    <div>
                                        <FormLabel>Flight Sectors</FormLabel>
                                        <div className="space-y-4 mt-2">
                                        {fields.map((item, index) => (
                                            <div key={item.id} className="flex gap-2 items-end p-2 border rounded-md">
                                                <FormField control={form.control} name={`flights.${index}.duration`} render={({ field }) => (
                                                    <FormItem className="flex-1"><FormLabel>Flight {index+1} (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/></FormControl><FormMessage /></FormItem>
                                                )} />
                                                {index < fields.length - 1 && <FormField control={form.control} name={`flights.${index}.turnaround`} render={({ field }) => (
                                                    <FormItem className="flex-1"><FormLabel>Turnaround (min)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/></FormControl><FormMessage /></FormItem>
                                                )} />}
                                                {fields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                                            </div>
                                        ))}
                                        </div>
                                         <Button type="button" variant="outline" size="sm" onClick={() => append({ duration: 90, turnaround: 45 })} className="mt-2"><PlusCircle className="mr-2 h-4 w-4"/>Add Sector</Button>
                                    </div>

                                    <Button type="submit" className="w-full">Calculate Timeline</Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </AnimatedCard>

                <AnimatedCard delay={0.1} className="lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Generated Timeline</CardTitle>
                            {summary && (
                                <CardDescription>
                                    FDP: <span className="font-semibold text-primary">{summary.fdp}</span> | Total Duty: <span className="font-semibold text-primary">{summary.totalDuty}</span>
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="relative pl-8">
                                <div className="absolute left-[3px] top-0 h-full w-0.5 bg-border -z-10"></div>
                                <div className="space-y-8">
                                    {timeline.map((event, index) => {
                                        const Icon = event.icon;
                                        return (
                                            <div key={index} className="relative flex items-start gap-4">
                                                <div className="absolute -left-[18px] top-1 h-4 w-4 bg-primary rounded-full border-4 border-card z-10"></div>
                                                <div className="w-16 text-right font-mono text-sm shrink-0">{event.time}</div>
                                                <div className="flex-grow pt-0.5">
                                                    <h4 className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground"/>{event.title}</h4>
                                                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </AnimatedCard>
            </div>
        </div>
    );
}
