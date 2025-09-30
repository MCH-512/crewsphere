'use server';

import 'server-only';
import { db, isConfigValid } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import type { User } from "@/schemas/user-schema";
import type { UserActivity } from "@/schemas/user-activity-schema";
import type { StoredUserQuizAttempt, StoredCourse } from "@/schemas/course-schema";
import type { StoredUserRequest } from "@/schemas/request-schema";
import type { StoredUserDocument } from "@/schemas/user-document-schema";
import { getAirportByCode, type Airport } from "@/services/airport-service";
import { z } from 'zod';

const UserIdSchema = z.string().min(1, "User ID cannot be empty.");

export interface ProfileData {
  user: User;
  activities: UserActivity[];
  trainings: (StoredUserQuizAttempt & { courseTitle: string })[];
  requests: StoredUserRequest[];
  documents: StoredUserDocument[];
  baseAirport: Airport | null;
}

/**
 * Fetches all data related to a user's profile for the admin detail page.
 * @param userId The UID of the user to fetch data for.
 * @returns A promise that resolves to a comprehensive profile data object.
 */
export async function getUserProfileData(userId: string): Promise<ProfileData | null> {
    const validation = UserIdSchema.safeParse(userId);
    if (!validation.success) {
        console.error("Invalid user ID provided to getUserProfileData.");
        return null;
    }

    if (!isConfigValid || !db) {
        console.error("Firebase not configured, cannot fetch user profile.");
        return null;
    }

    try {
        const userDocRef = doc(db, "users", userId);
        const userPromise = getDoc(userDocRef);
        const activitiesPromise = getDocs(query(collection(db, "userActivities"), where("userId", "==", userId), orderBy("date", "desc"), limit(5)));
        const trainingsPromise = getDocs(query(collection(db, "userQuizAttempts"), where("userId", "==", userId), orderBy("completedAt", "desc"), limit(5)));
        const requestsPromise = getDocs(query(collection(db, "requests"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(5)));
        const documentsPromise = getDocs(query(collection(db, "userDocuments"), where("userId", "==", userId), orderBy("expiryDate", "asc")));

        const [userSnap, activitiesSnap, trainingsSnap, requestsSnap, documentsSnap] = await Promise.all([userPromise, activitiesPromise, trainingsPromise, requestsPromise, documentsSnap]);

        if (!userSnap.exists()) {
            console.warn(`User document not found for ID: ${userId}`);
            return null;
        }

        const fetchedUser = { uid: userSnap.id, ...userSnap.data() } as User;
        const baseAirport = fetchedUser.baseAirport ? await getAirportByCode(fetchedUser.baseAirport) : null;
        
        const activities = activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserActivity);
        const requests = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as StoredUserRequest);
        const documents = documentsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as StoredUserDocument);

        const trainingAttempts = trainingsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as StoredUserQuizAttempt);
        const courseIds = [...new Set(trainingAttempts.map(t => t.courseId))];
        
        let trainings: (StoredUserQuizAttempt & { courseTitle: string })[] = [];
        if(courseIds.length > 0) {
            const courseDocs = await Promise.all(courseIds.map(id => getDoc(doc(db, "courses", id))));
            const coursesMap = new Map(courseDocs.map(d => [d.id, d.data() as StoredCourse]));
            trainings = trainingAttempts.map(t => ({ ...t, courseTitle: coursesMap.get(t.courseId)?.title || "Unknown Course" }));
        }
        
        return {
            user: fetchedUser,
            activities,
            trainings,
            requests,
            documents,
            baseAirport,
        };

    } catch (error) {
        console.error("Error fetching comprehensive user profile data:", error);
        return null;
    }
}
