"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BadgeAlert, Loader2, RefreshCw, Edit, PlusCircle, Trash2, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { logAuditEvent } from "@/lib/audit-logger";
import { adminUserDocumentFormSchema, userDocumentTypes, type StoredUserDocument, type UserDocumentStatus, type AdminUserDocumentFormValues, getDocumentStatus, getStatusBadgeVariant } from "@/schemas/user-document-schema";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/custom/custom-sortable-header";

const EXPIRY_WARNING_DAYS = 30;

type SortableColumn = 'userEmail' | 'documentName' | 'expiryDate' | 'status' | 'lastUpdatedAt';
type SortDirection = 'asc' | 'desc';

const statusOrder: Record&lt;UserDocumentStatus, number&gt; = { 'expired': 0, 'expiring-soon': 1, 'pending-validation': 2, 'approved': 3 };

export default function AdminExpiryManagementPage() {
    const { user: adminUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [documents, setDocuments] = React.useState&lt;StoredUserDocument[]&gt;([]);
    const [users, setUsers] = React.useState&lt;User[]&gt;([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentDocument, setCurrentDocument] = React.useState&lt;StoredUserDocument | null&gt;(null);

    const [searchTerm, setSearchTerm] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState&lt;UserDocumentStatus | "all"&gt;("all");
    const [sortColumn, setSortColumn] = React.useState&lt;SortableColumn&gt;('expiryDate');
    const [sortDirection, setSortDirection] = React.useState&lt;SortDirection&gt;('asc');

    const form = useForm&lt;AdminUserDocumentFormValues&gt;({
        resolver: zodResolver(adminUserDocumentFormSchema),
        defaultValues: { userId: "", documentName: "", documentType: undefined, issueDate: "", expiryDate: "", notes: "" },
        mode: "onBlur",
    });

    const fetchPageData = React.useCallback(async () =&gt; {
        setIsLoading(true);
        try {
            const usersQuery = query(collection(db, "users"), orderBy("email", "asc"));
            const docsQuery = query(collection(db, "userDocuments"), orderBy("expiryDate", "asc"));
            
            const [usersSnapshot, docsSnapshot] = await Promise.all([getDocs(usersQuery), getDocs(docsQuery)]);
            
            setUsers(usersSnapshot.docs.map(doc =&gt; ({ uid: doc.id, ...doc.data() } as User)));
            setDocuments(docsSnapshot.docs.map(doc =&gt; ({ id: doc.id, ...doc.data() } as StoredUserDocument)));
        } catch (err: unknown) {
            toast({ title: "Loading Error", description: "Could not fetch users and documents.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() =&gt; {
        if (!authLoading) {
            if (!adminUser || adminUser.role !== 'admin') router.push('/');
            else fetchPageData();
        }
    }, [adminUser, authLoading, router, fetchPageData]);
    
    const sortedAndFilteredDocuments = React.useMemo(() =&gt; {
        const processedDocs = documents.filter(doc =&gt; {
            const status = getDocumentStatus(doc, EXPIRY_WARNING_DAYS);
            if (statusFilter !== 'all' &amp;&amp; status !== statusFilter) return false;
            
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                return (
                    doc.userEmail.toLowerCase().includes(lowerTerm) ||
                    doc.documentName.toLowerCase().includes(lowerTerm)
                );
            }
            return true;
        });

        return processedDocs.sort((a, b) =&gt; {
            let valA: string | number | Date | Timestamp = a[sortColumn];
            let valB: string | number | Date | Timestamp = b[sortColumn];

            if (sortColumn === 'status') {
                valA = statusOrder[getDocumentStatus(a, EXPIRY_WARNING_DAYS)];
                valB = statusOrder[getDocumentStatus(b, EXPIRY_WARNING_DAYS)];
            } else if (valA instanceof Timestamp &amp;&amp; valB instanceof Timestamp) {
                valA = valA.toMillis();
                valB = valB.toMillis();
            } else {
                 comparison = String(valA).localeCompare(String(valB));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [documents, statusFilter, searchTerm, sortColumn, sortDirection]);

    const handleSort = (column: SortableColumn) =&gt; {
        if (sortColumn === column) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'expiryDate' ? 'asc' : 'desc');
        }
    };

    const handleOpenDialog = (docToEdit?: StoredUserDocument) =&gt; {
        if (docToEdit) {
            setIsEditMode(true);
            setCurrentDocument(docToEdit);
            form.reset({
                userId: docToEdit.userId,
                documentName: docToEdit.documentName,
                documentType: docToEdit.documentType,
                issueDate: format(docToEdit.issueDate.toDate(), 'yyyy-MM-dd'),
                expiryDate: format(docToEdit.expiryDate.toDate(), 'yyyy-MM-dd'),
                notes: docToEdit.notes || "",
            });
        } else {
            setIsEditMode(false);
            setCurrentDocument(null);
            form.reset({ userId: "", documentName: "", documentType: undefined, issueDate: "", expiryDate: "", notes: "" });
        }
        setIsManageDialogOpen(true);
    };

    const handleFormSubmit = async (data: AdminUserDocumentFormValues) =&gt; {
        if (!adminUser) return;
        setIsSubmitting(true);
        try {
            const selectedUser = users.find(u =&gt; u.uid === data.userId);
            if (!selectedUser) throw new Error("Selected user not found.");

            const documentData = {
                ...data,
                issueDate: new Date(data.issueDate),
                expiryDate: new Date(data.expiryDate),
                userEmail: selectedUser.email,
                lastUpdatedAt: serverTimestamp(),
                adminLastUpdatedBy: adminUser.uid,
                status: 'approved', // Admin actions are auto-approved
            };

            if (isEditMode &amp;&amp; currentDocument) {
                const docRef = doc(db, "userDocuments", currentDocument.id);
                await updateDoc(docRef, documentData);
                await logAuditEvent({ userId: adminUser.uid, userEmail: adminUser.email!, actionType: "UPDATE_DOCUMENT", entityType: "USER_DOCUMENT", entityId: currentDocument.id, details: { user: selectedUser.email, doc: data.documentName } });
                toast({ title: "Document Updated", description: "The user's document has been updated." });
            } else {
                const newDocRef = await addDoc(collection(db, "userDocuments"), { ...documentData, createdAt: serverTimestamp() });
                await logAuditEvent({ userId: adminUser.uid, userEmail: adminUser.email!, actionType: "CREATE_DOCUMENT", entityType: "USER_DOCUMENT", entityId: newDocRef.id, details: { user: selectedUser.email, doc: data.documentName } });
                toast({ title: "Document Added", description: "The user's document has been added." });
            }
            fetchPageData();
            setIsManageDialogOpen(false);
        } catch (error: unknown) {
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (docToDelete: StoredUserDocument) =&gt; {
        if (!adminUser || !window.confirm(`Are you sure you want to delete "${docToDelete.documentName}" for ${docToDelete.userEmail}?`)) return;
        try {
            await deleteDoc(doc(db, "userDocuments", docToDelete.id));
            await logAuditEvent({ userId: adminUser.uid, userEmail: adminUser.email!, actionType: "DELETE_DOCUMENT", entityType: "USER_DOCUMENT", entityId: docToDelete.id, details: { user: docToDelete.userEmail, doc: docToDelete.documentName } });
            toast({ title: "Document Deleted", description: "The document has been removed." });
            fetchPageData();
        } catch (error: unknown) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    if (authLoading || isLoading) return &lt;div className="flex items-center justify-center min-h-screen"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;

    const getStatusRowClass = (status: UserDocumentStatus) =&gt; {
        if (status === 'expired') return 'bg-destructive/10';
        if (status === 'expiring-soon') return 'bg-yellow-400/10';
        if (status === 'pending-validation') return 'bg-blue-400/10';
        return '';
    }

    return (
        &lt;div className="space-y-6"&gt;
            &lt;Card className="shadow-lg"&gt;
                &lt;CardHeader className="flex flex-row justify-between items-start"&gt;
                    &lt;div&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;BadgeAlert className="mr-3 h-7 w-7 text-primary" /&gt;Expiry Management&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Track and manage expiry dates for all user documents and licenses.&lt;/CardDescription&gt;
                    &lt;/div&gt;
                    &lt;div className="flex gap-2"&gt;
                        &lt;Button variant="outline" onClick={fetchPageData} disabled={isLoading}&gt;&lt;RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /&gt;Refresh&lt;/Button&gt;
                        &lt;Button onClick={() =&gt; handleOpenDialog()}&gt;&lt;PlusCircle className="mr-2 h-4 w-4" /&gt;Add Document&lt;/Button&gt;
                    &lt;/div&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    &lt;div className="flex flex-col md:flex-row gap-4 mb-6"&gt;
                        &lt;div className="relative flex-grow"&gt;
                            &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                            &lt;Input type="search" placeholder="Search by user or document name..." className="pl-8 w-full" value={searchTerm} onChange={(e) =&gt; setSearchTerm(e.target.value)} /&gt;
                        &lt;/div&gt;
                        &lt;Select value={statusFilter} onValueChange={(value) =&gt; setStatusFilter(value as UserDocumentStatus | "all")}&gt;
                            &lt;SelectTrigger className="w-full md:w-[200px]"&gt;&lt;Filter className="mr-2 h-4 w-4 text-muted-foreground" /&gt;&lt;SelectValue placeholder="Filter by status" /&gt;&lt;/SelectTrigger&gt;
                            &lt;SelectContent&gt;
                                &lt;SelectItem value="all"&gt;All Statuses&lt;/SelectItem&gt;
                                &lt;SelectItem value="approved"&gt;Approved&lt;/SelectItem&gt;
                                &lt;SelectItem value="pending-validation"&gt;Pending Validation&lt;/SelectItem&gt;
                                &lt;SelectItem value="expiring-soon"&gt;Expiring Soon&lt;/SelectItem&gt;
                                &lt;SelectItem value="expired"&gt;Expired&lt;/SelectItem&gt;
                            &lt;/SelectContent&gt;
                        &lt;/Select&gt;
                    &lt;/div&gt;

                    &lt;div className="rounded-md border"&gt;
                    &lt;Table&gt;
                        &lt;TableHeader&gt;&lt;TableRow&gt;
                            &lt;SortableHeader&lt;SortableColumn&gt; column="userEmail" label="User" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                            &lt;SortableHeader&lt;SortableColumn&gt; column="documentName" label="Document" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                            &lt;SortableHeader&lt;SortableColumn&gt; column="expiryDate" label="Expires On" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                            &lt;SortableHeader&lt;SortableColumn&gt; column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                            &lt;SortableHeader&lt;SortableColumn&gt; column="lastUpdatedAt" label="Last Updated" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                            &lt;TableHead&gt;Actions&lt;/TableHead&gt;
                        &lt;/TableRow&gt;&lt;/TableHeader&gt;
                        &lt;TableBody&gt;
                            {sortedAndFilteredDocuments.map(d =&gt; {
                                const status = getDocumentStatus(d, EXPIRY_WARNING_DAYS);
                                return (
                                &lt;TableRow key={d.id} className={getStatusRowClass(status)}&gt;
                                    &lt;TableCell className="font-medium text-xs max-w-xs truncate"&gt;{d.userEmail}&lt;/TableCell&gt;
                                    &lt;TableCell className="text-xs"&gt;{d.documentName} &lt;span className="text-muted-foreground"&gt;({d.documentType})&lt;/span&gt;&lt;/TableCell&gt;
                                    &lt;TableCell className="text-xs font-mono"&gt;{format(d.expiryDate.toDate(), "PP")}&lt;/TableCell&gt;
                                    &lt;TableCell&gt;
                                        &lt;Badge variant={getStatusBadgeVariant(status)} className="capitalize"&gt;{status.replace('-', ' ')}&lt;/Badge&gt;
                                    &lt;/TableCell&gt;
                                    &lt;TableCell className="text-xs"&gt;{format(d.lastUpdatedAt.toDate(), "PPp")}&lt;/TableCell&gt;
                                    &lt;TableCell className="space-x-1"&gt;
                                        &lt;Button variant="ghost" size="icon" onClick={() =&gt; handleOpenDialog(d)}&gt;&lt;Edit className="h-4 w-4" /&gt;&lt;/Button&gt;
                                        &lt;Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() =&gt; handleDelete(d)}&gt;&lt;Trash2 className="h-4 w-4" /&gt;&lt;/Button&gt;
                                    &lt;/TableCell&gt;
                                &lt;/TableRow&gt;
                            )})}
                        &lt;/TableBody&gt;
                    &lt;/Table&gt;
                    &lt;/div&gt;
                    {sortedAndFilteredDocuments.length === 0 &amp;&amp; &lt;p className="text-center text-muted-foreground p-8"&gt;No documents found matching criteria.&lt;/p&gt;}
                &lt;/CardContent&gt;
            &lt;/Card&gt;

            &lt;Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}&gt;
                &lt;DialogContent&gt;
                    &lt;DialogHeader&gt;
                        &lt;DialogTitle&gt;{isEditMode ? "Edit Document" : "Add New Document"}&lt;/DialogTitle&gt;
                        &lt;DialogDescription&gt;{isEditMode ? "Update document details." : "Add a new trackable document for a user. Files cannot be uploaded from here."}&lt;/DialogDescription&gt;
                    &lt;/DialogHeader&gt;
                    &lt;Form {...form}&gt;
                        &lt;form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4"&gt;
                            &lt;FormField control={form.control} name="userId" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;User&lt;/FormLabel&gt;&lt;Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}&gt;&lt;FormControl&gt;&lt;SelectTrigger&gt;&lt;SelectValue placeholder="Select a user"/&gt;&lt;/SelectTrigger&gt;&lt;/FormControl&gt;&lt;SelectContent&gt;{users.map(u =&gt; &lt;SelectItem key={u.uid} value={u.uid}&gt;{u.email}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;&lt;/Select&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;FormField control={form.control} name="documentType" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Document Type&lt;/FormLabel&gt;&lt;Select onValueChange={field.onChange} value={field.value}&gt;&lt;FormControl&gt;&lt;SelectTrigger&gt;&lt;SelectValue placeholder="Select a type"/&gt;&lt;/SelectTrigger&gt;&lt;/FormControl&gt;&lt;SelectContent&gt;{userDocumentTypes.map(t =&gt; &lt;SelectItem key={t} value={t}&gt;{t}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;&lt;/Select&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;FormField control={form.control} name="documentName" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Document Name&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input {...field} placeholder="e.g., Passport, Medical Class 1" /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;div className="grid grid-cols-2 gap-4"&gt;
                                &lt;FormField control={form.control} name="issueDate" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Issue Date&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input type="date" {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                                &lt;FormField control={form.control} name="expiryDate" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Expiry Date&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input type="date" {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;/div&gt;
                            &lt;FormField control={form.control} name="notes" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Notes (Optional)&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Textarea {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;DialogFooter&gt;
                                &lt;DialogClose asChild&gt;&lt;Button type="button" variant="outline"&gt;Cancel&lt;/Button&gt;&lt;/DialogClose&gt;
                                &lt;Button type="submit" disabled={isSubmitting}&gt;{isSubmitting &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}{isEditMode ? "Save Changes" : "Add Document"}&lt;/Button&gt;
                            &lt;/DialogFooter&gt;
                        &lt;/form&gt;
                    &lt;/Form&gt;
                &lt;/DialogContent&gt;
            &lt;/Dialog&gt;
        &lt;/div&gt;
    );
}
