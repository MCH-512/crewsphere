
"use client";

import * as React from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
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
      (currentUser) => {
        if (currentUser) {
          // TEMPORARY: Hardcode role for demonstration.
          // In a real app, you would fetch this role from Firestore or a custom claim.
          const userWithRole: User = {
            ...currentUser,
            email: currentUser.email || '', // Ensure email is always a string
            // All other FirebaseUser properties are spread
            // Defaulting to 'crew' if you want a non-admin default for testing
            // To test admin, set to 'admin' after logging in with any user.
            // role: 'crew', 
            role: 'admin', // Hardcoding to 'admin' for now to show the Admin Console link
          };
          setUser(userWithRole);
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
    if (loading) return; // Don't do anything while loading

    const pathIsPublic = PUBLIC_PATHS.includes(pathname);

    if (!user && !pathIsPublic) {
      // If user is not logged in and trying to access a protected page, redirect to login
      router.push('/login');
    } else if (user && pathIsPublic) {
      // If user is logged in and trying to access a public page (login/signup), redirect to dashboard
      router.push('/');
    }
  }, [user, loading, pathname, router]);


  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null); // Explicitly set user to null on logout
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
  if ((!user && !pathIsPublic) || (user && pathIsPublic)) {
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
