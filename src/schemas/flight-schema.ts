
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const aircraftTypes = ["B737-800", "B737-300", "A320"] as const;

export const flightFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Departure airport is required."),
  arrivalAirport: z.string().min(3, "Arrival airport is required."),
  scheduledDepartureDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid departure date/time." }),
  scheduledArrivalDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid arrival date/time." }),
  aircraftType: z.enum(aircraftTypes, { required_error: "Aircraft type is required." }),
  purserId: z.string().min(1, "A purser must be assigned."),
  pilotIds: z.array(z.string()).min(2, "At least two pilots must be assigned."),
  cabinCrewIds: z.array(z.string()).min(1, "At least one cabin crew member is required."),
  instructorIds: z.array(z.string()).optional(),
  traineeIds: z.array(z.string()).optional(),
  
  // Optional return flight fields
  includeReturnFlight: z.boolean().optional(),
  returnFlightNumber: z.string().optional(),
  returnDepartureAirport: z.string().optional(),
  returnArrivalAirport: z.string().optional(),
  returnScheduledDepartureDateTimeUTC: z.string().optional(),
  returnScheduledArrivalDateTimeUTC: z.string().optional(),
  returnAircraftType: z.enum(aircraftTypes).optional(),
  returnPurserId: z.string().optional(),
  returnPilotIds: z.array(z.string()).optional(),
  returnCabinCrewIds: z.array(z.string()).optional(),
  returnInstructorIds: z.array(z.string()).optional(),
  returnTraineeIds: z.array(z.string()).optional(),

}).refine(data => new Date(data.scheduledArrivalDateTimeUTC) > new Date(data.scheduledDepartureDateTimeUTC), {
    message: "Arrival time must be after departure time.",
    path: ["scheduledArrivalDateTimeUTC"],
}).superRefine((data, ctx) => {
    if (data.includeReturnFlight) {
        if (!data.returnFlightNumber || data.returnFlightNumber.length < 3) ctx.addIssue({ path: ['returnFlightNumber'], message: 'Return flight number is required.' });
        if (!data.returnScheduledDepartureDateTimeUTC) ctx.addIssue({ path: ['returnScheduledDepartureDateTimeUTC'], message: 'Return departure time is required.' });
        if (!data.returnScheduledArrivalDateTimeUTC) ctx.addIssue({ path: ['returnScheduledArrivalDateTimeUTC'], message: 'Return arrival time is required.' });
        if (!data.returnAircraftType) ctx.addIssue({ path: ['returnAircraftType'], message: 'Return aircraft type is required.' });
        if (!data.returnPurserId) ctx.addIssue({ path: ['returnPurserId'], message: 'Return purser is required.' });
        if ((data.returnPilotIds?.length || 0) < 2) ctx.addIssue({ path: ['returnPilotIds'], message: 'At least two pilots are required for the return flight.' });
        if ((data.returnCabinCrewIds?.length || 0) < 1) ctx.addIssue({ path: ['returnCabinCrewIds'], message: 'At least one cabin crew member is required for the return flight.' });
        
        if (data.returnScheduledDepartureDateTimeUTC && data.returnScheduledArrivalDateTimeUTC && new Date(data.returnScheduledArrivalDateTimeUTC) <= new Date(data.returnScheduledDepartureDateTimeUTC)) {
             ctx.addIssue({ path: ['returnScheduledArrivalDateTimeUTC'], message: 'Return arrival must be after return departure.' });
        }
    }
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
