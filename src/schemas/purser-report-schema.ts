import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';

export const purserReportFormSchema = z.object({
  // Flight Info (pre-filled)
  flightId: z.string(),
  flightNumber: z.string(),
  flightDate: z.string(), // ISO date string
  departureAirport: z.string(),
  arrivalAirport: z.string(),
  aircraftTypeRegistration: z.string(),

  // Form fields
  passengerLoad: z.object({
    total: z.coerce.number().int().min(0, "Total must be a non-negative number.").max(1000, "Invalid number"),
    adults: z.coerce.number().int().min(0, "Adults must be a non-negative number.").max(1000, "Invalid number"),
    infants: z.coerce.number().int().min(0, "Infants must be a non-negative number.").max(100, "Invalid number"),
  }).refine(data => data.adults + data.infants === data.total, {
    message: "Sum of adults and infants must equal the total.",
    path: ["total"], 
  }),
  
  crewMembers: z.string().min(10, "Please list the crew members on duty.").max(1000, "Crew members list is too long."),
  
  generalFlightSummary: z.string().min(20, "Summary must be at least 20 characters.").max(2500, "General summary is too long."),
  
  safetyIncidents: z.string().max(2000).optional(),
  securityIncidents: z.string().max(2000).optional(),
  medicalIncidents: z.string().max(2000).optional(),
  passengerFeedback: z.string().max(2000).optional(),
  cateringNotes: z.string().max(2000).optional(),
  maintenanceIssues: z.string().max(2000).optional(),
  otherObservations: z.string().max(2000).optional(),
  crewPerformanceNotes: z.string().max(2000).optional(),
});

export type PurserReportFormValues = z.infer<typeof purserReportFormSchema>;


// This will be the shape of the data stored in Firestore.
export interface StoredPurserReportData extends PurserReportFormValues {
  userId: string;
  userEmail: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  status: 'submitted' | 'reviewed';
}

export interface StoredPurserReport extends StoredPurserReportData {
    id: string; // Document ID
}
