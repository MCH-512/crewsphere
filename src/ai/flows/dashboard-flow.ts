
'use server';
/**
 * @fileOverview An AI flow for generating consolidated dashboard data, including the daily briefing and Kai's insights.
 *
 * - generateDashboardData - A function that generates all necessary AI data for the user dashboard.
 * - DashboardDataInput - The input type for the generateDashboardData function.
 * - DashboardDataOutput - The return type for the generateDashboardData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

// --- Schemas from daily-briefing-flow.ts (duplicated for consolidation) ---
const DailyBriefingOutputSchema = z.object({
  briefingMarkdown: z
    .string()
    .describe(
      'A concise, AI-generated daily briefing in Markdown format. Includes a greeting, reminders, a safety tip, a contextual update, and an encouraging closing.'
    ),
});

// --- Schemas from operational-insights.ts (duplicated for consolidation) ---
const InsightSchema = z.object({
  title: z.string().describe("A short, engaging title for the insight."),
  description: z.string().describe("The detailed insight or suggestion, in Markdown format. Should be empathetic and constructive."),
  emoji: z.string().optional().describe("A relevant emoji to visually represent the insight."),
  category: z.enum(["safety", "wellbeing", "teamwork", "service", "growth", "feedback"]).describe("The category of the insight."),
  priority: z.enum(["high", "medium", "low"]).optional().describe("The urgency or importance of the insight. High for critical items like safety."),
  actionableLink: z.object({
    text: z.string().describe("The text for the action button/link, e.g., 'Review Safety Procedures', 'Access Wellbeing Module'."),
    href: z.string().describe("The URL (e.g., https://example.com/resource) or internal path (e.g., /documents?category=Safety) for the action.")
  }).optional().describe("A link to a relevant resource or action."),
  contextHint: z.string().optional().describe("A brief hint about the (simulated) data source or context for this insight, e.g., 'From recent long-haul flight reports', 'Based on passenger feedback for flight XY123'."),
  categoryIcon: z.string().optional().describe("A suggested Lucide icon name (e.g., 'ShieldCheck', 'Users', 'TrendingUp') relevant to the category or insight theme."),
});

const OperationalInsightsOutputSchema = z.object({
  greeting: z.string().describe("A warm, personalized greeting for the crew member, incorporating their name and role if provided."),
  overallSentiment: z.string().describe("A brief (1-3 words) overall sentiment or focus for the day, e.g., 'Positive Outlook', 'Focus on Teamwork', 'Safety First'. This could be used with an icon."),
  insights: z.array(InsightSchema).min(3).max(5).describe("An array of 3-5 actionable and empathetic insights/suggestions. Each insight should be constructive and supportive."),
  motivationalQuote: z.object({
    quote: z.string().describe("An uplifting or relevant quote, ideally tied to the day's context or a theme from the insights."),
    author: z.string().describe("The author of the quote."),
  }).optional().describe("An optional motivational quote for the day."),
});


// --- New Consolidated Schemas ---
const DashboardDataInputSchema = z.object({
  userName: z.string().describe('The name of the user for whom to generate the dashboard data.'),
  userRole: z.enum(["Cabin Crew", "Purser", "Instructor", "Pilot", "Admin", "Other"]).optional().describe("The role of the crew member, to tailor the content."),
});
export type DashboardDataInput = z.infer<typeof DashboardDataInputSchema>;

const DashboardDataOutputSchema = z.object({
  dailyBriefing: DailyBriefingOutputSchema,
  kaiInsights: OperationalInsightsOutputSchema,
});
export type DashboardDataOutput = z.infer<typeof DashboardDataOutputSchema>;

export async function generateDashboardData(
  input: DashboardDataInput
): Promise<DashboardDataOutput> {
  return dashboardDataFlow(input);
}

const dashboardDataPrompt = ai.definePrompt({
  name: 'dashboardDataPrompt',
  input: {schema: DashboardDataInputSchema},
  output: {schema: DashboardDataOutputSchema},
  prompt: `You are an AI assistant for AirCrew Hub, a platform for airline crew.
Your task is to generate a JSON object containing two main parts for a user's dashboard: a "dailyBriefing" and personalized "kaiInsights".

User Details:
- Name: {{{userName}}}
- Role: {{#if userRole}}{{{userRole}}}{{else}}Not Specified{{/if}}
- Current Date: {{currentDate}}

Please generate the output in a single JSON object conforming to the specified output schema.

--- PART 1: dailyBriefing ---
Generate a concise, positive, and informative daily briefing. It MUST be well-structured Markdown in the 'briefingMarkdown' field.
Include the following sections in the Markdown:
- A warm and professional greeting.
- A reminder to check their schedule and any new communications. 📄 📢
- A short, relevant safety tip or operational best practice reminder tailored to the user's role if possible. 🛡️
- A brief, simulated contextual update (e.g., "Weather Watch: Expect potential turbulence over the Atlantic sector today."). 🌤️
- An encouraging and positive closing remark. ✨

--- PART 2: kaiInsights ---
Act as "Kai", an empathetic and supportive AI Coach. Generate personalized, actionable insights derived from (simulated) operational data. The tone must ALWAYS be kind, emotionally aware, and empowering. Avoid technical jargon.
Generate the following for the 'kaiInsights' object:
1.  **greeting**: A warm, personalized greeting for the user. This can be different from the briefing greeting.
2.  **overallSentiment**: A brief, positive sentiment for the day (e.g., "Focus on Wellbeing," "Team Synergy Highlighted").
3.  **insights (3-5 diverse insights)**:
    *   Invent plausible, personalized context (e.g., "On your recent flight AX456...", "Following the debrief on the DKR rotation...").
    *   Cover diverse categories: "safety", "wellbeing", "teamwork", "service", "growth", "feedback".
    *   Assign a 'priority' ("high", "medium", "low"). High is for safety-critical items.
    *   For some insights, suggest an 'actionableLink' with 'text' and 'href' (e.g., "/documents?category=Safety").
    *   Provide a 'contextHint' (e.g., "Based on passenger feedback analysis").
    *   Suggest an 'emoji' and a 'categoryIcon' (a Lucide icon name like 'ShieldCheck', 'Users', 'Leaf').
4.  **motivationalQuote** (Optional): An uplifting quote that aligns with the day's theme.

Ensure the final output is a single, valid JSON object with both 'dailyBriefing' and 'kaiInsights' keys as per the output schema.
`,
});

const dashboardDataFlow = ai.defineFlow(
  {
    name: 'dashboardDataFlow',
    inputSchema: DashboardDataInputSchema,
    outputSchema: DashboardDataOutputSchema,
  },
  async (input: DashboardDataInput) => {
    const currentDate = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const {output} = await dashboardDataPrompt({ ...input, currentDate });
    if (!output) {
      throw new Error("The AI failed to generate dashboard data. Please try again later.");
    }
    // Sort insights within the output
    if (output.kaiInsights?.insights) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        output.kaiInsights.insights.sort((a, b) => {
            const priorityA = a.priority ? priorityOrder[a.priority] : 2;
            const priorityB = b.priority ? priorityOrder[b.priority] : 2;
            return priorityA - priorityB;
        });
    }
    return output;
  }
);
