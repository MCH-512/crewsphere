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
import { Calculator, AlertTriangle, Clock, Hash, SunMoon, Minus, Plus } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";

const calculatorSchema = z.object({
  reportTime: z.string().nonempty({ message: "Report time is required." }),
  sectors: z.coerce.number().min(1).max(8),
  acclimatised: z.enum(["yes", "no"]),
});

type CalculatorValues = z.infer<typeof calculatorSchema>;

interface CalculationResult {
  maxFDP: string;
  minRest: string;
  breakdown: {
    label: string;
    value: string;
    adjustment?: string;
    icon: React.ElementType;
  }[];
}

export default function FlightDutyCalculatorPage() {
  const [result, setResult] = React.useState<CalculationResult | null>(null);

  const form = useForm<CalculatorValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      reportTime: "08:00",
      sectors: 1,
      acclimatised: "yes",
    },
  });

  function onSubmit(values: CalculatorValues) {
    const reportHour = parseInt(values.reportTime.split(":")[0], 10);
    const breakdown: CalculationResult['breakdown'] = [];

    // 1. Base FDP
    let baseFDP = 13;
    breakdown.push({ label: "Base FDP", value: "13h 00m", icon: Clock });

    // 2. WOCL Adjustment
    let woclAdjustment = 0;
    if (reportHour >= 2 && reportHour <= 5) {
      woclAdjustment = -1.5;
    } else if (reportHour >= 22 || reportHour < 2) {
      woclAdjustment = -1;
    }
    if (woclAdjustment !== 0) {
      breakdown.push({ label: "WOCL Adjustment", value: `${woclAdjustment > 0 ? '+' : ''}${woclAdjustment * 60}m`, adjustment: `Reporting time ${values.reportTime} is within the Window of Circadian Low.`, icon: SunMoon });
    }

    // 3. Sector Adjustment
    let sectorAdjustment = 0;
    if (values.sectors >= 5) {
      sectorAdjustment = (values.sectors - 4) * -0.5;
    }
    if (sectorAdjustment !== 0) {
      breakdown.push({ label: "Sector Adjustment", value: `${sectorAdjustment * 60}m`, adjustment: `${values.sectors} sectors require a reduction.`, icon: Hash });
    }
    
    // 4. Acclimatisation Adjustment
    let acclimatisationAdjustment = 0;
    if (values.acclimatised === "no") {
        acclimatisationAdjustment = -1;
    }
    if (acclimatisationAdjustment !== 0) {
        breakdown.push({ label: "Acclimatisation", value: `${acclimatisationAdjustment * 60}m`, adjustment: "Non-acclimatised crew have a reduced FDP.", icon: AlertTriangle });
    }

    const calculatedFDP = Math.max(baseFDP + woclAdjustment + sectorAdjustment + acclimatisationAdjustment, 9);

    setResult({
      maxFDP: `${Math.floor(calculatedFDP)}h ${Math.round((calculatedFDP % 1) * 60)}m`,
      minRest: "12h or duty period length",
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
              Flight Duty Calculator
            </CardTitle>
            <CardDescription>
              A simplified tool to estimate maximum Flight Duty Period (FDP) based on standard regulations.
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
                    <FormLabel className="flex items-center gap-2"><Hash/> Number of Sectors (Legs)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val, 10))} defaultValue={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="acclimatised" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><SunMoon/> Crew Acclimatised</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
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
                    <CardDescription>The following is an estimated calculation. Always refer to official documentation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Alert variant="success" className="h-full">
                            <AlertTitle className="font-bold text-lg">Max Flight Duty Period (FDP)</AlertTitle>
                            <AlertDescription className="text-2xl font-mono font-bold text-success-foreground/90">{result.maxFDP}</AlertDescription>
                        </Alert>
                         <Alert className="h-full">
                            <AlertTitle className="font-bold text-lg">Minimum Rest Period</AlertTitle>
                            <AlertDescription className="text-xl font-mono font-semibold">{result.minRest}</AlertDescription>
                        </Alert>
                    </div>

                    <div className="pt-4">
                      <h4 className="text-md font-semibold mb-2">Calculation Breakdown:</h4>
                      <div className="space-y-2">
                        {result.breakdown.map((item, index) => {
                          const Icon = item.icon;
                          const isAdjustment = !!item.adjustment;
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
            This calculator is for estimation and training purposes only. It is based on simplified rules and does not account for all regulatory extensions or disruptions. Always refer to official company tools and regulations for operational flight planning.
          </AlertDescription>
        </Alert>
    </div>
  );
}
