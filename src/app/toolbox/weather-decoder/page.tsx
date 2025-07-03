
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { CloudSun, Loader2, Send, AlertTriangle, Wind, Eye, Thermometer, Cloud, Compass, Watch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { decodeWeatherReport, type DecodeWeatherReportOutput } from "@/ai/flows/decode-weather-flow";
import { AnimatedCard } from "@/components/motion/animated-card";

const formSchema = z.object({
  reportCode: z.string().min(5, { message: "Please enter a valid METAR/TAF code." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function WeatherDecoderPage() {
  const { toast } = useToast();
  const [result, setResult] = React.useState<DecodeWeatherReportOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { reportCode: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const decodedData = await decodeWeatherReport({ reportCode: data.reportCode });
      setResult(decodedData);
    } catch (err: any) {
      console.error("Error decoding report:", err);
      setError(err.message || "An unexpected error occurred.");
      toast({
        title: "Decoding Failed",
        description: "Could not decode the weather report. Please check the code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const ResultDisplay = ({ data }: { data: DecodeWeatherReportOutput }) => (
    <Card className="mt-6">
        <CardHeader>
            <CardTitle>Decoded Report: {data.station}</CardTitle>
            <CardDescription>{data.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-primary" /><strong>Station:</strong> {data.station}</div>
            <div className="flex items-center gap-2"><Watch className="h-4 w-4 text-primary" /><strong>Time:</strong> {data.time}</div>
            <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-primary" /><strong>Wind:</strong> {data.wind.direction} at {data.wind.speed} {data.wind.gusts ? `(gusts to ${data.wind.gusts})` : ''}</div>
            <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><strong>Visibility:</strong> {data.visibility}</div>
            <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" /><strong>Temp/Dew:</strong> {data.temperature} / {data.dewPoint}</div>
            <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-primary" /><strong>Pressure:</strong> {data.pressure}</div>
            <div className="md:col-span-2 flex items-start gap-2"><Cloud className="h-4 w-4 text-primary mt-1" />
                <div>
                  <strong>Clouds:</strong>
                  <ul className="list-disc list-inside ml-4">
                    {data.clouds.map((cloud, i) => <li key={i}>{cloud}</li>)}
                  </ul>
                </div>
            </div>
             <div className="md:col-span-2 flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-primary mt-1" />
                <div>
                  <strong>Weather:</strong>
                  <p>{data.weather}</p>
                </div>
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CloudSun className="mr-3 h-7 w-7 text-primary" />
            METAR/TAF Weather Decoder
          </CardTitle>
          <CardDescription>
            Enter a METAR or TAF code below to get a human-readable weather report, powered by AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reportCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weather Report Code</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., KLAX 122051Z 25007KT 10SM CLR 19/12 A2989 RMK AO2 SLP120 T01940122"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Decoding...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Decode Report</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {isLoading && (
        <AnimatedCard>
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">AI is decoding the report...</p>
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
