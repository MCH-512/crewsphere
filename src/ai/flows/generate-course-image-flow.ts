'use server';
/**
 * @fileOverview An AI flow to generate an image for a course based on a hint.
 *
 * - generateCourseImage - A function that takes a text hint and returns an image data URI.
 * - GenerateCourseImageInput - The input type for the generateCourseImage function.
 * - GenerateCourseImageOutput - The return type for the generateCourseImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

export const GenerateCourseImageInputSchema = z.object({
  prompt: z.string().describe('A text prompt or hint to generate an image from, e.g., "flight safety manual".'),
});
export type GenerateCourseImageInput = z.infer<typeof GenerateCourseImageInputSchema>;

export const GenerateCourseImageOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type GenerateCourseImageOutput = z.infer<typeof GenerateCourseImageOutputSchema>;

export async function generateCourseImage(input: GenerateCourseImageInput): Promise<GenerateCourseImageOutput> {
  return generateCourseImageFlow(input);
}

const generateCourseImageFlow = ai.defineFlow(
  {
    name: 'generateCourseImageFlow',
    inputSchema: GenerateCourseImageInputSchema,
    outputSchema: GenerateCourseImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `Generate a professional, high-quality image suitable for an e-learning course cover on the topic of: ${input.prompt}. The style should be clean, modern, and relevant to the aviation industry. Avoid text in the image.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed to return a valid image.');
    }
    
    return { imageDataUri: media.url };
  }
);
