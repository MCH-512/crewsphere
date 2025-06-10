
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert as ShadAlert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, Timestamp, getDocs, or } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, AlertTriangle, RefreshCw, Info, Briefcase, GraduationCap, LucideIcon } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { VariantProps } from "class-variance-authority";
import { alertVariants } from "@/components/ui/alert"; // Import alertVariants to get its types

interface Alert {
  id: string;
  title: string;
  content: string;
  level: "critical" | "warning" | "info";
  createdAt: Timestamp;
  userId?: string | null; 
  iconName?: string | null; 
}

export default function MyAlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
            where("userId", "==", null)
        ),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(alertsQuery);
      const fetchedAlerts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      
      setAlerts(fetchedAlerts);

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

  const getAlertVariant = (level: Alert["level"]): VariantProps<typeof alertVariants>["variant"] => {
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

  const getIconForAlert = (alert: Alert): LucideIcon => {
    if (alert.iconName) {
        const lowerIconName = alert.iconName.toLowerCase();
        if (lowerIconName === "briefcase") return Briefcase;
        if (lowerIconName === "graduationcap") return GraduationCap;
        // Add more icon name mappings here if needed
    }
    // Default icons based on level if no specific iconName is provided or matched
    switch (alert.level) {
        case "critical": return AlertTriangle;
        case "warning": return AlertTriangle; // Using AlertTriangle for warning too
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
          {isLoading && (
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
                    <IconComponent className="h-5 w-5" /> {/* Icon styling handled by alertVariants */}
                    <div className="flex justify-between items-center mb-1">
                        <ShadAlertTitle>{alert.title}</ShadAlertTitle>
                        <p className="text-xs text-muted-foreground/80">{timeAgo}</p>
                    </div>
                    <ShadAlertDescription>{alert.content}</ShadAlertDescription>
                    {alert.userId === user?.uid && (
                        <p className="text-xs font-medium text-primary mt-1">(Personal Alert)</p>
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
