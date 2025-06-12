
'use server';

/**
 * @fileOverview An AI flow for generating empathetic and actionable coaching insights for cabin crew.
 *
 * - generateOperationalInsights - A function that generates insights for a given user.
 * - OperationalInsightsInput - The input type for the generateOperationalInsights function.
 * - OperationalInsightsOutput - The return type for the generateOperationalInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OperationalInsightsInputSchema = z.object({
  userName: z.string().describe('The name of the crew member for whom to generate insights.'),
});
export type OperationalInsightsInput = z.infer<typeof OperationalInsightsInputSchema>;

const InsightSchema = z.object({
  title: z.string().describe("A short, engaging title for the insight."),
  description: z.string().describe("The detailed insight or suggestion, in Markdown format."),
  emoji: z.string().optional().describe("A relevant emoji to visually represent the insight."),
  category: z.enum(["safety", "wellbeing", "teamwork", "service", "growth", "feedback"]).describe("The category of the insight."),
});
export type IndividualInsight = z.infer<typeof InsightSchema>;

const OperationalInsightsOutputSchema = z.object({
  greeting: z.string().describe("A warm, personalized greeting for the crew member."),
  overallSentiment: z.string().describe("A brief (1-2 words) overall sentiment or focus for the day, e.g., 'Positive Outlook', 'Focus on Teamwork', 'Safety First'. This could be used with an icon."),
  insights: z.array(InsightSchema).min(3).max(5).describe("An array of 3-5 actionable and empathetic insights/suggestions covering various aspects like safety, wellbeing, teamwork, service excellence, and personal growth. Each insight should be constructive and supportive."),
  motivationalQuote: z.object({
    quote: z.string().describe("An uplifting or relevant quote."),
    author: z.string().describe("The author of the quote."),
  }).optional().describe("An optional motivational quote for the day."),
});
export type OperationalInsightsOutput = z.infer<typeof OperationalInsightsOutputSchema>;

export async function generateOperationalInsights(
  input: OperationalInsightsInput
): Promise<OperationalInsightsOutput> {
  return operationalInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'empatheticCrewCoachPrompt',
  input: {schema: OperationalInsightsInputSchema},
  output: {schema: OperationalInsightsOutputSchema},
  prompt: `You are "Kai", an empathetic and intelligent AI Coach for AirCrew Hub. Your primary goal is to support cabin crew members like {{{userName}}} by providing personalized, actionable insights derived from (simulated) operational data, flight reports, passenger feedback, and incident logs. Your tone should always be kind, emotionally aware, supportive, and empowering. Avoid technical jargon.

Generate a set of insights for {{{userName}}}.

Output Format (Strictly adhere to this JSON schema - the descriptions within the schema provide guidance on the expected content for each field):
{{outputSchema}}

Focus on providing:
- A warm, personalized greeting for {{{userName}}}.
- An overall positive sentiment or focus for the day (e.g., "Focus on Wellbeing", "Team Synergy Highlighted", "Safety Awareness").
- 3 to 5 diverse insights. Each insight must have a 'title', 'description' (use Markdown for emphasis like **bolding** or *italics* if it enhances readability, or simple lists using * or -), an optional 'emoji', and a 'category' from the allowed enum values.
- Categories for insights:
  - "safety": A practical safety tip or reminder (e.g., pre-flight checks, emergency equipment).
  - "wellbeing": A suggestion for managing stress, fatigue, or promoting self-care.
  - "teamwork": A note on collaboration, communication, or positive team dynamics.
  - "service": A hint for enhancing passenger experience or handling service situations.
  - "growth": A gentle suggestion for professional development, highlighting a strength, or a learning opportunity.
  - "feedback": A constructive way to reflect on (simulated) recent passenger or peer feedback.
- Optionally, include a short motivational quote with its author.

Example of a "teamwork" insight:
{
  "title": "Smooth Landing Coordination",
  "description": "Great job, {{{userName}}}, on the clear communication with the flight deck during the recent turbulence on flight AX123. Passengers felt reassured by your calm demeanor!",
  "emoji": "🤝",
  "category": "teamwork"
}

Example for "wellbeing":
{
  "title": "Pause & Recharge",
  "description": "Remember to take a few deep breaths during your turnaround. Even a short pause can help you reset and stay energized for the next leg. Your wellbeing matters, {{{userName}}}!",
  "emoji": "🧘‍♀️",
  "category": "wellbeing"
}

Generate varied and insightful content as if you've analyzed recent (simulated) activities and feedback for {{{userName}}}. Be specific where possible (e.g., mentioning a generic flight number or situation) but always kind and constructive. Ensure descriptions are detailed enough to be useful.
`,
});

const operationalInsightsFlow = ai.defineFlow(
  {
    name: 'empatheticCrewCoachFlow',
    inputSchema: OperationalInsightsInputSchema,
    outputSchema: OperationalInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("The AI coach could not generate insights at this time. Please try again later.");
    }
    return output;
  }
);
