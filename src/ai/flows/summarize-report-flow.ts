
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
    try {
        const {output} = await summarizeReportPrompt(input);
        if (!output) {
          // This case handles if the model returns nothing, which is different from an error.
          console.warn('AI summary returned no output.');
          return { summary: '', keyPoints: [], potentialRisks: [] };
        }
        return output;
    } catch (error) {
        // This case handles network errors or API failures (like 503).
        console.error("AI summarization flow failed:", error);
        // Return an empty valid structure instead of throwing an error
        return { summary: '', keyPoints: [], potentialRisks: [] };
    }
  }
);
