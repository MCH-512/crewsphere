
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
import { Calculator, AlertTriangle, Clock, Hash, SunMoon } from "lucide-react";
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
}

export default function FlightDutyCalculatorPage() {
  const [result, setResult] = React.useState<CalculationResult | null>(null);

  const form = useForm<CalculatorValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      sectors: 1,
      acclimatised: "yes",
    },
  });

  function onSubmit(values: CalculatorValues) {
    const reportHour = parseInt(values.reportTime.split(":")[0], 10);
    let baseFDP = 13; // Base FDP in hours for an acclimatised crew member reporting at a "good" time.
    
    // Simplified WOCL (Window of Circadian Low) adjustment
    if (reportHour >= 2 && reportHour <= 5) {
      baseFDP -= 1.5; // Reporting within WOCL
    } else if (reportHour >= 22 || reportHour < 2) {
      baseFDP -= 1; // Reporting on the edge of WOCL
    }

    // Sector adjustment
    if (values.sectors >= 5) {
      baseFDP -= (values.sectors - 4) * 0.5;
    }
    
    // Acclimatisation adjustment
    if (values.acclimatised === "no") {
        baseFDP -= 1;
    }

    const calculatedFDP = Math.max(baseFDP, 9); // FDP can't be less than 9 hours.

    setResult({
      maxFDP: `${Math.floor(calculatedFDP)}h ${Math.round((calculatedFDP % 1) * 60)}m`,
      minRest: "12h or duty period length",
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
                </CardHeader>
                <CardContent className="space-y-3 text-lg">
                    <p><strong>Max Flight Duty Period (FDP):</strong> <span className="font-bold text-primary">{result.maxFDP}</span></p>
                    <p><strong>Minimum Rest:</strong> <span className="font-bold text-primary">{result.minRest}</span></p>
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
