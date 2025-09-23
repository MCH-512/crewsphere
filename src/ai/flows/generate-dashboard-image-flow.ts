
'use server';
/**
 * @fileOverview An AI flow to generate a dynamic hero image for the user's dashboard.
 *
 * - generateDashboardImage - A function that takes a destination and time of day to create a relevant image.
 */

import { ai } from '@/ai/genkit';
import { GenerateDashboardImageInputSchema, type GenerateDashboardImageInput, GenerateDashboardImageOutputSchema, type GenerateDashboardImageOutput } from '@/schemas/dashboard-image-schema';


export async function generateDashboardImage(input: GenerateDashboardImageInput): Promise<GenerateDashboardImageOutput> {
  const validatedInput = GenerateDashboardImageInputSchema.parse(input);
  console.log(`[AI-STUB] AI image generation is temporarily disabled. Returning fallback for input:`, validatedInput);
  // Return an empty object to allow the service to fall back to the default placeholder.
  return { imageDataUri: "" };
}

/*
// Original Genkit Flow - Temporarily disabled

const generateDashboardImageFlow = ai.defineFlow(
  {
    name: 'generateDashboardImageFlow',
    inputSchema: GenerateDashboardImageInputSchema,
    outputSchema: GenerateDashboardImageOutputSchema,
  },
  async (input) => {
    try {
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
      
      console.log(`[AI-FLOW] generateDashboardImage successfully generated an image.`);
      return { imageDataUri: media.url };

    } catch (error) {
        console.error("Error in generateDashboardImageFlow:", error);
        // Instead of throwing, return an empty object to allow fallback
        return { imageDataUri: "" };
    }
  }
);
*/
