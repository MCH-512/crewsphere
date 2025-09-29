
"use server";

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateDashboardImageSchema, type GenerateDashboardImageInput, GenerateDashboardImageOutputSchema, type GenerateDashboardImageOutput } from '@/schemas/dashboard-schema';

export async function generateDashboardImage(input: GenerateDashboardImageInput): Promise<GenerateDashboardImageOutput> {
  const validatedInput = GenerateDashboardImageSchema.parse(input);
  return generateDashboardImageFlow(validatedInput);
}

const generateDashboardImageFlow = ai.defineFlow({
    name: 'generateDashboardImageFlow',
    inputSchema: GenerateDashboardImageSchema,
    outputSchema: GenerateDashboardImageOutputSchema,
}, async (input) => {

    const { media } = await ai.generate({
        model: googleAI.model('gemini-pro-vision'),
        config: {
          maxOutputTokens: 1024,
          promptConfig: {
            temperature: 0.8,
            topP: 0.9,
          },
          responseModalities: ['IMAGE'],
        },
        prompt: `Create a visually stunning and cinematic background image that conveys the feeling of flight or travel. The image should be a banner, designed for a dashboard.
            - It must contain a very soft, muted gradient background.
            - Avoid any text or labels on the image. It will be overlaid with user-specific data later.
            - Avoid human elements and faces.

            The prompt should focus on the following:
            - The overall theme is ${input.destination ? `flying to or through ${input.destination}` : "general aviation"}.
            - The time of day feeling should be ${input.timeOfDay || "general"}.
        `,
    });

    if (!media) {
        throw new Error('Image generation failed to return valid media.');
    }
    
    return { imageDataUri: media.url };
});
