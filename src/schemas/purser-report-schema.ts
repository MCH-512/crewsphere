
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';
import { Shield, HeartPulse, Utensils, AlertCircle, UserCheck, Wrench, MessageSquare, PlusCircle } from "lucide-react";

export const optionalReportSections = [
    { name: 'safetyIncidents', label: 'Safety Incidents', placeholder: 'Describe any safety-related incidents or concerns...', icon: Shield },
    { name: 'securityIncidents', label: 'Security Incidents', placeholder: 'Describe any security-related incidents or concerns...', icon: AlertCircle },
    { name: 'medicalIncidents', label: 'Medical Incidents', placeholder: 'Describe any medical incidents, treatments administered, or requests for medical assistance...', icon: HeartPulse },
    { name: 'passengerFeedback', label: 'Significant Passenger Feedback', placeholder: 'Note any notable positive or negative feedback from passengers...', icon: MessageSquare },
    { name: 'cateringNotes', label: 'Catering Notes', placeholder: 'Note any issues with catering, stock levels, or special meal requests...', icon: Utensils },
    { name: 'maintenanceIssues', label: 'Maintenance or Equipment Issues', placeholder: 'Describe any technical issues or malfunctioning cabin equipment...', icon: Wrench },
    { name: 'crewPerformanceNotes', label: 'Crew Performance Notes', placeholder: 'Note any exceptional performance or areas for improvement within the crew...', icon: UserCheck },
    { name: 'otherObservations', label: 'Other Observations', placeholder: 'Any other notes or observations relevant to the flight...', icon: PlusCircle },
] as const;


const passengerLoadSchema = z.object({
  total: z.number().min(0, "Total must be 0 or more.").default(0),
  adults: z.number().min(0, "Adults must be 0 or more.").default(0),
  infants: z.number().min(0, "Infants must be 0 or more.").default(0),
}).refine(data => data.adults + data.infants === data.total, {
  message: "Sum of adults and infants must equal the total number of passengers.",
  path: ["total"],
});


export const purserReportFormSchema = z.object({
  // Pre-filled, hidden fields for reference
  flightId: z.string(),
  flightNumber: z.string(),
  flightDate: z.string(), // ISO string
  departureAirport: z.string(),
  arrivalAirport: z.string(),
  aircraftTypeRegistration: z.string(),
  
  // User-filled fields
  passengerLoad: passengerLoadSchema,
  crewMembers: z.string().min(10, "Please list the crew members on duty (min 10 characters)."),
  generalFlightSummary: z.string().min(20, "Please provide a summary of at least 20 characters."),

  // Optional sections
  safetyIncidents: z.string().optional(),
  securityIncidents: z.string().optional(),
  medicalIncidents: z.string().optional(),
  passengerFeedback: z.string().optional(),
  cateringNotes: z.string().optional(),
  maintenanceIssues: z.string().optional(),
  crewPerformanceNotes: z.string().optional(),
  otherObservations: z.string().optional(),
});


export type PurserReportFormValues = z.infer<typeof purserReportFormSchema>;

export interface StoredPurserReport extends PurserReportFormValues {
  id: string;
  userId: string;
  userEmail: string;
  createdAt: Timestamp;
  status: 'submitted' | 'under-review' | 'closed';
  adminNotes?: string;
}
