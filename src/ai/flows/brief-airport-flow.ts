
'use server';
/**
 * @fileOverview An AI flow for generating airport operational briefings.
 *
 * - briefAirport - A function that provides a structured briefing for a given airport.
 * - AirportBriefingInput - The input type for the briefAirport function.
 * - AirportBriefingOutput - The return type for the briefAirport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const AirportBriefingInputSchema = z.object({
  icao: z.string().length(4).describe('The ICAO code of the airport (e.g., KJFK, EGLL).'),
  iata: z.string().length(3).describe('The IATA code of the airport (e.g., JFK, LHR).'),
  name: z.string().describe('The full name of the airport.'),
  city: z.string().describe('The city where the airport is located.'),
  country: z.string().describe('The country where the airport is located.'),
});
export type AirportBriefingInput = z.infer<typeof AirportBriefingInputSchema>;

const AirportBriefingOutputSchema = z.object({
  operationalSummary: z.string().describe("A summary of the airport's key operational characteristics, including runway layout, typical traffic patterns, and important taxiway information."),
  potentialChallenges: z.string().describe("Highlights potential challenges such as common adverse weather, complex terrain, noise abatement procedures, or specific ATC complexities."),
  crewRecommendations: z.string().describe("Actionable recommendations for the flight crew, like fuel planning considerations, specific approach procedures to be aware of, or communication tips."),
});
export type AirportBriefingOutput = z.infer<typeof AirportBriefingOutputSchema>;

export async function briefAirport(input: AirportBriefingInput): Promise<AirportBriefingOutput> {
  return briefAirportFlow(input);
}

const briefingPrompt = ai.definePrompt({
  name: 'airportBriefingPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: {schema: AirportBriefingInputSchema},
  output: {schema: AirportBriefingOutputSchema},
  prompt: `You are an expert aviation operations analyst providing a vital briefing for flight crew.
  
  Your task is to generate a concise, professional operational briefing for the following airport:
  - ICAO: {{icao}}
  - IATA: {{iata}}
  - Name: {{name}}
  - Location: {{city}}, {{country}}

  The briefing must be structured and contain only factual, relevant information for pilots and cabin crew. Focus on operational aspects. Do not include historical facts or tourist information.
  
  Please provide the output in the requested JSON format, with detailed descriptions for each field as specified in the output schema.
  - operationalSummary: Mention runway configuration (e.g., parallel, single), dominant traffic flow if any, and key taxiways or hotspots.
  - potentialChallenges: Focus on recurring weather (e.g., crosswinds, fog), nearby terrain, complex SIDs/STARs, or strict noise abatement.
  - crewRecommendations: Provide actionable advice. Examples: "Consider extra taxi fuel due to complex layout," "Be prepared for visual approaches," or "Strict adherence to noise abatement procedures on departure is mandatory."`,
});

const briefAirportFlow = ai.defineFlow(
  {
    name: 'briefAirportFlow',
    inputSchema: AirportBriefingInputSchema,
    outputSchema: AirportBriefingOutputSchema,
  },
  async (input) => {
    const {output} = await briefingPrompt(input);
    if (!output) {
      throw new Error("Failed to generate airport briefing from AI.");
    }
    return output;
  }
);
