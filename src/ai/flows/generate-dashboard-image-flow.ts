

'use server';
/**
 * @fileOverview An AI flow to generate an image for the dashboard based on flight context.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

// Define the input schema for the flow
const GenerateDashboardImageInputSchema = z.object({
  destination: z.string().describe("The destination city or airport name."),
  timeOfDay: z.enum(['sunrise', 'daylight', 'sunset', 'night']).describe("The time of day for the image scene."),
});
export type GenerateDashboardImageInput = z.infer<typeof GenerateDashboardImageInputSchema>;

// Define the output schema for the flow
const GenerateDashboardImageOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated image as a Base64 encoded data URI."),
});
export type GenerateDashboardImageOutput = z.infer<typeof GenerateDashboardImageOutputSchema>;

export async function generateDashboardImage(input: GenerateDashboardImageInput): Promise<GenerateDashboardImageOutput> {
  return generateDashboardImageFlow(input);
}

// Define the Genkit flow
const generateDashboardImageFlow = ai.defineFlow(
  {
    name: 'generateDashboardImageFlow',
    inputSchema: GenerateDashboardImageInputSchema,
    outputSchema: GenerateDashboardImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: `Generate a breathtaking, photorealistic image of an airplane flying towards ${input.destination} during ${input.timeOfDay}. The style should be a dramatic, cinematic wide-angle shot. The image must be high-quality and suitable for a hero banner. Do not include any text or logos in the image.`,
    });

    if (!media?.url) {
      throw new Error('Image generation failed to return a valid image.');
    }
    
    return { imageDataUri: media.url };
  }
);
