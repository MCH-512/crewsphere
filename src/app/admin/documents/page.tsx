
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
import { collection, getDocs, query, orderBy, Timestamp, doc, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import { Library, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StoredDocument, documentFormSchema, documentEditFormSchema, documentCategories } from "@/schemas/document-schema";
import { logAuditEvent } from "@/lib/audit-logger";

type ManageDocumentFormValues = z.infer<typeof documentFormSchema>;
type ManageDocumentEditFormValues = z.infer<typeof documentEditFormSchema>;

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
            const batch = writeBatch(db);
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

            const docData = {
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
                batch.update(docRef, docData);
                await batch.commit();
                 await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_DOCUMENT", entityType: "DOCUMENT", entityId: currentDocument.id, details: { title: data.title } });
            } else {
                const docRef = doc(collection(db, "documents"));
                batch.set(docRef, docData);
                await batch.commit();
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
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents.map((docItem) => (
                                    <TableRow key={docItem.id}>
                                        <TableCell className="font-medium">{docItem.title}</TableCell>
                                        <TableCell>{docItem.category}</TableCell>
                                        <TableCell>{docItem.version}</TableCell>
                                        <TableCell>{format(docItem.lastUpdated.toDate(), "PPp")}</TableCell>
                                        <TableCell>{docItem.uploaderEmail}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" asChild><a href={docItem.fileURL} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4"/></a></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(docItem)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(docItem)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     {documents.length === 0 && <p className="text-center text-muted-foreground py-8">No documents found.</p>}
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
