
'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { format, eachDayOfInterval, startOfDay, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { type ActivityType, type UserActivity } from "@/schemas/user-activity-schema";

export interface Conflict {
    activityType: ActivityType;
    details: string;
}


/**
 * Fetches all activities for a specific user within a given month.
 * @param userId The UID of the user.
 * @param month The month to fetch activities for.
 * @returns A promise that resolves to an array of UserActivity objects.
 */
export async function getUserActivitiesForMonth(userId: string, month: Date): Promise<UserActivity[]> {
    if (!isConfigValid || !db) {
        console.error("Firebase is not configured. Cannot fetch user activities.");
        return [];
    }

    const start = startOfMonth(month);
    const end = endOfMonth(month);

    try {
        const q = query(
            collection(db, "userActivities"), 
            where("userId", "==", userId), 
            where("date", ">=", start), 
            where("date", "<=", end)
        );
        const querySnapshot = await getDocs(q);
        const activities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivity));
        activities.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        return activities;
    } catch (error) {
        console.error("Error fetching user activities for month:", error);
        // In a real app, you might want to handle this more gracefully.
        // For now, returning an empty array to prevent the page from crashing.
        return [];
    }
}


/**
 * Checks the availability of multiple crew members for a given date range.
 * @param crewUserIds An array of user UIDs to check.
 * @param startDate The start date of the period to check.
 * @param endDate The end date of the period to check.
 * @param activityIdToIgnore Optional. The ID of the current flight or session being edited, to ignore its own activities.
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
  const dateInterval = eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) });

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
                
                let isIgnored = false;
                if (activityIdToIgnore) {
                    // Check if the activity's flightId or trainingSessionId matches the ID to ignore
                    isIgnored = (activity.flightId === activityIdToIgnore) || (activity.trainingSessionId === activityIdToIgnore);
                }

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
