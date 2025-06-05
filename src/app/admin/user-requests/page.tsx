
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, AlertTriangle, RefreshCw, Eye, Edit } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface UserRequest {
  id: string;
  userId: string;
  userEmail: string;
  requestType: string;
  subject: string;
  details: string;
  createdAt: Timestamp;
  status: "pending" | "approved" | "rejected" | "in-progress";
}

export default function AdminUserRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [requests, setRequests] = React.useState<UserRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = React.useState<UserRequest | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
  const [newStatus, setNewStatus] = React.useState<UserRequest["status"] | "">("");
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

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
        router.push('/'); 
      } else {
        fetchRequests();
      }
    }
  }, [user, authLoading, router, fetchRequests]);

  const handleOpenManageDialog = (request: UserRequest) => {
    setSelectedRequest(request);
    setNewStatus(request.status); // Pre-fill with current status
    setIsManageDialogOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedRequest || !newStatus || newStatus === selectedRequest.status) {
      toast({ title: "No Change", description: "Status is the same or not selected.", variant: "default" });
      setIsManageDialogOpen(false);
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const requestDocRef = doc(db, "requests", selectedRequest.id);
      await updateDoc(requestDocRef, { status: newStatus });
      toast({ title: "Status Updated", description: `Request status changed to ${newStatus}.` });
      fetchRequests(); // Re-fetch to update the table
      setIsManageDialogOpen(false);
    } catch (err) {
      console.error("Error updating status:", err);
      toast({ title: "Update Failed", description: "Could not update request status.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadgeVariant = (status: UserRequest["status"]) => {
    switch (status) {
      case "pending": return "secondary";
      case "approved": return "default"; 
      case "rejected": return "destructive";
      case "in-progress": return "outline";
      default: return "secondary";
    }
  };

  if (authLoading || (isLoading && requests.length === 0 && !user)) {
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
          {isLoading && requests.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading request list...</p>
            </div>
          )}
          {!isLoading && requests.length === 0 && !error && (
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
                        <Button variant="ghost" size="sm" onClick={() => handleOpenManageDialog(request)}>
                          <Edit className="mr-1 h-4 w-4" /> Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRequest && (
        <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Request: {selectedRequest.subject}</DialogTitle>
              <DialogDescription>Review details and update the status of this request.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">User: <span className="text-muted-foreground">{selectedRequest.userEmail}</span></p>
                <p className="text-sm font-medium">Type: <span className="text-muted-foreground">{selectedRequest.requestType}</span></p>
                <p className="text-sm font-medium">Submitted: <span className="text-muted-foreground">{format(selectedRequest.createdAt.toDate(), "PPpp")}</span></p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Details:</Label>
                <p className="text-sm text-muted-foreground p-2 border rounded-md bg-secondary/30 max-h-40 overflow-y-auto">{selectedRequest.details}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-select">Update Status</Label>
                <Select 
                  value={newStatus || ""}
                  onValueChange={(value) => setNewStatus(value as UserRequest["status"])}
                >
                  <SelectTrigger id="status-select">
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleStatusUpdate} disabled={isUpdatingStatus || !newStatus || newStatus === selectedRequest.status}>
                {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

    
