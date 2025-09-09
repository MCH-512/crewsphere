"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { MessageSquare, Loader2, AlertTriangle, RefreshCw, Edit, ThumbsUp, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { StoredSuggestion, suggestionCategories, suggestionStatuses } from "@/schemas/suggestion-schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logAuditEvent } from "@/lib/audit-logger";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/components/custom/custom-sortable-header";

type SortableColumn = 'createdAt' | 'userEmail' | 'subject' | 'category' | 'upvoteCount' | 'status';
type SortDirection = 'asc' | 'desc';
type SuggestionStatus = StoredSuggestion["status"];
type SuggestionCategory = StoredSuggestion["category"];

export default function AdminSuggestionsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [suggestions, setSuggestions] = React.useState<StoredSuggestion[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [selectedSuggestion, setSelectedSuggestion] = React.useState<StoredSuggestion | null>(null);
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [newStatus, setNewStatus] = React.useState<StoredSuggestion["status"] | "">("");
    const [adminNotes, setAdminNotes] = React.useState("");
    const [isUpdating, setIsUpdating] = React.useState(false);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('createdAt');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
    const [searchTerm, setSearchTerm] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<SuggestionStatus | "all">("all");
    const [categoryFilter, setCategoryFilter] = React.useState<SuggestionCategory | "all">("all");

    const fetchSuggestions = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredSuggestion));
            setSuggestions(fetched);
        } catch (err) {
            console.error("Error fetching suggestions:", err);
            toast({ title: "Loading Error", description: "Could not fetch suggestions.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    const filteredAndSortedSuggestions = React.useMemo(() => {
        let filtered = suggestions.filter(s => {
            if (statusFilter !== "all" && s.status !== statusFilter) return false;
            if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
            if (searchTerm) {
                const lowercasedTerm = searchTerm.toLowerCase();
                return (
                    s.subject.toLowerCase().includes(lowercasedTerm) ||
                    (!s.isAnonymous && s.userEmail?.toLowerCase().includes(lowercasedTerm))
                );
            }
            return true;
        });

        return filtered.sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else {
                comparison = String(valA || '').localeCompare(String(valB || ''));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [suggestions, sortColumn, sortDirection, statusFilter, categoryFilter, searchTerm]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'createdAt' || column === 'upvoteCount' ? 'desc' : 'asc');
        }
    };

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
            } else {
                fetchSuggestions();
            }
        }
    }, [user, authLoading, router, fetchSuggestions]);
    
    const handleOpenManageDialog = (suggestion: StoredSuggestion) => {
        setSelectedSuggestion(suggestion);
        setNewStatus(suggestion.status);
        setAdminNotes(suggestion.adminNotes || "");
        setIsManageDialogOpen(true);
    };

    const handleUpdateSuggestion = async () => {
        if (!selectedSuggestion || !newStatus || !user) return;
        
        setIsUpdating(true);
        try {
            const suggestionRef = doc(db, "suggestions", selectedSuggestion.id);
            await updateDoc(suggestionRef, {
                status: newStatus,
                adminNotes: adminNotes,
            });

            await logAuditEvent({
                userId: user.uid,
                userEmail: user.email || "N/A",
                actionType: "UPDATE_SUGGESTION",
                entityType: "SUGGESTION",
                entityId: selectedSuggestion.id,
                details: { subject: selectedSuggestion.subject, newStatus: newStatus },
            });

            toast({ title: "Suggestion Updated", description: "Status and notes have been saved." });
            fetchSuggestions();
            setIsManageDialogOpen(false);
        } catch (error) {
            console.error("Error updating suggestion:", error);
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusBadgeVariant = (status: StoredSuggestion["status"]) => {
        switch (status) {
            case "new": return "secondary";
            case "under-review": return "outline";
            case "planned": return "default";
            case "implemented": return "success";
            case "rejected": return "destructive";
            default: return "secondary";
        }
    };

    if (authLoading || (isLoading && !user)) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
     if (!user || user.role !== 'admin') {
        return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><MessageSquare className="mr-3 h-7 w-7 text-primary" />Suggestion Box Management</CardTitle>
                        <CardDescription>Review, categorize, and manage all user suggestions.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={fetchSuggestions} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by subject or user..."
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
                                {suggestionStatuses.map(status => (
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
                                {suggestionCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading && suggestions.length === 0 ? (
                        <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/></div>
                    ) : filteredAndSortedSuggestions.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHeader column="createdAt" label="Submitted" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader column="userEmail" label="User" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader column="subject" label="Subject" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader column="upvoteCount" label="Upvotes" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndSortedSuggestions.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="text-xs">{format(s.createdAt.toDate(), "PPp")}</TableCell>
                                            <TableCell className="text-xs">
                                                {s.isAnonymous ? (
                                                    "Anonymous"
                                                ) : (
                                                    <Link href={`/admin/users/${s.userId}`} className="hover:underline text-primary">
                                                        {s.userEmail}
                                                    </Link>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium max-w-xs truncate" title={s.subject}>{s.subject}</TableCell>
                                            <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
                                            <TableCell className="flex items-center gap-1"><ThumbsUp className="h-4 w-4 text-muted-foreground"/>{s.upvoteCount}</TableCell>
                                            <TableCell><Badge variant={getStatusBadgeVariant(s.status)} className="capitalize">{s.status.replace('-', ' ')}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenManageDialog(s)}><Edit className="mr-1 h-4 w-4" />Manage</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No suggestions found matching your criteria.</p>
                    )}
                </CardContent>
            </Card>

            {selectedSuggestion && (
                <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Manage Suggestion</DialogTitle>
                            <DialogDescription>{selectedSuggestion.subject}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <p className="text-sm border p-3 rounded-md bg-muted/50">{selectedSuggestion.details}</p>
                            <div className="space-y-2">
                                <Label htmlFor="status-select">Status</Label>
                                <Select value={newStatus || ""} onValueChange={(val) => setNewStatus(val as StoredSuggestion["status"])}>
                                    <SelectTrigger id="status-select"><SelectValue placeholder="Select a status" /></SelectTrigger>
                                    <SelectContent>{suggestionStatuses.map(status => <SelectItem key={status} value={status} className="capitalize">{status.replace('-', ' ')}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin-notes">Admin Notes</Label>
                                <Textarea id="admin-notes" placeholder="Add internal notes about this suggestion..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleUpdateSuggestion} disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
