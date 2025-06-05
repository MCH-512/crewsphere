
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
    if (!loading && !user && !['/login', '/signup'].includes(pathname)) {
      // Allow access to login and signup pages even if not authenticated
      if (pathname !== '/' && !pathname.startsWith('/_next/')) { // Add more public paths if needed
         // router.push('/login'); // Temporarily disable forced redirect for easier development
      }
    }
  }, [user, loading, pathname, router]);


  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      router.push("/login");
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
