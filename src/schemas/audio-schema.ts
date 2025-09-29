import { z } from 'zod';

export const GenerateAudioInputSchema = z.object({
  prompt: z.string().min(1, { message: 'Prompt cannot be empty.' }).max(500, { message: 'Prompt is too long.' }),
  voice: z.string().min(1, { message: 'Voice cannot be empty.' }),
});

export const GenerateAudioOutputSchema = z.object({
    audioUrl: z.string(),
});

export type GenerateAudioInput = z.infer<typeof GenerateAudioInputSchema>;
export type GenerateAudioOutput = z.infer<typeof GenerateAudioOutputSchema>;
