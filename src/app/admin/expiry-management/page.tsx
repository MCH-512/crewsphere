
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BadgeAlert, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { logAuditEvent } from "@/lib/audit-logger";
import { adminUserDocumentFormSchema, userDocumentTypes, type StoredUserDocument, type UserDocumentStatus, type AdminUserDocumentFormValues, getDocumentStatus, getStatusBadgeVariant } from "@/schemas/user-document-schema";
import { Badge } from "@/components/ui/badge";
import { SortableHeader } from "@/components/custom/custom-sortable-header";

const EXPIRY_WARNING_DAYS = 30;

type SortableColumn = 'userEmail' | 'documentName' | 'expiryDate' | 'status' | 'lastUpdatedAt';
type SortDirection = 'asc' | 'desc';

const statusOrder: Record<UserDocumentStatus, number> = { 'expired': 0, 'expiring-soon': 1, 'pending-validation': 2, 'approved': 3 };

export default function AdminExpiryManagementPage() {
    const { user: adminUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [documents, setDocuments] = React.useState<StoredUserDocument[]>([]);
    const [users, setUsers] = React.useState<User[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentDocument, setCurrentDocument] = React.useState<StoredUserDocument | null>(null);

    const [searchTerm, setSearchTerm] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<UserDocumentStatus | "all">("all");
    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('expiryDate');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');

    const form = useForm<AdminUserDocumentFormValues>({
        resolver: zodResolver(adminUserDocumentFormSchema),
        defaultValues: { userId: "", documentName: "", documentType: undefined, issueDate: "", expiryDate: "", notes: "" },
        mode: "onBlur",
    });

    const fetchPageData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const usersQuery = query(collection(db, "users"), orderBy("email", "asc"));
            const docsQuery = query(collection(db, "userDocuments"), orderBy("expiryDate", "asc"));
            
            const [usersSnapshot, docsSnapshot] = await Promise.all([getDocs(usersQuery), getDocs(docsQuery)]);
            
            setUsers(usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
            setDocuments(docsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserDocument)));
        } catch (err) {
            toast({ title: "Loading Error", description: "Could not fetch users and documents.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!adminUser || adminUser.role !== 'admin') router.push('/');
            else fetchPageData();
        }
    }, [adminUser, authLoading, router, fetchPageData]);
    
    const sortedAndFilteredDocuments = React.useMemo(() => {
        let processedDocs = documents.filter(doc => {
            const status = getDocumentStatus(doc, EXPIRY_WARNING_DAYS);
            if (statusFilter !== 'all' && status !== statusFilter) return false;
            
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                return (
                    doc.userEmail.toLowerCase().includes(lowerTerm) ||
                    doc.documentName.toLowerCase().includes(lowerTerm)
                );
            }
            return true;
        });

        return processedDocs.sort((a, b) => {
            let valA: string | number | Date | Timestamp = a[sortColumn];
            let valB: string | number | Date | Timestamp = b[sortColumn];

            if (sortColumn === 'status') {
                valA = statusOrder[getDocumentStatus(a, EXPIRY_WARNING_DAYS)];
                valB = statusOrder[getDocumentStatus(b, EXPIRY_WARNING_DAYS)];
            } else if (valA instanceof Timestamp && valB instanceof Timestamp) {
                valA = valA.toMillis();
                valB = valB.toMillis();
            }

            let comparison = 0;
            if (typeof valA === 'string' && typeof valB === 'string') {
                comparison = valA.localeCompare(valB);
            } else if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else {
                 comparison = String(valA).localeCompare(String(valB));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [documents, statusFilter, searchTerm, sortColumn, sortDirection]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'expiryDate' ? 'asc' : 'desc');
        }
    };

    const handleOpenDialog = (docToEdit?: StoredUserDocument) => {
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

    const handleFormSubmit = async (data: AdminUserDocumentFormValues) => {
        if (!adminUser) return;
        setIsSubmitting(true);
        try {
            const selectedUser = users.find(u => u.uid === data.userId);
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

            if (isEditMode && currentDocument) {
                const docRef = doc(db, "userDocuments", currentDocument.id);
                await updateDoc(docRef, documentData as any);
                await logAuditEvent({ userId: adminUser.uid, userEmail: adminUser.email!, actionType: "UPDATE_DOCUMENT", entityType: "USER_DOCUMENT", entityId: currentDocument.id, details: { user: selectedUser.email, doc: data.documentName } });
                toast({ title: "Document Updated", description: "The user's document has been updated." });
            } else {
                const newDocRef = await addDoc(collection(db, "userDocuments"), { ...documentData, createdAt: serverTimestamp() });
                await logAuditEvent({ userId: adminUser.uid, userEmail: adminUser.email!, actionType: "CREATE_DOCUMENT", entityType: "USER_DOCUMENT", entityId: newDocRef.id, details: { user: selectedUser.email, doc: data.documentName } });
                toast({ title: "Document Added", description: "The user's document has been added." });
            }
            fetchPageData();
            setIsManageDialogOpen(false);
        } catch (error) {
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (docToDelete: StoredUserDocument) => {
        if (!adminUser || !window.confirm(`Are you sure you want to delete "${docToDelete.documentName}" for ${docToDelete.userEmail}?`)) return;
        try {
            await deleteDoc(doc(db, "userDocuments", docToDelete.id));
            await logAuditEvent({ userId: adminUser.uid, userEmail: adminUser.email!, actionType: "DELETE_DOCUMENT", entityType: "USER_DOCUMENT", entityId: docToDelete.id, details: { user: docToDelete.userEmail, doc: docToDelete.documentName } });
            toast({ title: "Document Deleted", description: "The document has been removed." });
            fetchPageData();
        } catch (error) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

    const getStatusRowClass = (status: UserDocumentStatus) => {
        if (status === 'expired') return 'bg-destructive/10';
        if (status === 'expiring-soon') return 'bg-yellow-400/10';
        if (status === 'pending-validation') return 'bg-blue-400/10';
        return '';
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><BadgeAlert className="mr-3 h-7 w-7 text-primary" />Expiry Management</CardTitle>
                        <CardDescription>Track and manage expiry dates for all user documents and licenses.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchPageData} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" />Add Document</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="search" placeholder="Search by user or document name..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[200px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Filter by status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="pending-validation">Pending Validation</SelectItem>
                                <SelectItem value="expiring-soon">Expiring Soon</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-md border">
                    <Table>
                        <TableHeader><TableRow>
                            <SortableHeader<SortableColumn> column="userEmail" label="User" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader<SortableColumn> column="documentName" label="Document" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader<SortableColumn> column="expiryDate" label="Expires On" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader<SortableColumn> column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <SortableHeader<SortableColumn> column="lastUpdatedAt" label="Last Updated" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                            <TableHead>Actions</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {sortedAndFilteredDocuments.map(d => {
                                const status = getDocumentStatus(d, EXPIRY_WARNING_DAYS);
                                return (
                                <TableRow key={d.id} className={getStatusRowClass(status)}>
                                    <TableCell className="font-medium text-xs max-w-xs truncate">{d.userEmail}</TableCell>
                                    <TableCell className="text-xs">{d.documentName} <span className="text-muted-foreground">({d.documentType})</span></TableCell>
                                    <TableCell className="text-xs font-mono">{format(d.expiryDate.toDate(), "PP")}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusBadgeVariant(status)} className="capitalize">{status.replace('-', ' ')}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">{format(d.lastUpdatedAt.toDate(), "PPp")}</TableCell>
                                    <TableCell className="space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(d)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(d)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                    </div>
                    {sortedAndFilteredDocuments.length === 0 && <p className="text-center text-muted-foreground p-8">No documents found matching criteria.</p>}
                </CardContent>
            </Card>

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Document" : "Add New Document"}</DialogTitle>
                        <DialogDescription>{isEditMode ? "Update document details." : "Add a new trackable document for a user. Files cannot be uploaded from here."}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                            <FormField control={form.control} name="userId" render={({ field }) => <FormItem><FormLabel>User</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}><FormControl><SelectTrigger><SelectValue placeholder="Select a user"/></SelectTrigger></FormControl><SelectContent>{users.map(u => <SelectItem key={u.uid} value={u.uid}>{u.email}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                            <FormField control={form.control} name="documentType" render={({ field }) => <FormItem><FormLabel>Document Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a type"/></SelectTrigger></FormControl><SelectContent>{userDocumentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                            <FormField control={form.control} name="documentName" render={({ field }) => <FormItem><FormLabel>Document Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Passport, Medical Class 1" /></FormControl><FormMessage /></FormItem>} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="issueDate" render={({ field }) => <FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={form.control} name="expiryDate" render={({ field }) => <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
                            </div>
                            <FormField control={form.control} name="notes" render={({ field }) => <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditMode ? "Save Changes" : "Add Document"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
