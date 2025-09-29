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

  const [trainingsSnapshot, requestsSnapshot, documentsSnapshot] = await Promise.all([
      getDocs(trainingsQuery),
      getDocs(requestsQuery),
      getDocs(documentsQuery),
  ]);

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