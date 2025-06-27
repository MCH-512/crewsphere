
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert as ShadAlert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, AlertTriangle, RefreshCw, Info, Briefcase, GraduationCap, LucideIcon, CheckCircle, Link as LinkIcon, CheckCheck } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns"; 
import { useToast } from "@/hooks/use-toast";
import type { VariantProps } from "class-variance-authority";
import { alertVariants } from "@/components/ui/alert"; 
import { useNotification, type AlertData } from "@/contexts/notification-context"; 
import { cn } from "@/lib/utils";
import Link from "next/link";

// NOTE: All logic and state are now managed by NotificationContext. This component is now for display only.

export default function MyAlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const { 
    alerts, 
    isLoading, 
    error, 
    refreshAlerts, 
    acknowledgeAlert, 
    acknowledgeAllAlerts 
  } = useNotification();

  const [isAcknowledging, setIsAcknowledging] = React.useState<Record<string, boolean>>({});
  const [isAcknowledgingAll, setIsAcknowledgingAll] = React.useState(false);

  const unreadAlertsExist = React.useMemo(() => alerts.some(a => !a.isAcknowledged), [alerts]);

  const handleAcknowledge = async (alertId: string) => {
    setIsAcknowledging(prev => ({ ...prev, [alertId]: true }));
    try {
      await acknowledgeAlert(alertId);
      toast({ title: "Alert Acknowledged", description: "Marked as read.", action: <CheckCircle className="text-success-foreground" /> });
    } catch (err) {
      console.error("Error acknowledging alert:", err);
      toast({ title: "Acknowledgement Failed", description: "Could not mark alert as read.", variant: "destructive" });
      refreshAlerts(); // Refresh state if optimistic update failed
    } finally {
      setIsAcknowledging(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleAcknowledgeAll = async () => {
    if (!unreadAlertsExist) return;

    setIsAcknowledgingAll(true);
    const unacknowledgedCount = alerts.filter(a => !a.isAcknowledged).length;
    try {
      await acknowledgeAllAlerts();
      toast({ title: "All Alerts Acknowledged", description: `${unacknowledgedCount} alert(s) marked as read.`, action: <CheckCircle className="text-success-foreground" /> });
    } catch (error) {
      console.error("Error acknowledging all alerts:", error);
      toast({ title: "Operation Failed", description: "Could not mark all alerts as read.", variant: "destructive" });
      refreshAlerts(); // Refresh state if optimistic update failed
    } finally {
      setIsAcknowledgingAll(false);
    }
  };

  const getAlertVariant = (level: AlertData["level"]): VariantProps<typeof alertVariants>["variant"] => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'warning': return 'warning';
      case 'info': default: return 'default';
    }
  };

  const getIconForAlert = (alert: AlertData): LucideIcon => {
    if (alert.iconName) {
      const lowerIconName = alert.iconName.toLowerCase();
      if (lowerIconName.includes("briefcase")) return Briefcase;
      if (lowerIconName.includes("graduation")) return GraduationCap;
    }
    switch (alert.level) {
      case "critical": case "warning": return AlertTriangle;
      case "info": default: return Info;
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
     router.push('/login');
     return null; // Render nothing while redirecting
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <BellRing className="mr-3 h-7 w-7 text-primary" />
              My Alerts
            </CardTitle>
            <CardDescription>All relevant global and personal notifications.</CardDescription>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={refreshAlerts} disabled={isLoading} className="flex-1 sm:flex-none">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleAcknowledgeAll} disabled={isLoading || isAcknowledgingAll || !unreadAlertsExist} className="flex-1 sm:flex-none">
              {isAcknowledgingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCheck className="mr-2 h-4 w-4" />}
              Acknowledge All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <ShadAlert variant="destructive" className="mb-4">
              <AlertTriangle className="h-5 w-5" />
              <ShadAlertTitle>Error</ShadAlertTitle>
              <ShadAlertDescription>{error.message}</ShadAlertDescription>
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
                  <ShadAlert 
                    key={alert.id} 
                    variant={getAlertVariant(alert.level)} 
                    className={cn(
                      "shadow-sm",
                      alert.isAcknowledged && "bg-muted/40 border-muted/60 opacity-80 dark:bg-muted/20 dark:border-muted/30"
                    )}
                  >
                    <IconComponent className="h-5 w-5" /> 
                    <div className="flex justify-between items-start mb-1">
                      <ShadAlertTitle>{alert.title}</ShadAlertTitle>
                      <p className="text-xs text-muted-foreground/80 whitespace-nowrap ml-2">{timeAgo}</p>
                    </div>
                    <ShadAlertDescription className="mb-2">{alert.content}</ShadAlertDescription>
                    {alert.userId === user?.uid && (
                      <p className="text-xs font-medium text-primary mb-2">(Personal Alert)</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {alert.linkUrl && alert.linkUrl.trim() !== "" && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={alert.linkUrl} target="_blank" rel="noopener noreferrer">
                            <LinkIcon className="mr-2 h-4 w-4" />
                            More Info
                          </Link>
                        </Button>
                      )}
                      {!alert.isAcknowledged ? (
                        <Button 
                          size="sm" 
                          variant="default" 
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={isAcknowledging[alert.id] || isLoading}
                          className={cn(alert.linkUrl && alert.linkUrl.trim() !== "" ? "" : "w-full sm:w-auto")}
                        >
                          {isAcknowledging[alert.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                          {isAcknowledging[alert.id] ? "Acknowledging..." : "Acknowledge"}
                        </Button>
                      ) : (
                        <div className="flex items-center text-xs text-success-foreground">
                          <CheckCircle className="mr-1.5 h-4 w-4" />
                          Acknowledged {alert.acknowledgedOn ? formatDistanceToNowStrict(alert.acknowledgedOn.toDate(), { addSuffix: true }) : ''}
                        </div>
                      )}
                    </div>
                  </ShadAlert>
                )})}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
