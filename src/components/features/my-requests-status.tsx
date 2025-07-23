
"use server";

import * as React from "react";
import { auth as adminAuth } from "firebase-admin";
import { getAuth } from "firebase/auth";
import { cookies } from "next/headers";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Inbox, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "../ui/badge";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "../ui/badge";
import { getCurrentUser } from "@/lib/session";

interface RequestSummary {
  subject: string;
  status: "pending" | "approved" | "rejected" | "in-progress";
}

const getStatusBadgeVariant = (status: RequestSummary["status"]): VariantProps<typeof badgeVariants>["variant"] => {
    switch (status) {
      case "pending": return "secondary";
      case "approved": return "success"; 
      case "rejected": return "destructive";
      case "in-progress": return "outline";
      default: return "secondary";
    }
};

async function getRequestsStatus(userId: string | undefined): Promise<{ pendingCount: number; latestRequest: RequestSummary | null }> {
    if (!userId) {
        return { pendingCount: 0, latestRequest: null };
    }
    
    const requestsQuery = query(collection(db, "requests"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(requestsQuery);
    const allUserRequests = querySnapshot.docs.map(doc => doc.data() as RequestSummary);
    
    const pendingCount = allUserRequests.filter(r => r.status === 'pending').length;
    const latestRequest = allUserRequests.length > 0 ? allUserRequests[0] : null;

    return { pendingCount, latestRequest };
}

export async function MyRequestsStatusCard() {
    const user = await getCurrentUser();
    const stats = await getRequestsStatus(user?.uid);
    
    return (
        <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                    <Inbox className="h-5 w-5" />
                    My Requests
                </CardTitle>
                <CardDescription>A summary of your submitted requests.</CardDescription>
            </CardHeader>
            <CardContent>
                 {stats.pendingCount > 0 ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
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
                        <CheckCircle className="h-5 w-5 text-green-600" />
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
