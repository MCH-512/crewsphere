

'use server';

import { db, isConfigValid } from "@/lib/firebase";
import { getCurrentUser } from "@/lib/session";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";
import type { StoredCourse } from "@/schemas/course-schema";
import type { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import type { StoredUserRequest } from "@/schemas/request-schema";


export interface TodayActivity {
  activityType: 'flight' | 'leave' | 'training' | 'standby' | 'day-off';
  comments?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
}

export async function getTodayActivities(): Promise<TodayActivity[]> {
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
        if (querySnapshot.empty) {
            return [];
        }
        return querySnapshot.docs.map(doc => doc.data() as TodayActivity);
    } catch (error) {
        console.error("Server Error fetching today's schedule:", error);
        // In case of error, return an empty array to prevent the client from crashing.
        return [];
    }
}


export interface TrainingStats {
    totalMandatory: number;
    completed: number;
    nextCourseId?: string;
}

export async function getTrainingStatus(): Promise<TrainingStats | null> {
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) {
        return null;
    }
     try {
        const coursesQuery = query(collection(db, "courses"), where("published", "==", true), where("mandatory", "==", true));
        const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", user.uid), where("status", "==", "passed"));
        
        const [coursesSnapshot, attemptsSnapshot] = await Promise.all([getDocs(coursesQuery), getDocs(attemptsQuery)]);

        const mandatoryCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredCourse));
        const passedCourseIds = new Set(attemptsSnapshot.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
        
        const completedCount = mandatoryCourses.filter(c => passedCourseIds.has(c.id)).length;
        const outstandingCourses = mandatoryCourses.filter(c => !passedCourseIds.has(c.id));
        
        return {
            totalMandatory: mandatoryCourses.length,
            completed: completedCount,
            nextCourseId: outstandingCourses.length > 0 ? outstandingCourses[0].id : undefined
        };
    } catch(e) {
        console.error("Error fetching training status from server: ", e);
        return null; // Return null on error
    }
}

export interface RequestsStats {
  pendingCount: number;
  latestRequest: Omit<StoredUserRequest, 'id' | 'createdAt' | 'updatedAt' | 'issueDate' | 'expiryDate'> & { createdAt: string; } | null;
}

export async function getRequestsStatus(): Promise<RequestsStats | null> {
    const user = await getCurrentUser();
    if (!user || !isConfigValid || !db) {
        return null;
    }

    const requestsQuery = query(collection(db, "requests"), where("userId", "==", user.uid), where("status", "in", ["pending", "in-progress"]), orderBy("createdAt", "desc"));
    
    try {
        const querySnapshot = await getDocs(requestsQuery);
        const allUserRequests = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                 ...data,
                 createdAt: (data.createdAt as Timestamp).toDate().toISOString() // Serialize date
            } as any; // Cast to any to handle serialized date
        }) as (Omit<StoredUserRequest, 'id' | 'createdAt'> & { createdAt: string; })[];
        
        const pendingCount = allUserRequests.length;
        const latestRequest = allUserRequests.length > 0 ? allUserRequests[0] : null;

        return { pendingCount, latestRequest };
    } catch(e) {
         console.error("Error fetching request status from server:", e);
         return null;
    }
}

