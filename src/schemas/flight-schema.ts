import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';

export const flightFormSchema = z.object({
  flightNumber: z.string().min(3, "Flight number must be at least 3 characters.").max(10),
  departureAirport: z.string().min(3, "Departure airport is required."),
  arrivalAirport: z.string().min(3, "Arrival airport is required."),
  scheduledDepartureDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid departure date/time." }),
  scheduledArrivalDateTimeUTC: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: "Invalid arrival date/time." }),
  aircraftType: z.string().min(3, "Aircraft type is required.").max(50),
  purserId: z.string().min(1, "A purser must be assigned."),
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
  purserReportSubmitted: boolean;
  purserReportId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
