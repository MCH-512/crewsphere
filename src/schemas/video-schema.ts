
import { z } from 'zod';

// Video Schemas

// A prompt for video can be a string or an array of text and media parts.
const VideoPromptPartSchema = z.union([
  z.object({ text: z.string() }),
  z.object({ media: z.object({ url: z.string(), contentType: z.string().optional() }) }),
]);

export const GenerateVideoInputSchema = z.object({
  prompt: z.union([z.string(), z.array(VideoPromptPartSchema)]).describe("The text prompt or a combination of text and media parts for video generation."),
});
export type GenerateVideoInput = z.infer<typeof GenerateVideoInputSchema>;


export const GenerateVideoOutputSchema = z.object({
  videoUrl: z.string().describe("The URL of the generated video file."),
});
export type GenerateVideoOutput = z.infer<typeof GenerateVideoOutputSchema>;
