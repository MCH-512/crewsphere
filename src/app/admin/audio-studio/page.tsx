"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AudioWaveform, Loader2, Send, AlertTriangle, PlayCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AnimatedCard } from "@/components/motion/animated-card";
import { generateAudio } from "@/ai/flows/generate-audio-flow";
import { GenerateAudioInputSchema, GenerateAudioOutputSchema, type GenerateAudioInput } from '@/schemas/video-schema';


export default function AudioStudioPage() {
  const { toast } = useToast();
  const [result, setResult] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<GenerateAudioInput>({
    resolver: zodResolver(GenerateAudioInputSchema),
    defaultValues: { prompt: "", voice: "Algenib" },
  });

  const onSubmit = async (data: GenerateAudioInput) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      toast({ title: "Generating Audio...", description: "The AI is processing your request. This may take a moment." });
      const audioResult = await generateAudio(data);
      setResult(audioResult.audioUrl);
      toast({ title: "Audio Generated", description: "Your audio is ready for preview." });
    } catch (err: any) {
      console.error("Error generating audio:", err);
      setError(err.message || "An unexpected error occurred.");
      toast({
        title: "Generation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <AudioWaveform className="mr-3 h-7 w-7 text-primary" />
              AI Audio Studio
            </CardTitle>
            <CardDescription>
              Generate professional voice announcements and audio messages using Text-to-Speech AI.
            </CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>
      
      <AnimatedCard delay={0.1}>
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="text-lg">Message Composer</CardTitle>
                        <CardDescription>Enter the text you want to convert to speech.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Text to Generate</FormLabel>
                                <FormControl>
                                <Textarea
                                    placeholder="e.g., 'Attention all cabin crew, please be advised that the pre-flight briefing will now take place in briefing room 3.'"
                                    className="min-h-[150px]"
                                    {...field}
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="voice"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Voice</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Algenib">Male 1</SelectItem>
                                    <SelectItem value="Achernar">Male 2</SelectItem>
                                    <SelectItem value="Antares">Male 3</SelectItem>
                                    <SelectItem value="Canopus">Female 1</SelectItem>
                                    <SelectItem value="Sirius">Female 2</SelectItem>
                                    <SelectItem value="Spica">Female 3</SelectItem>
                                    <SelectItem value="Vega">Female 4</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                         <Button type="submit" disabled={isGenerating}>
                            {isGenerating ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Send className="mr-2 h-4 w-4" />)}
                            Generate Audio
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
      </AnimatedCard>

      {isGenerating && (
        <AnimatedCard delay={0.1}>
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Generating audio... Please wait.</p>
            </div>
        </AnimatedCard>
      )}

      {error && (
        <AnimatedCard delay={0.1}>
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </AnimatedCard>
      )}
      
      {result && (
        <AnimatedCard delay={0.1}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-primary"/>Generated Audio</CardTitle>
                    <CardDescription>Preview your generated audio file below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <audio controls className="w-full" src={result}>
                        Your browser does not support the audio element.
                    </audio>
                </CardContent>
                 <CardFooter>
                    <Button asChild variant="outline">
                        <a href={result} download={`crewsphere_announcement_${Date.now()}.wav`}>
                            <Download className="mr-2 h-4 w-4"/>
                            Download WAV File
                        </a>
                    </Button>
                </CardFooter>
            </Card>
        </AnimatedCard>
      )}
    </div>
  );
}
