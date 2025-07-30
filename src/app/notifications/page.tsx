
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { StoredAlert } from "@/schemas/alert-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import type { VariantProps } from "class-variance-authority";
import { alertVariants } from "@/components/ui/alert";

export default function NotificationsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [alerts, setAlerts] = React.useState<StoredAlert[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const fetchAlerts = React.useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const userRoles = ["all", user.role].filter(Boolean);
            const q = query(
                collection(db, "alerts"),
                where("targetAudience", "in", userRoles),
                orderBy("createdAt", "desc")
            );
            const querySnapshot = await getDocs(q);
            const fetchedAlerts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredAlert));
            setAlerts(fetchedAlerts);
        } catch (err) {
            console.error("Error fetching alerts:", err);
            toast({ title: "Loading Error", description: "Could not fetch your notifications.", variant: "destructive" });
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
    
    const getAlertVariant = (type: StoredAlert['type']): VariantProps<typeof alertVariants>["variant"] => {
        switch (type) {
            case 'critical': return 'destructive';
            case 'warning': return 'warning';
            case 'info': return 'info';
            default: return 'info';
        }
    };
    
    const getAlertIcon = (type: StoredAlert['type']): React.ElementType => {
        switch (type) {
            case 'critical': return AlertTriangle;
            case 'warning': return AlertTriangle;
            default: return Info;
        }
    };

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <BellRing className="mr-3 h-7 w-7 text-primary" />
                            Notifications
                        </CardTitle>
                        <CardDescription>
                            An archive of all alerts and important communications relevant to you.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            <div className="space-y-4">
                {alerts.length > 0 ? (
                    alerts.map((alert, index) => {
                        const Icon = getAlertIcon(alert.type);
                        return (
                            <AnimatedCard key={alert.id} delay={0.1 + index * 0.05}>
                                <Alert variant={getAlertVariant(alert.type)}>
                                    <Icon className="h-4 w-4" />
                                    <AlertTitle className="font-bold flex justify-between items-start">
                                        <span>{alert.title}</span>
                                        <span className="text-xs font-normal text-muted-foreground">{format(alert.createdAt.toDate(), "PPp")}</span>
                                    </AlertTitle>
                                    <AlertDescription>
                                        <p className="whitespace-pre-wrap">{alert.message}</p>
                                        {!alert.isActive && <p className="text-xs mt-2 font-semibold opacity-70">(This alert is no longer active)</p>}
                                    </AlertDescription>
                                </Alert>
                            </AnimatedCard>
                        )
                    })
                ) : (
                    <Card className="text-center py-12">
                        <CardContent>
                            <p className="text-muted-foreground">You have no notifications.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
