
'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { format, eachDayOfInterval, startOfDay, isSameDay } from 'date-fns';
import { type ActivityType, type UserActivity } from "@/schemas/user-activity-schema";

export interface Conflict {
    activityType: ActivityType;
    details: string;
}

/**
 * Checks the availability of multiple crew members for a given date range.
 * @param crewUserIds An array of user UIDs to check.
 * @param startDate The start date of the period to check.
 * @param endDate The end date of the period to check.
 * @param activityIdToIgnore Optional. The ID of the current activity being edited, to ignore its own activities.
 * @returns A promise that resolves to a record mapping user IDs to their first found conflict.
 */
export async function checkCrewAvailability(
  crewUserIds: string[],
  startDate: Date,
  endDate: Date,
  activityIdToIgnore?: string
): Promise<Record<string, Conflict>> {
  if (!isConfigValid || !db || crewUserIds.length === 0) {
    return {};
  }
  
  const warnings: Record<string, Conflict> = {};
  const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });

  for (const userId of crewUserIds) {
      if (warnings[userId]) continue; // Already found a conflict for this user

      // Create a query that covers the entire date range for a user
      const q = query(
          collection(db, "userActivities"),
          where("userId", "==", userId),
          where("date", ">=", startOfDay(startDate)),
          where("date", "<=", startOfDay(endDate))
      );
      
      try {
          const querySnapshot = await getDocs(q);

          // Iterate over each day in the interval to check for conflicts
          for (const day of dateInterval) {
            const conflictingActivityDoc = querySnapshot.docs.find(doc => {
                const activity = doc.data() as UserActivity;
                // Check if the activity is on the current day of the interval
                const isOnSameDay = isSameDay(activity.date.toDate(), day);
                // And ignore the activity if it's part of the flight or session we're currently editing
                const isIgnored = activityIdToIgnore && (activity.flightId === activityIdToIgnore || activity.trainingSessionId === activityIdToIgnore);

                return isOnSameDay && !isIgnored;
            });

            if (conflictingActivityDoc) {
                const activity = conflictingActivityDoc.data() as UserActivity;
                warnings[userId] = {
                    activityType: activity.activityType,
                    details: activity.comments || `Scheduled for ${activity.activityType} on ${format(activity.date.toDate(), 'PP')}`,
                };
                break; // Move to the next user once a conflict is found
            }
          }
      } catch (e) {
          console.error(`Error checking availability for user ${userId}:`, e);
          // Do not throw, just skip this user. The UI will show no warning for them.
      }
  }

  return warnings;
}
