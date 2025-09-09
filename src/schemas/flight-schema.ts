
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const aircraftTypes = ["B737-800", "B737-300", "A320"] as const;

export const flightFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Departure airport is required.").max(4, "Invalid ICAO code"),
  arrivalAirport: z.string().min(3, "Arrival airport is required.").max(4, "Invalid ICAO code"),
  scheduledDepartureDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid departure date/time." }),
  scheduledArrivalDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid arrival date/time." }),
  aircraftType: z.enum(aircraftTypes, { required_error: "Aircraft type is required." }),
  purserId: z.string().min(1, "A purser must be assigned."),
  pilotIds: z.array(z.string()).min(2, "At least two pilots must be assigned."),
  cabinCrewIds: z.array(z.string()).min(1, "At least one cabin crew member is required."),
  instructorIds: z.array(z.string()).optional(),
  traineeIds: z.array(z.string()).optional(),
  
  // Recurrence fields
  enableRecurrence: z.boolean().optional(),
  recurrenceType: z.enum(["Daily", "Weekly"]).optional(),
  recurrenceCount: z.number().min(1).max(52).optional(),


}).refine(data => new Date(data.scheduledArrivalDateTimeUTC) > new Date(data.scheduledDepartureDateTimeUTC), {
    message: "Arrival time must be after departure time.",
    path: ["scheduledArrivalDateTimeUTC"],
});


export type FlightFormValues = z.infer<typeof flightFormSchema>;


export interface StoredFlight {
  id: string;
  flightNumber: string;
  departureAirport: string; // ICAO code
  arrivalAirport: string; // ICAO code
  scheduledDepartureDateTimeUTC: string; // ISO 8601 string
  scheduledArrivalDateTimeUTC: string; // ISO 8601 string
  aircraftType: string;
  purserId: string; // UID of the assigned purser
  pilotIds: string[];
  cabinCrewIds: string[];
  instructorIds?: string[];
  traineeIds?: string[];
  allCrewIds: string[];
  activityIds?: Record<string, string>; // Maps userId -> activityId
  purserReportSubmitted: boolean;
  purserReportId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
