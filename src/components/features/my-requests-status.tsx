

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Inbox, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "../ui/badge";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "../ui/badge";
import { getRequestsStatus, type RequestsStats } from "@/services/schedule-service";


const getStatusBadgeVariant = (status: RequestsStats['latestRequest']['status']): VariantProps<typeof badgeVariants>["variant"] => {
    switch (status) {
      case "pending": return "warning";
      case "approved": return "success"; 
      case "rejected": return "destructive";
      case "in-progress": return "outline";
      default: return "secondary";
    }
};

export function MyRequestsStatusCard() {
    const [stats, setStats] = React.useState<RequestsStats | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchStatus = async () => {
            setIsLoading(true);
            const statusData = await getRequestsStatus();
            setStats(statusData);
            setIsLoading(false);
        }
        fetchStatus();
    }, []);
    
    return (
        <Card className="h-full shadow-md hover:shadow-lg transition-shadow flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-primary" />
                    My Requests
                </CardTitle>
                <CardDescription>A summary of your submitted requests.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                 {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading status...</span>
                    </div>
                 ) : !stats ? (
                     <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <p>Could not load request status.</p>
                    </div>
                 ) : stats.pendingCount > 0 ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-warning-foreground" />
                            <p>You have <strong className="text-foreground">{stats.pendingCount}</strong> request(s) awaiting review.</p>
                        </div>
                         {stats.latestRequest && (
                            <p className="text-sm text-muted-foreground truncate">
                                Latest: "{stats.latestRequest.subject}" <Badge variant={getStatusBadgeVariant(stats.latestRequest.status)} className="capitalize">{stats.latestRequest.status.replace('-', ' ')}</Badge>
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <p>You have no pending requests.</p>
                    </div>
                )}
            </CardContent>
             <CardFooter>
                 <Button asChild className="w-full" variant="outline">
                    <Link href="/requests">
                        Go to My Requests
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
