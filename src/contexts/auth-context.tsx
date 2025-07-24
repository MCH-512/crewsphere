
"use client";

import * as React from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, db, isConfigValid } from "@/lib/firebase"; 
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore"; // Import setDoc for user creation
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Define a new User type that can include a role and other Firestore fields
export interface User extends FirebaseUser {
  role?: 'admin' | 'purser' | 'cabin crew' | 'instructor' | 'pilote' | 'stagiaire' | 'other' | null;
  fullName?: string;
  employeeId?: string;
  joiningDate?: string | null;
  accountStatus?: 'active' | 'inactive';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// A simple client-side function to set a cookie.
// NOTE: This is for demonstration. In a real app, the server should set a secure, httpOnly cookie.
const setSessionCookie = (uid: string | null) => {
    if (typeof window !== 'undefined') {
        if (uid) {
            document.cookie = `firebase-session-uid=${uid}; path=/; max-age=2592000; SameSite=Lax`; // 30 days
        } else {
            document.cookie = 'firebase-session-uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
    }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    // If config is invalid, don't even try to set up the listener
    if (!isConfigValid || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => { // Make this async
        if (currentUser) {
          try {
            // Fetch user details from Firestore
            if (!db) throw new Error("Firestore is not configured.");
            const userDocRef = doc(db, "users", currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const userRole = (userData.role && ['admin', 'purser', 'cabin crew', 'instructor', 'pilote', 'stagiaire', 'other'].includes(userData.role)) ? userData.role : null;
                const firestoreDisplayName = userData.displayName || currentUser.displayName || '';

                const enhancedUser: User = {
                  ...currentUser,
                  email: currentUser.email || '', 
                  displayName: firestoreDisplayName,
                  role: userRole,
                  fullName: userData.fullName,
                  employeeId: userData.employeeId,
                  joiningDate: userData.joiningDate,
                  accountStatus: userData.accountStatus,
                };
                setUser(enhancedUser);
                setSessionCookie(enhancedUser.uid);
            } else {
                // User exists in Auth but not in Firestore, create a basic profile
                const basicProfile = {
                    uid: currentUser.uid,
                    email: currentUser.email || '',
                    displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'New User'),
                    role: 'other', // Default role
                    createdAt: new Date(), // Use JS date, Firestore will convert
                    accountStatus: 'active',
                };
                await setDoc(userDocRef, basicProfile);
                const enhancedUser: User = { ...currentUser, ...basicProfile, email: currentUser.email || '' };
                setUser(enhancedUser);
                setSessionCookie(enhancedUser.uid);
            }

          } catch (firestoreError) {
            console.error("Error fetching or creating user details in Firestore:", firestoreError);
            setError(firestoreError instanceof Error ? firestoreError : new Error("Error managing user profile"));
            const basicUser: User = { ...currentUser, email: currentUser.email || '', displayName: currentUser.displayName || '' };
            setUser(basicUser);
            setSessionCookie(basicUser.uid);
          }
        } else {
          setUser(null);
          setSessionCookie(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    if (!auth) {
        console.warn("Logout skipped: Firebase Auth not initialized.");
        setUser(null);
        setSessionCookie(null);
        return;
    }
    try {
      await firebaseSignOut(auth);
      setUser(null); 
      setSessionCookie(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error("An unknown error occurred during logout."));
      }
      console.error("Logout error:", err);
    }
  };

  const value = { user, loading, error, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
