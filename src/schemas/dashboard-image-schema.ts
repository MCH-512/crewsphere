import { z } from 'zod';

export const GenerateDashboardImageInputSchema = z.object({
  destination: z.string().describe("The user's next flight destination city (e.g., Paris)."),
  timeOfDay: z.enum(['sunrise', 'daylight', 'sunset', 'night']).describe("The time of day for the image scene."),
});
export type GenerateDashboardImageInput = z.infer<typeof GenerateDashboardImageInputSchema>;

export const GenerateDashboardImageOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated image as a Base64 encoded data URI."),
});
export type GenerateDashboardImageOutput = z.infer<typeof GenerateDashboardImageOutputSchema>;
