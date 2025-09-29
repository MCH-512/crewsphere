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
import { collection, getDocs, query, orderBy, Timestamp, doc, serverTimestamp, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import { Library, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Download, Search, Filter, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StoredDocument, documentFormSchema, documentEditFormSchema, documentCategories, DocumentFormValues, DocumentEditFormValues } from "@/schemas/document-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import Link from "next/link";
import { SortableHeader } from "@/components/custom/custom-sortable-header";

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

    const form = useForm<DocumentFormValues | DocumentEditFormValues>({
        resolver: zodResolver(isEditMode ? documentEditFormSchema : documentFormSchema),
        defaultValues: { title: "", description: "", category: undefined, version: "", file: undefined },
    });

    const fetchDocuments = React.useCallback(async () =&gt; {
        setIsLoading(true);
        try {
            const q = query(collection(db, "documents"), orderBy("lastUpdated", "desc"));
            const querySnapshot = await getDocs(q);
            setDocuments(querySnapshot.docs.map(doc =&gt; ({ id: doc.id, ...doc.data() } as StoredDocument)));
        } catch (err: unknown) {
            toast({ title: "Loading Error", description: "Could not fetch documents.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() =&gt; {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchDocuments();
        }
    }, [user, authLoading, router, fetchDocuments]);

    const sortedDocuments = React.useMemo(() =&gt; {
        const filteredDocs = documents.filter(doc =&gt; {
            if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
            if (searchTerm && !doc.title.toLowerCase().includes(searchTerm.toLowerCase()) && !doc.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

        return filteredDocs.sort((a, b) =&gt; {
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
    
    const handleSort = (column: SortableColumn) =&gt; {
        if (sortColumn === column) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'lastUpdated' ? 'desc' : 'asc');
        }
    };

    const handleOpenDialog = (docToEdit?: StoredDocument) =&gt; {
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

    const handleFormSubmit = async (data: DocumentFormValues | DocumentEditFormValues) =&gt; {
        if (!user) return;
        setIsSubmitting(true);
        try {
            let fileURL = currentDocument?.fileURL;
            let filePath = currentDocument?.filePath;
            let fileName = currentDocument?.fileName;
            let fileType = currentDocument?.fileType;

            const fileList = (data as DocumentFormValues).file;
            const file = fileList?.[0];

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

            const docData: Partial&lt;StoredDocument&gt; = {
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
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "UPDATE_DOCUMENT", entityType: "DOCUMENT", entityId: currentDocument.id, details: { title: data.title } });
            } else {
                const docRef = doc(collection(db, "documents"));
                docData.readBy = [];
                await setDoc(docRef, docData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "CREATE_DOCUMENT", entityType: "DOCUMENT", entityId: docRef.id, details: { title: data.title } });
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

    const handleDelete = async (docToDelete: StoredDocument) =&gt; {
        if (!user || !window.confirm(`Are you sure you want to delete the document "${docToDelete.title}"?`)) return;
        try {
            await deleteObject(ref(storage, docToDelete.filePath));
            await deleteDoc(doc(db, "documents", docToDelete.id));
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "DELETE_DOCUMENT", entityType: "DOCUMENT", entityId: docToDelete.id, details: { title: docToDelete.title } });
            toast({ title: "Document Deleted", description: `"${docToDelete.title}" has been removed.` });
            fetchDocuments();
        } catch (error) {
            console.error("Error deleting document:", error);
            toast({ title: "Deletion Failed", variant: "destructive" });
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
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;Library className="mr-3 h-7 w-7 text-primary" /&gt;Document Management&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Add, update, and remove documents from the library.&lt;/CardDescription&gt;
                    &lt;/div&gt;
                    &lt;div className="flex gap-2"&gt;
                        &lt;Button variant="outline" onClick={fetchDocuments} disabled={isLoading}&gt;&lt;RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /&gt;Refresh&lt;/Button&gt;
                        &lt;Button onClick={() =&gt; handleOpenDialog()}&gt;&lt;PlusCircle className="mr-2 h-4 w-4"/&gt;Add Document&lt;/Button&gt;
                    &lt;/div&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    &lt;div className="flex flex-col md:flex-row gap-4 mb-6"&gt;
                        &lt;div className="relative flex-grow"&gt;
                            &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                            &lt;Input
                                type="search"
                                placeholder="Search by title or description..."
                                className="pl-8 w-full md:max-w-md"
                                value={searchTerm}
                                onChange={(e) =&gt; setSearchTerm(e.target.value)}
                            /&gt;
                        &lt;/div&gt;
                        &lt;Select value={categoryFilter} onValueChange={(value) =&gt; setCategoryFilter(value as DocumentCategory | "all")}&gt;
                            &lt;SelectTrigger className="w-full md:w-[220px]"&gt;
                                &lt;Filter className="mr-2 h-4 w-4" /&gt;
                                &lt;SelectValue placeholder="Filter by category" /&gt;
                            &lt;/SelectTrigger&gt;
                            &lt;SelectContent&gt;
                                &lt;SelectItem value="all"&gt;All Categories&lt;/SelectItem&gt;
                                {documentCategories.map(cat =&gt; (
                                    &lt;SelectItem key={cat} value={cat}&gt;{cat}&lt;/SelectItem&gt;
                                ))}
                            &lt;/SelectContent&gt;
                        &lt;/Select&gt;
                    &lt;/div&gt;
                    &lt;div className="rounded-md border"&gt;
                        &lt;Table&gt;
                            &lt;TableHeader&gt;
                                &lt;TableRow&gt;
                                    &lt;SortableHeader&lt;SortableColumn&gt; column="title" label="Title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                    &lt;SortableHeader&lt;SortableColumn&gt; column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                    &lt;SortableHeader&lt;SortableColumn&gt; column="version" label="Version" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                    &lt;SortableHeader&lt;SortableColumn&gt; column="lastUpdated" label="Last Updated" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                    &lt;SortableHeader&lt;SortableColumn&gt; column="uploaderEmail" label="Uploaded By" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /&gt;
                                    &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                                &lt;/TableRow&gt;
                            &lt;/TableHeader&gt;
                            &lt;TableBody&gt;
                                {sortedDocuments.map((docItem) =&gt; (
                                    &lt;TableRow key={docItem.id}&gt;
                                        &lt;TableCell className="font-medium"&gt;{docItem.title}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;{docItem.category}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;{docItem.version}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;{format(docItem.lastUpdated.toDate(), "PPp")}&lt;/TableCell&gt;
                                        &lt;TableCell&gt;{docItem.uploaderEmail}&lt;/TableCell&gt;
                                        &lt;TableCell className="text-right space-x-1"&gt;
                                            &lt;Button variant="ghost" size="icon" asChild title="View Read Status"&gt;&lt;Link href={`/admin/documents/${docItem.id}`}&gt;&lt;Eye className="h-4 w-4"/&gt;&lt;/Link&gt;&lt;/Button&gt;
                                            &lt;Button variant="ghost" size="icon" asChild&gt;&lt;a href={docItem.fileURL} target="_blank" rel="noopener noreferrer"&gt;&lt;Download className="h-4 w-4"/&gt;&lt;/a&gt;&lt;/Button&gt;
                                            &lt;Button variant="ghost" size="icon" onClick={() =&gt; handleOpenDialog(docItem)}&gt;&lt;Edit className="h-4 w-4" /&gt;&lt;/Button&gt;
                                            &lt;Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() =&gt; handleDelete(docItem)}&gt;&lt;Trash2 className="h-4 w-4" /&gt;&lt;/Button&gt;
                                        &lt;/TableCell&gt;
                                    &lt;/TableRow&gt;
                                ))}
                            &lt;/TableBody&gt;
                        &lt;/Table&gt;
                    &lt;/div&gt;
                     {sortedDocuments.length === 0 &amp;&amp; &lt;p className="text-center text-muted-foreground py-8"&gt;No documents found matching your criteria.&lt;/p&gt;}
                &lt;/CardContent&gt;
            &lt;/Card&gt;

            &lt;Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}&gt;
                &lt;DialogContent&gt;
                    &lt;DialogHeader&gt;
                        &lt;DialogTitle&gt;{isEditMode ? "Edit Document" : "Add New Document"}&lt;/DialogTitle&gt;
                        &lt;DialogDescription&gt;{isEditMode ? "Update the document details below." : "Fill in the form to add a new document."}&lt;/DialogDescription&gt;
                    &lt;/DialogHeader&gt;
                    &lt;Form {...form}&gt;
                        &lt;form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4"&gt;
                            &lt;FormField control={form.control} name="title" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Title&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                            &lt;FormField control={form.control} name="description" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Description&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Textarea {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                            &lt;FormField control={form.control} name="category" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Category&lt;/FormLabel&gt;&lt;Select onValueChange={field.onChange} value={field.value}&gt;&lt;FormControl&gt;&lt;SelectTrigger&gt;&lt;SelectValue placeholder="Select a category" /&gt;&lt;/SelectTrigger&gt;&lt;/FormControl&gt;&lt;SelectContent&gt;{documentCategories.map(c =&gt; (&lt;SelectItem key={c} value={c}&gt;{c}&lt;/SelectItem&gt;))}&lt;/SelectContent&gt;&lt;/Select&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                            &lt;FormField control={form.control} name="version" render={({ field }) =&gt; (&lt;FormItem&gt;&lt;FormLabel&gt;Version&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;)} /&gt;
                            &lt;FormField control={form.control} name="file" render={({ field: { onChange, ...fieldProps } }) =&gt; (
                                &lt;FormItem&gt;
                                    &lt;FormLabel&gt;File {isEditMode &amp;&amp; "(Optional: leave empty to keep existing file)"}&lt;/FormLabel&gt;
                                    &lt;FormControl&gt;&lt;Input type="file" {...fieldProps} onChange={e =&gt; onChange(e.target.files)} /&gt;&lt;/FormControl&gt;
                                    &lt;FormMessage /&gt;
                                &lt;/FormItem&gt;
                            )} /&gt;
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
