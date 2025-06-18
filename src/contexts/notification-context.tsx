
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
  doc,
  getDoc,
} from "firebase/firestore";

interface AlertForCount {
  id: string;
  userId?: string | null;
  createdAt: Timestamp; // Ensure createdAt is part of the type for sorting
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
      // Fetch user-specific alerts
      const userAlertsQuery = query(
        collection(db, "alerts"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(50) // Limit individual query
      );
      const userAlertsSnapshot = await getDocs(userAlertsQuery);
      const fetchedUserAlerts = userAlertsSnapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as AlertForCount)
      );

      // Fetch global alerts
      const globalAlertsQuery = query(
        collection(db, "alerts"),
        where("userId", "==", null),
        orderBy("createdAt", "desc"),
        limit(50) // Limit individual query
      );
      const globalAlertsSnapshot = await getDocs(globalAlertsQuery);
      const fetchedGlobalAlerts = globalAlertsSnapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as AlertForCount)
      );

      // Combine, deduplicate, sort by date, and take top 50 overall for acknowledgement checks
      const combinedAlerts = [...fetchedUserAlerts, ...fetchedGlobalAlerts]
        .reduce((acc, current) => { // Deduplicate
          if (!acc.find(item => item.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, [] as AlertForCount[])
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()) // Sort by createdAt
        .slice(0, 50); // Limit for performance of ack checks

      if (combinedAlerts.length > 0) {
        const ackCheckPromises = combinedAlerts.map(async (alert) => {
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
      setUnreadAlertsCount(0);
      setIsLoadingCount(false);
      setErrorCount(null);
    }
  }, [user, fetchAndCountUnread]);

  const refreshUnreadCount = async () => {
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

