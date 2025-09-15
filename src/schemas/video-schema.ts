
import { z } from 'zod';
import type { MediaPart } from 'genkit';

const validVoices = ["Algenib", "Achernar", "Antares", "Canopus", "Sirius", "Spica", "Vega"] as const;

export const GenerateAudioInputSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty.').max(1000, 'Prompt is too long.'),
  voice: z.enum(validVoices).default('Algenib'),
});

export type GenerateAudioInput = z.infer<typeof GenerateAudioInputSchema>;

export const GenerateAudioOutputSchema = z.object({
  audioUrl: z.string().describe("The generated audio as a Base64 encoded data URI."),
});

export type GenerateAudioOutput = z.infer<typeof GenerateAudioOutputSchema>;

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
