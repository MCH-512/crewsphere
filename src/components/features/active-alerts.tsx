
"use client";

import * as React from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp, limit } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, AlertTriangle, BellRing, X } from "lucide-react";
import type { StoredAlert } from "@/schemas/alert-schema";
import { Button } from "../ui/button";

export function ActiveAlerts() {
    const { user } = useAuth();
    const [alerts, setAlerts] = React.useState<StoredAlert[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dismissedAlerts, setDismissedAlerts] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const fetchAlerts = async () => {
            setIsLoading(true);
            try {
                const userRoles = ["all", user.role].filter(Boolean);
                const q = query(
                    collection(db, "alerts"),
                    where("isActive", "==", true),
                    where("targetAudience", "in", userRoles),
                    orderBy("createdAt", "desc"),
                    limit(5)
                );
                const querySnapshot = await getDocs(q);
                const fetchedAlerts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredAlert));
                setAlerts(fetchedAlerts);
            } catch (error) {
                console.error("Error fetching alerts:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlerts();
    }, [user]);

    const handleDismiss = (alertId: string) => {
        setDismissedAlerts(prev => [...prev, alertId]);
    };

    if (isLoading) {
        return (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking for alerts...</span>
            </div>
        );
    }
    
    const visibleAlerts = alerts.filter(alert => !dismissedAlerts.includes(alert.id));

    if (visibleAlerts.length === 0) {
        return null;
    }

    const getAlertVariant = (type: StoredAlert['type']): 'default' | 'destructive' | 'warning' => {
        switch (type) {
            case 'critical': return 'destructive';
            case 'warning': return 'warning';
            default: return 'default';
        }
    };
    
     const getAlertIcon = (type: StoredAlert['type']): React.ElementType => {
        switch (type) {
            case 'critical': return AlertTriangle;
            case 'warning': return Info;
            default: return BellRing;
        }
    };

    return (
        <div className="space-y-4">
            {visibleAlerts.map(alert => {
                 const Icon = getAlertIcon(alert.type);
                 return (
                    <Alert key={alert.id} variant={getAlertVariant(alert.type)} className="relative pr-10">
                        <Icon className="h-4 w-4" />
                        <AlertTitle className="font-bold">{alert.title}</AlertTitle>
                        <AlertDescription>
                            {alert.message}
                        </AlertDescription>
                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => handleDismiss(alert.id)}>
                            <X className="h-4 w-4" />
                            <span className="sr-only">Dismiss alert</span>
                        </Button>
                    </Alert>
                )
            })}
        </div>
    );
}
