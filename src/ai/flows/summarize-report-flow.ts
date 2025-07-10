'use server';
/**
 * @fileOverview An AI flow to summarize purser reports.
 *
 * - summarizeReport - A function that takes the content of a purser report and returns a structured summary.
 */

import {ai} from '@/ai/genkit';
import { SummarizeReportInputSchema, SummarizeReportOutputSchema, type SummarizeReportInput, type SummarizeReportOutput } from '@/schemas/purser-report-schema';

export async function summarizeReport(input: SummarizeReportInput): Promise<SummarizeReportOutput> {
  return summarizeReportFlow(input);
}

const summarizeReportPrompt = ai.definePrompt({
  name: 'summarizeReportPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: SummarizeReportInputSchema},
  output: {schema: SummarizeReportOutputSchema},
  prompt: `You are an expert aviation analyst. Your task is to read the following purser's flight report and provide a structured summary.

Focus on extracting factual information. Be concise and objective. Identify any points that may require administrative attention, especially regarding safety, security, maintenance, crew performance, or significant passenger issues.

Here is the report content:
---
{{{reportContent}}}
---
`,
});

const summarizeReportFlow = ai.defineFlow(
  {
    name: 'summarizeReportFlow',
    inputSchema: SummarizeReportInputSchema,
    outputSchema: SummarizeReportOutputSchema,
  },
  async (input) => {
    const {output} = await summarizeReportPrompt(input);
    if (!output) {
      throw new Error('The AI model did not return a valid summary.');
    }
    return output;
  }
);
