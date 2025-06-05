
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface UserRequest {
  id: string;
  userId: string;
  userEmail: string;
  requestType: string;
  subject: string;
  details: string;
  createdAt: Timestamp; // Firestore Timestamp
  status: "pending" | "approved" | "rejected" | "in-progress";
}

export default function AdminUserRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = React.useState<UserRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as UserRequest));
      setRequests(fetchedRequests);
    } catch (err) {
      console.error("Error fetching requests:", err);
      setError("Failed to load user requests. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); // Redirect non-admins or unauthenticated users
      } else {
        fetchRequests();
      }
    }
  }, [user, authLoading, router, fetchRequests]);

  const getStatusBadgeVariant = (status: UserRequest["status"]) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "approved":
        return "default"; // Greenish if theme supports
      case "rejected":
        return "destructive";
      case "in-progress":
        return "outline"; // Bluish if theme supports
      default:
        return "secondary";
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading requests...</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <ClipboardList className="mr-3 h-7 w-7 text-primary" />
              User Submitted Requests
            </CardTitle>
            <CardDescription>Review and manage all requests submitted by users.</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchRequests} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
          {requests.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No user requests found at this time.</p>
          )}
          {requests.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead>User Email</TableHead>
                    <TableHead>Request Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {request.createdAt ? format(request.createdAt.toDate(), "PPpp") : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{request.userEmail}</TableCell>
                      <TableCell>{request.requestType}</TableCell>
                      <TableCell>{request.subject}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm">View</Button>
                        {/* Add more actions like Approve, Reject, etc. later */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
