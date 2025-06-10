
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input"; 
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, serverTimestamp, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, AlertTriangle, RefreshCw, Eye, Zap, Filter, Search, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { VariantProps } from "class-variance-authority"; 

interface UserRequest {
  id: string;
  userId: string;
  userEmail: string;
  requestType: string; 
  specificRequestType?: string | null; 
  urgencyLevel: "Low" | "Medium" | "High" | "Critical";
  subject: string;
  details: string;
  createdAt: Timestamp;
  status: "pending" | "approved" | "rejected" | "in-progress";
  adminResponse?: string;
  updatedAt?: Timestamp;
}

type SortableColumn = "createdAt" | "status" | "urgencyLevel";
type SortDirection = "asc" | "desc";

const requestStatuses: UserRequest["status"][] = ["pending", "approved", "rejected", "in-progress"];
const urgencyOrder: Record<UserRequest["urgencyLevel"], number> = { "Low": 0, "Medium": 1, "High": 2, "Critical": 3 };
const statusOrder: Record<UserRequest["status"], number> = { "pending": 0, "in-progress": 1, "approved": 2, "rejected": 3 };


export default function AdminUserRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [allRequests, setAllRequests] = React.useState<UserRequest[]>([]); 
  const [filteredAndSortedRequests, setFilteredAndSortedRequests] = React.useState<UserRequest[]>([]); 
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = React.useState<UserRequest | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
  const [newStatus, setNewStatus] = React.useState<UserRequest["status"] | "">("");
  const [adminResponseText, setAdminResponseText] = React.useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  
  const [statusFilter, setStatusFilter] = React.useState<UserRequest["status"] | "all">("all");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [sortColumn, setSortColumn] = React.useState<SortableColumn>("createdAt");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "requests"), orderBy("createdAt", "desc")); // Always fetch all, sorting/filtering done client-side
      const querySnapshot = await getDocs(q);
      const fetchedRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as UserRequest));
      setAllRequests(fetchedRequests); 
    } catch (err) {
      console.error("Error fetching requests:", err);
      setError("Failed to load user requests. Please try again.");
      toast({ title: "Loading Error", description: "Could not fetch requests.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/'); 
      } else {
        fetchRequests();
      }
    }
  }, [user, authLoading, router, fetchRequests]);

  React.useEffect(() => {
    let processedRequests = [...allRequests];

    // Apply status filter
    if (statusFilter !== "all") {
      processedRequests = processedRequests.filter(request => request.status === statusFilter);
    }

    // Apply search term filter
    if (searchTerm !== "") {
      const lowercasedFilter = searchTerm.toLowerCase();
      processedRequests = processedRequests.filter(request =>
        request.subject.toLowerCase().includes(lowercasedFilter) ||
        request.userEmail.toLowerCase().includes(lowercasedFilter)
      );
    }

    // Apply sorting
    processedRequests.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === "createdAt") {
        comparison = a.createdAt.toMillis() - b.createdAt.toMillis();
      } else if (sortColumn === "status") {
        comparison = statusOrder[a.status] - statusOrder[b.status];
      } else if (sortColumn === "urgencyLevel") {
        comparison = urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    setFilteredAndSortedRequests(processedRequests);
  }, [allRequests, statusFilter, searchTerm, sortColumn, sortDirection]);


  const handleOpenManageDialog = (request: UserRequest) => {
    setSelectedRequest(request);
    setNewStatus(request.status); 
    setAdminResponseText(request.adminResponse || "");
    setIsManageDialogOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedRequest || !newStatus ) {
      toast({ title: "Selection Missing", description: "No request selected or new status not chosen.", variant: "default" });
      return;
    }
    if (newStatus === selectedRequest.status && adminResponseText === (selectedRequest.adminResponse || "")) {
      toast({ title: "No Change", description: "Status and response are the same.", variant: "default" });
      setIsManageDialogOpen(false);
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const requestDocRef = doc(db, "requests", selectedRequest.id);
      await updateDoc(requestDocRef, { 
        status: newStatus,
        adminResponse: adminResponseText || null,
        updatedAt: serverTimestamp(),
       });
      toast({ title: "Request Updated", description: `Request status changed to ${newStatus}. Response saved.` });
      fetchRequests(); 
      setIsManageDialogOpen(false);
    } catch (err) {
      console.error("Error updating status:", err);
      toast({ title: "Update Failed", description: "Could not update request status/response.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadgeVariant = (status: UserRequest["status"]): VariantProps<typeof Badge>["variant"] => {
    switch (status) {
      case "pending": return "secondary";
      case "approved": return "success"; 
      case "rejected": return "destructive";
      case "in-progress": return "outline";
      default: return "secondary";
    }
  };

  const getUrgencyBadgeVariant = (level?: UserRequest["urgencyLevel"]): VariantProps<typeof Badge>["variant"] => {
    if (!level || !["Low", "Medium", "High", "Critical"].includes(level)) {
        return "outline";
    }
    switch (level) {
      case "Critical": return "destructive";
      case "High": return "default"; 
      case "Medium": return "secondary";
      case "Low": return "outline";
      default: return "outline";
    }
  };
  
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "createdAt" ? "desc" : "asc"); // Default desc for date, asc for others
    }
  };

  const SortableHeader = ({ column, label }: { column: SortableColumn; label: string }) => (
    <TableHead onClick={() => handleSort(column)} className="cursor-pointer hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-1">
        {label}
        {sortColumn === column && (
          <ArrowUpDown className={`h-3 w-3 ${sortDirection === "desc" ? "" : "rotate-180"}`} />
        )}
      </div>
    </TableHead>
  );


  if (authLoading || (isLoading && filteredAndSortedRequests.length === 0 && !user)) {
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
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <CardTitle className="text-2xl font-headline flex items-center">
              <ClipboardList className="mr-3 h-7 w-7 text-primary" />
              User Submitted Requests
            </CardTitle>
            <CardDescription>Review and manage all requests submitted by users.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={fetchRequests} disabled={isLoading} className="w-full sm:w-auto">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow md:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by subject or email..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UserRequest["status"] | "all")}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {requestStatuses.map(status => (
                        <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          {error && (
            <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}
          {isLoading && allRequests.length === 0 && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading request list...</p>
            </div>
          )}
          {!isLoading && filteredAndSortedRequests.length === 0 && !error && (
            <p className="text-muted-foreground text-center py-8">No user requests found{statusFilter !== "all" ? ` for status: ${statusFilter}` : ""}{searchTerm ? ` matching "${searchTerm}"` : ""}.</p>
          )}
          {filteredAndSortedRequests.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader column="createdAt" label="Submitted" />
                    <TableHead>User Email</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Specific Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <SortableHeader column="urgencyLevel" label="Urgency" />
                    <SortableHeader column="status" label="Status" />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {request.createdAt ? format(request.createdAt.toDate(), "PPp") : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{request.userEmail}</TableCell>
                      <TableCell>{request.requestType}</TableCell>
                      <TableCell>{request.specificRequestType || 'N/A'}</TableCell>
                      <TableCell>{request.subject}</TableCell>
                      <TableCell>
                        <Badge variant={getUrgencyBadgeVariant(request.urgencyLevel)} className="capitalize flex items-center gap-1">
                            {request.urgencyLevel === "Critical" && <Zap className="h-3 w-3" />}
                            {request.urgencyLevel || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenManageDialog(request)}>
                          <Eye className="mr-1 h-4 w-4" /> View &amp; Manage
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
              <DialogDescription>Review details, update status, and add response notes.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">User: <span className="text-muted-foreground">{selectedRequest.userEmail}</span></p>
                <p className="text-sm font-medium">Category: <span className="text-muted-foreground">{selectedRequest.requestType}</span></p>
                {selectedRequest.specificRequestType && <p className="text-sm font-medium">Specific Type: <span className="text-muted-foreground">{selectedRequest.specificRequestType}</span></p>}
                <p className="text-sm font-medium">Urgency: 
                  <Badge variant={getUrgencyBadgeVariant(selectedRequest.urgencyLevel)} className="capitalize ml-1 px-1.5 py-0.5 text-xs">
                    {selectedRequest.urgencyLevel === "Critical" && <Zap className="h-3 w-3 mr-1" />}
                    {selectedRequest.urgencyLevel || "N/A"}
                  </Badge>
                </p>
                <p className="text-sm font-medium">Submitted: <span className="text-muted-foreground">{format(selectedRequest.createdAt.toDate(), "PPpp")}</span></p>
                {selectedRequest.updatedAt && selectedRequest.updatedAt.toMillis() !== selectedRequest.createdAt.toMillis() && <p className="text-sm font-medium">Last Updated: <span className="text-muted-foreground">{format(selectedRequest.updatedAt.toDate(), "PPpp")}</span></p>}
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
                    {requestStatuses.map(status => (
                         <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-response">Admin Response / Notes</Label>
                <Textarea
                  id="admin-response"
                  placeholder="Add your response or internal notes here..."
                  value={adminResponseText}
                  onChange={(e) => setAdminResponseText(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleStatusUpdate} disabled={isUpdatingStatus}>
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
    

