
import 'server-only'
import { cookies } from 'next/headers'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { User } from '@/schemas/user-schema'
import { cache } from 'react'
 
// This is a placeholder for a secure, server-side session management solution.
// In a real production app, this would involve verifying a session cookie
// against a session store (e.g., Redis, or a session management service)
// or decoding a secure, HTTP-only cookie containing a JWT.
// For this project, we'll simulate this by reading a "pseudo-session" cookie
// that simply contains the user's UID.

export const getCurrentUser = cache(async (): Promise<User | null> => {
  // This is a simplified, non-secure way to get the user for server components.
  // In a real app, you would verify a secure session token here.
  const session = cookies().get('firebase-session-uid')?.value

  if (!session) {
    return null
  }
 
  try {
    const userDocRef = doc(db, "users", session);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        // Construct the full User object, matching the type definition
        return {
          uid: userDocSnap.id,
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role,
          photoURL: userData.photoURL,
          fullName: userData.fullName,
          employeeId: userData.employeeId,
          joiningDate: userData.joiningDate,
          accountStatus: userData.accountStatus,
        } as User;
    }
    return null;

  } catch (error) {
    console.error("Failed to fetch user from session:", error);
    return null;
  }
})

