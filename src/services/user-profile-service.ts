'use server';

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { User } from "@/schemas/user-schema";
import { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";
import { StoredUserRequest } from "@/schemas/request-schema";
import { Airport, getAirportByCode } from "./airport-service";
import { ActivityData, getUserActivitiesForMonth } from "./activity-service";
import { StoredUserDocument } from "@/schemas/user-document-schema";


export interface ProfileData {
    user: User;
    activities: ActivityData[];
    trainings: StoredUserQuizAttempt[];
    requests: StoredUserRequest[];
    documents: StoredUserDocument[];
    baseAirport: Airport | null;
    userMap: Map<string, User>;
}


/**
 * Fetches all the necessary data for a user's profile page.
 * 
 * @param {string} userId - The UID of the user.
 * @returns An object containing user details, activities, trainings, requests, documents, and a map of all users.
 */
export async function getUserProfileData(userId: string): Promise<ProfileData | null> {

  const userRef = doc(db, "users", userId);
  
  const [userDoc, allUsersSnapshot] = await Promise.all([
    getDoc(userRef),
    getDocs(collection(db, "users")),
  ]);

<<<<<<< HEAD
    try {
        const userDocRef = doc(db, "users", userId);
        const userPromise = getDoc(userDocRef);
        const activitiesPromise = getDocs(query(collection(db, "userActivities"), where("userId", "==", userId), orderBy("date", "desc"), limit(5)));
        const trainingsPromise = getDocs(query(collection(db, "userQuizAttempts"), where("userId", "==", userId), orderBy("completedAt", "desc"), limit(5)));
        const requestsPromise = getDocs(query(collection(db, "requests"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(5)));
        const documentsPromise = getDocs(query(collection(db, "userDocuments"), where("userId", "==", userId), orderBy("expiryDate", "asc")));

        const [userSnap, activitiesSnap, trainingsSnap, requestsSnap, documentsSnap] = await Promise.all([userPromise, activitiesPromise, trainingsPromise, requestsPromise, documentsSnap]);
=======
  if (!userDoc.exists()) {
    return null; // User not found
  }
  
  const user = { uid: userDoc.id, ...userDoc.data() } as User;
  
  const userMap = new Map(allUsersSnapshot.docs.map(doc => [doc.id, { uid: doc.id, ...doc.data() } as User]));
  
  const baseAirport = user.baseAirport ? await getAirportByCode(user.baseAirport) : null;
  
  const activities = await getUserActivitiesForMonth(new Date(), userId);

  const trainingsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", userId), orderBy("completedAt", "desc"), limit(5));
  const requestsQuery = query(collection(db, "requests"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(5));
  const documentsQuery = query(collection(db, "userDocuments"), where("userId", "==", userId), orderBy("expiryDate", "asc"));
>>>>>>> 574222e9d7c8cb9928d1f30ba4e25ba0e9ad8299

  const [trainingsSnapshot, requestsSnapshot, documentsSnapshot] = await Promise.all([
      getDocs(trainingsQuery),
      getDocs(requestsQuery),
      getDocs(documentsQuery),
  ]);

<<<<<<< HEAD
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
=======
  const trainings = trainingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserQuizAttempt));
  const requests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserRequest));
  const documents = documentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserDocument));

  return {
    user,
    activities,
    trainings,
    requests,
    documents,
    baseAirport,
    userMap,
  };
}
>>>>>>> 574222e9d7c8cb9928d1f30ba4e25ba0e9ad8299
