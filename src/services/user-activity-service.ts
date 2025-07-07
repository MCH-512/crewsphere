
'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { format } from 'date-fns';

export interface Conflict {
    activityType: 'flight' | 'leave' | 'training' | 'standby' | 'day-off';
    details: string;
}

/**
 * Checks the availability of multiple crew members for a given date range.
 * @param crewUserIds An array of user UIDs to check.
 * @param startDate The start date of the period to check.
 * @param endDate The end date of the period to check.
 * @returns A promise that resolves to a record mapping user IDs to their first found conflict.
 */
export async function checkCrewAvailability(
  crewUserIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Record<string, Conflict>> {
  if (!isConfigValid || !db || crewUserIds.length === 0) {
    return {};
  }
  
  const warnings: Record<string, Conflict> = {};

  for (const userId of crewUserIds) {
      if (warnings[userId]) continue; // Already found a conflict for this user

      const q = query(
          collection(db, "userActivities"),
          where("userId", "==", userId),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
      );
      
      try {
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
              const activity = querySnapshot.docs[0].data();
              warnings[userId] = {
                  activityType: activity.activityType,
                  details: activity.comments || `Scheduled for ${activity.activityType} on ${format(activity.date.toDate(), 'PP')}`,
              };
          }
      } catch (e) {
          console.error(`Error checking availability for user ${userId}:`, e);
          // Do not throw, just skip this user. The UI will show no warning for them.
      }
  }

  return warnings;
}
