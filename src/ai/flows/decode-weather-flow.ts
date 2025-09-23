

'use server';
/**
 * @fileOverview An AI flow to decode METAR/TAF weather reports.
 *
 * - decodeWeatherReport - A function that takes a weather report string and returns a structured, decoded version.
 */

import {ai} from '@/ai/genkit';
import { DecodeWeatherReportInputSchema, DecodeWeatherReportOutputSchema, type DecodeWeatherReportInput, type DecodeWeatherReportOutput } from '@/schemas/weather-schema';

export async function decodeWeatherReport(input: DecodeWeatherReportInput): Promise<DecodeWeatherReportOutput> {
  const validatedInput = DecodeWeatherReportInputSchema.parse(input);
  return decodeWeatherReportFlow(validatedInput);
}

const decodeWeatherReportPrompt = ai.definePrompt({
  name: 'decodeWeatherReportPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: DecodeWeatherReportInputSchema},
  output: {schema: DecodeWeatherReportOutputSchema},
  prompt: `You are an expert aviation meteorologist. Your task is to decode the provided METAR or TAF report into a structured JSON format. Provide units for all values. Be precise and professional.

---
METAR/TAF Code: {{{reportCode}}}
---
`,
});

const decodeWeatherReportFlow = ai.defineFlow(
  {
    name: 'decodeWeatherReportFlow',
    inputSchema: DecodeWeatherReportInputSchema,
    outputSchema: DecodeWeatherReportOutputSchema,
  },
  async (input) => {
    const validatedInput = DecodeWeatherReportInputSchema.parse(input);
    try {
      const {output} = await decodeWeatherReportPrompt(validatedInput);
      if (!output) {
        throw new Error('The AI model did not return a valid decoded report.');
      }
      return output;
    } catch (error: unknown) {
       const e = error as Error;
       console.error("Error in decodeWeatherReportFlow:", e);
       throw new Error(`Failed to decode weather report due to an AI service error: ${e.message}`);
    }
  }
);
