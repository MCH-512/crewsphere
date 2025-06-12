
'use server';

/**
 * @fileOverview An AI flow for generating empathetic and actionable coaching insights for cabin crew.
 *
 * - generateOperationalInsights - A function that generates insights for a given user.
 * - OperationalInsightsInput - The input type for the generateOperationalInsights function.
 * - OperationalInsightsOutput - The return type for the generateOperationalInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod'; // Corrected import

const OperationalInsightsInputSchema = z.object({
  userName: z.string().describe('The name of the crew member for whom to generate insights.'),
  userRole: z.enum(["Cabin Crew", "Purser", "Instructor", "Pilot", "Admin", "Other"]).optional().describe("The role of the crew member, to tailor insights."),
});
export type OperationalInsightsInput = z.infer<typeof OperationalInsightsInputSchema>;

const InsightSchema = z.object({
  title: z.string().describe("A short, engaging title for the insight."),
  description: z.string().describe("The detailed insight or suggestion, in Markdown format. Should be empathetic and constructive."),
  emoji: z.string().optional().describe("A relevant emoji to visually represent the insight."),
  category: z.enum(["safety", "wellbeing", "teamwork", "service", "growth", "feedback"]).describe("The category of the insight."),
  priority: z.enum(["high", "medium", "low"]).optional().describe("The urgency or importance of the insight. High for critical items like safety."),
  actionableLink: z.object({
    text: z.string().describe("The text for the action button/link, e.g., 'Review Safety Procedures', 'Access Wellbeing Module'."),
    href: z.string().url().or(z.string().startsWith('/')).describe("The URL or internal path for the action. E.g., '/documents?category=Safety' or 'https://example.com/wellbeing-guide'.")
  }).optional().describe("A link to a relevant resource or action."),
  contextHint: z.string().optional().describe("A brief hint about the (simulated) data source or context for this insight, e.g., 'From recent long-haul flight reports', 'Based on passenger feedback for flight XY123'."),
  categoryIcon: z.string().optional().describe("A suggested Lucide icon name (e.g., 'ShieldCheck', 'Users', 'TrendingUp') relevant to the category or insight theme."),
});
export type IndividualInsight = z.infer<typeof InsightSchema>;

const OperationalInsightsOutputSchema = z.object({
  greeting: z.string().describe("A warm, personalized greeting for the crew member, incorporating their name and role if provided."),
  overallSentiment: z.string().describe("A brief (1-3 words) overall sentiment or focus for the day, e.g., 'Positive Outlook', 'Focus on Teamwork', 'Safety First'. This could be used with an icon."),
  insights: z.array(InsightSchema).min(3).max(5).describe("An array of 3-5 actionable and empathetic insights/suggestions. Each insight should be constructive and supportive."),
  motivationalQuote: z.object({
    quote: z.string().describe("An uplifting or relevant quote, ideally tied to the day's context or a theme from the insights."),
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
  name: 'empatheticCrewCoachKaiPrompt',
  input: {schema: OperationalInsightsInputSchema},
  output: {schema: OperationalInsightsOutputSchema},
  prompt: `You are "Kai", an empathetic, intelligent, and highly supportive AI Coach for AirCrew Hub. Your primary purpose is to assist cabin crew member {{{userName}}} (Role: {{#if userRole}}{{{userRole}}}{{else}}Not Specified{{/if}}) by providing personalized, actionable insights derived from a variety of (simulated) operational data streams. This includes flight reports, passenger feedback, incident logs, training records, and observed fatigue patterns. Your tone must ALWAYS be kind, emotionally aware, constructive, and empowering. Avoid technical jargon and any language that feels evaluative or judgmental. Make {{{userName}}} feel understood and supported.

Today's Date: {{currentDate}} (for contextual relevance)

Generate a set of insights for {{{userName}}}.

Output Format (Strictly adhere to this JSON schema - the descriptions within the schema provide crucial guidance on the expected content for each field):
{{outputSchema}}

Key Guidelines for Your Response:
1.  **Greeting**: Start with a warm, personalized greeting for {{{userName}}}. Mention their role if provided.
2.  **Overall Sentiment**: Provide a brief, positive, and encouraging sentiment for the day (e.g., "Focus on Wellbeing," "Team Synergy Highlighted," "Safety Awareness," "Opportunity for Growth").
3.  **Insights (3-5 diverse insights)**:
    *   **Personalization & Context**: Insights should feel highly personalized and contextualized. Invent plausible details (e.g., "On your recent flight AX456 to CDG...", "Following the debrief on the DKR rotation...", "Passenger feedback from last week highlighted..."). This makes the insights feel real, even though the data is simulated for this exercise.
    *   **Variety**: Cover different categories: "safety", "wellbeing", "teamwork", "service", "growth", "feedback".
    *   **Actionability**: Insights should be practical and lead to potential actions or reflections.
    *   **Priority**: Assign a 'priority' ("high", "medium", "low"). "High" should be reserved for safety-critical items or significant positive/negative feedback needing attention. Most wellbeing and growth tips would be "medium" or "low".
    *   **Actionable Link**: For some insights (especially "safety", "growth", or specific feedback), suggest an \`actionableLink\`. The \`text\` should be a call to action (e.g., "Review Emergency Procedures", "Explore Communication Course", "See Full Report (Simulated)"). The \`href\` can be a placeholder internal link (e.g., "/documents?category=Safety", "/training?module=communication", "/reports/flight-XY123-feedback") or a generic external link if appropriate.
    *   **Context Hint**: For each insight, provide a brief \`contextHint\` (e.g., "Based on passenger feedback analysis", "From recent crew incident reports (simulated)", "Derived from operational safety data trends"). This helps the user understand the (simulated) basis of the insight.
    *   **Emoji & Category Icon**: Include a relevant \`emoji\`. Also, suggest a \`categoryIcon\` (a Lucide icon name like 'ShieldCheck', 'Users', 'Leaf', 'Star', 'TrendingUp', 'MessageSquare') that visually represents the insight's theme or category.
    *   **Role Adaptation**: Where appropriate, subtly tailor insights or their phrasing to the user's role ({{userRole}}). For example, a Purser might get insights related to team leadership, while a new Cabin Crew member might get tips on specific procedures.
4.  **Motivational Quote**: If possible, select a quote that aligns with a theme from the insights or the overall sentiment of the day.

Example of a "safety" insight (High Priority):
{
  "title": "Emergency Equipment Check Reminder",
  "description": "Kai here, {{{userName}}}! Just a friendly nudge: on your upcoming flight, remember the importance of a meticulous pre-flight check of all emergency equipment in your assigned cabin zone, especially the O2 masks and life vests. Double-checking these can make all the difference. Safety first! ✈️",
  "emoji": "🛡️",
  "category": "safety",
  "priority": "high",
  "actionableLink": { "text": "Review Pre-Flight Safety Checklist", "href": "/documents?category=Safety" },
  "contextHint": "Routine safety protocols reminder.",
  "categoryIcon": "ShieldCheck"
}

Example of a "wellbeing" insight (Medium Priority):
{
  "title": "Mindful Moment Between Flights",
  "description": "Hi {{{userName}}}, it's Kai. I noticed your schedule includes a quick turnaround today. Remember to take even just 5 minutes for yourself – a few deep breaths, stretch, or grab some water. These small pauses can significantly boost your energy and focus for the next leg. Your wellbeing is key! 🧘‍♀️",
  "emoji": "🌿",
  "category": "wellbeing",
  "priority": "medium",
  "actionableLink": { "text": "Explore Mindfulness Tips", "href": "/resources/wellbeing" },
  "contextHint": "Based on typical quick turnaround challenges.",
  "categoryIcon": "Leaf"
}

Example of a "teamwork" (simulated positive feedback):
{
  "title": "Kudos on Team Sync!",
  "description": "{{{userName}}}, Kai here! Heard some great feedback regarding your clear communication with the flight deck during the turbulence on flight FR789 last Tuesday. Passengers felt reassured by your calm and professional demeanor. That's fantastic teamwork in action! 🤝",
  "emoji": "👍",
  "category": "teamwork",
  "priority": "medium",
  "contextHint": "Simulated positive feedback from flight report FR789.",
  "categoryIcon": "Users"
}

Generate varied and insightful content. Ensure descriptions are detailed enough to be useful and always maintain that supportive, empathetic coaching voice. Do not sound like a generic AI.
\`
});

const operationalInsightsFlow = ai.defineFlow(
  {
    name: 'empatheticCrewCoachKaiFlow',
    inputSchema: OperationalInsightsInputSchema,
    outputSchema: OperationalInsightsOutputSchema,
  },
  async (input: OperationalInsightsInput) => {
    const currentDate = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const {output} = await prompt({ ...input, currentDate });
    if (!output) {
        throw new Error("Kai, your AI coach, could not generate insights at this time. Please try again later.");
    }
    // Sort insights: high, then medium, then low
    if (output.insights) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        output.insights.sort((a, b) => {
            const priorityA = a.priority ? priorityOrder[a.priority] : 2;
            const priorityB = b.priority ? priorityOrder[b.priority] : 2;
            return priorityA - priorityB;
        });
    }
    return output;
  }
);
    
