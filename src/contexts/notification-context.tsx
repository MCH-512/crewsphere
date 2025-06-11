
"use client";

import * as React from "react";
import { useAuth, type User } from "./auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  or,
  doc,
  getDoc,
} from "firebase/firestore";

interface AlertForCount {
  id: string;
  userId?: string | null;
}

interface NotificationContextType {
  unreadAlertsCount: number;
  isLoadingCount: boolean;
  errorCount: Error | null;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadAlertsCount, setUnreadAlertsCount] = React.useState(0);
  const [isLoadingCount, setIsLoadingCount] = React.useState(true);
  const [errorCount, setErrorCount] = React.useState<Error | null>(null);

  const fetchAndCountUnread = React.useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setUnreadAlertsCount(0);
      setIsLoadingCount(false);
      return;
    }

    setIsLoadingCount(true);
    setErrorCount(null);
    let count = 0;

    try {
      // Fetch all potentially relevant alerts (global or user-specific)
      // We limit to a reasonable number as we fetch full docs for subsequent checks.
      // This limit might need adjustment based on typical alert volume.
      const alertsQuery = query(
        collection(db, "alerts"),
        or(
          where("userId", "==", currentUser.uid),
          where("userId", "==", null)
        ),
        orderBy("createdAt", "desc"),
        limit(50) // Fetch up to 50 most recent relevant alerts
      );

      const alertsSnapshot = await getDocs(alertsQuery);
      const potentiallyUnreadAlerts = alertsSnapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as AlertForCount)
      );
      
      if (potentiallyUnreadAlerts.length > 0) {
        const ackCheckPromises = potentiallyUnreadAlerts.map(async (alert) => {
          const ackDocId = `${currentUser.uid}_${alert.id}`;
          const ackDocRef = doc(db, "alertAcknowledgements", ackDocId);
          const ackSnap = await getDoc(ackDocRef);
          return !ackSnap.exists(); // True if unread (acknowledgement does not exist)
        });

        const unreadResults = await Promise.all(ackCheckPromises);
        count = unreadResults.filter(isUnread => isUnread).length;
      }
      
      setUnreadAlertsCount(count);
    } catch (err) {
      console.error("Error fetching unread alerts count:", err);
      setErrorCount(err instanceof Error ? err : new Error("Failed to count unread alerts"));
      setUnreadAlertsCount(0); // Reset count on error
    } finally {
      setIsLoadingCount(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      fetchAndCountUnread(user);
    } else {
      // If no user, reset count and loading state
      setUnreadAlertsCount(0);
      setIsLoadingCount(false);
      setErrorCount(null);
    }
  }, [user, fetchAndCountUnread]);

  const refreshUnreadCount = async () => {
    // Re-fetch based on the current user from AuthContext
    await fetchAndCountUnread(user);
  };
  
  const value = { unreadAlertsCount, isLoadingCount, errorCount, refreshUnreadCount };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = (): NotificationContextType => {
  const context = React.useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};
