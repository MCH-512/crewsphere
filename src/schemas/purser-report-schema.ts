import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const briefingChecklistOptions = ["On time", "Complete", "Incomplete", "Not done"] as const;
export const atmosphereChecklistOptions = ["Good coordination", "Clear communication", "Interpersonal issues", "SOP deviation"] as const;
export const passengersToReportOptions = ["UM", "PRM", "VIP", "Stress / Anxiety", "Disruptive passenger"] as const;
export const cabinConditionOptions = ["Good", "Average", "Poor", "Acceptable", "Degradation noticed"] as const;
export const technicalIssuesOptions = ["Seats", "Galley", "Lavatories", "Safety equipment"] as const;
export const safetyDemoOptions = ["Properly completed", "Incomplete", "Not done"] as const;
export const safetyChecksOptions = ["Fully performed", "Issues reported"] as const;
export const crossCheckOptions = ["Compliant", "Needs correction"] as const;
export const servicePerformanceOptions = ["Smooth", "Internal delays", "Missing items"] as const;
export const delayCausesOptions = ["Boarding", "ATC", "Technical", "Other"] as const;
export const cockpitCommunicationOptions = ["smooth", "partial", "difficult"] as const;
export const incidentTypesOptions = ["Medical", "Passenger behavior", "Technical", "Safety-related"] as const;

export const purserReportFormSchema = z.object({
  // Section 1
  flightId: z.string(),
  flightNumber: z.string(),
  flightDate: z.string(),
  route: z.string(),
  aircraftType: z.string(),
  aircraftRegistration: z.string(),
  picName: z.string(),
  foName: z.string(),
  sccmName: z.string(),
  cabinCrewOnBoard: z.array(z.string()),
  
  // Section 2
  briefing: z.array(z.string()).optional(),
  atmosphere: z.array(z.string()).optional(),
  positivePoints: z.string().max(500).optional(),
  improvementPoints: z.string().max(500).optional(),
  followUpRecommended: z.boolean(),

  // Section 3
  passengerCount: z.number().min(0),
  passengersToReport: z.array(z.string()).optional(),
  passengerBehaviorNotes: z.string().max(1000).optional(),
  passengerComplaint: z.boolean(),

  // Section 4
  cabinConditionBoarding: z.array(z.string()).optional(),
  cabinConditionArrival: z.array(z.string()).optional(),
  technicalIssues: z.array(z.string()).optional(),
  cabinActionsTaken: z.string().max(1000).optional(),

  // Section 5
  safetyDemo: z.array(z.string()).optional(),
  safetyChecks: z.array(z.string()).optional(),
  crossCheck: z.array(z.string()).optional(),
  safetyAnomalies: z.string().max(1000).optional(),

  // Section 6
  servicePerformance: z.array(z.string()).optional(),
  cateringShortage: z.boolean(),
  servicePassengerFeedback: z.string().max(1000).optional(),

  // Section 7
  delayCauses: z.array(z.string()).optional(),
  cockpitCommunication: z.string().optional(),
  groundHandlingRemarks: z.string().max(1000).optional(),

  // Section 8
  specificIncident: z.boolean(),
  incidentTypes: z.array(z.string()).optional(),
  incidentDetails: z.string().max(2000).optional(),
}).refine(data => {
  if (data.specificIncident) {
    return data.incidentTypes && data.incidentTypes.length > 0 && data.incidentDetails && data.incidentDetails.length > 10;
  }
  return true;
}, {
  message: "If an incident is reported, type and details are required.",
  path: ["incidentDetails"],
});

export type PurserReportFormValues = z.infer<typeof purserReportFormSchema>;

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

// This is a temporary type definition until the schema is fully updated.
export const optionalReportSections = [] as const;

    
