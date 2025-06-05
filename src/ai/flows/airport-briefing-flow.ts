
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
      'A comprehensive AI-generated briefing for the specified airport, formatted in Markdown. Includes operational details, weather patterns, NOTAMs, emojis for visual appeal, visa notes, and other relevant information for crew.'
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
The output MUST be well-structured Markdown. Incorporate relevant emojis in section titles or key points to enhance readability and visual appeal.

Airport Identifier: {{{airportIdentifier}}}

Please provide a briefing that includes the following sections, using Markdown headings (e.g., ## Section Title) for each:

1.  **## 🌍 Airport Overview**
    *   **Full Name:** [Full Name]
    *   **Location:** [City, Country]
    *   **ICAO Code:** [ICAO]
    *   **IATA Code:** [IATA]
    *   **Airport Emblem/Symbol (Textual):** [e.g., Suggest a simple textual placeholder like "[Airport Icon]" or a relevant emoji if appropriate]
    *   **Local Time Zone:** [e.g., UTC-5 (Eastern Time), include DST info if applicable and known] 🕒
    *   **Airport Elevation:** [Elevation in feet and meters, e.g., 123 ft / 37 m] ⛰️


2.  **## ✈️ Operational Information**
    *   **Key Runways:** (List lengths, surfaces, typical configurations if known. Use bullet points: * Runway XX: Length, Surface)
    *   **ATC Frequencies:** (Common Tower, Ground, ATIS if generally known. Use bullet points: * Tower: XXX.XX MHz 📡)
    *   **Known Complexities:** (e.g., noise abatement, specific arrival/departure procedures, significant terrain. Use bullet points if multiple.)

3.  **## ☀️ Weather Patterns**
    *   **Prevailing Winds:** [General direction and common strength, e.g., Predominantly WSW at 10-15 kts] 💨
    *   **Seasonal Weather:** (e.g., Fog season (Oct-Mar) 🌫️, common snow (Dec-Feb) ❄️, typical thunderstorm activity (Jun-Aug) ⛈️. Use bullet points.)
    *   **Specific Phenomena:** (Any particular weather hazards crews should be aware of, e.g., Microbursts common in summer.)

4.  **## 📢 NOTAMs & Advisories (General)**
    *   **General NOTAM Activity:** (Describe if typically many/few, common types. *Do not fetch live NOTAMs.*)
    *   **Long-Standing Advisories:** (Any significant, persistent advisories or common alerts mentioned in general sources.)

5.  **## 🛂 Visa & Immigration Notes**
    *   **General Entry Requirements:** (Brief note on general passport/visa policies if widely known for the country. e.g., "Schengen Area entry rules apply.")
    *   **Visa Regulations for Tunisian Nationals:** (Provide a general overview of visa requirements or arrangements for Tunisian nationals entering the country of the specified airport. If specific information is not readily available from general knowledge, state "Visa requirements for Tunisian nationals should be verified via official consular websites or the respective embassy.")
    *   **Customs & Quarantine:** (Brief notes on any particularly notable customs or quarantine regulations for arriving crews/passengers if widely known.)

6.  **## 🧑‍✈️ Crew Information**
    *   **Ground Transportation:** (Notes on typical options/time to city center/crew hotels if widely known.) 🚕
    *   **Crew Facilities:** (Brief mention if specific crew rooms or amenities are known and publicly documented.) ☕
    *   **Layover Considerations:** (Brief, practical cultural notes, safety tips, or local customs if relevant and helpful for layovers. Focus on safety and convenience.)

7.  **## 🆘 Contingency & Emergency**
    *   **Nearest Suitable Alternates:** (List 1-2 major suitable alternate airports if applicable, especially for hub airports.)
    *   **Airport Emergency Services:** (General note on availability, e.g., "Full ARFF services available Cat 9.") 🚒

Formatting Guidelines:
*   Use Markdown headings (e.g., ## Section Title) for each main section listed above.
*   Use bold text (e.g., **text**) for sub-headings or to emphasize key terms within bullet points.
*   Use bullet points (e.g., * Item or - Item) for lists.
*   Incorporate relevant emojis where appropriate to make the briefing more engaging.
*   Ensure the output is a single, coherent Markdown string.
*   Be concise but thorough.

If the airport identifier is ambiguous or not recognized, please state: "The airport identifier '{{{airportIdentifier}}}' is not recognized or is ambiguous. Please provide a specific ICAO or IATA code."
Do not invent information if it's not generally known or publicly available. It's better to state that specific information requires consulting official sources for operational use.
Focus on providing practical and actionable information for flight and cabin crew.
The briefing should be well-structured and easy to read.
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

