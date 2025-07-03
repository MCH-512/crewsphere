
import type { Timestamp } from 'firebase/firestore';

export interface Flight {
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
