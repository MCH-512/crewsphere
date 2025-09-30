'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { format, eachDayOfInterval, startOfDay, isSameDay, startOfMonth, endOfMonth, endOfDay } from 'date-fns';
import { type ActivityType, type UserActivity } from "@/schemas/user-activity-schema";
import { getCurrentUser } from "@/lib/session";
import type { User } from "@/schemas/user-schema";
import { z } from 'zod';

export interface Conflict {
    activityType: ActivityType;
    details: string;
}

export type TodayActivity = Omit<UserActivity, 'id' | 'userId' | 'date'>;

export interface ActivityData extends UserActivity {
    userEmail?: string;
}

const GetTodayActivitiesSchema = z.object({}).optional();

/**
 * Fetches all activities for the current user for the current day.
 * @returns A promise that resolves to an array of TodayActivity objects.
 */
export async function getTodayActivities(): Promise<TodayActivity[]> {
    GetTodayActivitiesSchema.parse({}); // Zod validation
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) {
        return [];
    }
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    try {
        const q = query(
            collection(db, "userActivities"), 
            where("userId", "==", user.uid), 
            where("date", ">=", todayStart),
            where("date", "<=", todayEnd)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const { id: _id, userId: _userId, date: _date, ...activity } = doc.data();
            return activity as TodayActivity;
        });
    } catch (error) {
        console.error("Error fetching today's activities:", error);
        return [];
    }
}

const GetUserActivitiesForMonthSchema = z.object({
    month: z.date(),
    userId: z.string().optional(),
});

/**
 * Fetches all activities for a specific user or globally within a given month.
 * @param month The month to fetch activities for.
 * @param userId Optional. The UID of the user. If not provided, fetches all activities.
 * @returns A promise that resolves to an array of UserActivity objects.
 */
export async function getUserActivitiesForMonth(month: Date, userId?: string): Promise<ActivityData[]> {
    GetUserActivitiesForMonthSchema.parse({ month, userId }); // Zod validation
    if (!isConfigValid || !db) {
        console.error("Firebase is not configured. Cannot fetch user activities.");
        return [];
    }

    const start = startOfMonth(month);
    const end = endOfMonth(month);

    try {
        let baseQuery = query(
            collection(db, "userActivities"), 
            where("date", ">=", start), 
            where("date", "<=", end)
        );

        if (userId) {
            baseQuery = query(baseQuery, where("userId", "==", userId));
        }

        const querySnapshot = await getDocs(baseQuery);

        if (userId) {
             const activities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivity));
             activities.sort((a, b) => a.date.toMillis() - b.date.toMillis());
             return activities;
        }

        // If global, we need to fetch user emails to display them
        const usersSnapshot = await getDocs(collection(db, "users"));
        const userMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data() as User]));

        const activities: ActivityData[] = querySnapshot.docs.map(doc => {
            const activity = { id: doc.id, ...doc.data() } as UserActivity;
            return {
                ...activity,
                userEmail: userMap.get(activity.userId)?.email || 'Unknown User'
            };
        });

        activities.sort((a, b) => a.date.toMillis() - b.date.toMillis());
        return activities;

    } catch (error) {
        console.error("Error fetching user activities for month:", error);
        return [];
    }
}

const CheckCrewAvailabilitySchema = z.object({
  crewUserIds: z.array(z.string()),
  startDate: z.date(),
  endDate: z.date(),
  activityIdToIgnore: z.string().optional(),
});
/**
 * Checks the availability of a single crew member for a given date range.
 * @param userId The user UID to check.
 * @param startDate The start date of the period to check.
 * @param endDate The end date of the period to check.
 * @param activityIdToIgnore Optional. The ID of the current flight, session or request being edited, to ignore its own activities.
 * @returns A promise that resolves to a conflict object or null.
 */
export async function checkCrewAvailability(
  crewUserIds: string[],
  startDate: Date,
  endDate: Date,
  activityIdToIgnore?: string
): Promise<Record<string, Conflict>> {
  CheckCrewAvailabilitySchema.parse({ crewUserIds, startDate, endDate, activityIdToIgnore }); // Zod validation
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
                    isIgnored = (activity.flightId === activityIdToIgnore) || 
                                (activity.trainingSessionId === activityIdToIgnore) ||
                                (activity.requestId === activityIdToIgnore);
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