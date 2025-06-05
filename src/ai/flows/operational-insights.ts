'use server';

/**
 * @fileOverview An AI flow for generating summaries of safety reports and incident logs.
 *
 * - generateOperationalInsights - A function that generates summaries of safety reports and incident logs.
 * - OperationalInsightsInput - The input type for the generateOperationalInsights function.
 * - OperationalInsightsOutput - The return type for the generateOperationalInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OperationalInsightsInputSchema = z.object({
  safetyReports: z
    .string()
    .describe('Summarized safety reports and incident logs in JSON format.'),
});
export type OperationalInsightsInput = z.infer<typeof OperationalInsightsInputSchema>;

const OperationalInsightsOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'An AI-generated summary of recent safety reports and incident logs, highlighting potential hazards and areas for improvement.'
    ),
});
export type OperationalInsightsOutput = z.infer<typeof OperationalInsightsOutputSchema>;

export async function generateOperationalInsights(
  input: OperationalInsightsInput
): Promise<OperationalInsightsOutput> {
  return operationalInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'operationalInsightsPrompt',
  input: {schema: OperationalInsightsInputSchema},
  output: {schema: OperationalInsightsOutputSchema},
  prompt: `You are an AI assistant that analyzes safety reports and incident logs to identify potential hazards and areas for improvement.

  Safety Reports and Incident Logs:
  {{safetyReports}}

  Please provide a concise summary of the key findings and recommendations. Focus on identifying patterns, potential risks, and actionable steps to enhance safety and prevent future incidents.`,
});

const operationalInsightsFlow = ai.defineFlow(
  {
    name: 'operationalInsightsFlow',
    inputSchema: OperationalInsightsInputSchema,
    outputSchema: OperationalInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
