
'use server';
/**
 * @fileOverview An AI flow to generate an image for a course based on a hint.
 *
 * - generateCourseImage - A function that takes a text hint and returns an image data URI.
 */

import {ai} from '@/ai/genkit';
import { GenerateCourseImageInputSchema, GenerateCourseImageOutputSchema, type GenerateCourseImageInput, type GenerateCourseImageOutput } from '@/schemas/course-schema';


export async function generateCourseImage(input: GenerateCourseImageInput): Promise<GenerateCourseImageOutput> {
  const validatedInput = GenerateCourseImageInputSchema.parse(input);
  return generateCourseImageFlow(validatedInput);
}

const generateCourseImageFlow = ai.defineFlow(
  {
    name: 'generateCourseImageFlow',
    inputSchema: GenerateCourseImageInputSchema,
    outputSchema: GenerateCourseImageOutputSchema,
  },
  async (input) => {
    const validatedInput = GenerateCourseImageInputSchema.parse(input);
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: `Generate a professional, high-quality image suitable for an e-learning course cover on the topic of: ${validatedInput.prompt}. The style should be clean, modern, and relevant to the aviation industry. Avoid text in the image.`,
    });

    if (!media?.url) {
      throw new Error('Image generation failed to return a valid image.');
    }
    
    return { imageDataUri: media.url };
  }
);

