
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ShieldAlert, Timer, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Separator } from "@/components/ui/separator";
import { useDebounce } from "@/packages/use-debounce";

// --- FTL Data and Logic ---

const FDP_TABLE_ACCLIMATISED = [
    { start: "06:00-13:29", fdp: "13:00" }, { start: "13:30-13:59", fdp: "12:45" },
    { start: "14:00-14:29", fdp: "12:30" }, { start: "14:30-14:59", fdp: "12:15" },
    { start: "15:00-15:29", fdp: "12:00" }, { start: "15:30-15:59", fdp: "11:45" },
    { start: "16:00-16:59", fdp: "11:30" }, { start: "17:00-21:59", fdp: "11:00" },
    { start: "22:00-22:29", fdp: "10:45" }, { start: "22:30-22:59", fdp: "10:30" },
    { start: "23:00-23:29", fdp: "10:15" }, { start: "23:30-23:59", fdp: "10:00" },
    { start: "00:00-00:29", fdp: "09:45" }, { start: "00:30-00:59", fdp: "09:30" },
    { start: "01:00-01:29", fdp: "09:15" }, { start: "01:30-05:59", fdp: "09:00" },
];

const FDP_TABLE_NOT_ACCLIMATISED = [
    { start: "06:00-12:29", fdp: "11:00" }, { start: "12:30-12:59", fdp: "10:45" },
    { start: "13:00-13:29", fdp: "10:30" }, { start: "13:30-13:59", fdp: "10:15" },
    { start: "14:00-21:59", fdp: "10:00" }, { start: "22:00-22:29", fdp: "09:45" },
    { start: "22:30-22:59", fdp: "09:30" }, { start: "23:00-23:29", fdp: "09:15" },
    { start: "23:30-05:59", fdp: "09:00" },
];

const timeToMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const minutesToTime = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const minutesToTimeH24 = (totalMinutes: number) => { const hours = Math.floor(totalMinutes / 60) % 24; const minutes = totalMinutes % 60; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; };

const findMaxFDP = (reportTime: string, table: typeof FDP_TABLE_ACCLIMATISED) => {
    const reportMinutes = timeToMinutes(reportTime);
    for (const entry of table) {
        const [startRange, endRange] = entry.start.split('-').map(timeToMinutes);
        if (startRange <= endRange) {
            if (reportMinutes >= startRange && reportMinutes <= endRange) return timeToMinutes(entry.fdp);
        } else { // Handles overnight ranges like 22:00-05:59
            if (reportMinutes >= startRange || reportMinutes <= endRange) return timeToMinutes(entry.fdp);
        }
    }
    return 0;
};

// --- Form Schema and Types ---

const formSchema = z.object({
  reportTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  proposedArrivalTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)" }).optional().or(z.literal("")),
  sectors: z.number().min(1, "At least 1 sector").max(10, "Max 10 sectors"),
  acclimatisation: z.enum(["acclimatised", "not_acclimatised"]),
});
type FormValues = z.infer<typeof formSchema>;

// --- Page Component ---

export default function FtlCalculatorPage() {
    const [result, setResult] = React.useState<any | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { reportTime: "08:00", proposedArrivalTime: "", sectors: 2, acclimatisation: "acclimatised" },
        mode: "onChange",
    });

    const formValues = form.watch();
    const debouncedFormValues = useDebounce(formValues, 300);

    const calculateFDP = React.useCallback((data: FormValues) => {
        if (!form.formState.isValid) {
            setResult(null);
            return;
        }
        
        const { reportTime, sectors, acclimatisation, proposedArrivalTime } = data;
        
        const table = acclimatisation === 'acclimatised' ? FDP_TABLE_ACCLIMATISED : FDP_TABLE_NOT_ACCLIMATISED;
        const baseFDPMinutes = findMaxFDP(reportTime, table);
        const sectorReductions = sectors > 2 ? (sectors - 2) * 30 : 0;
        const fdpAfterSectors = baseFDPMinutes - sectorReductions;
        const reportMinutes = timeToMinutes(reportTime);
        const fdpEndMinutes = reportMinutes + fdpAfterSectors;
        const woclStart = timeToMinutes("02:00");
        const woclEnd = timeToMinutes("05:59");
        
        const infringesToday = Math.max(reportMinutes, woclStart) < Math.min(fdpEndMinutes, woclEnd);
        const infringesTomorrow = Math.max(reportMinutes, woclStart + 1440) < Math.min(fdpEndMinutes, woclEnd + 1440);
        const woclInfringement = infringesToday || infringesTomorrow;

        const woclLimitMinutes = timeToMinutes("11:00");
        const fdpWithWOCL = woclInfringement ? Math.min(fdpAfterSectors, woclLimitMinutes) : fdpAfterSectors;
        const latestOffBlockTime = minutesToTimeH24(reportMinutes + fdpWithWOCL);
        const extensionPossible = sectors <= 4;
        const extendedFDP = minutesToTime(fdpWithWOCL + 60);

        let minRest = Math.max(timeToMinutes("10:00"), fdpWithWOCL);
        if (acclimatisation === 'acclimatised') minRest = Math.max(timeToMinutes("12:00"), fdpWithWOCL);
        
        let feasibilityResult = null;
        if (proposedArrivalTime) {
            let arrivalMinutes = timeToMinutes(proposedArrivalTime);
            if (arrivalMinutes < reportMinutes) arrivalMinutes += 24 * 60;
            const plannedFDPMinutes = arrivalMinutes - reportMinutes;
            const isFeasible = plannedFDPMinutes <= fdpWithWOCL;
            const differenceMinutes = Math.abs(plannedFDPMinutes - fdpWithWOCL);
            
            feasibilityResult = { isFeasible, plannedFDP: minutesToTime(plannedFDPMinutes), difference: minutesToTime(differenceMinutes) };
        }

        setResult({
            baseFDP: minutesToTime(baseFDPMinutes),
            sectorReductions: minutesToTime(sectorReductions),
            fdpAfterSectors: minutesToTime(fdpAfterSectors),
            woclInfringement,
            finalFDP: minutesToTime(fdpWithWOCL),
            latestOffBlock: latestOffBlockTime,
            extension: { possible: extensionPossible, newFDP: extendedFDP },
            minRest: minutesToTime(minRest),
            feasibility: feasibilityResult,
        });
    }, [form.formState.isValid]);
    
    React.useEffect(() => {
        calculateFDP(debouncedFormValues);
    }, [debouncedFormValues, calculateFDP]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center">
                        <ShieldAlert className="mr-3 h-7 w-7 text-primary" />
                        EASA FTL Calculator
                    </CardTitle>
                    <CardDescription>
                        Calculate maximum Flight Duty Period (FDP), minimum rest, and check flight feasibility based on EASA ORO.FTL.205.
                    </CardDescription>
                </CardHeader>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <AnimatedCard>
                    <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Duty Details</CardTitle>
                          <CardDescription>Results will update automatically.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form className="space-y-6">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="reportTime" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Report Time (Local)</FormLabel>
                                                <FormControl><Input type="time" {...field} /></FormControl>
                                                <FormDescription>Duty start time.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="proposedArrivalTime" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Proposed Arrival (Local)</FormLabel>
                                                <FormControl><Input type="time" {...field} /></FormControl>
                                                <FormDescription>Final on-block time.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                     </div>
                                     <FormField control={form.control} name="sectors" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Number of Sectors</FormLabel>
                                            <FormControl><Input type="number" min="1" max="10" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl>
                                             <FormDescription>The number of flights in this duty.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="acclimatisation" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Acclimatisation State</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="acclimatised">Acclimatised</SelectItem>
                                                    <SelectItem value="not_acclimatised">Not Acclimatised</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </AnimatedCard>

                <AnimatedCard delay={0.1}>
                    {result ? (
                        <Card>
                           <CardHeader>
                               <CardTitle className="text-lg">Calculation Results</CardTitle>
                               <CardDescription>Based on the provided details.</CardDescription>
                           </CardHeader>
                           <CardContent className="space-y-4">

                                <div className="space-y-2 text-sm p-3 rounded-md border bg-muted/50">
                                   <p className="flex justify-between">Base FDP from Table: <span>{result.baseFDP}</span></p>
                                   <p className="flex justify-between">Sector Reductions ({form.getValues('sectors')} sectors): <span className="text-destructive">- {result.sectorReductions}</span></p>
                                   <Separator className="my-1"/>
                                   <p className="flex justify-between font-medium">FDP after Reductions: <span>{result.fdpAfterSectors}</span></p>
                                   {result.woclInfringement && (
                                       <p className="flex justify-between items-center text-destructive font-semibold">
                                            <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4"/>WOCL Infringement</span>
                                            <span>(Limited to 11:00)</span>
                                       </p>
                                   )}
                                </div>

                                <div className="flex justify-between items-center p-3 rounded-md bg-muted">
                                   <span className="font-medium text-lg">Max Permissible FDP</span>
                                   <span className="font-mono text-2xl font-bold text-primary">{result.finalFDP}</span>
                               </div>
                               
                               <div className="text-sm space-y-2">
                                   <p className="flex justify-between"><strong>Latest On-Blocks Time:</strong> <span>{result.latestOffBlock}</span></p>
                                   <p className="flex justify-between"><strong>Min. Rest Period Required:</strong> <span>{result.minRest}</span></p>
                               </div>

                               {result.extension.possible && (
                                   <>
                                     <Separator/>
                                     <div className="text-sm space-y-2">
                                        <p className="font-semibold text-green-700">Extension Possible (+1h)</p>
                                        <p className="flex justify-between"><strong>Extended FDP:</strong> <span>{result.extension.newFDP}</span></p>
                                     </div>
                                   </>
                               )}

                                {result.feasibility && (
                                    <>
                                        <Separator className="my-4"/>
                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-md">Feasibility Check</h4>
                                            {result.feasibility.isFeasible ? (
                                                <div className="flex items-center gap-2 text-green-700 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                                                    <CheckCircle className="h-5 w-5" />
                                                    <span className="font-bold">Flight is Feasible</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-destructive p-2 rounded-md bg-destructive/10 border border-destructive/20">
                                                    <AlertTriangle className="h-5 w-5" />
                                                    <span className="font-bold">Exceeds Max FDP by {result.feasibility.difference}</span>
                                                </div>
                                            )}
                                            <div className="text-sm space-y-1 text-muted-foreground">
                                               <p className="flex justify-between">Planned FDP (from inputs): <span>{result.feasibility.plannedFDP}</span></p>
                                               <p className="flex justify-between">Max Allowed FDP (calculated): <span>{result.finalFDP}</span></p>
                                            </div>
                                        </div>
                                    </>
                                )}
                           </CardContent>
                        </Card>
                    ) : (
                         <Card className="h-full flex flex-col items-center justify-center text-center">
                            <CardContent>
                                <Timer className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-4 text-muted-foreground">Results will be displayed here.</p>
                                 <p className="text-xs text-muted-foreground mt-1">Fill out the form to calculate.</p>
                            </CardContent>
                         </Card>
                    )}
                </AnimatedCard>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5"/>Rules & Definitions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="fdp">
                            <AccordionTrigger>What is FDP?</AccordionTrigger>
                            <AccordionContent>
                                A Flight Duty Period (FDP) is the period which commences when a crew member is required to report for duty, which includes a flight or a series of flights, and finishes when the aircraft finally comes to rest and the engines are shut down, at the end of the last flight on which he/she is a crew member.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="acclimatisation">
                            <AccordionTrigger>What is Acclimatisation?</AccordionTrigger>
                            <AccordionContent>
                                A state in which a crew member's circadian biological clock is synchronised to the time of the area to which the crew member is exposed. A crew member is considered to be acclimatised to a 2-hour wide time zone surrounding the local time at the point of departure. When the local time at the place where a duty commences differs by more than 2 hours from the local time at the place where the crew member was last acclimatised, the crew member, for the calculation of the maximum FDP, is considered to be in an unknown state of acclimatisation.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="wocl">
                            <AccordionTrigger>What is WOCL?</AccordionTrigger>
                            <AccordionContent>
                                The Window of Circadian Low (WOCL) is the period between 02:00 and 05:59 hours in the time zone to which a crew member is acclimatised. When any part of a duty infringes on this period, the maximum FDP is reduced to manage fatigue.
                            </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="disclaimer">
                            <AccordionTrigger className="text-destructive">Disclaimer</AccordionTrigger>
                            <AccordionContent className="text-destructive/80">
                                This calculator is for informational and guidance purposes only and should not be used as a substitute for official flight planning and rostering systems. Always refer to your airline's official Operations Manual and all applicable EASA regulations. The creators of this tool are not liable for any errors or omissions.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

        </div>
    );
}
