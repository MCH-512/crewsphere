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
import { BellRing, Loader2, AlertTriangle, Edit, PlusCircle, Trash2, Search, Filter } from "lucide-react";
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

        return () =&gt; unsubscribe(); // Unsubscribe when component unmounts
    }, [user, toast]);


    React.useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') router.push('/');
        }
    }, [user, authLoading, router]);

    const sortedAlerts = React.useMemo(() => {
        const filtered = alerts.filter(alert =&gt; {
            if (searchTerm && !alert.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (typeFilter !== 'all' && alert.type !== typeFilter) return false;
            if (audienceFilter !== 'all' && alert.targetAudience !== audienceFilter) return false;
            return true;
        });

        const sorted = [...filtered];
        sorted.sort((a, b) =&gt; {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
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

    const handleSort = (column: SortableColumn) =&gt; {
        if (sortColumn === column) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleOpenDialog = (alertToEdit?: StoredAlert) =&gt; {
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

    const handleFormSubmit = async (data: AlertFormValues) =&gt; {
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
        } catch (error: unknown) {
            toast({ title: "Submission Failed", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (alertToDelete: StoredAlert) =&gt; {
        if (!user || !window.confirm(`Are you sure you want to delete the alert "${alertToDelete.title}"?`)) return;
        try {
            await deleteDoc(doc(db, "alerts", alertToDelete.id));
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "DELETE_ALERT", entityType: "ALERT", entityId: alertToDelete.id, details: { title: alertToDelete.title } });
            toast({ title: "Alert Deleted", description: `"${alertToDelete.title}" has been removed.` });
        } catch (error: unknown) {
            toast({ title: "Deletion Failed", variant: "destructive" });
        }
    };

    const getTypeBadgeVariant = (type: StoredAlert["type"]): VariantProps&lt;typeof Badge&gt;["variant"] =&gt; {
        switch (type) {
            case "info": return "secondary";
            case "warning": return "warning";
            case "critical": return "destructive";
            default: return "outline";
        }
    };

    if (authLoading || isLoading) {
      return (
        &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;
          &lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;
          &lt;p className="ml-4 text-lg text-muted-foreground"&gt;Loading alerts...&lt;/p&gt;
        &lt;/div&gt;
      );
    }
    
    if (!user || user.role !== 'admin') {
       return (
        &lt;div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center"&gt;
          &lt;AlertTriangle className="h-12 w-12 text-destructive mb-4" /&gt;
          &lt;CardTitle className="text-xl mb-2"&gt;Access Denied&lt;/CardTitle&gt;
          &lt;p className="text-muted-foreground"&gt;You do not have permission to view this page.&lt;/p&gt;
          &lt;Button onClick={() =&gt; router.push('/')} className="mt-4"&gt;Go to Dashboard&lt;/Button&gt;
        &lt;/div&gt;
      );
    }

    return (
        &lt;div className="space-y-6"&gt;
            &lt;Card className="shadow-lg"&gt;
                &lt;CardHeader className="flex flex-row justify-between items-start"&gt;
                    &lt;div&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;BellRing className="mr-3 h-7 w-7 text-primary" /&gt;Alert Management&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Create, manage, and broadcast alerts to specific user groups.&lt;/CardDescription&gt;
                    &lt;/div&gt;
                    &lt;div className="flex gap-2"&gt;
                        &lt;Button onClick={() =&gt; handleOpenDialog()}&gt;&lt;PlusCircle className="mr-2 h-4 w-4" /&gt;Create Alert&lt;/Button&gt;
                    &lt;/div&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                    &lt;div className="flex flex-col md:flex-row gap-4 mb-6"&gt;
                         &lt;div className="relative flex-grow"&gt;
                            &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                            &lt;Input
                                type="search"
                                placeholder="Search by title..."
                                className="pl-8 w-full md:max-w-xs"
                                value={searchTerm}
                                onChange={(e) =&gt; setSearchTerm(e.target.value)}
                            /&gt;
                        &lt;/div&gt;
                        &lt;Select value={typeFilter} onValueChange={(value) =&gt; setTypeFilter(value as AlertType | "all")}&gt;
                            &lt;SelectTrigger className="w-full md:w-[180px]"&gt;
                                &lt;Filter className="mr-2 h-4 w-4" /&gt;
                                &lt;SelectValue placeholder="Filter by type" /&gt;
                            &lt;/SelectTrigger&gt;
                            &lt;SelectContent&gt;
                                &lt;SelectItem value="all"&gt;All Types&lt;/SelectItem&gt;
                                {alertTypes.map(type =&gt; &lt;SelectItem key={type} value={type} className="capitalize"&gt;{type}&lt;/SelectItem&gt;)}
                            &lt;/SelectContent&gt;
                        &lt;/Select&gt;
                        &lt;Select value={audienceFilter} onValueChange={(value) =&gt; setAudienceFilter(value as AlertAudience | "all")}&gt;
                            &lt;SelectTrigger className="w-full md:w-[180px]"&gt;
                                &lt;Filter className="mr-2 h-4 w-4" /&gt;
                                &lt;SelectValue placeholder="Filter by audience" /&gt;
                            &lt;/SelectTrigger&gt;
                            &lt;SelectContent&gt;
                                &lt;SelectItem value="all"&gt;All Audiences&lt;/SelectItem&gt;
                                {alertAudiences.map(audience =&gt; &lt;SelectItem key={audience} value={audience} className="capitalize"&gt;{audience}&lt;/SelectItem&gt;)}
                            &lt;/SelectContent&gt;
                        &lt;/Select&gt;
                    &lt;/div&gt;

                    &lt;Table&gt;
                        &lt;TableHeader&gt;&lt;TableRow&gt;
                            &lt;SortableHeader column="title" label="Title" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;SortableHeader column="type" label="Type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;SortableHeader column="targetAudience" label="Audience" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;SortableHeader column="isActive" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;SortableHeader column="createdAt" label="Created" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;TableHead&gt;Actions&lt;/TableHead&gt;
                        &lt;/TableRow&gt;&lt;/TableHeader&gt;
                        &lt;TableBody&gt;
                            {sortedAlerts.map(alert =&gt; (
                                &lt;TableRow key={alert.id}&gt;
                                    &lt;TableCell className="font-medium max-w-sm truncate" title={alert.title}&gt;{alert.title}&lt;/TableCell&gt;
                                    &lt;TableCell&gt;&lt;Badge variant={getTypeBadgeVariant(alert.type)} className="capitalize"&gt;{alert.type}&lt;/Badge&gt;&lt;/TableCell&gt;
                                    &lt;TableCell&gt;&lt;Badge variant="outline" className="capitalize"&gt;{alert.targetAudience}&lt;/Badge&gt;&lt;/TableCell&gt;
                                    &lt;TableCell&gt;{alert.isActive ? &lt;Badge variant="success"&gt;Active&lt;/Badge&gt; : &lt;Badge variant="secondary"&gt;Inactive&lt;/Badge&gt;}&lt;/TableCell&gt;
                                    &lt;TableCell className="text-xs"&gt;{alert.createdAt ? format(alert.createdAt.toDate(), "PPp") : 'N/A'}&lt;/TableCell&gt;
                                    &lt;TableCell className="space-x-1"&gt;
                                        &lt;Button variant="ghost" size="icon" onClick={() =&gt; handleOpenDialog(alert)}&gt;&lt;Edit className="h-4 w-4" /&gt;&lt;/Button&gt;
                                        &lt;Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() =&gt; handleDelete(alert)}&gt;&lt;Trash2 className="h-4 w-4" /&gt;&lt;/Button&gt;
                                    &lt;/TableCell&gt;
                                &lt;/TableRow&gt;
                            ))}&lt;/TableBody&gt;
                    &lt;/Table&gt;
                    {sortedAlerts.length === 0 && &lt;p className="text-center text-muted-foreground p-8"&gt;No alerts found matching your criteria.&lt;/p&gt;}
                &lt;/CardContent&gt;
            &lt;/Card&gt;

            &lt;Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}&gt;
                &lt;DialogContent&gt;
                    &lt;DialogHeader&gt;
                        &lt;DialogTitle&gt;{isEditMode ? "Edit Alert" : "Create New Alert"}&lt;/DialogTitle&gt;
                        &lt;DialogDescription&gt;{isEditMode ? "Update the alert details below." : "Fill out the form to broadcast a new alert."}&lt;/DialogDescription&gt;
                    &lt;/DialogHeader&gt;
                    &lt;Form {...form}&gt;
                        &lt;form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4"&gt;
                            &lt;FormField control={form.control} name="title" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Title&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Input {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;FormField control={form.control} name="message" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Message&lt;/FormLabel&gt;&lt;FormControl&gt;&lt;Textarea className="min-h-[100px]" {...field} /&gt;&lt;/FormControl&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;div className="grid grid-cols-2 gap-4"&gt;
                                &lt;FormField control={form.control} name="type" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Type&lt;/FormLabel&gt;&lt;Select onValueChange={field.onChange} value={field.value}&gt;&lt;FormControl&gt;&lt;SelectTrigger&gt;&lt;SelectValue/&gt;&lt;/SelectTrigger&gt;&lt;/FormControl&gt;&lt;SelectContent&gt;{alertTypes.map(t =&gt; &lt;SelectItem key={t} value={t} className="capitalize"&gt;{t}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;&lt;/Select&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                                &lt;FormField control={form.control} name="targetAudience" render={({ field }) =&gt; &lt;FormItem&gt;&lt;FormLabel&gt;Audience&lt;/FormLabel&gt;&lt;Select onValueChange={field.onChange} value={field.value}&gt;&lt;FormControl&gt;&lt;SelectTrigger&gt;&lt;SelectValue/&gt;&lt;/SelectTrigger&gt;&lt;/FormControl&gt;&lt;SelectContent&gt;{alertAudiences.map(a =&gt; &lt;SelectItem key={a} value={a} className="capitalize"&gt;{a}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;&lt;/Select&gt;&lt;FormMessage /&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;/div&gt;
                            &lt;FormField control={form.control} name="isActive" render={({ field }) =&gt; &lt;FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"&gt;&lt;div className="space-y-0.5"&gt;&lt;FormLabel&gt;Active&lt;/FormLabel&gt;&lt;/div&gt;&lt;FormControl&gt;&lt;Switch checked={field.value} onCheckedChange={field.onChange} /&gt;&lt;/FormControl&gt;&lt;/FormItem&gt;} /&gt;
                            &lt;DialogFooter&gt;
                                &lt;DialogClose asChild&gt;&lt;Button type="button" variant="outline"&gt;Cancel&lt;/Button&gt;&lt;/DialogClose&gt;
                                &lt;Button type="submit" disabled={isSubmitting}&gt;{isSubmitting &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}{isEditMode ? "Save Changes" : "Create Alert"}&lt;/Button&gt;
                            &lt;/DialogFooter&gt;
                        &lt;/form&gt;
                    &lt;/Form&gt;
                &lt;/DialogContent&gt;
            &lt;/Dialog&gt;
        &lt;/div&gt;
    );
}
