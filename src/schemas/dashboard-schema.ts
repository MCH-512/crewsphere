import { z } from 'zod';

export const GenerateDashboardImageSchema = z.object({
  destination: z.string().optional(),
  timeOfDay: z.enum(["sunrise", "daylight", "sunset", "night"]).optional(),
});

export const GenerateDashboardImageOutputSchema = z.object({
    imageDataUri: z.string(),
});

export type GenerateDashboardImageInput = z.infer<typeof GenerateDashboardImageSchema>;
export type GenerateDashboardImageOutput = z.infer<typeof GenerateDashboardImageOutputSchema>;
