"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { VariantProps } from "class-variance-authority";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { logAuditEvent } from "@/lib/audit-logger";
import { Switch } from "@/components/ui/switch";
import { StoredAlert, alertFormSchema, AlertFormValues, alertTypes, alertAudiences } from "@/schemas/alert-schema";
import { SortableHeader } from "@/components/custom/custom-sortable-header";

type SortableColumn = 'title' | 'type' | 'targetAudience' | 'isActive' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function AdminAlertsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [alerts, setAlerts] = React.useState<StoredAlert[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentAlert, setCurrentAlert] = React.useState<StoredAlert | null>(null);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>("createdAt");
    const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

    const form = useForm<AlertFormValues>({
        resolver: zodResolver(alertFormSchema),
        defaultValues: { title: "", message: "", type: "info", targetAudience: "all", isActive: true },
    });

    const fetchAlerts = React.useCallback(async () => {
        setIsLoading(true);
        try {
            // Initial fetch is always ordered by creation date
            const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            setAlerts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredAlert)));
        } catch (err) {
            toast({ title: "Loading Error", description: "Could not fetch alerts.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
            else fetchAlerts();
        }
    }, [user, authLoading, router, fetchAlerts]);

    const sortedAlerts = React.useMemo(() => {
        const sorted = [...alerts];
        sorted.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];

            let comparison = 0;
            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                comparison = valA.localeCompare(valB);
            } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
                comparison = valA === valB ? 0 : valA ? -1 : 1;
            } else {
                 comparison = String(valA).localeCompare(String(valB));
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [alerts, sortColumn, sortDirection]);

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleOpenDialog = (alertToEdit?: StoredAlert) => {
        if (alertToEdit) {
            setIsEditMode(true);
            setCurrentAlert(alertToEdit);
            form.reset(alertToEdit);
        } else {
            setIsEditMode(false);
            setCurrentAlert(null);
            form.reset({ title: "", message: "", type: "info", targetAudience: "all", isActive: true });
        }
        setIsManageDialogOpen(true);
    };

    const handleFormSubmit = async (data: AlertFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            if (isEditMode && currentAlert) {
                const alertRef = doc(db, "alerts", currentAlert.id);
                await updateDoc(alertRef, data);
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "UPDATE_ALERT", entityType: "ALERT", entityId: currentAlert.id, details: { title: data.title } });
                toast({ title: "Alert Updated", description: `Alert "${data.title}" has been updated.` });
            } else {
                const newAlertRef = await addDoc(collection(db, "alerts"), {
                    ...data,
                    createdBy: user.uid,
                    creatorEmail: user.email,
                    createdAt: serverTimestamp(),
                });
                await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "CREATE_ALERT", entityType: "ALERT", entityId: newAlertRef.id, details: { title: data.title } });
                toast({ title: "Alert Created", description: `Alert "${data.title}" has been published.` });
            }
            fetchAlerts();
            setIsManageDialogOpen(false);
        } catch (error) {
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (alertToDelete: StoredAlert) => {
        if (!user || !window.confirm(`Are you sure you want to delete the alert "${alertToDelete.title}"?`)) return;
        try {
            await deleteDoc(doc(db, "alerts", alertToDelete.id));
            await logAuditEvent({ userId: user.uid, userEmail: user.email, actionType: "DELETE_ALERT", entityType: "ALERT", entityId: alertToDelete.id, details: { title: alertToDelete.title } });
            toast({ title: "Alert Deleted", description: `"${alertToDelete.title}" has been removed.` });
            fetchAlerts();
        } catch (error) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    const getTypeBadgeVariant = (type: StoredAlert["type"]): VariantProps<typeof Badge>["variant"] => {
        switch (type) {
            case "info": return "secondary";
            case "warning": return "warning";
            case "critical": return "destructive";
            default: return "outline";
        }
    };

    if (authLoading || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><BellRing className="mr-3 h-7 w-7 text-primary" />Alert Management</CardTitle>
                        <CardDescription>Create, manage, and broadcast alerts to specific user groups.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchAlerts} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" />Create Alert</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow>
                            <SortableHeader column="title" label="Title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <SortableHeader column="type" label="Type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <SortableHeader column="targetAudience" label="Audience" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <SortableHeader column="isActive" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <SortableHeader column="createdAt" label="Created" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <TableHead>Actions</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {sortedAlerts.map(alert => (
                                <TableRow key={alert.id}>
                                    <TableCell className="font-medium max-w-sm truncate" title={alert.title}>{alert.title}</TableCell>
                                    <TableCell><Badge variant={getTypeBadgeVariant(alert.type)} className="capitalize">{alert.type}</Badge></TableCell>
                                    <TableCell><Badge variant="outline" className="capitalize">{alert.targetAudience}</Badge></TableCell>
                                    <TableCell>{alert.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                                    <TableCell className="text-xs">{format(alert.createdAt.toDate(), "PPp")}</TableCell>
                                    <TableCell className="space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(alert)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(alert)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {sortedAlerts.length === 0 && <p className="text-center text-muted-foreground p-8">No alerts found.</p>}
                </CardContent>
            </Card>

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Alert" : "Create New Alert"}</DialogTitle>
                        <DialogDescription>{isEditMode ? "Update the alert details below." : "Fill out the form to broadcast a new alert."}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                            <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                            <FormField control={form.control} name="message" render={({ field }) => <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="type" render={({ field }) => <FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{alertTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                                <FormField control={form.control} name="targetAudience" render={({ field }) => <FormItem><FormLabel>Audience</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{alertAudiences.map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                            </div>
                            <FormField control={form.control} name="isActive" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Active</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditMode ? "Save Changes" : "Create Alert"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
