
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
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Search } from "lucide-react";
import { generateAirportBriefing, type AirportBriefingOutput } from "@/ai/flows/airport-briefing-flow";
import { useToast } from "@/hooks/use-toast";

const FormSchema = z.object({
  airportIdentifier: z.string().min(3, {
    message: "Airport identifier must be at least 3 characters (e.g., JFK, EGLL).",
  }).max(10, {
    message: "Airport identifier must not be longer than 10 characters.",
  }),
});

export function AirportBriefingTool() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [briefing, setBriefing] = React.useState<AirportBriefingOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      airportIdentifier: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setBriefing(null);
    try {
      const result = await generateAirportBriefing({ airportIdentifier: data.airportIdentifier.toUpperCase() });
      setBriefing(result);
      toast({
        title: "Airport Briefing Generated",
        description: `Briefing for ${data.airportIdentifier.toUpperCase()} is ready.`,
      });
    } catch (error) {
      console.error("Error generating airport briefing:", error);
      let userMessage = "Failed to generate airport briefing. Please check the identifier or try again later.";
      if (error instanceof Error && error.message) {
        if (error.message.includes("503") || error.message.toLowerCase().includes("service unavailable") || error.message.toLowerCase().includes("overloaded")) {
          userMessage = "The AI service is currently overloaded or unavailable. Please try again in a few moments.";
        }
      }
      toast({
        title: "Error Generating Briefing",
        description: userMessage,
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
            name="airportIdentifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg font-semibold">Airport Identifier (ICAO/IATA)</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., KJFK, EGLL, LHR"
                      className="font-code"
                      {...field}
                      autoCapitalize="characters"
                    />
                    <Button type="submit" disabled={isLoading} className="min-w-[120px]">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Get Briefing
                        </>
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>
                  Enter the ICAO or IATA code for the airport. The AI will generate a briefing formatted in Markdown.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      {briefing && (
        <Card className="mt-8 shadow-md bg-card border">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <Sparkles className="mr-2 h-6 w-6 text-primary" />
              AI-Generated Briefing for {form.getValues("airportIdentifier").toUpperCase()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none dark:prose-invert text-card-foreground whitespace-pre-wrap font-sans text-sm"
            >
              {briefing.briefing}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
