
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UiCardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, FileJson, AlertTriangle } from "lucide-react";
import { generateOperationalInsights, type OperationalInsightsOutput } from "@/ai/flows/operational-insights";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const FormSchema = z.object({
  safetyReports: z.string().min(10, {
    message: "Safety reports data must be at least 10 characters.",
  }).refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch (e) {
      return false;
    }
  }, { message: "Input must be valid JSON." }),
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
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      safetyReports: "",
    },
  });

  const handleLoadSampleData = () => {
    form.setValue("safetyReports", placeholderSafetyReports);
    toast({
      title: "Sample Data Loaded",
      description: "Sample JSON data has been loaded into the textarea.",
    });
  };

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setInsights(null);
    setError(null);
    try {
      const result = await generateOperationalInsights({ safetyReports: data.safetyReports });
      setInsights(result);
      toast({
        title: "Insights Generated",
        description: "AI analysis complete.",
      });
    } catch (apiError) {
      console.error("Error generating insights:", apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : "An unknown error occurred.";
      setError(`Failed to generate insights: ${errorMessage}`);
      toast({
        title: "Error Generating Insights",
        description: `An error occurred: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <FileJson className="mr-3 h-6 w-6 text-primary" />
            Input Operational Data
          </CardTitle>
          <UiCardDescription>
            Paste your summarized safety reports and incident logs in JSON format below.
          </UiCardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="safetyReports"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Safety Reports & Incident Logs Data (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste your JSON data for safety reports and incident logs here..."
                        className="min-h-[250px] font-code text-xs bg-muted/30"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mt-2">
                        <FormDescription className="text-xs sm:max-w-md">
                        The AI will analyze this data to identify trends, potential hazards, and areas for improvement. Ensure the data is valid JSON.
                        </FormDescription>
                        <Button type="button" variant="outline" size="sm" onClick={handleLoadSampleData} className="mt-2 sm:mt-0 self-start sm:self-auto">
                            Load Sample Data
                        </Button>
                    </div>
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
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
          <p>AI is analyzing the data... Please wait.</p>
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Error Generating Insights</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {insights && !isLoading && !error && (
        <Card className="mt-8 shadow-md bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <Sparkles className="mr-3 h-6 w-6 text-primary" />
              AI-Generated Summary & Analysis
            </CardTitle>
             <UiCardDescription>Below is the AI-generated summary based on the data you provided.</UiCardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert text-card-foreground bg-secondary/20 p-4 rounded-md">
              <p className="whitespace-pre-wrap">{insights.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
