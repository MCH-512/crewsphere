'use server';

import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { startOfMonth, endOfMonth } from "date-fns";
import { db } from "@/lib/firebase";
import { type User } from "@/contexts/auth-context";
import { type StoredFlight } from "@/schemas/flight-schema";
import { type StoredTrainingSession } from "@/schemas/training-session-schema";

export interface TimelineActivity {
  id: string;
  type: 'flight' | 'training';
  date: Timestamp;
  title: string;
  description: string;
  details: {
    purserName?: string;
    crewCount?: number;
    attendeeCount?: number;
  }
}

export async function getTimelineData(month: Date, userMap: Map<string, User>): Promise<TimelineActivity[]> {
    if (userMap.size === 0) return [];
    
    const start = startOfMonth(month);
    const end = endOfMonth(month);

    try {
        const flightsQuery = query(collection(db, "flights"), where("scheduledDepartureDateTimeUTC", ">=", start.toISOString()), where("scheduledDepartureDateTimeUTC", "<=", end.toISOString()));
        const trainingQuery = query(collection(db, "trainingSessions"), where("sessionDateTimeUTC", ">=", start), where("sessionDateTimeUTC", "<=", end));
        
        const [flightsSnap, trainingSnap] = await Promise.all([getDocs(flightsQuery), getDocs(trainingQuery)]);

        const flightActivities: TimelineActivity[] = flightsSnap.docs.map(doc => {
            const data = doc.data() as StoredFlight;
            const purser = userMap.get(data.purserId);
            return { 
                id: doc.id, 
                type: 'flight', 
                date: Timestamp.fromDate(new Date(data.scheduledDepartureDateTimeUTC)), 
                title: `Flight ${data.flightNumber}`, 
                description: `${data.departureAirport} → ${data.arrivalAirport}`,
                details: {
                    purserName: purser?.displayName,
                    crewCount: data.allCrewIds.length,
                }
            };
        });

        const trainingActivities: TimelineActivity[] = trainingSnap.docs.map(doc => {
            const data = doc.data() as StoredTrainingSession;
            return { 
                id: doc.id, 
                type: 'training', 
                date: data.sessionDateTimeUTC, 
                title: `Training: ${data.title}`, 
                description: `Location: ${data.location}`,
                details: {
                    attendeeCount: data.attendeeIds.length
                }
            };
        });
        
        const allActivities = [...flightActivities, ...trainingActivities];
        allActivities.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        return allActivities;
    } catch (error) {
        console.error("Error fetching timeline data:", error);
        return [];
    }
}
