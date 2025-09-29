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
import { MessageSquare, Loader2, AlertTriangle, Edit, ThumbsUp, Filter, Search } from "lucide-react";
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

    React.useEffect(() =&gt; {
        if (!user) return;
        setIsLoading(true);
        const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
        
        const unsubscribe = onSnapshot(q,
            (snapshot) =&gt; {
                const fetchedSuggestions = snapshot.docs.map(doc =&gt; ({ id: doc.id, ...doc.data() } as StoredSuggestion));
                setSuggestions(fetchedSuggestions);
                setIsLoading(false);
            },
            (err) =&gt; {
                console.error("Error fetching suggestions in real-time:", err);
                toast({ title: "Real-time Error", description: "Could not fetch suggestion updates.", variant: "destructive" });
                setIsLoading(false);
            }
        );
        
        return () =&gt; unsubscribe();
    }, [user, toast]);
    
    const filteredAndSortedSuggestions = React.useMemo(() =&gt; {
        const filtered = suggestions.filter(s =&gt; {
            if (statusFilter !== "all" &amp;&amp; s.status !== statusFilter) return false;
            if (categoryFilter !== "all" &amp;&amp; s.category !== categoryFilter) return false;
            if (searchTerm) {
                const lowercasedTerm = searchTerm.toLowerCase();
                return (
                    s.subject.toLowerCase().includes(lowercasedTerm) ||
                    (!s.isAnonymous &amp;&amp; s.userEmail?.toLowerCase().includes(lowercasedTerm))
                );
            }
            return true;
        });

        return filtered.sort((a, b) =&gt; {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (valA instanceof Timestamp &amp;&amp; valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else if (typeof valA === 'number' &amp;&amp; typeof valB === 'number') {
                comparison = valA - valB;
            } else {
                comparison = String(valA || '').localeCompare(String(valB || ''));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [suggestions, sortColumn, sortDirection, statusFilter, categoryFilter, searchTerm]);

    const handleSort = (column: SortableColumn) =&gt; {
        if (sortColumn === column) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'createdAt' || column === 'upvoteCount' ? 'desc' : 'asc');
        }
    };

    React.useEffect(() =&gt; {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
            }
        }
    }, [user, authLoading, router]);
    
    const handleOpenManageDialog = (suggestion: StoredSuggestion) =&gt; {
        setSelectedSuggestion(suggestion);
        setNewStatus(suggestion.status);
        setAdminNotes(suggestion.adminNotes || "");
        setIsManageDialogOpen(true);
    };

    const handleUpdateSuggestion = async () =&gt; {
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
            setIsManageDialogOpen(false);
        } catch (error) {
            console.error("Error updating suggestion:", error);
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusBadgeVariant = (status: StoredSuggestion["status"]) =&gt; {
        switch (status) {
            case "new": return "secondary";
            case "under-review": return "outline";
            case "planned": return "default";
            case "implemented": return "success";
            case "rejected": return "destructive";
            default: return "secondary";
        }
    };

    if (authLoading || isLoading) {
        return &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;
    }
     if (!user || user.role !== 'admin') {
        return &lt;div className="flex flex-col items-center justify-center min-h-screen text-center p-4"&gt;&lt;AlertTriangle className="h-16 w-16 text-destructive mb-4" /&gt;&lt;CardTitle className="text-2xl mb-2"&gt;Access Denied&lt;/CardTitle&gt;&lt;p className="text-muted-foreground"&gt;You do not have permission to view this page.&lt;/p&gt;&lt;Button onClick={() =&gt; router.push('/')} className="mt-6"&gt;Go to Dashboard&lt;/Button&gt;&lt;/div&gt;;
    }

    return (
        &lt;div className="space-y-6"&gt;
            &lt;Card className="shadow-lg"&gt;
                &lt;CardHeader className="flex flex-row justify-between items-start"&gt;
                    &lt;div&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;MessageSquare className="mr-3 h-7 w-7 text-primary" /&gt;Suggestion Box Management&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Review, categorize, and manage all user suggestions.&lt;/CardDescription&gt;
                    &lt;/div&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    &lt;div className="flex flex-col md:flex-row gap-4 mb-6"&gt;
                        &lt;div className="relative flex-grow"&gt;
                            &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                            &lt;Input
                                type="search"
                                placeholder="Search by subject or user..."
                                className="pl-8 w-full md:max-w-xs"
                                value={searchTerm}
                                onChange={(e) =&gt; setSearchTerm(e.target.value)}
                            /&gt;
                        &lt;/div&gt;
                        &lt;Select value={statusFilter} onValueChange={(value) =&gt; setStatusFilter(value as SuggestionStatus | "all")}&gt;
                            &lt;SelectTrigger className="w-full md:w-[180px]"&gt;
                                &lt;Filter className="mr-2 h-4 w-4" /&gt;
                                &lt;SelectValue placeholder="Filter by status" /&gt;
                            &lt;/SelectTrigger&gt;
                            &lt;SelectContent&gt;
                                &lt;SelectItem value="all"&gt;All Statuses&lt;/SelectItem&gt;
                                {suggestionStatuses.map(status =&gt; (
                                    &lt;SelectItem key={status} value={status} className="capitalize"&gt;{status.replace('-', ' ')}&lt;/SelectItem&gt;))}&lt;/SelectContent&gt;
                        &lt;/Select&gt;
                        &lt;Select value={categoryFilter} onValueChange={(value) =&gt; setCategoryFilter(value as SuggestionCategory | "all")}&gt;
                            &lt;SelectTrigger className="w-full md:w-[220px]"&gt;
                                &lt;Filter className="mr-2 h-4 w-4" /&gt;
                                &lt;SelectValue placeholder="Filter by category" /&gt;
                            &lt;/SelectTrigger&gt;
                            &lt;SelectContent&gt;
                                &lt;SelectItem value="all"&gt;All Categories&lt;/SelectItem&gt;
                                {suggestionCategories.map(cat =&gt; (
                                    &lt;SelectItem key={cat} value={cat}&gt;{cat}&lt;/SelectItem&gt;))}&lt;/SelectContent&gt;
                        &lt;/Select&gt;
                    &lt;/div&gt;

                    {isLoading &amp;&amp; suggestions.length === 0 ? (
                        &lt;div className="text-center py-8"&gt;&lt;Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/&gt;&lt;/div&gt;
                    ) : filteredAndSortedSuggestions.length &gt; 0 ? (
                        &lt;div className="rounded-md border"&gt;
                            &lt;Table&gt;
                                &lt;TableHeader&gt;
                                    &lt;TableRow&gt;
                                        &lt;SortableHeader&lt;SortableColumn&gt; column="createdAt" label="Submitted" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                                        &lt;SortableHeader&lt;SortableColumn&gt; column="userEmail" label="User" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                                        &lt;SortableHeader&lt;SortableColumn&gt; column="subject" label="Subject" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                                        &lt;SortableHeader&lt;SortableColumn&gt; column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                                        &lt;SortableHeader&lt;SortableColumn&gt; column="upvoteCount" label="Upvotes" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                                        &lt;SortableHeader&lt;SortableColumn&gt; column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                                        &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                                    &lt;/TableRow&gt;
                                &lt;/TableHeader&gt;
                                &lt;TableBody&gt;
                                    {filteredAndSortedSuggestions.map((s) =&gt; (
                                        &lt;TableRow key={s.id}&gt;
                                            &lt;TableCell className="text-xs"&gt;{s.createdAt ? format(s.createdAt.toDate(), "PPp") : 'N/A'}&lt;/TableCell&gt;
                                            &lt;TableCell className="text-xs"&gt;
                                                {s.isAnonymous ? (
                                                    "Anonymous"
                                                ) : (
                                                    &lt;Link href={`/admin/users/${s.userId}`} className="hover:underline text-primary"&gt;
                                                        {s.userEmail}
                                                    &lt;/Link&gt;
                                                )}
                                            &lt;/TableCell&gt;
                                            &lt;TableCell className="font-medium max-w-xs truncate" title={s.subject}&gt;{s.subject}&lt;/TableCell&gt;
                                            &lt;TableCell&gt;&lt;Badge variant="outline"&gt;{s.category}&lt;/Badge&gt;&lt;/TableCell&gt;
                                            &lt;TableCell className="flex items-center gap-1"&gt;&lt;ThumbsUp className="h-4 w-4 text-muted-foreground"/&gt;{s.upvoteCount}&lt;/TableCell&gt;
                                            &lt;TableCell&gt;&lt;Badge variant={getStatusBadgeVariant(s.status)} className="capitalize"&gt;{s.status.replace('-', ' ')}&lt;/Badge&gt;&lt;/TableCell&gt;
                                            &lt;TableCell className="text-right"&gt;
                                                &lt;Button variant="ghost" size="sm" onClick={() =&gt; handleOpenManageDialog(s)}&gt;&lt;Edit className="mr-1 h-4 w-4" /&gt;Manage&lt;/Button&gt;
                                            &lt;/TableCell&gt;
                                        &lt;/TableRow&gt;
                                    ))}&lt;/TableBody&gt;
                            &lt;/Table&gt;
                        &lt;/div&gt;
                    ) : (
                        &lt;p className="text-center text-muted-foreground py-8"&gt;No suggestions found matching your criteria.&lt;/p&gt;
                    )}
                &lt;/CardContent&gt;
            &lt;/Card&gt;

            {selectedSuggestion &amp;&amp; (
                &lt;Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}&gt;
                    &lt;DialogContent className="sm:max-w-lg"&gt;
                        &lt;DialogHeader&gt;
                            &lt;DialogTitle&gt;Manage Suggestion&lt;/DialogTitle&gt;
                            &lt;DialogDescription&gt;{selectedSuggestion.subject}&lt;/DialogDescription&gt;
                        &lt;/DialogHeader&gt;
                        &lt;div className="py-4 space-y-4"&gt;
                            &lt;p className="text-sm border p-3 rounded-md bg-muted/50"&gt;{selectedSuggestion.details}&lt;/p&gt;
                            &lt;div className="space-y-2"&gt;
                                &lt;Label htmlFor="status-select"&gt;Status&lt;/Label&gt;
                                &lt;Select value={newStatus || ""} onValueChange={(val) =&gt; setNewStatus(val as StoredSuggestion["status"])}&gt;
                                    &lt;SelectTrigger id="status-select"&gt;&lt;SelectValue placeholder="Select a status" /&gt;&lt;/SelectTrigger&gt;
                                    &lt;SelectContent&gt;{suggestionStatuses.map(status =&gt; &lt;SelectItem key={status} value={status} className="capitalize"&gt;{status.replace('-', ' ')}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;
                                &lt;/Select&gt;
                            &lt;/div&gt;
                            &lt;div className="space-y-2"&gt;
                                &lt;Label htmlFor="admin-notes"&gt;Admin Notes&lt;/Label&gt;
                                &lt;Textarea id="admin-notes" placeholder="Add internal notes about this suggestion..." value={adminNotes} onChange={(e) =&gt; setAdminNotes(e.target.value)} /&gt;
                            &lt;/div&gt;
                        &lt;/div&gt;
                        &lt;DialogFooter&gt;
                            &lt;DialogClose asChild&gt;&lt;Button variant="outline"&gt;Cancel&lt;/Button&gt;&lt;/DialogClose&gt;
                            &lt;Button onClick={handleUpdateSuggestion} disabled={isUpdating}&gt;{isUpdating &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}Save Changes&lt;/Button&gt;
                        &lt;/DialogFooter&gt;
                    &lt;/DialogContent&gt;
                &lt;/Dialog&gt;
            )}
        &lt;/div&gt;
    );
}
