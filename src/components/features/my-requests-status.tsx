
"use server";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Inbox, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { getStatusBadgeVariant } from "@/schemas/request-schema";
import { getRequestsStatus } from "@/services/dashboard-service";
import { z } from 'zod';
import type { RequestStatus } from "@/schemas/request-schema";

const EmptySchema = z.object({});

export async function MyRequestsStatusCard() {
    EmptySchema.parse({});
    const stats = await getRequestsStatus();

    // Handle the case where stats are null (error fetching)
    if (stats === null) {
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
                     <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <p>Could not load request status.</p>
                    </div>
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
                 {stats.pendingCount > 0 ? (
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-warning-foreground mt-0.5 flex-shrink-0" />
                            <p>You have <strong className="text-foreground">{stats.pendingCount}</strong> request(s) awaiting review.</p>
                        </div>
                         {stats.latestRequest && (
                            <div className="text-sm text-muted-foreground truncate p-2 border-l-2 border-warning/80">
                                Latest: &quot;{stats.latestRequest.subject}&quot; <Badge variant={getStatusBadgeVariant(stats.latestRequest.status as RequestStatus)} className="capitalize">{stats.latestRequest.status.replace('-', ' ')}</Badge>
                            </div>
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
