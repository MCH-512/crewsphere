
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calculator, AlertTriangle, Clock, Hash, SunMoon, Bed, Table as TableIcon, PlaneLanding } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";

const calculatorSchema = z.object({
  reportTime: z.string().nonempty({ message: "Report time is required." }),
  sectors: z.coerce.number().min(1).max(10),
  acclimatisation: z.enum(["acclimatised", "unacclimatised"]),
  inFlightRest: z.enum(["none", "class3", "class2", "class1"]),
});

type CalculatorValues = z.infer<typeof calculatorSchema>;

interface CalculationResult {
  maxFDP: string;
  potentialFDPWithExtension: string | null;
  minRest: string;
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
    },
  });

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

    const extensionInfo = fdpExtensions[values.inFlightRest];
    let potentialFDPWithExtension = null;
    if (values.inFlightRest !== 'none') {
        potentialFDPWithExtension = extensionInfo.text;
        breakdown.push({ label: "In-Flight Rest", value: `Potential: ${extensionInfo.text.split(" ")[2]}`, adjustment: "Extension subject to crew composition and rest duration.", icon: Bed });
    }

    // --- Calculate Latest On-Blocks Time ---
    const [reportHours, reportMinutes] = values.reportTime.split(':').map(Number);
    const reportTotalMinutes = reportHours * 60 + reportMinutes;
    const fdpTotalMinutes = baseFDP * 60;
    const endTotalMinutes = reportTotalMinutes + fdpTotalMinutes;

    const endDayOffset = Math.floor(endTotalMinutes / (24 * 60));
    const endHour = Math.floor((endTotalMinutes % (24 * 60)) / 60);
    const endMinute = Math.round(endTotalMinutes % 60);

    const formattedEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')} Local`;
    const latestOnBlocksDisplay = `${formattedEndTime}${endDayOffset > 0 ? ` (+${endDayOffset} day${endDayOffset > 1 ? 's' : ''})` : ''}`;

    setResult({
      maxFDP: formatHours(baseFDP),
      potentialFDPWithExtension,
      minRest: "12h or duty period length",
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
              Estimate maximum Flight Duty Period (FDP) based on EASA ORO.FTL.205 regulations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
                <FormField control={form.control} name="reportTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Clock/> Report Time (Local)</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="sectors" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Hash/> Number of Sectors</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val, 10))} defaultValue={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(s => <SelectItem key={s} value={String(s)}>{s} Sector{s > 1 ? 's' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="acclimatisation" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><SunMoon/> Crew State</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="acclimatised">Acclimatised</SelectItem>
                        <SelectItem value="unacclimatised">Unacclimatised</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="inFlightRest" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Bed/> In-Flight Rest Facilities</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">None / Class 3 Seat</SelectItem>
                        <SelectItem value="class3">Class 3 Seat (Leg & foot support)</SelectItem>
                        <SelectItem value="class2">Class 2 Bunk / Lie-flat Seat</SelectItem>
                        <SelectItem value="class1">Class 1 Bunk</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Alert variant="success" className="h-full">
                            <AlertTitle className="font-bold text-lg">Maximum FDP</AlertTitle>
                            <AlertDescription className="text-2xl font-mono font-bold text-success-foreground/90">{result.maxFDP}</AlertDescription>
                        </Alert>
                        <Alert>
                            <PlaneLanding className="h-5 w-5" />
                            <AlertTitle className="font-bold text-lg">Latest On-Blocks Time</AlertTitle>
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
                          const isAdjustment = item.label !== "EASA ORO.FTL.205 Table B" && item.label !== "EASA ORO.FTL.205 (Unacclimatised)";
                          return (
                            <div key={index} className="flex items-start gap-3 p-2 border rounded-md">
                              <Icon className={`mt-1 h-5 w-5 ${isAdjustment ? 'text-destructive' : 'text-primary'}`} />
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
            This calculator is for estimation and training purposes only and is based on standard EASA ORO.FTL.205 rules. It does not account for commander's discretion, extensions due to in-flight rest, split duty, or other disruptive schedules. Always refer to official company tools and regulations for operational flight planning.
          </AlertDescription>
        </Alert>
    </div>
  );
}
