
'use server';
/**
 * @fileOverview An AI flow for generating airport briefings.
 *
 * - generateAirportBriefing - A function that generates a briefing for a given airport identifier.
 * - AirportBriefingInput - The input type for the generateAirportBriefing function.
 * - AirportBriefingOutput - The return type for the generateAirportBriefing function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AirportBriefingInputSchema = z.object({
  airportIdentifier: z
    .string()
    .min(3)
    .max(10)
    .describe(
      'The ICAO or IATA code of the airport (e.g., KJFK, EGLL, LHR).'
    ),
});
export type AirportBriefingInput = z.infer<typeof AirportBriefingInputSchema>;

const AirportBriefingOutputSchema = z.object({
  briefing: z
    .string()
    .describe(
      'A comprehensive AI-generated briefing for the specified airport, including operational details, weather patterns, NOTAMs, and other relevant information for crew.'
    ),
});
export type AirportBriefingOutput = z.infer<typeof AirportBriefingOutputSchema>;

export async function generateAirportBriefing(
  input: AirportBriefingInput
): Promise<AirportBriefingOutput> {
  return airportBriefingFlow(input);
}

const airportBriefingPrompt = ai.definePrompt({
  name: 'airportBriefingPrompt',
  input: {schema: AirportBriefingInputSchema},
  output: {schema: AirportBriefingOutputSchema},
  prompt: `You are an expert aviation intelligence assistant. Your task is to generate a concise yet comprehensive briefing for the airport specified by the user.

Airport Identifier: {{{airportIdentifier}}}

Please provide a briefing that includes, but is not limited to:
1.  **Airport Overview**: Full Name, City, Country, ICAO/IATA codes.
2.  **Operational Information**:
    *   Key Runways (length, surface, typical configurations if known).
    *   Common ATC frequencies (Tower, Ground, ATIS if generally known).
    *   Known complex procedures or noise abatement rules if significant.
3.  **Weather Patterns**:
    *   Typical prevailing winds.
    *   Seasonal weather considerations (e.g., fog season, snow, thunderstorms).
    *   Any specific weather phenomena crews should be aware of.
4.  **NOTAMs & Advisories**:
    *   Mention if there are typically many NOTAMs or if specific types are common. (You do not need to fetch live NOTAMs, but can describe general patterns).
    *   Any long-standing advisories or common alerts.
5.  **Crew Information**:
    *   Notes on ground transportation from airport to city center/hotels if readily available.
    *   Brief mention of crew facilities or layover considerations if widely known.
    *   Any significant cultural notes or local customs for layovers if applicable and brief.
6.  **Contingency/Emergency**:
    *   Brief mention of nearest suitable alternate airports if a major hub.

Focus on providing practical and actionable information for flight and cabin crew.
The briefing should be well-structured and easy to read. Use Markdown for formatting if it helps clarity (e.g., bold headings, bullet points).

If the airport identifier is ambiguous or not recognized, please state that you need a more specific identifier (e.g., ICAO or IATA code) and cannot generate a briefing.
Do not invent information if it's not generally known or available. It's better to state that specific information (like live NOTAMs or very detailed local procedures) requires consulting official sources.
`,
});

const airportBriefingFlow = ai.defineFlow(
  {
    name: 'airportBriefingFlow',
    inputSchema: AirportBriefingInputSchema,
    outputSchema: AirportBriefingOutputSchema,
  },
  async input => {
    const {output} = await airportBriefingPrompt(input);
    if (!output) {
        throw new Error("Failed to get a response from the AI model for airport briefing.");
    }
    return output;
  }
);
