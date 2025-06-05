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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { generateOperationalInsights, type OperationalInsightsOutput } from "@/ai/flows/operational-insights";
import { useToast } from "@/hooks/use-toast";

const FormSchema = z.object({
  safetyReports: z.string().min(10, {
    message: "Safety reports data must be at least 10 characters.",
  }),
});

const placeholderSafetyReports = JSON.stringify(
  {
    reports: [
      { id: "SR001", date: "2024-07-15", type: "Minor Turbulence", description: "Unexpected light turbulence encountered during climb. No injuries.", aircraft: "A320", flight: "LH123", location: "ATL airspace", altitude: "FL280" },
      { id: "IL005", date: "2024-07-16", type: "Gate Change", description: "Last minute gate change for flight BA456 from A10 to C3 due to technical issue at A5.", flight: "BA456", airport: "LHR" },
      { id: "SR002", date: "2024-07-17", type: "Passenger Medical", description: "Passenger fainted during meal service. Attended by crew and doctor on board. Recovered before landing.", aircraft: "B777", flight: "EK789", phase: "Cruise" },
      { id: "SR003", date: "2024-07-18", type: "Equipment Malfunction", description: "In-flight entertainment system screen at seat 12A not working. Multiple reset attempts failed. Passenger re-seated.", aircraft: "A350", flight: "QF002", seat: "12A" },
      { id: "IL006", date: "2024-07-19", type: "Delay", description: "Flight DL500 delayed by 45 minutes due to late arrival of inbound aircraft.", flight: "DL500", airport: "JFK" },
      { id: "SR004", date: "2024-07-20", type: "Bird Strike", description: "Suspected bird strike on #2 engine during takeoff roll. Takeoff aborted. Aircraft returned to gate for inspection. No damage found.", aircraft: "B737", flight: "UA321", airport: "ORD", phase: "Takeoff" },
    ],
    trends: {
      commonIssues: ["Minor Turbulence", "IFE Malfunctions"],
      recentIncidents: 3,
    }
  },
  null,
  2
);


export function AiOperationalInsights() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [insights, setInsights] = React.useState<OperationalInsightsOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      safetyReports: placeholderSafetyReports,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setInsights(null);
    try {
      const result = await generateOperationalInsights({ safetyReports: data.safetyReports });
      setInsights(result);
      toast({
        title: "Insights Generated",
        description: "AI analysis complete.",
      });
    } catch (error) {
      console.error("Error generating insights:", error);
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
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
          <FormField
            control={form.control}
            name="safetyReports"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg font-semibold">Safety Reports & Incident Logs Data (JSON)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Paste your JSON data for safety reports and incident logs here."
                    className="min-h-[200px] font-code text-xs"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Provide summarized data in JSON format. The AI will analyze this to identify trends and potential hazards.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Insights...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Insights
              </>
            )}
          </Button>
        </form>
      </Form>

      {insights && (
        <Card className="mt-8 shadow-md bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <Sparkles className="mr-2 h-6 w-6 text-primary" />
              AI-Generated Summary & Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
              <p className="whitespace-pre-wrap">{insights.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
