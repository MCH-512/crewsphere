
"use server";

import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const safetyReportEventTypes = [
  "Technical Failure",
  "Operational Error",
  "Bird Strike",
  "Severe Turbulence",
  "Passenger Misconduct",
  "Security Breach",
  "Medical Emergency",
  "Ground Operations",
  "Weather Related",
  "Other",
] as const;

export const safetyReportFlightPhases = [
  "Pre-Flight / Gate",
  "Taxi",
  "Take-off",
  "Climb",
  "Cruise",
  "Descent",
  "Approach",
  "Landing",
  "Post-Flight / Ground",
] as const;

export const safetyReportSeverityLevels = [
  "Low",
  "Medium",
  "High",
  "Critical",
] as const;

export const safetyReportFormSchema = z.object({
  eventDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "An accurate event date is required." }),
  flightNumber: z.string().max(10).optional(),
  aircraftRegistration: z.string().max(10).optional(),
  eventType: z.enum(safetyReportEventTypes, { required_error: "Please select the most relevant event type." }),
  flightPhase: z.enum(safetyReportFlightPhases).optional(),
  severity: z.enum(safetyReportSeverityLevels, { required_error: "Please assess the event's severity." }),
  description: z.string().min(50, "Description must be at least 50 characters.").max(5000, "Description is too long."),
  isAnonymous: z.boolean().default(false),
});

export type SafetyReportFormValues = z.infer<typeof safetyReportFormSchema>;

export const safetyReportStatuses = ['new', 'under-investigation', 'closed', 'resolved'] as const;

export interface StoredSafetyReport {
  id: string;
  reporterId?: string;
  reporterEmail?: string;
  isAnonymous: boolean;
  status: typeof safetyReportStatuses[number];
  
  eventDate: Timestamp;
  flightNumber?: string;
  aircraftRegistration?: string;
  eventType: typeof safetyReportEventTypes[number];
  flightPhase?: typeof safetyReportFlightPhases[number];
  severity: typeof safetyReportSeverityLevels[number];
  description: string;
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  investigationNotes?: string;
}
