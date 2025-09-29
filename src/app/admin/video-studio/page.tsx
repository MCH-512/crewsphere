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
type FormValues = z.infer&lt;typeof formSchema&gt;;

const toBase64 = (file: File) =&gt; new Promise&lt;string&gt;((resolve, reject) =&gt; {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () =&gt; resolve(reader.result as string);
    reader.onerror = error =&gt; reject(error);
});

export default function VideoStudioPage() {
  const { toast } = useToast();
  const [result, setResult] = React.useState&lt;string | null&gt;(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState&lt;string | null&gt;(null);
  const [previewImage, setPreviewImage] = React.useState&lt;string | null&gt;(null);

  const form = useForm&lt;FormValues&gt;({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: "" },
  });

  const handleFileChange = (event: React.ChangeEvent&lt;HTMLInputElement&gt;) =&gt; {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size &gt; 4 * 1024 * 1024) { // 4MB limit for Veo
        toast({ title: "File too large", description: "Image must be smaller than 4MB.", variant: "destructive" });
        return;
      }
      form.setValue('imageFile', file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };
  
  const clearImage = () =&gt; {
    form.setValue('imageFile', undefined);
    setPreviewImage(null);
  };

  const onSubmit = async (data: FormValues) =&gt; {
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
    &lt;div className="space-y-6 max-w-4xl mx-auto"&gt;
      &lt;AnimatedCard&gt;
        &lt;Card className="shadow-lg"&gt;
          &lt;CardHeader&gt;
            &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;
              &lt;Video className="mr-3 h-7 w-7 text-primary" /&gt;
              AI Video Studio
            &lt;/CardTitle&gt;
            &lt;CardDescription&gt;
              Generate short, high-quality videos from a text description, or by animating an image.
            &lt;/CardDescription&gt;
          &lt;/CardHeader&gt;
        &lt;/Card&gt;
      &lt;/AnimatedCard&gt;
      
      &lt;AnimatedCard delay={0.1}&gt;
        &lt;Card&gt;
            &lt;Form {...form}&gt;
                &lt;form onSubmit={form.handleSubmit(onSubmit)}&gt;
                    &lt;CardHeader&gt;
                        &lt;CardTitle className="text-lg"&gt;Video Composer&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Describe the video you want to create. Be specific for best results.&lt;/CardDescription&gt;
                    &lt;/CardHeader&gt;
                    &lt;CardContent className="space-y-6"&gt;
                        &lt;FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) =&gt; (
                            &lt;FormItem&gt;
                                &lt;FormLabel&gt;Video Prompt&lt;/FormLabel&gt;
                                &lt;FormControl&gt;
                                &lt;Textarea
                                    placeholder="e.g., 'A cinematic, photorealistic shot of an airplane flying through clouds at sunrise' or 'make the person in the image wave their hand'."
                                    className="min-h-[120px]"
                                    {...field}
                                /&gt;
                                &lt;/FormControl&gt;
                                &lt;FormMessage /&gt;
                            &lt;/FormItem&gt;
                            )}
                        /&gt;
                         &lt;FormField
                            control={form.control}
                            name="imageFile"
                            render={() =&gt; (
                            &lt;FormItem&gt;
                                &lt;FormLabel&gt;Reference Image (Optional)&lt;/FormLabel&gt;
                                 &lt;CardDescription className="mb-2"&gt;Animate a static image by providing it as a reference.&lt;/CardDescription&gt;
                                {previewImage ? (
                                    &lt;div className="relative w-fit"&gt;
                                        &lt;Image src={previewImage} alt="Image preview" width={128} height={128} className="h-32 w-auto rounded-md border" /&gt;
                                        &lt;Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={clearImage}&gt;
                                            &lt;X className="h-4 w-4" /&gt;
                                        &lt;/Button&gt;
                                    &lt;/div&gt;
                                ) : (
                                    &lt;FormControl&gt;
                                         &lt;label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-6 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600"&gt;
                                            &lt;div className="flex flex-col items-center justify-center"&gt;
                                                &lt;ImageUp className="h-8 w-8 text-muted-foreground" /&gt;
                                                &lt;p className="mt-2 text-sm text-muted-foreground"&gt;Click to upload or drag and drop&lt;/p&gt;
                                                &lt;p className="text-xs text-muted-foreground"&gt;PNG, JPG, or WEBP (MAX. 4MB)&lt;/p&gt;
                                            &lt;/div&gt;
                                            &lt;Input
                                                id="dropzone-file"
                                                type="file"
                                                className="hidden"
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={handleFileChange}
                                            /&gt;
                                        &lt;/label&gt;
                                    &lt;/FormControl&gt;
                                )}
                                &lt;FormMessage /&gt;
                            &lt;/FormItem&gt;
                            )}
                        /&gt;
                    &lt;/CardContent&gt;
                    &lt;CardFooter&gt;
                         &lt;Button type="submit" disabled={isGenerating}&gt;
                            {isGenerating ? (&lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt;) : (&lt;Send className="mr-2 h-4 w-4" /&gt;)}
                            Generate Video
                        &lt;/Button&gt;
                    &lt;/CardFooter&gt;
                &lt;/form&gt;
            &lt;/Form&gt;
        &lt;/Card&gt;
      &lt;/AnimatedCard&gt;

      {isGenerating &amp;&amp; (
        &lt;AnimatedCard delay={0.1}&gt;
            &lt;div className="flex flex-col items-center justify-center py-8 text-center"&gt;
                &lt;Loader2 className="h-8 w-8 animate-spin text-primary" /&gt;
                &lt;p className="mt-3 text-muted-foreground"&gt;Generating video... This can take up to a minute.&lt;/p&gt;
                &lt;p className="text-xs text-muted-foreground"&gt;Please do not navigate away from this page.&lt;/p&gt;
            &lt;/div&gt;
        &lt;/AnimatedCard&gt;
      )}

      {error &amp;&amp; (
        &lt;AnimatedCard delay={0.1}&gt;
            &lt;Alert variant="destructive"&gt;
                &lt;AlertTriangle className="h-4 w-4" /&gt;
                &lt;AlertTitle&gt;Error&lt;/AlertTitle&gt;
                &lt;AlertDescription&gt;{error}&lt;/AlertDescription&gt;
            &lt;/Alert&gt;
        &lt;/AnimatedCard&gt;
      )}
      
      {result &amp;&amp; (
        &lt;AnimatedCard delay={0.1}&gt;
            &lt;Card&gt;
                &lt;CardHeader&gt;
                    &lt;CardTitle className="flex items-center gap-2"&gt;&lt;Film className="h-5 w-5 text-primary"/&gt;Generated Video&lt;/CardTitle&gt;
                    &lt;CardDescription&gt;Preview your AI-generated video below.&lt;/CardDescription&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    &lt;video controls muted autoPlay loop className="w-full rounded-lg border"&gt;
                        &lt;source src={result} type="video/mp4" /&gt;
                        Your browser does not support the video tag.
                    &lt;/video&gt;
                &lt;/CardContent&gt;
                 &lt;CardFooter&gt;
                    &lt;Button asChild variant="outline"&gt;
                        &lt;a href={result} download={`crewsphere_video_${Date.now()}.mp4`}` &gt;
                            &lt;Download className="mr-2 h-4 w-4"/&gt;
                            Download MP4
                        &lt;/a&gt;
                    &lt;/Button&gt;
                &lt;/CardFooter&gt;
            &lt;/Card&gt;
        &lt;/AnimatedCard&gt;
      )}
    &lt;/div&gt;
  );
}
