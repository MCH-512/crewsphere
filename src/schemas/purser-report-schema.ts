
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

// Define the options for checkboxes and selects
export const passengersToReportOptions = ["UM", "PRM", "VIP", "Stress / Anxiety", "Disruptive passenger"] as const;
export const technicalIssuesOptions = ["Seats", "Galley", "Lavatories", "Safety equipment", "Other"] as const;
export const safetyChecksOptions = ["Pre-flight check completed", "In-flight checks normal", "Pre-landing check completed"] as const;
export const incidentTypesOptions = ["Medical", "Passenger behavior", "Technical", "Safety-related", "Security"] as const;


// Define the main form schema
export const purserReportFormSchema = z.object({
  // Section 1: Pre-filled flight info
  flightId: z.string(),
  flightNumber: z.string(),
  flightDate: z.string(),
  route: z.string(),
  aircraftType: z.string(),
  picName: z.string().min(1, "PIC name is required."),
  foName: z.string().min(1, "FO name is required."),
  sccmName: z.string().min(1, "SCCM name is required."),
  cabinCrewOnBoard: z.array(z.string()),
  
  // Section 2: Crew Coordination
  positivePoints: z.string().max(500).optional(),
  improvementPoints: z.string().max(500).optional(),
  actionRequired: z.boolean().default(false),

  // Section 3: Passengers & Cabin
  passengerCount: z.number().min(0, "Passenger count cannot be negative."),
  passengersToReport: z.array(z.string()).optional(),
  technicalIssues: z.array(z.string()).optional(),

  // Section 4: Safety & Service
  safetyChecks: z.array(z.string()).min(1, { message: "Confirmation of safety checks is required." }),
  safetyAnomalies: z.string().max(1000).optional(),
  servicePassengerFeedback: z.string().max(1000).optional(),
  
  // Section 5: Incidents
  specificIncident: z.boolean().default(false),
  incidentTypes: z.array(z.string()).optional(),
  incidentDetails: z.string().max(2000).optional(),
}).refine(data => {
  // If an incident is reported, type and details are required.
  if (data.specificIncident) {
    return data.incidentTypes && data.incidentTypes.length > 0 && data.incidentDetails && data.incidentDetails.length > 10;
  }
  return true;
}, {
  message: "If an incident is reported, type and details are required.",
  path: ["incidentDetails"],
});

// Define types from the schema
export type PurserReportFormValues = z.infer<typeof purserReportFormSchema>;


// AI-related schemas
export const SummarizeReportInputSchema = z.object({
  reportContent: z.string().describe('The full text content of the purser report to be summarized.'),
});
export type SummarizeReportInput = z.infer<typeof SummarizeReportInputSchema>;

export const SummarizeReportOutputSchema = z.object({
  summary: z.string().describe("A concise, neutral summary of the entire report in 2-3 sentences."),
  keyPoints: z.array(z.string()).describe("A list of the most important key points or events mentioned in the report."),
  potentialRisks: z.array(z.string()).describe("A list of any potential risks or issues that may require follow-up, such as safety, security, or maintenance problems. If none, return an empty array."),
});
export type SummarizeReportOutput = z.infer<typeof SummarizeReportOutputSchema>;


// Firestore document schema
export interface StoredPurserReport extends PurserReportFormValues {
  id: string;
  userId: string;
  userEmail: string;
  createdAt: Timestamp;
  status: 'submitted' | 'under-review' | 'closed';
  adminNotes?: string;
  // Overwrite for storage
  departureAirport: string;
  arrivalAirport: string;
  crewRoster: { uid: string, name: string, role: string }[];
  // AI Summary fields
  aiSummary?: string;
  aiKeyPoints?: string[];
  aiPotentialRisks?: string[];
}
