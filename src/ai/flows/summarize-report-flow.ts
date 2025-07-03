'use server';
/**
 * @fileOverview An AI flow to summarize purser reports.
 *
 * - summarizeReport - A function that takes the content of a purser report and returns a structured summary.
 * - SummarizeReportInput - The input type for the summarizeReport function.
 * - SummarizeReportOutput - The return type for the summarizeReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

export const SummarizeReportInputSchema = z.object({
  reportContent: z.string().describe('The full text content of the purser report to be summarized.'),
});
export type SummarizeReportInput = z.infer<typeof SummarizeReportInputSchema>;

export const SummarizeReportOutputSchema = z.object({
  summary: z.string().describe("A concise, neutral summary of the entire report in 2-3 sentences."),
  keyPoints: z.array(z.string()).describe("A list of the most important key points or events mentioned in the report."),
  potentialRisks: z.array(z.string()).describe("A list of any potential risks or issues that may require follow-up, such as safety, security, or maintenance problems. If none, return an empty array."),
});
export type SummarizeReportOutput = z.infer<typeof SummarizeReportOutputSchema>;

export async function summarizeReport(input: SummarizeReportInput): Promise<SummarizeReportOutput> {
  return summarizeReportFlow(input);
}

const summarizeReportPrompt = ai.definePrompt({
  name: 'summarizeReportPrompt',
  input: {schema: SummarizeReportInputSchema},
  output: {schema: SummarizeReportOutputSchema},
  prompt: `You are an expert aviation analyst. Your task is to read the following purser's flight report and provide a structured summary.

Focus on extracting factual information. Be concise and objective. Identify any points that may require administrative attention, especially regarding safety, security, maintenance, or significant passenger issues.

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
