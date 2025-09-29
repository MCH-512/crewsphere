"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Video, Loader2, Send, AlertTriangle, Film, ImageUp, X, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AnimatedCard } from "@/components/motion/animated-card";
import { generateVideo } from "@/services/video-service";
import Image from "next/image";
import type { GenerateVideoInput } from "@/schemas/video-schema";

const formSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters long.').max(500, 'Prompt is too long.'),
  imageFile: z.instanceof(File).optional(),
});
type FormValues = z.infer<typeof formSchema>;

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

export default function VideoStudioPage() {
  const { toast } = useToast();
  const [result, setResult] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: "" },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit for Veo
        toast({ title: "File too large", description: "Image must be smaller than 4MB.", variant: "destructive" });
        return;
      }
      form.setValue('imageFile', file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };
  
  const clearImage = () => {
    form.setValue('imageFile', undefined);
    setPreviewImage(null);
  };

  const onSubmit = async (data: FormValues) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      toast({ title: "Generating Video...", description: "This is a complex task and may take up to a minute. Please be patient." });
      
      let promptPayload: GenerateVideoInput['prompt'] = data.prompt;

      if (data.imageFile) {
        const imageBase64 = await toBase64(data.imageFile);
        promptPayload = [
          { text: data.prompt },
          { media: { url: imageBase64, contentType: data.imageFile.type } }
        ];
      }

      const videoResult = await generateVideo({ prompt: promptPayload });
      setResult(videoResult.videoUrl);
      toast({ title: "Video Generated!", description: "Your video is ready for preview." });

    } catch (err) {
        const e = err as Error;
        const errorMessage = e.message || "An unexpected error occurred during video generation.";
        console.error("Error generating video:", e);
        setError(errorMessage);
        toast({
            title: "Generation Failed",
            description: errorMessage,
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
              <Video className="mr-3 h-7 w-7 text-primary" />
              AI Video Studio
            </CardTitle>
            <CardDescription>
              Generate short, high-quality videos from a text description, or by animating an image.
            </CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>
      
      <AnimatedCard delay={0.1}>
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="text-lg">Video Composer</CardTitle>
                        <CardDescription>Describe the video you want to create. Be specific for best results.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Video Prompt</FormLabel>
                                <FormControl>
                                <Textarea
                                    placeholder="e.g., 'A cinematic, photorealistic shot of an airplane flying through clouds at sunrise' or 'make the person in the image wave their hand'."
                                    className="min-h-[120px]"
                                    {...field}
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="imageFile"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reference Image (Optional)</FormLabel>
                                 <CardDescription className="mb-2">Animate a static image by providing it as a reference.</CardDescription>
                                {previewImage ? (
                                    <div className="relative w-fit">
                                        <Image src={previewImage} alt="Image preview" width={128} height={128} className="h-32 w-auto rounded-md border" />
                                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={clearImage}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <FormControl>
                                         <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-6 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                                            <div className="flex flex-col items-center justify-center">
                                                <ImageUp className="h-8 w-8 text-muted-foreground" />
                                                <p className="mt-2 text-sm text-muted-foreground">Click to upload or drag and drop</p>
                                                <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (MAX. 4MB)</p>
                                            </div>
                                            <Input
                                                id="dropzone-file"
                                                type="file"
                                                className="hidden"
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                    </FormControl>
                                )}
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                         <Button type="submit" disabled={isGenerating}>
                            {isGenerating ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Send className="mr-2 h-4 w-4" />)}
                            Generate Video
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
      </AnimatedCard>

      {isGenerating && (
        <AnimatedCard delay={0.1}>
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-muted-foreground">Generating video... This can take up to a minute.</p>
                <p className="text-xs text-muted-foreground">Please do not navigate away from this page.</p>
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
                    <CardTitle className="flex items-center gap-2"><Film className="h-5 w-5 text-primary"/>Generated Video</CardTitle>
                    <CardDescription>Preview your AI-generated video below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <video controls muted autoPlay loop className="w-full rounded-lg border">
                        <source src={result} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                </CardContent>
                 <CardFooter>
                    <Button asChild variant="outline">
                        <a href={result} download={`crewsphere_video_${Date.now()}.mp4`}>
                            <Download className="mr-2 h-4 w-4"/>
                            Download MP4
                        </a>
                    </Button>
                </CardFooter>
            </Card>
        </AnimatedCard>
      )}
    </div>
  );
}
