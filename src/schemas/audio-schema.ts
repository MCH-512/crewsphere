
import { z } from 'zod';

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
