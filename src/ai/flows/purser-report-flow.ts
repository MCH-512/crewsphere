'use server';
/**
 * @fileOverview An AI flow for generating Purser Reports based on flight details and observations.
 *
 * - generatePurserReport - A function that handles the Purser Report generation.
 * - PurserReportInput - The input type for the generatePurserReport function.
 * - PurserReportOutput - The return type for the generatePurserReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const passengerLoadSchema = z.object({
  total: z.coerce.number().int().min(0).describe('Total number of passengers.'),
  adults: z.coerce.number().int().min(0).describe('Number of adult passengers.'),
  infants: z.coerce.number().int().min(0).describe('Number of infant passengers.'),
  um: z.coerce.number().int().min(0).optional().describe('Number of Unaccompanied Minors.'),
  pregnant: z.coerce.number().int().min(0).optional().describe('Number of pregnant women.'),
  wchr: z.coerce.number().int().min(0).optional().describe('Number of Wheelchair (Ramp) passengers.'),
  wchs: z.coerce.number().int().min(0).optional().describe('Number of Wheelchair (Steps) passengers.'),
  wchc: z.coerce.number().int().min(0).optional().describe('Number of Wheelchair (Cabin) passengers.'),
  inad: z.coerce.number().int().min(0).optional().describe('Number of Inadmissible passengers.'),
});

const cateringLoadSchema = z.object({
  standardMeals: z.coerce.number().int().min(0).optional().describe("Number of standard passenger meals boarded."),
  specialMeals: z.coerce.number().int().min(0).optional().describe("Number of special meals (e.g., VGML, CHML) boarded."),
  crewMeals: z.coerce.number().int().min(0).optional().describe("Number of crew meals boarded."),
  totalSalesCash: z.coerce.number().min(0).optional().describe("Total cash sales made during the flight (e.g., duty-free, snacks)."),
  barFullyStocked: z.boolean().optional().describe("Whether the bar was fully stocked."),
  additionalNotes: z.string().optional().describe("Any other notes on catering uplift or discrepancies.")
});

const cleanlinessRatingSchema = z.enum(["Excellent", "Good", "Fair", "Poor"], {
  errorMap: (issue, ctx) => ({ message: 'Please select a cleanliness rating.' })
});

const aircraftCleaningSchema = z.object({
  cabinCleanlinessOverall: cleanlinessRatingSchema.describe("Overall cleanliness of the cabin."),
  galleyCleanliness: cleanlinessRatingSchema.describe("Cleanliness of the galleys."),
  lavatoryCleanliness: cleanlinessRatingSchema.describe("Cleanliness of the lavatories."),
  cleaningIssuesNoted: z.string().optional().describe("Specific cleaning issues or deficiencies observed."),
  itemsLeftByPassengers: z.string().optional().describe("Details of any items left behind by passengers and actions taken."),
});

const briefingDetailsSchema = z.object({
    briefingTime: z.string().optional().describe("Time of the pre-flight briefing (e.g., 10:30)."),
    flightCrewPresent: z.boolean().optional().describe("Whether the flight crew (PNT) was present at the briefing."),
    documentsChecked: z.object({
        licenseAndId: z.boolean().optional().describe("Checked crew licenses and IDs."),
        passportAndVisa: z.boolean().optional().describe("Checked passports and necessary visas."),
        manuals: z.boolean().optional().describe("Checked for required manuals (e.g., CCOM)."),
        flightLog: z.boolean().optional().describe("Checked flight logbooks."),
    }).optional().describe("Record of document checks performed."),
    documentRemarks: z.string().optional().describe("Any remarks or issues found during document checks."),
    securityQuestionTopic: z.string().optional().describe("The main topic of the security questions discussed."),
    securityQuestionRemarks: z.string().optional().describe("Remarks on the security discussion."),
    briefingAtmosphere: z.enum(["Chaleureuse", "Neutre", "Formelle", "Tendue"]).optional().describe("The overall atmosphere of the briefing."),
    openDialogueEncouraged: z.boolean().optional().describe("Whether open dialogue and questions were encouraged."),
    crewConcernsExpressed: z.string().optional().describe("Any specific concerns or observations expressed by the cabin crew during the briefing."),
});

const PurserReportInputSchema = z.object({
  flightNumber: z.string().min(3).max(10).describe('Flight number (e.g., BA245, UAL123).'),
  flightDate: z.string().describe('Date of the flight (YYYY-MM-DD).'),
  departureAirport: z.string().min(3).max(10).describe('Departure airport ICAO/IATA code.'),
  arrivalAirport: z.string().min(3).max(10).describe('Arrival airport ICAO/IATA code.'),
  aircraftTypeRegistration: z.string().min(3).max(20).describe('Aircraft type and registration (e.g., B789 G-XYZC).'),
  
  scheduledDepartureUTC: z.string().datetime().optional().describe('Scheduled Departure Time in UTC (ISO 8601 format).'),
  actualDepartureUTC: z.string().datetime().optional().describe('Actual Departure Time in UTC (ISO 8601 format).'),
  scheduledArrivalUTC: z.string().datetime().optional().describe('Scheduled Arrival Time in UTC (ISO 8601 format).'),
  actualArrivalUTC: z.string().datetime().optional().describe('Actual Arrival Time in UTC (ISO 8601 format).'),
  
  crewMembers: z.string().min(10).describe('List of crew members on board (names and roles, typically multi-line).'),
  passengerLoad: passengerLoadSchema,
  cateringLoad: cateringLoadSchema.optional(),
  aircraftCleaning: aircraftCleaningSchema.optional(),
  briefingDetails: briefingDetailsSchema.optional(),
  generalFlightSummary: z.string().min(10).describe('Overall summary of the flight, noting punctuality (based on provided times), and general atmosphere.'),
  safetyIncidents: z.string().optional().describe('Detailed description of any safety-related incidents or observations (e.g., turbulence, equipment malfunctions affecting safety).'),
  securityIncidents: z.string().optional().describe('Detailed description of any security-related incidents (e.g., unruly passengers, security breaches).'),
  medicalIncidents: z.string().optional().describe('Detailed description of any medical incidents involving passengers or crew, including actions taken.'),
  passengerFeedback: z.string().optional().describe('Summary of notable positive or negative passenger feedback received during the flight.'),
  cateringNotes: z.string().optional().describe('Comments on catering quality, quantity, and any issues encountered with meal services *during the flight*.'),
  maintenanceIssues: z.string().optional().describe('Description of any aircraft defects or maintenance issues noted by the crew during the flight.'),
  otherObservations: z.string().optional().describe('Any other relevant observations or information not covered in other sections (e.g., ground handling, customs/immigration issues).'),
  crewPerformanceNotes: z.string().optional().describe('Observations on individual cabin crew performance during the flight. Each crew member\'s evaluation should be clearly demarcated.'),
});
export type PurserReportInput = z.infer<typeof PurserReportInputSchema>;

const PurserReportOutputSchema = z.object({
  formattedReport: z.string().describe('A comprehensive, well-structured Purser Report generated by the AI based on the input, suitable for official records. Use Markdown for clear formatting.'),
  keyHighlights: z.array(z.string()).describe('A list of AI-identified key highlights or action items from the report.'),
});
export type PurserReportOutput = z.infer<typeof PurserReportOutputSchema>;

export async function generatePurserReport(input: PurserReportInput): Promise<PurserReportOutput> {
  return purserReportFlow(input);
}

const purserReportPrompt = ai.definePrompt({
  name: 'purserReportPrompt',
  input: {schema: PurserReportInputSchema},
  output: {schema: PurserReportOutputSchema},
  prompt: `You are an AI assistant tasked with generating a formal Purser Report for an airline flight.
Use the provided information to create a comprehensive, well-organized, and professional report.
The report should be structured clearly with headings for each section. Use Markdown for formatting.

Flight Details:
- Flight Number: {{{flightNumber}}}
- Date: {{{flightDate}}}
- Route: {{{departureAirport}}} - {{{arrivalAirport}}}
- Aircraft: {{{aircraftTypeRegistration}}}
{{#if scheduledDepartureUTC}}- Scheduled Departure (UTC): {{{scheduledDepartureUTC}}}{{/if}}
{{#if actualDepartureUTC}}- Actual Departure (UTC): {{{actualDepartureUTC}}}{{/if}}
{{#if scheduledArrivalUTC}}- Scheduled Arrival (UTC): {{{scheduledArrivalUTC}}}{{/if}}
{{#if actualArrivalUTC}}- Actual Arrival (UTC): {{{actualArrivalUTC}}}{{/if}}
- Crew Members:
{{{crewMembers}}}
- Passenger Load: Total: {{{passengerLoad.total}}}, Adults: {{{passengerLoad.adults}}}, Infants: {{{passengerLoad.infants}}}
  {{#if passengerLoad.um}}- Unaccompanied Minors (UM): {{{passengerLoad.um}}}{{/if}}
  {{#if passengerLoad.pregnant}}- Pregnant Women: {{{passengerLoad.pregnant}}}{{/if}}
  {{#if passengerLoad.wchr}}- WCHR (Wheelchair - Ramp): {{{passengerLoad.wchr}}}{{/if}}
  {{#if passengerLoad.wchs}}- WCHS (Wheelchair - Steps): {{{passengerLoad.wchs}}}{{/if}}
  {{#if passengerLoad.wchc}}- WCHC (Wheelchair - Cabin): {{{passengerLoad.wchc}}}{{/if}}
  {{#if passengerLoad.inad}}- INAD (Inadmissible): {{{passengerLoad.inad}}}{{/if}}
{{#if cateringLoad}}
- Catering Load:
  {{#if cateringLoad.standardMeals}}  - Standard Passenger Meals: {{cateringLoad.standardMeals}}{{/if}}
  {{#if cateringLoad.specialMeals}}   - Special Meals: {{cateringLoad.specialMeals}}{{/if}}
  {{#if cateringLoad.crewMeals}}      - Crew Meals: {{cateringLoad.crewMeals}}{{/if}}
  {{#if cateringLoad.totalSalesCash}} - Total Sales (Cash): {{cateringLoad.totalSalesCash}}{{/if}}
  {{#if cateringLoad.barFullyStocked}} - Bar Fully Stocked: Yes{{else}} - Bar Fully Stocked: No{{/if}}
  {{#if cateringLoad.additionalNotes}}- Catering Uplift Notes: {{{cateringLoad.additionalNotes}}}{{/if}}
{{/if}}
{{#if aircraftCleaning}}
- Aircraft Cleaning:
  {{#if aircraftCleaning.cabinCleanlinessOverall}}  - Overall Cabin Cleanliness: {{aircraftCleaning.cabinCleanlinessOverall}}{{/if}}
  {{#if aircraftCleaning.galleyCleanliness}}    - Galley Cleanliness: {{aircraftCleaning.galleyCleanliness}}{{/if}}
  {{#if aircraftCleaning.lavatoryCleanliness}}  - Lavatory Cleanliness: {{aircraftCleaning.lavatoryCleanliness}}{{/if}}
  {{#if aircraftCleaning.cleaningIssuesNoted}} - Cleaning Issues Noted: {{{aircraftCleaning.cleaningIssuesNoted}}}{{/if}}
  {{#if aircraftCleaning.itemsLeftByPassengers}}- Items Left By Passengers: {{{aircraftCleaning.itemsLeftByPassengers}}}{{/if}}
{{/if}}

Report Sections:

{{#if briefingDetails}}
**## Pre-Flight Briefing Details**:
  - **Briefing Time:** {{#if briefingDetails.briefingTime}}{{briefingDetails.briefingTime}}{{else}}Not specified{{/if}}
  - **Flight Crew (PNT) Present:** {{#if briefingDetails.flightCrewPresent}}Yes{{else}}No{{/if}}
  - **Document Checks:**
    - License & ID: {{#if briefingDetails.documentsChecked.licenseAndId}}✅ Verified{{else}}❌ Not Verified/Applicable{{/if}}
    - Passport & Visa: {{#if briefingDetails.documentsChecked.passportAndVisa}}✅ Verified{{else}}❌ Not Verified/Applicable{{/if}}
    - Manuals: {{#if briefingDetails.documentsChecked.manuals}}✅ Verified{{else}}❌ Not Verified/Applicable{{/if}}
    - Flight Logbook: {{#if briefingDetails.documentsChecked.flightLog}}✅ Verified{{else}}❌ Not Verified/Applicable{{/if}}
  {{#if briefingDetails.documentRemarks}}  - **Document Remarks:** {{{briefingDetails.documentRemarks}}}{{/if}}
  - **Security Topic Discussed:** {{#if briefingDetails.securityQuestionTopic}}{{briefingDetails.securityQuestionTopic}}{{else}}Not specified{{/if}}
  {{#if briefingDetails.securityQuestionRemarks}}  - **Security Remarks:** {{{briefingDetails.securityQuestionRemarks}}}{{/if}}
  - **Briefing Atmosphere:** {{#if briefingDetails.briefingAtmosphere}}{{briefingDetails.briefingAtmosphere}}{{else}}Not specified{{/if}}
  - **Open Dialogue Encouraged:** {{#if briefingDetails.openDialogueEncouraged}}Yes{{else}}No{{/if}}
  {{#if briefingDetails.crewConcernsExpressed}}  - **Crew Concerns Expressed:** {{{briefingDetails.crewConcernsExpressed}}}{{/if}}
{{/if}}

**## General Flight Summary**:
{{{generalFlightSummary}}}
(Ensure to comment on flight punctuality based on the scheduled vs actual departure/arrival times if provided. Also consider passenger load and catering load information if relevant to the summary.)

{{#if safetyIncidents}}
**## Safety Incidents/Observations**:
{{{safetyIncidents}}}
{{/if}}

{{#if securityIncidents}}
**## Security Incidents/Observations**:
{{{securityIncidents}}}
{{/if}}

{{#if medicalIncidents}}
**## Medical Incidents**:
{{{medicalIncidents}}}
{{/if}}

{{#if passengerFeedback}}
**## Passenger Feedback**:
{{{passengerFeedback}}}
{{/if}}

{{#if cateringNotes}}
**## Catering Notes (In-flight Observations)**:
{{{cateringNotes}}}
(Observations on catering quality, quantity, and any issues encountered with meal services during the flight.)
{{/if}}

{{#if maintenanceIssues}}
**## Maintenance Issues Noted**:
{{{maintenanceIssues}}}
{{/if}}

{{#if otherObservations}}
**## Other Observations/Information**:
{{{otherObservations}}}
{{/if}}

{{#if crewPerformanceNotes}}
**## Crew Performance Notes**:
{{{crewPerformanceNotes}}}
{{/if}}

After generating the full report, provide a separate list of key highlights or action items that management should be aware of. This should be a concise summary of the most critical points from the entire report.

Ensure the final output strictly follows the PurserReportOutputSchema, providing both 'formattedReport' and 'keyHighlights'.
The 'formattedReport' should be a single string with Markdown.
The 'keyHighlights' should be an array of strings.
`,
});

const purserReportFlow = ai.defineFlow(
  {
    name: 'purserReportFlow',
    inputSchema: PurserReportInputSchema,
    outputSchema: PurserReportOutputSchema,
  },
  async (input: PurserReportInput) => {
    const {output} = await purserReportPrompt(input);
    if (!output) {
      throw new Error("Failed to get a response from the AI model for the Purser Report.");
    }
    return output;
  }
);
    





