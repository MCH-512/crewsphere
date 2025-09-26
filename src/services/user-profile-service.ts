
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
  Timestamp,
} from "firebase/firestore";
import { User, StoredUser } from "@/schemas/user-schema";
import { Course, StoredCourse } from "@/schemas/course-schema";
import {
  UserCourseProgress, 
  StoredUserCourseProgress,
} from "@/schemas/user-course-progress-schema";
import { 
  StoredUserRequest,
  UserRequest
} from "@/schemas/user-request-schema";

/**
 * Fetches all the necessary data for a user's profile page.
 * 
 * @param {string} userId - The UID of the user.
 * @returns An object containing user details, course progress, and recent requests.
 */
export async function getUserProfileData(userId: string) {

  const userRef = doc(db, "users", userId);
  const userDocPromise = getDoc(userRef);

  const progressQuery = query(
    collection(db, "userCourseProgress"),
    where("userId", "==", userId),
    orderBy("lastActivity", "desc")
  );
  const progressPromise = getDocs(progressQuery);

  const requestsPromise = getDocs(query(collection(db, "requests"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(5)));

  const [userDoc, progressSnapshot, requestsSnapshot] = await Promise.all([
    userDocPromise,
    progressPromise,
    requestsPromise,
  ]);

  if (!userDoc.exists()) {
    throw new Error("User not found");
  }
  const user = { uid: userDoc.id, ...userDoc.data() } as StoredUser;

  const courseProgress = progressSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as StoredUserCourseProgress)
  );

  const recentRequests = requestsSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as StoredUserRequest)
  );

  return {
    user,
    courseProgress,
    recentRequests,
  };
}
