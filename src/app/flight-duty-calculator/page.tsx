
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calculator, AlertTriangle, Clock, Hash, SunMoon, Bed, Table as TableIcon, PlaneLanding, UserCheck, Timer, BedDouble, Hotel } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Switch } from "@/components/ui/switch";

const timeStringToHours = (timeStr: string) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours + minutes / 60;
};

const calculatorSchema = z.object({
  reportTime: z.string().nonempty({ message: "Report time is required." }),
  sectors: z.coerce.number().min(1).max(10),
  acclimatisation: z.enum(["acclimatised", "unacclimatised"]),
  inFlightRest: z.enum(["none", "class3", "class2", "class1"]),
  isSplitDuty: z.boolean().default(false),
  splitDutyBreak: z.string().optional().refine(
      (val) => !val || /^\d{1,2}:\d{2}$/.test(val),
      "Use HH:MM format (e.g., 04:00)"
  ),
  commandersDiscretion: z.enum(["none", "1h", "2h"]).default("none"),
  previousDutyLength: z.string().optional().refine(
      (val) => !val || /^\d{1,2}:\d{2}$/.test(val),
      "Use HH:MM format (e.g., 10:30)"
    ),
  precedingRestLength: z.string().optional().refine(
      (val) => !val || /^\d{1,2}:\d{2}$/.test(val),
      "Use HH:MM format (e.g., 09:00)"
  ),
}).superRefine((data, ctx) => {
    if (data.isSplitDuty && (!data.splitDutyBreak || !/^\d{1,2}:\d{2}$/.test(data.splitDutyBreak))) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Break duration is required for Split Duty.",
            path: ["splitDutyBreak"],
        });
    }
});

type CalculatorValues = z.infer<typeof calculatorSchema>;

interface CalculationResult {
  maxFDP: string;
  finalFDP: string;
  potentialFDPWithExtension: string | null;
  minRest: string;
  minRestNote: string | null;
  latestOnBlocks: string;
  breakdown: {
    label: string;
    value: string;
    adjustment?: string;
    icon: React.ElementType;
  }[];
}

// --- EASA FTL Data ---

const fdpTableAcclimatised = [
  // 06:00 - 13:29
  { start: 6, end: 13.49, sectors: [ {max: 2, fdp: 13}, {max: 3, fdp: 12.5}, {max: 4, fdp: 12}, {max: 5, fdp: 11.5}, {max: 6, fdp: 11}, {max: 7, fdp: 10.5}, {max: 8, fdp: 10}, {max: 9, fdp: 9.5}, {max: 10, fdp: 9} ] },
  // 13:30 - 16:59
  { start: 13.5, end: 16.99, sectors: [ {max: 2, fdp: 12}, {max: 3, fdp: 11.5}, {max: 4, fdp: 11}, {max: 5, fdp: 10.5}, {max: 6, fdp: 10}, {max: 10, fdp: 9} ] },
  // 17:00 - 04:59 (WOCL)
  { start: 17, end: 4.99, sectors: [ {max: 1, fdp: 11.5}, {max: 2, fdp: 11}, {max: 3, fdp: 10.5}, {max: 4, fdp: 10}, {max: 10, fdp: 9} ] },
  // 05:00 - 05:59
  { start: 5, end: 5.99, sectors: [ {max: 2, fdp: 11}, {max: 3, fdp: 10.5}, {max: 4, fdp: 10}, {max: 10, fdp: 9} ] },
];

const fdpTableUnacclimatised = { fdp: 11, reduction: -1 }; // Base 11h, reduction of 1h for > 4 sectors.

const fdpExtensions = {
    none: { text: "No extension." },
    class3: { text: "Up to 14h FDP possible." },
    class2: { text: "Up to 16h FDP possible." },
    class1: { text: "Up to 18h FDP possible." },
};

const formatHours = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};


export default function FlightDutyCalculatorPage() {
  const [result, setResult] = React.useState<CalculationResult | null>(null);

  const form = useForm<CalculatorValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      reportTime: "08:00",
      sectors: 4,
      acclimatisation: "acclimatised",
      inFlightRest: "none",
      isSplitDuty: false,
      splitDutyBreak: "03:00",
      commandersDiscretion: "none",
      previousDutyLength: "10:30",
      precedingRestLength: "",
    },
  });
  
  const isSplitDuty = form.watch("isSplitDuty");

  function onSubmit(values: CalculatorValues) {
    const reportHour = parseFloat(values.reportTime.replace(':', '.'));
    const sectors = values.sectors;
    const breakdown: CalculationResult['breakdown'] = [];

    let baseFDP = 0;
    let tableLabel = "";

    if (values.acclimatisation === "acclimatised") {
      tableLabel = "EASA ORO.FTL.205 Table B";
      const timeBand = fdpTableAcclimatised.find(band => {
        if (band.start > band.end) { // Handles WOCL wrap-around (e.g., 17:00-04:59)
          return reportHour >= band.start || reportHour <= band.end;
        }
        return reportHour >= band.start && reportHour <= band.end;
      });

      if (timeBand) {
        const sectorBand = timeBand.sectors.find(sBand => sectors <= sBand.max);
        baseFDP = sectorBand ? sectorBand.fdp : 9; // Default to 9h if sectors exceed table
      }
    } else { // Unacclimatised
      tableLabel = "EASA ORO.FTL.205 (Unacclimatised)";
      baseFDP = fdpTableUnacclimatised.fdp;
      if (sectors > 4) {
        baseFDP += fdpTableUnacclimatised.reduction;
        breakdown.push({ label: "Sector Adjustment", value: formatHours(fdpTableUnacclimatised.reduction), adjustment: `Reduction for ${sectors} sectors while unacclimatised.`, icon: Hash });
      }
    }

    breakdown.unshift({ label: tableLabel, value: formatHours(baseFDP), adjustment: `Report time ${values.reportTime} & ${sectors} sectors.`, icon: TableIcon });

    let finalFDP = baseFDP;
    let splitDutyBreakHours = 0;
    let splitDutyExtensionHours = 0;

    if(values.isSplitDuty && values.splitDutyBreak) {
        splitDutyBreakHours = timeStringToHours(values.splitDutyBreak);
        if (splitDutyBreakHours >= 3) { // Split duty requires a minimum break
            splitDutyExtensionHours = splitDutyBreakHours * 0.5;
            finalFDP += splitDutyExtensionHours;
            breakdown.push({ label: "Split Duty Extension", value: `+${formatHours(splitDutyExtensionHours)}`, adjustment: `For a break of ${formatHours(splitDutyBreakHours)}.`, icon: Hotel });
        }
    }

    if (values.commandersDiscretion !== 'none') {
        const discretionHours = parseInt(values.commandersDiscretion, 10);
        finalFDP += discretionHours;
        breakdown.push({ label: "Commander's Discretion", value: `+${formatHours(discretionHours)}`, adjustment: "Extension applied at commander's discretion.", icon: UserCheck });
    }

    const extensionInfo = fdpExtensions[values.inFlightRest];
    let potentialFDPWithExtension = null;
    if (values.inFlightRest !== 'none') {
        potentialFDPWithExtension = extensionInfo.text;
        breakdown.push({ label: "In-Flight Rest", value: `Potential: ${extensionInfo.text.split(" ")[2]}`, adjustment: "Extension subject to crew composition and rest duration.", icon: Bed });
    }

    const previousDutyHours = values.previousDutyLength ? timeStringToHours(values.previousDutyLength) : 0;
    const minRestHours = Math.max(previousDutyHours, 12); // Assuming rest at home base (12h)

    const precedingRestHours = values.precedingRestLength ? timeStringToHours(values.precedingRestLength) : null;
    let minRestNote = null;
    if (precedingRestHours !== null && precedingRestHours < 10) {
        minRestNote = "Preceding rest was reduced. Check regulations for compensatory rest requirements.";
    }


    // --- Calculate Latest On-Blocks Time ---
    const [reportHours, reportMinutes] = values.reportTime.split(':').map(Number);
    const reportTotalMinutes = reportHours * 60 + reportMinutes;
    const fdpTotalMinutes = finalFDP * 60;
    const breakTotalMinutes = splitDutyBreakHours * 60;
    const endTotalMinutes = reportTotalMinutes + fdpTotalMinutes + breakTotalMinutes;

    const endDayOffset = Math.floor(endTotalMinutes / (24 * 60));
    const endHour = Math.floor((endTotalMinutes % (24 * 60)) / 60);
    const endMinute = Math.round(endTotalMinutes % 60);

    const formattedEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')} Local`;
    const latestOnBlocksDisplay = `${formattedEndTime}${endDayOffset > 0 ? ` (+${endDayOffset} day${endDayOffset > 1 ? 's' : ''})` : ''}`;

    setResult({
      maxFDP: formatHours(baseFDP),
      finalFDP: formatHours(finalFDP),
      potentialFDPWithExtension,
      minRest: formatHours(minRestHours),
      minRestNote,
      latestOnBlocks: latestOnBlocksDisplay,
      breakdown,
    });
  }

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Calculator className="mr-3 h-7 w-7 text-primary" />
              EASA Flight Duty Calculator
            </CardTitle>
            <CardDescription>
              Estimate maximum Flight Duty Period (FDP) and minimum rest based on EASA ORO.FTL.205 regulations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
                <FormField control={form.control} name="reportTime" render={({ field }) => (
                  <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><Clock/> Report Time (Local)</FormLabel>
                    <div className="md:col-span-2">
                      <FormControl><Input type="time" {...field} className="max-w-xs" /></FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}/>
                <FormField control={form.control} name="sectors" render={({ field }) => (
                   <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><Hash/> Number of Sectors</FormLabel>
                     <div className="md:col-span-2">
                        <Select onValueChange={(val) => field.onChange(parseInt(val, 10))} defaultValue={String(field.value)}>
                          <FormControl><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(s => <SelectItem key={s} value={String(s)}>{s} Sector{s > 1 ? 's' : ''}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                    </div>
                  </FormItem>
                )}/>
                <FormField control={form.control} name="acclimatisation" render={({ field }) => (
                  <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><SunMoon/> Crew State</FormLabel>
                     <div className="md:col-span-2">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="acclimatised">Acclimatised</SelectItem>
                            <SelectItem value="unacclimatised">Unacclimatised</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                    </div>
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="isSplitDuty" render={({ field }) => (
                   <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                     <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><Hotel/> Split Duty</FormLabel>
                      <div className="md:col-span-2 flex items-center pt-1">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </div>
                  </FormItem>
                )}/>
                {isSplitDuty && (
                    <FormField control={form.control} name="splitDutyBreak" render={({ field }) => (
                       <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                         <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5">Break Duration</FormLabel>
                          <div className="md:col-span-2">
                            <FormControl><Input placeholder="HH:MM (e.g., 04:00)" {...field} className="max-w-xs" /></FormControl>
                            <FormDescription className="mt-1">Duration of break in suitable accommodation.</FormDescription>
                            <FormMessage />
                        </div>
                      </FormItem>
                    )}/>
                )}
                <FormField control={form.control} name="inFlightRest" render={({ field }) => (
                  <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><Bed/> In-Flight Rest Facilities</FormLabel>
                     <div className="md:col-span-2">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">None / Class 3 Seat</SelectItem>
                            <SelectItem value="class3">Class 3 Seat (Leg & foot support)</SelectItem>
                            <SelectItem value="class2">Class 2 Bunk / Lie-flat Seat</SelectItem>
                            <SelectItem value="class1">Class 1 Bunk</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                    </div>
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="commandersDiscretion" render={({ field }) => (
                   <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                     <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><UserCheck/> Commander's Discretion</FormLabel>
                      <div className="md:col-span-2">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="1h">+1 Hour</SelectItem>
                            <SelectItem value="2h">+2 Hours</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="mt-1">Optional extension to the FDP.</FormDescription>
                        <FormMessage />
                      </div>
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="previousDutyLength" render={({ field }) => (
                   <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                     <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><Timer/> Preceding Duty Length</FormLabel>
                      <div className="md:col-span-2">
                        <FormControl><Input placeholder="HH:MM (e.g., 10:30)" {...field} className="max-w-xs" /></FormControl>
                        <FormDescription className="mt-1">Optional: For calculating minimum rest period.</FormDescription>
                        <FormMessage />
                    </div>
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="precedingRestLength" render={({ field }) => (
                   <FormItem className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                     <FormLabel className="md:col-span-1 flex items-center gap-2 pt-1.5"><BedDouble/> Preceding Rest Length</FormLabel>
                      <div className="md:col-span-2">
                        <FormControl><Input placeholder="HH:MM (e.g., 09:00)" {...field} className="max-w-xs" /></FormControl>
                        <FormDescription className="mt-1">Optional: For identifying potential compensatory rest.</FormDescription>
                        <FormMessage />
                    </div>
                  </FormItem>
                )}/>
                <Button type="submit">Calculate</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </AnimatedCard>

      {result && (
        <AnimatedCard delay={0.1}>
            <Card>
                <CardHeader>
                    <CardTitle>Calculation Result</CardTitle>
                    <CardDescription>Based on EASA FTL regulations. This is not a substitute for official flight planning.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Alert variant="success" className="h-full">
                            <AlertTitle className="font-bold text-lg">Final Max FDP</AlertTitle>
                            <AlertDescription className="text-2xl font-mono font-bold text-success-foreground/90">{result.finalFDP}</AlertDescription>
                        </Alert>
                         <Alert className="h-full">
                            <Bed className="h-5 w-5" />
                            <AlertTitle className="font-bold text-lg">Minimum Rest</AlertTitle>
                            <AlertDescription className="text-xl font-mono font-semibold">{result.minRest}</AlertDescription>
                            {result.minRestNote && <p className="text-xs text-muted-foreground mt-1">{result.minRestNote}</p>}
                        </Alert>
                        <Alert>
                            <PlaneLanding className="h-5 w-5" />
                            <AlertTitle className="font-bold text-lg">Latest Arrival (On-Blocks)</AlertTitle>
                            <AlertDescription className="text-xl font-mono font-semibold">{result.latestOnBlocks}</AlertDescription>
                        </Alert>
                         <Alert className="h-full">
                            <AlertTitle className="font-bold text-lg">Potential Extended FDP</AlertTitle>
                            <AlertDescription className="text-xl font-mono font-semibold">{result.potentialFDPWithExtension || "N/A"}</AlertDescription>
                        </Alert>
                    </div>

                    <div className="pt-4">
                      <h4 className="text-md font-semibold mb-2">Calculation Breakdown:</h4>
                      <div className="space-y-2">
                        {result.breakdown.map((item, index) => {
                          const Icon = item.icon;
                          const isAdjustment = item.value.startsWith('+');
                          return (
                            <div key={index} className="flex items-start gap-3 p-2 border rounded-md">
                              <Icon className={`mt-1 h-5 w-5 ${isAdjustment ? 'text-blue-500' : 'text-primary'}`} />
                              <div className="flex-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{item.label}</span>
                                  <span className="font-mono font-semibold">{item.value}</span>
                                </div>
                                {item.adjustment && <p className="text-xs text-muted-foreground mt-1">{item.adjustment}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                </CardContent>
            </Card>
        </AnimatedCard>
      )}
       <Alert variant="warning" className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Disclaimer</AlertTitle>
          <AlertDescription>
            This calculator is for estimation and training purposes only and is based on standard EASA ORO.FTL.205 rules. It does not account for all variables such as split duty or other disruptive schedules. Always refer to official company tools and regulations for operational flight planning.
          </AlertDescription>
        </Alert>
    </div>
  );
}
