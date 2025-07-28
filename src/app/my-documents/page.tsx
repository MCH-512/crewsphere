
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { db, storage } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, doc, addDoc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, AlertTriangle, CalendarX, CalendarClock, CalendarCheck2, PlusCircle, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { StoredUserDocument, userDocumentCreateFormSchema, userDocumentUpdateFormSchema, userDocumentTypes, getDocumentStatus, getStatusBadgeVariant } from "@/schemas/user-document-schema";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit-logger";
import { UserDocumentFormValues } from "@/schemas/user-document-schema";

const EXPIRY_WARNING_DAYS = 30;

const statusConfig: Record<UserDocumentStatus, { icon: React.ElementType, color: string, label: string }> = {
    'pending-validation': { icon: CalendarClock, color: "text-blue-600", label: "Pending Validation" },
    expired: { icon: CalendarX, color: "text-destructive", label: "Expired" },
    'expiring-soon': { icon: CalendarClock, color: "text-yellow-600", label: "Expiring Soon" },
    approved: { icon: CalendarCheck2, color: "text-green-600", label: "Approved" },
};


const ManageDocumentDialog = ({ open, onOpenChange, documentToEdit, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, documentToEdit: StoredUserDocument | null, onSave: () => void }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const isEditMode = !!documentToEdit;

    const form = useForm<UserDocumentFormValues>({
        resolver: zodResolver(isEditMode ? userDocumentUpdateFormSchema : userDocumentCreateFormSchema),
        defaultValues: {
            documentName: "", documentType: undefined, issueDate: "", expiryDate: "", notes: "", file: undefined
        }
    });

    React.useEffect(() => {
        if (open && documentToEdit) {
            form.reset({
                documentName: documentToEdit.documentName,
                documentType: documentToEdit.documentType,
                issueDate: format(documentToEdit.issueDate.toDate(), 'yyyy-MM-dd'),
                expiryDate: format(documentToEdit.expiryDate.toDate(), 'yyyy-MM-dd'),
                notes: documentToEdit.notes || "",
                file: undefined, // File is always optional on edit
            });
        } else if (open && !documentToEdit) {
            form.reset({ documentName: "", documentType: undefined, issueDate: "", expiryDate: "", notes: "", file: undefined });
        }
    }, [open, documentToEdit, form]);

    const handleFormSubmit = async (data: UserDocumentFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const file = data.file?.[0];
            let fileURL = documentToEdit?.fileURL;
            let filePath = documentToEdit?.filePath;

            if (file) {
                if (isEditMode && documentToEdit?.filePath) {
                    try { await deleteObject(ref(storage, documentToEdit.filePath)); } catch (e) { console.warn("Old file not found for deletion, continuing.")}
                }
                const newFilePath = `user-documents/${user.uid}/${Date.now()}-${file.name}`;
                const storageRef = ref(storage, newFilePath);
                await uploadBytes(storageRef, file);
                fileURL = await getDownloadURL(storageRef);
                filePath = newFilePath;
            }

            if (!isEditMode && (!fileURL || !filePath)) {
                throw new Error("File is required when creating a new document.");
            }
            
            const docData = {
                userId: user.uid, userEmail: user.email,
                documentName: data.documentName, documentType: data.documentType,
                issueDate: new Date(data.issueDate), expiryDate: new Date(data.expiryDate),
                notes: data.notes, 
                status: 'pending-validation' as const, // Always requires validation
                lastUpdatedAt: serverTimestamp(),
                ...(fileURL && { fileURL }),
                ...(filePath && { filePath }),
            };

            if (isEditMode && documentToEdit) {
                const docRef = doc(db, "userDocuments", documentToEdit.id);
                await updateDoc(docRef, docData);
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_SELF_DOCUMENT", entityType: "USER_DOCUMENT", entityId: docRef.id });
            } else {
                const docRef = await addDoc(collection(db, "userDocuments"), { ...docData, createdAt: serverTimestamp() });
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "CREATE_SELF_DOCUMENT", entityType: "USER_DOCUMENT", entityId: docRef.id });
            }
            toast({ title: isEditMode ? "Document Updated" : "Document Added", description: `Your document is now pending validation by an administrator.` });
            onSave();
            onOpenChange(false);
        } catch (error) {
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditMode ? "Update Document" : "Add New Document"}</DialogTitle>
                    <DialogDescription>{isEditMode ? "Update the document details and upload a new file if needed." : "Add a new trackable document."}</DialogDescription>
                </DialogHeader>
                <Form {...form}><form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                    <FormField control={form.control} name="documentType" render={({ field }) => <FormItem><FormLabel>Document Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{userDocumentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="documentName" render={({ field }) => <FormItem><FormLabel>Document Name/Number</FormLabel><FormControl><Input {...field} placeholder="e.g., Passport, N123456" /></FormControl><FormMessage /></FormItem>} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="issueDate" render={({ field }) => <FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
                        <FormField control={form.control} name="expiryDate" render={({ field }) => <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
                    </div>
                    <FormField control={form.control} name="file" render={({ field: { value, onChange, ...fieldProps } }) => <FormItem><FormLabel>Upload File {isEditMode && "(Optional: only to replace existing file)"}</FormLabel><FormControl><Input type="file" {...fieldProps} onChange={e => onChange(e.target.files)} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="notes" render={({ field }) => <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit for Validation</Button>
                    </DialogFooter>
                </form></Form>
            </DialogContent>
        </Dialog>
    );
};

export default function MyDocumentsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [documents, setDocuments] = React.useState<StoredUserDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [documentToEdit, setDocumentToEdit] = React.useState<StoredUserDocument | null>(null);

    const fetchDocuments = React.useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, "userDocuments"), where("userId", "==", user.uid), orderBy("expiryDate", "asc"));
            const querySnapshot = await getDocs(q);
            setDocuments(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredUserDocument)));
        } catch (error) {
            console.error("Error fetching documents:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) { router.push('/login'); return; }
        fetchDocuments();
    }, [user, authLoading, router, fetchDocuments]);

    const handleOpenDialog = (doc?: StoredUserDocument) => {
        setDocumentToEdit(doc || null);
        setIsDialogOpen(true);
    };

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!user) return null;

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                            <CardTitle className="text-2xl font-headline flex items-center">
                                <ShieldCheck className="mr-3 h-7 w-7 text-primary" />
                                My Documents & Licenses
                            </CardTitle>
                            <CardDescription>Keep your documents up-to-date. All submissions require admin validation.</CardDescription>
                        </div>
                         <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Add Document</Button>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            {documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.map((docItem, index) => {
                        const status = getDocumentStatus(docItem, EXPIRY_WARNING_DAYS);
                        const config = statusConfig[status];
                        const Icon = config.icon;
                        
                        return (
                            <AnimatedCard key={docItem.id} delay={0.1 + index * 0.05}>
                                <Card className="shadow-sm h-full flex flex-col hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-start gap-3">
                                            <Icon className={cn("h-6 w-6 mt-1 flex-shrink-0", config.color)} />
                                            <span>{docItem.documentName}</span>
                                        </CardTitle>
                                        <CardDescription>{docItem.documentType}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-2 text-sm">
                                        <p><strong>Expires:</strong> {format(docItem.expiryDate.toDate(), "PPP")}</p>
                                        <p><strong>Status:</strong> <span className={cn("font-semibold", config.color)}>{config.label}</span></p>
                                        {docItem.notes && <p className="text-xs text-muted-foreground pt-2 border-t mt-2"><strong>Notes:</strong> {docItem.notes}</p>}
                                    </CardContent>
                                    <CardFooter>
                                        <Button variant="secondary" className="w-full" onClick={() => handleOpenDialog(docItem)}><Edit className="mr-2 h-4 w-4"/>Update</Button>
                                    </CardFooter>
                                </Card>
                            </AnimatedCard>
                        )
                    })}
                </div>
            ) : (
                 <AnimatedCard delay={0.1}>
                    <Card className="text-center py-12">
                        <CardContent><p className="text-muted-foreground">No documents found. Click "Add Document" to get started.</p></CardContent>
                    </Card>
                </AnimatedCard>
            )}
             <ManageDocumentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} documentToEdit={documentToEdit} onSave={fetchDocuments} />
        </div>
    );
}
