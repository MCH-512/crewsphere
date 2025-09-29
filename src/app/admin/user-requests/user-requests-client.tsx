
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, Timestamp, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Inbox, Loader2, AlertTriangle, Edit, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { StoredUserRequest, requestStatuses, getStatusBadgeVariant, getUrgencyBadgeVariant, urgencyLevels, requestCategoryKeys, allRequestCategories } from "@/schemas/request-schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logAuditEvent } from "@/lib/audit-logger";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/components/custom/custom-sortable-header";

type SortableColumn = 'createdAt' | 'userEmail' | 'subject' | 'requestType' | 'urgencyLevel' | 'status';
type SortDirection = 'asc' | 'desc';
type RequestStatus = StoredUserRequest["status"];
type RequestCategory = StoredUserRequest["requestType"];

export function UserRequestsClient({ initialRequests }: { initialRequests: StoredUserRequest[] }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [requests, setRequests] = React.useState<StoredUserRequest[]>(initialRequests);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [selectedRequest, setSelectedRequest] = React.useState<StoredUserRequest | null>(null);
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [newStatus, setNewStatus] = React.useState<RequestStatus | "">("");
    const [adminResponse, setAdminResponse] = React.useState("");
    const [isUpdating, setIsUpdating] = React.useState(false);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('createdAt');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
    const [searchTerm, setSearchTerm] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<RequestStatus | "all">("all");
    const [categoryFilter, setCategoryFilter] = React.useState<RequestCategory | "all">("all");

    React.useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
        
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const fetchedRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserRequest));
                setRequests(fetchedRequests);
                setIsLoading(false);
            },
            (err) => {
                console.error("Error fetching requests in real-time:", err);
                toast({ title: "Real-time Error", description: "Could not fetch request updates.", variant: "destructive" });
                setIsLoading(false);
            }
        );
        
        return () => unsubscribe();
    }, [user, toast]);
    
    const filteredAndSortedRequests = React.useMemo(() => {
        let filtered = requests.filter(r => {
            if (statusFilter !== "all" && r.status !== statusFilter) return false;
            if (categoryFilter !== "all" && r.requestType !== categoryFilter) return false;
            if (searchTerm) {
                const lowercasedTerm = searchTerm.toLowerCase();
                return (
                    r.subject.toLowerCase().includes(lowercasedTerm) ||
                    r.userEmail.toLowerCase().includes(lowercasedTerm)
                );
            }
            return true;
        });

        return filtered.sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - b.createdAt.toMillis();
            } else {
                comparison = String(valA || '').localeCompare(String(valB || ''));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [requests, sortColumn, sortDirection, statusFilter, categoryFilter, searchTerm]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'createdAt' ? 'desc' : 'asc');
        }
    };

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
            }
        }
    }, [user, authLoading, router]);
    
    const handleOpenManageDialog = (request: StoredUserRequest) => {
        setSelectedRequest(request);
        setNewStatus(request.status);
        setAdminResponse(request.adminResponse || "");
        setIsManageDialogOpen(true);
    };

    const handleUpdateRequest = async () => {
        if (!selectedRequest || !newStatus || !user) return;
        
        setIsUpdating(true);
        try {
            const requestRef = doc(db, "requests", selectedRequest.id);
            await updateDoc(requestRef, {
                status: newStatus,
                adminResponse: adminResponse,
                updatedAt: serverTimestamp(),
            });

            await logAuditEvent({
                userId: user.uid,
                userEmail: user.email || "N/A",
                actionType: "UPDATE_REQUEST_STATUS",
                entityType: "REQUEST",
                entityId: selectedRequest.id,
                details: { subject: selectedRequest.subject, newStatus },
            });

            toast({ title: "Request Updated", description: "The request has been updated successfully." });
            setIsManageDialogOpen(false);
        } catch (error) {
            console.error("Error updating request:", error);
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
     if (!user || user.role !== 'admin') {
        return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center"><Inbox className="mr-3 h-7 w-7 text-primary" />User Request Management</CardTitle>
                    <CardDescription>Review, prioritize, and respond to all requests submitted by users.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by subject or user email..."
                                className="pl-8 w-full md:max-w-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {requestStatuses.map(status => (
                                    <SelectItem key={status} value={status} className="capitalize">{status.replace('-', ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[220px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {allRequestCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading && requests.length === 0 ? (
                        <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
                    ) : filteredAndSortedRequests.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHeader<SortableColumn> column="createdAt" label="Submitted" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader<SortableColumn> column="userEmail" label="User" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader<SortableColumn> column="subject" label="Subject" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader<SortableColumn> column="requestType" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader<SortableColumn> column="urgencyLevel" label="Urgency" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader<SortableColumn> column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndSortedRequests.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell className="text-xs">{r.createdAt ? format(r.createdAt.toDate(), "PPp") : 'N/A'}</TableCell>
                                            <TableCell className="text-xs">
                                                <Link href={`/admin/users/${r.userId}`} className="hover:underline text-primary">
                                                    {r.userEmail}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="font-medium max-w-xs truncate" title={r.subject}>{r.subject}</TableCell>
                                            <TableCell><Badge variant="outline">{r.requestType}</Badge></TableCell>
                                            <TableCell><Badge variant={getUrgencyBadgeVariant(r.urgencyLevel)}>{r.urgencyLevel}</Badge></TableCell>
                                            <TableCell><Badge variant={getStatusBadgeVariant(r.status)} className="capitalize">{r.status.replace('-', ' ')}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenManageDialog(r)}><Edit className="mr-1 h-4 w-4" />Manage</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No requests found matching your criteria.</p>
                    )}
                </CardContent>
            </Card>

            {selectedRequest && (
                <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Manage Request</DialogTitle>
                            <DialogDescription>From: {selectedRequest.userEmail}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                             <div className="text-sm border p-3 rounded-md bg-muted/50">
                                <p><strong>Subject:</strong> {selectedRequest.subject}</p>
                                <p><strong>Category:</strong> {selectedRequest.requestType}</p>
                                <p><strong>Urgency:</strong> {selectedRequest.urgencyLevel}</p>
                                <p className="mt-2 pt-2 border-t"><strong>Details:</strong></p>
                                <p className="whitespace-pre-wrap">{selectedRequest.details}</p>
                             </div>
                            <div className="space-y-2">
                                <Label htmlFor="status-select">Status</Label>
                                <Select value={newStatus || ""} onValueChange={(val) => setNewStatus(val as RequestStatus)}>
                                    <SelectTrigger id="status-select"><SelectValue placeholder="Select a status" /></SelectTrigger>
                                    <SelectContent>{requestStatuses.map(status => <SelectItem key={status} value={status} className="capitalize">{status.replace('-', ' ')}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin-response">Admin Response</Label>
                                <Textarea id="admin-response" placeholder="Provide a response to the user..." value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleUpdateRequest} disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

    