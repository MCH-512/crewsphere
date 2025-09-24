
"use client";

import * as React from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, db, isConfigValid } from "@/lib/firebase"; 
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { User } from "@/schemas/user-schema";

export type { User };

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
    if (!isConfigValid || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          if (!db) throw new Error("Firestore is not configured.");
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          let userProfile: User;

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            // Combine auth and firestore data into a single user object
            userProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || userData.email,
              displayName: firebaseUser.displayName || userData.displayName,
              photoURL: firebaseUser.photoURL || userData.photoURL,
              role: userData.role || null,
              fullName: userData.fullName,
              employeeId: userData.employeeId,
              joiningDate: userData.joiningDate,
              accountStatus: userData.accountStatus,
              baseAirport: userData.baseAirport,
            };
          } else {
            // User exists in Auth but not Firestore, create a basic profile
            userProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'New User',
              photoURL: firebaseUser.photoURL,
              role: 'other',
              accountStatus: 'active',
            };
            await setDoc(doc(db, "users", firebaseUser.uid), {
                ...userProfile,
                createdAt: new Date(),
            });
          }
          setUser(userProfile);
          setSessionCookie(userProfile.uid);
        } catch (e) {
          console.error("Auth context error:", e);
          setError(e instanceof Error ? e : new Error("An unexpected error occurred during authentication."));
          // Fallback to basic user from auth if firestore fails
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL });
          setSessionCookie(firebaseUser.uid);
        }
      } else {
        setUser(null);
        setSessionCookie(null);
      }
      setLoading(false);
    }, (authError) => {
      console.error("Auth state change error:", authError);
      setError(authError);
      setLoading(false);
    });

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
