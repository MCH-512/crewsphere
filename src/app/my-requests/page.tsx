
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ListTodo, Loader2, AlertTriangle, Inbox, MessageSquareText, CalendarCheck2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { VariantProps } from "class-variance-authority";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface UserRequestForDisplay {
  id: string;
  userId: string;
  userEmail: string;
  requestType: string;
  specificRequestType?: string | null;
  urgencyLevel: "Low" | "Medium" | "High" | "Critical";
  subject: string;
  details: string; // Not directly displayed in list, but good to have
  createdAt: Timestamp;
  status: "pending" | "approved" | "rejected" | "in-progress";
  adminResponse?: string;
  updatedAt?: Timestamp;
}

export default function MyRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [myRequests, setMyRequests] = React.useState<UserRequestForDisplay[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMyRequests = React.useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setError("You must be logged in to view your requests.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "requests"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as UserRequestForDisplay));
      setMyRequests(fetchedRequests);
    } catch (err) {
      console.error("Error fetching user requests:", err);
      setError("Failed to load your requests. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch your requests.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchMyRequests();
      } else {
        // Redirect to login if not authenticated (AuthContext usually handles this, but as a fallback)
        router.push('/login');
      }
    }
  }, [user, authLoading, router, fetchMyRequests]);

  const getStatusBadgeVariant = (status: UserRequestForDisplay["status"]): VariantProps<typeof Badge>["variant"] => {
    switch (status) {
      case "pending": return "secondary";
      case "approved": return "success";
      case "rejected": return "destructive";
      case "in-progress": return "outline"; // Using 'outline' for in-progress
      default: return "secondary";
    }
  };
  
  const getUrgencyBadgeVariant = (level: UserRequestForDisplay["urgencyLevel"]): VariantProps<typeof Badge>["variant"] => {
    switch (level) {
      case "Critical": return "destructive";
      case "High": return "default"; // Default often has a primary color fill
      case "Medium": return "secondary";
      case "Low": return "outline";
      default: return "outline";
    }
  };


  if (authLoading || (isLoading && !user)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading your requests...</p>
      </div>
    );
  }

  if (!user && !authLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">Please log in to view your submitted requests.</p>
        <button onClick={() => router.push('/login')} className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">Go to Login</button>
      </div>
    );
  }
  
  if (error) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Error Loading Requests</CardTitle>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={fetchMyRequests} disabled={isLoading} className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-3">
            <Inbox className="h-7 w-7 text-primary" />
            <div>
                <CardTitle className="text-2xl font-headline">My Submitted Requests</CardTitle>
                <CardDescription>Track the status and responses to your submitted requests.</CardDescription>
            </div>
        </CardHeader>
      </Card>

      {myRequests.length === 0 && !isLoading && (
        <Card className="text-center p-6 shadow-md">
          <ListTodo className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-semibold text-lg text-muted-foreground">No requests submitted yet.</p>
          <p className="text-sm text-muted-foreground">
            You can submit a new request from the <a href="/requests" className="text-primary hover:underline">Submit Request</a> page.
          </p>
        </Card>
      )}

      {myRequests.length > 0 && (
        <div className="space-y-4">
          {myRequests.map((request) => (
            <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <CardTitle className="text-lg font-semibold">{request.subject}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize text-xs h-fit mt-1 sm:mt-0">
                        {request.status}
                    </Badge>
                </div>
                 <div className="text-xs text-muted-foreground space-x-2">
                    <span>Category: {request.requestType}</span>
                    {request.specificRequestType && <span>| Type: {request.specificRequestType}</span>}
                     <span>| Urgency: <Badge variant={getUrgencyBadgeVariant(request.urgencyLevel)} className="capitalize px-1.5 py-0.5 text-xs">{request.urgencyLevel}</Badge></span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-3">
                  Submitted: {request.createdAt ? format(request.createdAt.toDate(), "PPp") : 'N/A'}
                  {request.updatedAt && request.updatedAt.toMillis() !== request.createdAt.toMillis() && (
                    <span className="ml-2 italic">(Last updated: {format(request.updatedAt.toDate(), "PPp")})</span>
                  )}
                </div>
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="details">
                    <AccordionTrigger className="text-sm py-2">View Submitted Details</AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <p className="text-sm whitespace-pre-wrap bg-secondary/30 p-3 rounded-md">{request.details}</p>
                    </AccordionContent>
                  </AccordionItem>
                  {request.adminResponse && (
                    <AccordionItem value="response">
                      <AccordionTrigger className="text-sm py-2">
                        <span className="flex items-center gap-1">
                          <MessageSquareText className="h-4 w-4 text-primary" />
                          View Admin Response
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <p className="text-sm whitespace-pre-wrap bg-primary/10 p-3 rounded-md border border-primary/30">{request.adminResponse}</p>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
