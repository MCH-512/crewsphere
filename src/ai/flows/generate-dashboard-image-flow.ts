'use server';
/**
 * @fileOverview An AI flow to generate a dynamic hero image for the user's dashboard.
 *
 * - generateDashboardImage - A function that takes a destination and time of day to create a relevant image.
 */

import { ai } from '@/ai/genkit';
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

export async function generateDashboardImage(input: GenerateDashboardImageInput): Promise<GenerateDashboardImageOutput> {
  return generateDashboardImageFlow(input);
}

const generateDashboardImageFlow = ai.defineFlow(
  {
    name: 'generateDashboardImageFlow',
    inputSchema: GenerateDashboardImageInputSchema,
    outputSchema: GenerateDashboardImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: `Generate a photorealistic, cinematic image of an airplane wing view, looking out towards ${input.destination}. The scene should be at ${input.timeOfDay}. The image should be inspiring, professional, and suitable for a hero banner. Avoid text.`,
      config: {
        aspectRatio: '16:9',
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed to return a valid image.');
    }
    
    return { imageDataUri: media.url };
  }
);
