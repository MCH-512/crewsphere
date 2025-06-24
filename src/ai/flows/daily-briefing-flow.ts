
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
  userRole: z.enum(["Cabin Crew", "Purser", "Instructor", "Pilot", "Admin", "Other"]).optional().describe("The role of the crew member, to tailor the briefing."),
});
export type DailyBriefingInput = z.infer<typeof DailyBriefingInputSchema>;

const DailyBriefingOutputSchema = z.object({
  briefingMarkdown: z
    .string()
    .describe(
      'A concise, AI-generated daily briefing in Markdown format. Includes a greeting, reminders, a safety tip, a contextual update, and an encouraging closing.'
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
Generate a concise, positive, and informative daily briefing for {{{userName}}}{{#if userRole}} (Role: {{{userRole}}}){{/if}}.
The briefing MUST be in well-structured Markdown format.

Include the following sections using Markdown:
- A warm and professional greeting to {{{userName}}}.
- A reminder to check their schedule for any updates today. 📄 
- A prompt to review any new important documents or communications that might have been posted. 📢
- A short, relevant safety tip or operational best practice reminder. {{#if userRole}}Consider tailoring this tip to a {{{userRole}}}.{{else}}This tip should be general for all crew.{{/if}} 🛡️
- A brief, simulated contextual update. Examples: "Heads up: Increased passenger flow expected at Hub Airport this morning due to a local festival." or "Reminder: New uniform guidelines were posted yesterday, please review them in the document library." or "Weather Watch: Expect potential turbulence over the Atlantic sector today." 🌤️
- An encouraging and positive closing remark for their day. ✨

Keep the entire briefing brief (4-6 short paragraphs or bullet points overall), engaging, and professional.
Use relevant emojis appropriately to enhance readability.

Example safety tip for Pilot: "Remember to cross-verify FMS inputs with flight plan data before departure."
Example operational best practice for Purser: "A proactive cabin walk-through before descent can address passenger needs and ensure cabin security."
Example safety tip for Cabin Crew: "Ensure all cabin equipment is secure before takeoff and landing, especially items in galleys and overhead bins."

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
