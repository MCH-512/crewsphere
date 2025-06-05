
"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";

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
        setUser(currentUser);
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
      // The useEffect above will handle redirecting to /login after user becomes null
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

  // Do not render children until loading is complete and redirection logic has had a chance to run
  // This prevents brief flashes of protected content or login page when already authenticated.
  if (loading) {
    // You might want a more sophisticated loading screen here
    return null; 
  }
  
  // If not loading and trying to access a protected route without a user,
  // or a public route with a user, the redirection will be in progress.
  // Render children only if conditions are met (user for protected, no user for public).
  const pathIsPublic = PUBLIC_PATHS.includes(pathname);
  if ((!user && !pathIsPublic) || (user && pathIsPublic)) {
    // Redirection is happening or should be happening, show a loader or null
    // to prevent rendering the wrong page content briefly.
    return null; // Or a global loader
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
