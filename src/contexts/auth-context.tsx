
"use client";

import * as React from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, db, isConfigValid } from "@/lib/firebase"; 
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";

// Define a new User type that can include a role and other Firestore fields
export interface User extends FirebaseUser {
  role?: 'admin' | 'purser' | 'cabin crew' | 'instructor' | 'pilote' | 'other' | null;
  fullName?: string;
  employeeId?: string;
  joiningDate?: string | null; // Firestore stores as string or null
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// Define public paths that do not require authentication
const PUBLIC_PATHS = ['/login', '/signup'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const router = useRouter();
  const pathname = usePathname();

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

            let userRole: User['role'] = undefined;
            let userFullName: string | undefined = undefined;
            let userEmployeeId: string | undefined = undefined;
            let userJoiningDate: string | null | undefined = undefined;
            let firestoreDisplayName: string | undefined = undefined;


            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              if (userData.role && ['admin', 'purser', 'cabin crew', 'instructor', 'pilote', 'other'].includes(userData.role)) {
                userRole = userData.role as User['role'];
              } else if (userData.role === null) {
                userRole = null;
              }
              userFullName = userData.fullName;
              userEmployeeId = userData.employeeId;
              userJoiningDate = userData.joiningDate; // Can be string, null, or undefined
              firestoreDisplayName = userData.displayName;
            }
            
            const enhancedUser: User = {
              ...currentUser,
              email: currentUser.email || '', 
              displayName: firestoreDisplayName || currentUser.displayName || '', // Prioritize Firestore displayName
              role: userRole,
              fullName: userFullName,
              employeeId: userEmployeeId,
              joiningDate: userJoiningDate,
            };
            setUser(enhancedUser);

          } catch (firestoreError) {
            console.error("Error fetching user details from Firestore:", firestoreError);
            setError(firestoreError instanceof Error ? firestoreError : new Error("Error fetching user details"));
            // Set user with Firebase Auth data if Firestore fetch fails
            const basicUser: User = {
              ...currentUser,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
            };
            setUser(basicUser);
          }
        } else {
          setUser(null);
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

  React.useEffect(() => {
    if (loading) return; 

    const pathIsPublic = PUBLIC_PATHS.includes(pathname);

    if (!user && !pathIsPublic) {
      router.push('/login');
    } else if (user && pathIsPublic) {
      router.push('/');
    }
  }, [user, loading, pathname, router]);


  const logout = async () => {
    if (!auth) {
        console.warn("Logout skipped: Firebase Auth not initialized.");
        setUser(null);
        return;
    }
    try {
      await firebaseSignOut(auth);
      setUser(null); 
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

  // This part is tricky because of Next.js SSR and client-side navigation.
  // We want to avoid rendering children if a redirect is imminent.
  if (loading) {
    // During initial load, don't render children to avoid flash of incorrect content
    // or rendering a protected page before auth state is confirmed.
    return null; 
  }
  
  const pathIsPublic = PUBLIC_PATHS.includes(pathname);
  if (!pathIsPublic && !user) {
     // If not loading, not public, and no user, likely means redirecting to login.
     // Returning null here avoids rendering children that might depend on 'user'.
     return null; 
  }
  if (pathIsPublic && user) {
    // If not loading, on a public page, but user is logged in, likely redirecting to dashboard.
    // Returning null avoids rendering login/signup page briefly.
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
