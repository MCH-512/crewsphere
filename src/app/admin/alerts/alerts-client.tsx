
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
import { collection, query, orderBy, Timestamp, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { VariantProps } from "class-variance-authority";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { logAuditEvent } from "@/lib/audit-logger";
import { Switch } from "@/components/ui/switch";
import { StoredAlert, alertFormSchema, AlertFormValues, alertTypes, alertAudiences } from "@/schemas/alert-schema";
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import { badgeVariants } from "@/components/ui/badge";

type SortableColumn = 'title' | 'type' | 'targetAudience' | 'isActive' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type AlertType = StoredAlert["type"];
type AlertAudience = StoredAlert["targetAudience"];

export function AlertsClient({ initialAlerts }: { initialAlerts: StoredAlert[] }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [alerts, setAlerts] = React.useState<StoredAlert[]>(initialAlerts);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentAlert, setCurrentAlert] = React.useState<StoredAlert | null>(null);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>("createdAt");
    const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

    const [searchTerm, setSearchTerm] = React.useState("");
    const [typeFilter, setTypeFilter] = React.useState<AlertType | "all">("all");
    const [audienceFilter, setAudienceFilter] = React.useState<AlertAudience | "all">("all");

    const form = useForm<AlertFormValues>({
        resolver: zodResolver(alertFormSchema),
        defaultValues: { title: "", message: "", type: "info", targetAudience: "all", isActive: true },
    });
    
    React.useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const fetchedAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredAlert));
                setAlerts(fetchedAlerts);
                setIsLoading(false);
            },
            (err) => {
                console.error("Error fetching alerts in real-time:", err);
                toast({ title: "Real-time Error", description: "Could not fetch real-time alert updates.", variant: "destructive" });
                setIsLoading(false);
            }
        );

        return () => unsubscribe(); // Unsubscribe when component unmounts
    }, [user, toast]);


    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
        }
    }, [user, authLoading, router]);

    const sortedAlerts = React.useMemo(() => {
        const filtered = alerts.filter(alert => {
            if (searchTerm && !alert.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (typeFilter !== 'all' && alert.type !== typeFilter) return false;
            if (audienceFilter !== 'all' && alert.targetAudience !== audienceFilter) return false;
            return true;
        });

        const sorted = [...filtered];
        sorted.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];
            let comparison = 0;
            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
                comparison = valA === valB ? 0 : valA ? -1 : 1;
            } else {
                 comparison = String(valA).localeCompare(String(valB));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [alerts, sortColumn, sortDirection, searchTerm, typeFilter, audienceFilter]);

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
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "UPDATE_ALERT", entityType: "ALERT", entityId: currentAlert.id, details: { title: data.title } });
                toast({ title: "Alert Updated", description: `Alert "${data.title}" has been updated.` });
            } else {
                const newAlertRef = await addDoc(collection(db, "alerts"), {
                    ...data,
                    createdBy: user.uid,
                    creatorEmail: user.email,
                    createdAt: serverTimestamp(),
                });
                await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "CREATE_ALERT", entityType: "ALERT", entityId: newAlertRef.id, details: { title: data.title } });
                toast({ title: "Alert Created", description: `Alert "${data.title}" has been published.` });
            }
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
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "DELETE_ALERT", entityType: "ALERT", entityId: alertToDelete.id, details: { title: alertToDelete.title } });
            toast({ title: "Alert Deleted", description: `"${alertToDelete.title}" has been removed.` });
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

    if (authLoading || isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg text-muted-foreground">Loading alerts...</p>
        </div>
      );
    }
    
    if (!user || user.role !== 'admin') {
       return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
          <Button onClick={() => router.push('/')} className="mt-4">Go to Dashboard</Button>
        </div>
      );
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><BellRing className="mr-3 h-7 w-7 text-primary" />Alert Management</CardTitle>
                        <CardDescription>Create, manage, and broadcast alerts to specific user groups.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" />Create Alert</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                         <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by title..."
                                className="pl-8 w-full md:max-w-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {alertTypes.map(type => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={audienceFilter} onValueChange={(value) => setAudienceFilter(value as any)}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Filter by audience" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Audiences</SelectItem>
                                {alertAudiences.map(audience => <SelectItem key={audience} value={audience} className="capitalize">{audience}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

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
                                    <TableCell><Badge variant="outline" className="capitalize">{alert.targetAudience}</TableCell></TableCell>
                                    <TableCell>{alert.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                                    <TableCell className="text-xs">{alert.createdAt ? format(alert.createdAt.toDate(), "PPp") : 'N/A'}</TableCell>
                                    <TableCell className="space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(alert)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(alert)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {sortedAlerts.length === 0 && <p className="text-center text-muted-foreground p-8">No alerts found matching your criteria.</p>}
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

    