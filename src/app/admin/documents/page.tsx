
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
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, writeBatch, serverTimestamp, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import { Library, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Download, Search, Filter, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StoredDocument, documentFormSchema, documentEditFormSchema, documentCategories } from "@/schemas/document-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import Link from "next/link";
import { z } from "zod";
import { SortableHeader } from "@/components/custom/custom-sortable-header";

type ManageDocumentFormValues = z.infer<typeof documentFormSchema>;
type ManageDocumentEditFormValues = z.infer<typeof documentEditFormSchema>;

type SortableColumn = 'title' | 'category' | 'version' | 'lastUpdated' | 'uploaderEmail';
type SortDirection = 'asc' | 'desc';
type DocumentCategory = StoredDocument["category"];

export default function AdminDocumentsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [documents, setDocuments] = React.useState<StoredDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentDocument, setCurrentDocument] = React.useState<StoredDocument | null>(null);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('lastUpdated');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
    
    const [searchTerm, setSearchTerm] = React.useState("");
    const [categoryFilter, setCategoryFilter] = React.useState<DocumentCategory | "all">("all");

    const form = useForm<ManageDocumentFormValues>({
        resolver: zodResolver(isEditMode ? documentEditFormSchema : documentFormSchema),
        defaultValues: { title: "", description: "", category: undefined, version: "", file: undefined },
    });

    const fetchDocuments = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "documents"), orderBy("lastUpdated", "desc"));
            const querySnapshot = await getDocs(q);
            setDocuments(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredDocument)));
        } catch (err) {
            toast({ title: "Loading Error", description: "Could not fetch documents.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchDocuments();
        }
    }, [user, authLoading, router, fetchDocuments]);

    const sortedDocuments = React.useMemo(() => {
        const filteredDocs = documents.filter(doc => {
            if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
            if (searchTerm && !doc.title.toLowerCase().includes(searchTerm.toLowerCase()) && !doc.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

        return filteredDocs.sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [documents, sortColumn, sortDirection, searchTerm, categoryFilter]);
    
    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleOpenDialog = (docToEdit?: StoredDocument) => {
        if (docToEdit) {
            setIsEditMode(true);
            setCurrentDocument(docToEdit);
            form.reset({
                title: docToEdit.title,
                description: docToEdit.description,
                category: docToEdit.category,
                version: docToEdit.version,
                file: undefined,
            });
        } else {
            setIsEditMode(false);
            setCurrentDocument(null);
            form.reset({ title: "", description: "", category: undefined, version: "", file: undefined });
        }
        setIsManageDialogOpen(true);
    };

    const handleFormSubmit = async (data: ManageDocumentFormValues | ManageDocumentEditFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            let fileURL = currentDocument?.fileURL;
            let filePath = currentDocument?.filePath;
            let fileName = currentDocument?.fileName;
            let fileType = currentDocument?.fileType;

            const file = data.file?.[0];
            if (file) {
                if (isEditMode && currentDocument?.filePath) {
                    await deleteObject(ref(storage, currentDocument.filePath));
                }
                const newFilePath = `documents/${Date.now()}-${file.name}`;
                const storageRef = ref(storage, newFilePath);
                await uploadBytes(storageRef, file);
                fileURL = await getDownloadURL(storageRef);
                filePath = newFilePath;
                fileName = file.name;
                fileType = file.type;
            }

            if (!fileURL || !filePath || !fileName || !fileType) throw new Error("File information is missing.");

            const docData: Partial<StoredDocument> = {
                title: data.title,
                description: data.description,
                category: data.category,
                version: data.version,
                fileURL, filePath, fileName, fileType,
                uploaderId: user.uid,
                uploaderEmail: user.email || "N/A",
                lastUpdated: serverTimestamp(),
            };
            
            if (isEditMode && currentDocument) {
                const docRef = doc(db, "documents", currentDocument.id);
                // When a file is updated, reset the read acknowledgements
                if (file) {
                    docData.readBy = [];
                }
                await updateDoc(docRef, docData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_DOCUMENT", entityType: "DOCUMENT", entityId: currentDocument.id, details: { title: data.title } });
            } else {
                const docRef = doc(collection(db, "documents"));
                docData.readBy = [];
                await setDoc(docRef, docData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "CREATE_DOCUMENT", entityType: "DOCUMENT", entityId: docRef.id, details: { title: data.title } });
            }

            toast({ title: isEditMode ? "Document Updated" : "Document Added", description: `"${data.title}" has been saved.` });
            fetchDocuments();
            setIsManageDialogOpen(false);
        } catch (error) {
            console.error("Error submitting document:", error);
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (docToDelete: StoredDocument) => {
        if (!user || !window.confirm(`Are you sure you want to delete the document "${docToDelete.title}"?`)) return;
        try {
            await deleteObject(ref(storage, docToDelete.filePath));
            await deleteDoc(doc(db, "documents", docToDelete.id));
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "DELETE_DOCUMENT", entityType: "DOCUMENT", entityId: docToDelete.id, details: { title: docToDelete.title } });
            toast({ title: "Document Deleted", description: `"${docToDelete.title}" has been removed.` });
            fetchDocuments();
        } catch (error) {
            console.error("Error deleting document:", error);
            toast({ title: "Deletion Failed", variant: "destructive" });
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
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><Library className="mr-3 h-7 w-7 text-primary" />Document Management</CardTitle>
                        <CardDescription>Add, update, and remove documents from the library.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchDocuments} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Add Document</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by title or description..."
                                className="pl-8 w-full md:max-w-md"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[220px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {documentCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader column="title" label="Title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader column="version" label="Version" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader column="lastUpdated" label="Last Updated" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader column="uploaderEmail" label="Uploaded By" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedDocuments.map((docItem) => (
                                    <TableRow key={docItem.id}>
                                        <TableCell className="font-medium">{docItem.title}</TableCell>
                                        <TableCell>{docItem.category}</TableCell>
                                        <TableCell>{docItem.version}</TableCell>
                                        <TableCell>{format(docItem.lastUpdated.toDate(), "PPp")}</TableCell>
                                        <TableCell>{docItem.uploaderEmail}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" asChild title="View Read Status"><Link href={`/admin/documents/${docItem.id}`}><Eye className="h-4 w-4"/></Link></Button>
                                            <Button variant="ghost" size="icon" asChild><a href={docItem.fileURL} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4"/></a></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(docItem)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(docItem)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     {sortedDocuments.length === 0 && <p className="text-center text-muted-foreground py-8">No documents found matching your criteria.</p>}
                </CardContent>
            </Card>

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Document" : "Add New Document"}</DialogTitle>
                        <DialogDescription>{isEditMode ? "Update the document details below." : "Fill in the form to add a new document."}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent>{documentCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="version" render={({ field }) => (<FormItem><FormLabel>Version</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="file" render={({ field: { value, onChange, ...fieldProps } }) => (
                                <FormItem>
                                    <FormLabel>File {isEditMode && "(Optional: leave empty to keep existing file)"}</FormLabel>
                                    <FormControl><Input type="file" {...fieldProps} onChange={e => onChange(e.target.files)} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
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
