
'use server';
/**
 * @fileOverview An AI flow for calculating flight duty periods and basic compliance checks.
 *
 * - calculateFlightDuty - A function that calculates flight duty based on input flight segments and other parameters.
 * - FlightDutyInput - The input type for the calculateFlightDuty function.
 * - FlightDutyOutput - The return type for the calculateFlightDuty function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FlightSegmentSchema = z.object({
  departureAirport: z.string().min(3).max(10).describe('Departure airport ICAO/IATA code.'),
  arrivalAirport: z.string().min(3).max(10).describe('Arrival airport ICAO/IATA code.'),
  departureTimeUTC: z.string().datetime().describe('Scheduled departure time in UTC (ISO 8601 format).'),
  arrivalTimeUTC: z.string().datetime().describe('Scheduled arrival time in UTC (ISO 8601 format).'),
});

const FlightDutyInputSchema = z.object({
  flightSegments: z.array(FlightSegmentSchema).min(1).describe('An array of flight segments.'),
  preFlightBriefingHours: z.number().min(0).max(5).describe('Hours for pre-flight briefing before the first departure.'),
  postFlightDebriefingHours: z.number().min(0).max(5).describe('Hours for post-flight debriefing after the last arrival.'),
  // For simplicity, we are not asking for minimum rest here, the AI will use a general rule.
});
export type FlightDutyInput = z.infer<typeof FlightDutyInputSchema>;

const FlightDutyOutputSchema = z.object({
  dutyPeriodStartUTC: z.string().datetime().describe('Calculated start time of the duty period in UTC.'),
  dutyPeriodEndUTC: z.string().datetime().describe('Calculated end time of the duty period in UTC.'),
  totalDutyTimeHours: z.number().describe('Total calculated duty time in hours.'),
  totalFlightTimeHours: z.number().describe('Total calculated flight time (block time) in hours.'),
  maxFlightTimeExceeded: z.boolean().describe('Indicates if the flight time exceeds a general maximum (e.g., 9 hours for 1-2 sectors).'),
  // minRestMet: z.boolean().describe('Indicates if a generic minimum rest period (e.g., 10 hours) would be met before a subsequent duty if starting immediately after this one.'),
  summary: z.string().describe('An AI-generated summary of the duty period, including compliance notes and potential issues based on generic rules.'),
});
export type FlightDutyOutput = z.infer<typeof FlightDutyOutputSchema>;

export async function calculateFlightDuty(input: FlightDutyInput): Promise<FlightDutyOutput> {
  return flightDutyCalculatorFlow(input);
}

const flightDutyCalculatorPrompt = ai.definePrompt({
  name: 'flightDutyCalculatorPrompt',
  input: {schema: FlightDutyInputSchema},
  output: {schema: FlightDutyOutputSchema},
  prompt: `You are an expert Flight Duty Period calculator. Your task is to calculate duty times based on the provided flight segments and briefing/debriefing times. You also need to perform basic compliance checks against generic rules.

Input Data:
Flight Segments (0-indexed):
{{#each flightSegments}}
- Segment {{@index}}: {{departureAirport}} to {{arrivalAirport}}, Departure: {{departureTimeUTC}}, Arrival: {{arrivalTimeUTC}}
{{/each}}
Pre-Flight Briefing: {{preFlightBriefingHours}} hours
Post-Flight Debriefing: {{postFlightDebriefingHours}} hours

Calculations to perform:
1.  **Duty Period Start Time (UTC)**: This is the departure time of the first flight segment minus the pre-flight briefing hours.
2.  **Duty Period End Time (UTC)**: This is the arrival time of the last flight segment plus the post-flight debriefing hours.
3.  **Total Duty Time (Hours)**: The duration between the Duty Period Start Time and Duty Period End Time.
4.  **Total Flight Time (Hours)**: The sum of durations for each flight segment (from its departure to its arrival).
5.  **Max Flight Time Check**:
    *   Assume a generic rule: Maximum 9 hours of flight time for 1-2 flight segments.
    *   Assume a generic rule: Maximum 8 hours of flight time for 3-4 flight segments.
    *   Assume a generic rule: Maximum 7 hours of flight time for 5+ flight segments.
    *   Set \`maxFlightTimeExceeded\` to true if this is exceeded, otherwise false.
6.  **Summary**: Provide a human-readable summary of the calculated duty period. Include the start and end times, total duty duration, total flight time. Clearly state if the generic maximum flight time is exceeded. Mention general considerations like "Ensure this duty period allows for at least 10 hours of rest before any subsequent duty."

Output the results strictly in the JSON format defined by the output schema. Ensure all times are in ISO 8601 UTC format.
Provide the results in hours, rounded to two decimal places where appropriate.
`,
});

const flightDutyCalculatorFlow = ai.defineFlow(
  {
    name: 'flightDutyCalculatorFlow',
    inputSchema: FlightDutyInputSchema,
    outputSchema: FlightDutyOutputSchema,
  },
  async (input: FlightDutyInput) => {
    const {output} = await flightDutyCalculatorPrompt(input);
    if (!output) {
      throw new Error("Failed to get a response from the AI model for flight duty calculation.");
    }
    return output;
  }
);
