import type { Timestamp } from 'firebase/firestore';

export const flightSwapStatuses = [
    "posted", // A user has posted their flight for swap.
    "pending_approval", // Another user has requested the swap, awaiting admin action.
    "approved", // Admin approved the swap.
    "rejected", // Admin rejected the swap.
    "cancelled", // The initiating user cancelled their post.
] as const;

export type FlightSwapStatus = typeof flightSwapStatuses[number];


// This is the structure for a document in the 'flightSwaps' collection
export interface StoredFlightSwap {
  id: string;
  
  // Initiating User/Flight (the one offered)
  initiatingUserId: string;
  initiatingUserEmail: string;
  initiatingFlightId: string;
  flightInfo: {
      flightNumber: string;
      departureAirport: string;
      arrivalAirport: string;
      scheduledDepartureDateTimeUTC: string;
      scheduledArrivalDateTimeUTC: string;
  };
  
  // Requesting User/Flight (the one proposed in exchange)
  requestingUserId?: string;
  requestingUserEmail?: string;
  requestingFlightId?: string;
  requestingFlightInfo?: {
      flightNumber: string;
      departureAirport: string;
      arrivalAirport: string;
      scheduledDepartureDateTimeUTC: string;
      scheduledArrivalDateTimeUTC: string;
  };
  
  // New field for simplified queries and security rules
  participantIds: string[]; // [initiatingUserId] or [initiatingUserId, requestingUserId]

  status: FlightSwapStatus;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  
  // Admin fields
  resolvedBy?: string; // Admin UID
  adminNotes?: string;
}