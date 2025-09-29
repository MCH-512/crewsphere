import { z } from 'zod';

const textPrompt = z.object({
  text: z.string().min(1, { message: 'Prompt cannot be empty.' }).max(500, { message: 'Prompt is too long.' }),
});

const mediaPrompt = z.object({
  media: z.object({
    url: z.string().url(),
    contentType: z.string(),
  }),
});

export const GenerateVideoInputSchema = z.object({
  prompt: z.union([textPrompt, z.array(z.union([textPrompt, mediaPrompt]))]),
});

export const GenerateVideoOutputSchema = z.object({
    videoUrl: z.string(),
});

export type GenerateVideoInput = z.infer<typeof GenerateVideoInputSchema>;
export type GenerateVideoOutput = z.infer<typeof GenerateVideoOutputSchema>;
