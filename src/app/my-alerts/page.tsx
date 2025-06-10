
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert as ShadAlert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, Timestamp, getDocs, or, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, AlertTriangle, RefreshCw, Info, Briefcase, GraduationCap, LucideIcon, CheckCircle } from "lucide-react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { VariantProps } from "class-variance-authority";
import { alertVariants } from "@/components/ui/alert"; 

interface AlertData {
  id: string;
  title: string;
  content: string;
  level: "critical" | "warning" | "info";
  createdAt: Timestamp;
  userId?: string | null; 
  iconName?: string | null;
  isAcknowledged?: boolean;
  acknowledgedOn?: Timestamp | null;
}

export default function MyAlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [alerts, setAlerts] = React.useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAcknowledging, setIsAcknowledging] = React.useState<Record<string, boolean>>({});


  const fetchAlerts = React.useCallback(async () => {
    if (!user) {
        setIsLoading(false);
        setError("You must be logged in to view alerts.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const alertsQuery = query(
        collection(db, "alerts"),
        or(
            where("userId", "==", user.uid),
            where("userId", "==", null) // Global alerts
        ),
        orderBy("createdAt", "desc")
      );
      
      const alertsSnapshot = await getDocs(alertsQuery);
      const fetchedAlertsData = alertsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AlertData));

      // Fetch acknowledgements for these alerts by the current user
      const userAcknowledgementsMap = new Map<string, Timestamp>();
      if (fetchedAlertsData.length > 0) {
        const alertIds = fetchedAlertsData.map(a => a.id);
        // Firestore 'in' queries are limited to 30 items per query. For more alerts, batching would be needed.
        // For simplicity, if more than 30 alerts, we might query all user's acks.
        // Or, more efficiently, construct document IDs like `${user.uid}_${alertId}` and do getDoc in a loop (batched).
        // For this example, let's assume a reasonable number of alerts or fetch all for user.
        
        const acknowledgementsQuery = query(
          collection(db, "alertAcknowledgements"),
          where("userId", "==", user.uid),
          where("alertId", "in", alertIds.length > 0 ? alertIds : ["dummyId"]) // 'in' query needs non-empty array
        );
        const ackSnapshot = await getDocs(acknowledgementsQuery);
        ackSnapshot.forEach(doc => {
          const ackData = doc.data();
          userAcknowledgementsMap.set(ackData.alertId, ackData.acknowledgedAt as Timestamp);
        });
      }
      
      const processedAlerts = fetchedAlertsData.map(alert => ({
        ...alert,
        isAcknowledged: userAcknowledgementsMap.has(alert.id),
        acknowledgedOn: userAcknowledgementsMap.get(alert.id) || null,
      }));
      
      setAlerts(processedAlerts);

    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError("Failed to load your alerts. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch alerts.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading) {
        if (user) {
            fetchAlerts();
        } else {
            router.push('/login');
        }
    }
  }, [user, authLoading, router, fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsAcknowledging(prev => ({ ...prev, [alertId]: true }));
    try {
      const ackDocRef = doc(db, "alertAcknowledgements", `${user.uid}_${alertId}`);
      // Check if already acknowledged to prevent duplicate writes if UI state is slow
      const ackSnap = await getDoc(ackDocRef);
      if (ackSnap.exists()) {
          toast({ title: "Already Acknowledged", description: "This alert was already marked as read.", variant: "default" });
          // Optionally re-fetch to ensure UI consistency if local state got out of sync
          fetchAlerts();
          return;
      }

      await addDoc(collection(db, "alertAcknowledgements"), {
        alertId: alertId,
        userId: user.uid,
        acknowledgedAt: serverTimestamp(),
      });
      
      // Update local state
      setAlerts(prevAlerts => prevAlerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, isAcknowledged: true, acknowledgedOn: Timestamp.now() } // Use Timestamp.now() for immediate UI update
          : alert
      ));
      toast({ title: "Alert Acknowledged", description: "Marked as read.", action: <CheckCircle className="text-green-500" /> });
    } catch (err) {
      console.error("Error acknowledging alert:", err);
      toast({ title: "Acknowledgement Failed", description: "Could not mark alert as read.", variant: "destructive" });
    } finally {
      setIsAcknowledging(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const getAlertVariant = (level: AlertData["level"]): VariantProps<typeof alertVariants>["variant"] => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'default';
    }
  };

  const getIconForAlert = (alert: AlertData): LucideIcon => {
    if (alert.iconName) {
        const lowerIconName = alert.iconName.toLowerCase();
        if (lowerIconName === "briefcase") return Briefcase;
        if (lowerIconName === "graduationcap") return GraduationCap;
    }
    switch (alert.level) {
        case "critical": return AlertTriangle;
        case "warning": return AlertTriangle; 
        case "info":
        default: return Info;
    }
  };


  if (authLoading || (isLoading && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading alerts...</p>
      </div>
    );
  }
  
  if (!user && !authLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">Please log in to view your alerts.</p>
        <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <BellRing className="mr-3 h-7 w-7 text-primary" />
              My Alerts
            </CardTitle>
            <CardDescription>All relevant global and personal notifications.</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchAlerts} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Alerts
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
             <ShadAlert variant="destructive" className="mb-4">
              <AlertTriangle className="h-5 w-5" />
              <ShadAlertTitle>Error</ShadAlertTitle>
              <ShadAlertDescription>{error}</ShadAlertDescription>
            </ShadAlert>
          )}
          {isLoading && alerts.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Fetching your alerts...</p>
            </div>
          )}
          {!isLoading && alerts.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No alerts for you at this time. Check back later!</p>
          )}
          {!isLoading && alerts.length > 0 && (
            <div className="space-y-4">
              {alerts.map((alert) => {
                  const IconComponent = getIconForAlert(alert);
                  const timeAgo = formatDistanceToNowStrict(alert.createdAt.toDate(), { addSuffix: true });
                  
                  return (
                  <ShadAlert key={alert.id} variant={getAlertVariant(alert.level)} className="shadow-sm">
                    <IconComponent className="h-5 w-5" /> 
                    <div className="flex justify-between items-start mb-1">
                        <ShadAlertTitle>{alert.title}</ShadAlertTitle>
                        <p className="text-xs text-muted-foreground/80 whitespace-nowrap ml-2">{timeAgo}</p>
                    </div>
                    <ShadAlertDescription className="mb-2">{alert.content}</ShadAlertDescription>
                    {alert.userId === user?.uid && (
                        <p className="text-xs font-medium text-primary mb-2">(Personal Alert)</p>
                    )}

                    {!alert.isAcknowledged ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={isAcknowledging[alert.id] || isLoading}
                        className="mt-2 w-full sm:w-auto"
                      >
                        {isAcknowledging[alert.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        {isAcknowledging[alert.id] ? "Acknowledging..." : "Acknowledge"}
                      </Button>
                    ) : (
                      <div className="flex items-center text-xs text-green-600 dark:text-green-400 mt-2">
                        <CheckCircle className="mr-1.5 h-4 w-4" />
                        Acknowledged {alert.acknowledgedOn ? formatDistanceToNowStrict(alert.acknowledgedOn.toDate(), { addSuffix: true }) : ''}
                      </div>
                    )}
                  </ShadAlert>
                )})}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
