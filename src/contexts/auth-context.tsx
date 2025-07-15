
"use client";

import * as React from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, db, isConfigValid } from "@/lib/firebase"; 
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore"; // Import setDoc for user creation
import { usePathname, useRouter } from "next/navigation";
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
            }

          } catch (firestoreError) {
            console.error("Error fetching or creating user details in Firestore:", firestoreError);
            setError(firestoreError instanceof Error ? firestoreError : new Error("Error managing user profile"));
            // Set user with Firebase Auth data as a fallback
            const basicUser: User = { ...currentUser, email: currentUser.email || '', displayName: currentUser.displayName || '' };
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

  // Improved rendering logic to prevent flashes of content
  const pathIsPublic = PUBLIC_PATHS.includes(pathname);
  if (loading) {
      return ( // Return a full-page loader
          <div className="flex min-h-screen items-center justify-center bg-background">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      );
  }
  
  if (!user && !pathIsPublic) return null; // Let the redirect in useEffect handle it
  if (user && pathIsPublic) return null; // Let the redirect in useEffect handle it

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
