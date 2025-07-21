import type { Timestamp } from 'firebase/firestore';

export type ActivityType = 'flight' | 'leave' | 'training' | 'standby' | 'day-off';

export interface UserActivity {
  id: string;
  activityType: ActivityType;
  date: Timestamp;
  userId: string;
  comments?: string;
  flightId?: string | null;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  trainingSessionId?: string;
  requestId?: string;
}
