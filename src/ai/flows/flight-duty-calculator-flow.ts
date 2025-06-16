
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
  reportTimeOffsetHours: z.number().min(0).max(5).describe('Time for reporting/pre-flight duties before the first departure (in hours).'),
  postDutyActivitiesHours: z.number().min(0).max(5).describe('Time for post-flight duties (debriefing, customs, etc.) after the last arrival (in hours).'),
  numberOfCrew: z.number().int().min(1).max(25).describe('Number of crew members (e.g., 2 for flight deck, 4 for cabin crew). Influences extensions.'),
  crewType: z.enum(["PNT", "PNC"]).describe('Type of crew: PNT (Personnel Navigant Technique - Flight Crew) or PNC (Personnel Navigant Commercial - Cabin Crew).'),
  acclimatizationStatus: z.enum(["Acclimaté", "Non Acclimaté", "Inconnu"]).describe('Crew acclimatization status at the start of duty.'),
});
export type FlightDutyInput = z.infer<typeof FlightDutyInputSchema>;

const FlightDutyOutputSchema = z.object({
  dutyPeriodStartUTC: z.string().datetime().describe('Calculated start time of the duty period in UTC.'),
  dutyPeriodEndUTC: z.string().datetime().describe('Calculated end time of the duty period in UTC.'),
  totalDutyTimeHours: z.number().describe('Total calculated duty time in hours.'),
  totalFlightTimeHours: z.number().describe('Total calculated flight time (block time) in hours.'),
  maxDutyTimeHours: z.number().describe('Estimated maximum allowable duty time in hours based on inputs and generic FTL rules.'),
  dutyTimeExceeded: z.boolean().describe('Indicates if the total duty time exceeds the estimated maximum allowable duty time.'),
  flightTimeComplianceNotes: z.string().describe('AI-generated notes regarding flight time limitations based on inputs.'),
  dutyTimeComplianceNotes: z.string().describe('AI-generated notes regarding duty time limitations and potential extensions based on inputs.'),
  restRequirementsNotes: z.string().describe('AI-generated notes on minimum rest requirements following this duty period.'),
  summary: z.string().describe('An AI-generated overall summary of the duty period, incorporating compliance notes.'),
});
export type FlightDutyOutput = z.infer<typeof FlightDutyOutputSchema>;

export async function calculateFlightDuty(input: FlightDutyInput): Promise<FlightDutyOutput> {
  return flightDutyCalculatorFlow(input);
}

const flightDutyCalculatorPrompt = ai.definePrompt({
  name: 'flightDutyCalculatorPrompt',
  input: {schema: FlightDutyInputSchema},
  output: {schema: FlightDutyOutputSchema},
  prompt: `You are an expert Flight Duty Period (FDP) and Flight Time Limitation (FTL) calculator.
Your task is to calculate duty times based on provided flight segments, crew details, and duty parameters.
You also need to perform compliance checks against generic FTL rules and provide detailed notes.

Input Data:
Flight Segments (0-indexed):
{{#each flightSegments}}
- Segment {{@index}}: {{departureAirport}} to {{arrivalAirport}}, Departure: {{departureTimeUTC}}, Arrival: {{arrivalTimeUTC}}
{{/each}}
Report Time / Pre-Flight Duties: {{reportTimeOffsetHours}} hours
Post-Flight Duties: {{postDutyActivitiesHours}} hours
Number of Crew: {{numberOfCrew}}
Crew Type: {{crewType}}
Acclimatization Status: {{acclimatizationStatus}}

Calculations to perform:
1.  **Duty Period Start Time (UTC)**: This is the departure time of the first flight segment minus the reportTimeOffsetHours.
2.  **Duty Period End Time (UTC)**: This is the arrival time of the last flight segment plus the postDutyActivitiesHours.
3.  **Total Duty Time (Hours)**: The duration between the Duty Period Start Time and Duty Period End Time.
4.  **Total Flight Time (Hours)**: The sum of durations for each flight segment (from its departure to its arrival).
5.  **Estimated Maximum Duty Time (Hours)** (maxDutyTimeHours):
    *   Base this on generic FTL rules, considering:
        *   **Acclimatization**: 'Non Acclimaté' usually reduces max FDP. 'Acclimaté' allows standard FDP. 'Inconnu' should assume a more conservative (potentially non-acclimatized) limit or state the ambiguity.
        *   **Time of Day of Report**: Reporting during Window of Circadian Low (WOCL, e.g., 02:00-05:59 local at home base for an acclimated crew) significantly reduces FDP. Consider the reportTimeOffsetHours and first departure to infer if duty starts in WOCL if the crew is Acclimaté. If Non Acclimaté, WOCL at home base is less relevant, but general fatigue from non-acclimatization is key.
        *   **Number of Sectors**: More sectors generally reduce max FDP. (e.g., 1-2 sectors: ~13h, 3-4 sectors: ~12h, 5 sectors: ~11h, 6+ sectors: ~10h - these are illustrative, use general knowledge).
        *   **Crew Type**: PNC may have slightly different FDP limits or extension rules than PNT.
        *   **Example FDP for Acclimated PNT (1-2 sectors, reporting outside WOCL):** ~13 hours. Adjust down for WOCL, more sectors, non-acclimatization.
    *   Be explicit about the assumptions made in estimating this value.
6.  **Duty Time Exceeded**: True if totalDutyTimeHours > maxDutyTimeHours.
7.  **Flight Time Compliance Notes**:
    *   Comment on totalFlightTimeHours against generic limits (e.g., max 9-10 hours flight time in a duty period, possibly less with many sectors or adverse conditions).
    *   Mention if the number of sectors is high.
8.  **Duty Time Compliance Notes**:
    *   Clearly state if dutyTimeExceeded is true.
    *   Discuss potential for FDP extensions (e.g., in-flight rest, split duty if applicable, augmentation with {{numberOfCrew}}). Acknowledge if the provided {{numberOfCrew}} might allow for extensions under certain rules (e.g., more than minimum crew).
    *   Mention impact of {{acclimatizationStatus}} and reporting time on duty limits.
9.  **Rest Requirements Notes**:
    *   State generic minimum rest required after this duty (e.g., typically at least 10-12 hours, or equal to preceding duty period, or longer if FDP was extended or involved WOCL encroachment).
    *   Mention any factors from the input that might increase rest requirements (e.g., long duty, time zone differences suggested by long flights if airports are far apart, non-acclimatization).

10. **Summary**: Provide a human-readable overall summary of the calculated duty period. Include start/end times, total duty/flight durations, and *integrate the key compliance notes* from above. Crucially, this summary *must always* include a disclaimer: "These calculations are for illustrative and educational purposes only, based on generic FTL rules. Always consult official company and regulatory documentation for operational flight planning."

Output the results strictly in the JSON format defined by the output schema. Ensure all times are in ISO 8601 UTC format.
Provide all durations in hours, rounded to two decimal places where appropriate.
If the airport codes suggest very different time zones for multi-sector duties, briefly mention that acclimatization rules for intermediate points would apply in reality but are simplified here.
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

