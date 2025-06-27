
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
  writeBatch,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

// --- INTERFACES ---

export interface AlertData {
  id: string;
  title: string;
  content: string;
  level: "critical" | "warning" | "info";
  createdAt: Timestamp;
  userId?: string | null; 
  iconName?: string | null;
  linkUrl?: string | null; 
  isAcknowledged?: boolean;
  acknowledgedOn?: Timestamp | null;
}

interface NotificationContextType {
  alerts: AlertData[];
  unreadAlertsCount: number;
  isLoading: boolean;
  error: Error | null;
  refreshAlerts: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  acknowledgeAllAlerts: () => Promise<void>;
}

// --- CONTEXT ---

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

// --- PROVIDER ---

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = React.useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const unreadAlertsCount = React.useMemo(() => alerts.filter(a => !a.isAcknowledged).length, [alerts]);

  const fetchAlerts = React.useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch user-specific alerts
      const userAlertsQuery = query(collection(db, "alerts"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(25));
      
      // 2. Fetch global alerts
      const globalAlertsQuery = query(collection(db, "alerts"), where("userId", "==", null), orderBy("createdAt", "desc"), limit(25));

      const [userAlertsSnapshot, globalAlertsSnapshot] = await Promise.all([
          getDocs(userAlertsQuery),
          getDocs(globalAlertsQuery)
      ]);

      const fetchedUserAlerts = userAlertsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AlertData));
      const fetchedGlobalAlerts = globalAlertsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AlertData));
      
      // 3. Combine, deduplicate, and sort
      const combinedAlerts = [...fetchedUserAlerts, ...fetchedGlobalAlerts]
        .reduce((acc, current) => {
          if (!acc.find(item => item.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, [] as AlertData[])
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
        .slice(0, 50);

      // 4. Efficiently fetch acknowledgements
      const userAcknowledgementsMap = new Map<string, Timestamp>();
      if (combinedAlerts.length > 0) {
        // Firestore 'in' query is limited to 30 items, so we may need to batch
        const alertIds = combinedAlerts.map(a => a.id);
        const ackQueries = [];
        for (let i = 0; i < alertIds.length; i += 30) {
          const batchIds = alertIds.slice(i, i + 30);
          ackQueries.push(
            getDocs(query(
              collection(db, "alertAcknowledgements"),
              where("userId", "==", currentUser.uid),
              where("alertId", "in", batchIds)
            ))
          );
        }
        const ackSnapshots = await Promise.all(ackQueries);
        
        ackSnapshots.forEach(snapshot => {
          snapshot.forEach(ackDoc => {
            const ackData = ackDoc.data();
            userAcknowledgementsMap.set(ackData.alertId, ackData.acknowledgedAt as Timestamp);
          });
        });
      }
      
      // 5. Process and set the final state
      const processedAlerts = combinedAlerts.map(alert => ({
        ...alert,
        isAcknowledged: userAcknowledgementsMap.has(alert.id),
        acknowledgedOn: userAcknowledgementsMap.get(alert.id) || null,
      }));
      
      setAlerts(processedAlerts);

    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch alerts"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      fetchAlerts(user);
    } else {
      setAlerts([]);
      setIsLoading(false);
      setError(null);
    }
  }, [user, fetchAlerts]);
  
  const acknowledgeAlert = async (alertId: string) => {
    if (!user) throw new Error("User not authenticated");
    
    // Optimistic UI update
    const now = Timestamp.now();
    setAlerts(prev => prev.map(a => a.id === alertId && !a.isAcknowledged ? { ...a, isAcknowledged: true, acknowledgedOn: now } : a));

    const ackDocId = `${user.uid}_${alertId}`;
    const ackDocRef = doc(db, "alertAcknowledgements", ackDocId);
    
    const ackSnap = await getDoc(ackDocRef);
    if (ackSnap.exists()) return; // Already acknowledged on backend

    await setDoc(ackDocRef, {
      alertId: alertId,
      userId: user.uid,
      userEmail: user.email, 
      acknowledgedAt: serverTimestamp(),
      alertTitle: alerts.find(a => a.id === alertId)?.title || "N/A"
    });
  };

  const acknowledgeAllAlerts = async () => {
    if (!user) throw new Error("User not authenticated");

    const unacknowledgedAlerts = alerts.filter(a => !a.isAcknowledged);
    if (unacknowledgedAlerts.length === 0) return;

    // Optimistic UI update
    const now = Timestamp.now();
    setAlerts(prev => prev.map(a => a.isAcknowledged ? a : { ...a, isAcknowledged: true, acknowledgedOn: now }));

    const batch = writeBatch(db);
    unacknowledgedAlerts.forEach(alert => {
      const ackDocId = `${user.uid}_${alert.id}`;
      const ackDocRef = doc(db, "alertAcknowledgements", ackDocId);
      batch.set(ackDocRef, {
        alertId: alert.id,
        userId: user.uid,
        userEmail: user.email,
        acknowledgedAt: serverTimestamp(),
        alertTitle: alert.title || "N/A"
      });
    });

    await batch.commit();
  };

  const value = {
    alerts,
    unreadAlertsCount,
    isLoading,
    error,
    refreshAlerts: () => fetchAlerts(user),
    acknowledgeAlert,
    acknowledgeAllAlerts,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// --- HOOK ---

export const useNotification = (): NotificationContextType => {
  const context = React.useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};
