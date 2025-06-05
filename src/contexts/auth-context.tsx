
"use client";

import * as React from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase"; // Import db
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore"; // Import Firestore functions
import { usePathname, useRouter } from "next/navigation";

// Define a new User type that can include a role
export interface User extends FirebaseUser {
  role?: 'admin' | 'purser' | 'crew'; // Define possible roles
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
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => { // Make this async
        if (currentUser) {
          try {
            // Fetch user role from Firestore
            const userDocRef = doc(db, "users", currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            let userRole: User['role'] = undefined; // Default to no specific role

            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              if (userData.role && ['admin', 'purser', 'crew'].includes(userData.role)) {
                userRole = userData.role as User['role'];
              }
            }
            
            const userWithRole: User = {
              ...currentUser,
              email: currentUser.email || '', 
              role: userRole,
            };
            setUser(userWithRole);

          } catch (firestoreError) {
            console.error("Error fetching user role from Firestore:", firestoreError);
            setError(firestoreError instanceof Error ? firestoreError : new Error("Error fetching role"));
            // Set user without role if Firestore fetch fails
            const userWithoutRole: User = {
              ...currentUser,
              email: currentUser.email || '',
            };
            setUser(userWithoutRole);
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

  if (loading) {
    return null; 
  }
  
  const pathIsPublic = PUBLIC_PATHS.includes(pathname);
  // This check ensures we don't render children prematurely during redirection logic
  if (!pathIsPublic && !user && !loading) {
     return null; // Or a loading spinner specifically for redirection
  }
  if (pathIsPublic && user && !loading) {
    return null; // Or a loading spinner specifically for redirection
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
