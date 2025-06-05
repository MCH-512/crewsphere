'use server';
/**
 * @fileOverview An AI flow for generating a daily briefing for AirCrew Hub users.
 *
 * - generateDailyBriefing - A function that generates a daily briefing.
 * - DailyBriefingInput - The input type for the generateDailyBriefing function.
 * - DailyBriefingOutput - The return type for the generateDailyBriefing function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DailyBriefingInputSchema = z.object({
  userName: z.string().describe('The name of the user for whom to generate the briefing.'),
});
export type DailyBriefingInput = z.infer<typeof DailyBriefingInputSchema>;

const DailyBriefingOutputSchema = z.object({
  briefingMarkdown: z
    .string()
    .describe(
      'A concise, AI-generated daily briefing in Markdown format. Includes a greeting, reminders, a safety tip, and an encouraging closing.'
    ),
});
export type DailyBriefingOutput = z.infer<typeof DailyBriefingOutputSchema>;

export async function generateDailyBriefing(
  input: DailyBriefingInput
): Promise<DailyBriefingOutput> {
  return dailyBriefingFlow(input);
}

const dailyBriefingPrompt = ai.definePrompt({
  name: 'dailyBriefingPrompt',
  input: {schema: DailyBriefingInputSchema},
  output: {schema: DailyBriefingOutputSchema},
  prompt: `You are an AI assistant for AirCrew Hub, a platform for airline crew.
Generate a concise, positive, and informative daily briefing for {{{userName}}}.
The briefing MUST be in well-structured Markdown format.

Include the following sections using Markdown:
- A warm and professional greeting to {{{userName}}}.
- A reminder to check their schedule for any updates today. 📄
- A prompt to review any new important documents or communications that might have been posted. 📢
- A short, relevant safety tip or operational best practice reminder for cabin crew. 🛡️
- An encouraging and positive closing remark for their day. ✨

Keep the entire briefing brief (3-5 short paragraphs or bullet points overall), engaging, and professional.
Use relevant emojis appropriately to enhance readability.

Example safety tip: "Remember to conduct thorough pre-flight checks on all emergency equipment in your assigned zone."
Example operational best practice: "Clear and concise communication with fellow crew members is key to a smooth operation."
Ensure the output is a single Markdown string for 'briefingMarkdown'.
`,
});

const dailyBriefingFlow = ai.defineFlow(
  {
    name: 'dailyBriefingFlow',
    inputSchema: DailyBriefingInputSchema,
    outputSchema: DailyBriefingOutputSchema,
  },
  async (input: DailyBriefingInput) => {
    const {output} = await dailyBriefingPrompt(input);
    if (!output) {
      throw new Error("Failed to get a response from the AI model for the daily briefing.");
    }
    return output;
  }
);
