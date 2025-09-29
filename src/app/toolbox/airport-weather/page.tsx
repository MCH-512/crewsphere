"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CloudSun, Loader2, Send, AlertTriangle, Wind, Eye, Thermometer, Cloud, Compass, Watch, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { decodeWeatherReport } from "@/ai/flows/decode-weather-flow";
import type { DecodeWeatherReportOutput } from "@/schemas/weather-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import { getLiveWeather } from "@/services/weather-service";

const formSchema = z.object({
  icaoCode: z.string().min(4, "ICAO code must be 4 characters.").max(4, "ICAO code must be 4 characters.").regex(/^[A-Z]{4}$/, "Invalid ICAO format. Must be 4 uppercase letters."),
});

type FormValues = z.infer<typeof formSchema>;

const ResultDisplay = ({ data }: { data: DecodeWeatherReportOutput }) => (
    <Card className="mt-6">
        <CardHeader>
            <CardTitle>Live Weather: {data.station}</CardTitle>
            <CardDescription>{data.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-primary" /><strong>Station:</strong> {data.station}</div>
            <div className="flex items-center gap-2"><Watch className="h-4 w-4 text-primary" /><strong>Time:</strong> {data.time}</div>
            <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-primary" /><strong>Wind:</strong> {data.wind.direction} at {data.wind.speed} {data.wind.gusts ? `(gusts to ${data.wind.gusts})` : ''}</div>
            <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><strong>Visibility:</strong> {data.visibility}</div>
            <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" /><strong>Temp/Dew:</strong> {data.temperature} / {data.dewPoint}</div>
            <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-primary" /><strong>Pressure:</strong> {data.pressure}</div>
            {data.clouds.length > 0 && <div className="md:col-span-2 flex items-start gap-2"><Cloud className="h-4 w-4 text-primary mt-1" />
                <div>
                  <strong>Clouds:</strong>
                  <ul className="list-disc list-inside ml-4">
                    {data.clouds.map((cloud, i) => <li key={i}>{cloud}</li>)}
                  </ul>
                </div>
            </div>}
             <div className="md:col-span-2 flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-primary mt-1" />
                <div>
                  <strong>Weather:</strong>
                  <p>{data.weather}</p>
                </div>
            </div>
        </CardContent>
    </Card>
);

export default function AirportWeatherPage() {
  const { toast } = useToast();
  const [result, setResult] = React.useState<DecodeWeatherReportOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { icaoCode: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const rawMetar = await getLiveWeather(data.icaoCode);
      if (!rawMetar) {
        throw new Error("No METAR data found for this ICAO code. Please check the code or try again later.");
      }
      toast({ title: "Decoding Weather Report...", description: "The AI is analyzing the METAR data."});
      const decodedData = await decodeWeatherReport({ reportCode: rawMetar });
      setResult(decodedData);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Error fetching or decoding weather:", e);
      setError(e.message || "An unexpected error occurred.");
      toast({
        title: "Operation Failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CloudSun className="mr-3 h-7 w-7 text-primary" />
            AI Weather Decoder
          </CardTitle>
          <CardDescription>
            Enter a 4-letter ICAO airport code to get the latest live weather report (METAR) decoded by AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-4">
              <FormField
                control={form.control}
                name="icaoCode"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="e.g., DTTA, LFPG, KJFK"
                                className="pl-10 font-mono uppercase"
                                {...field}
                                onChange={e => field.onChange(e.target.value.toUpperCase())}
                            />
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="h-10">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /></>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /></>
                )}
                Get Weather
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {isLoading && (
        <AnimatedCard>
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Fetching live data & analyzing...</p>
            </div>
        </AnimatedCard>
      )}

      {error && (
        <AnimatedCard>
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </AnimatedCard>
      )}
      
      {result && (
        <AnimatedCard>
            <ResultDisplay data={result} />
        </AnimatedCard>
      )}
    </div>
  );
}