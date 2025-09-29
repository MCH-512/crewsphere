"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, query, where, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Plane, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, Handshake, FileSignature, Filter, BellOff, Search, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import type { StoredFlight } from "@/schemas/flight-schema";
import { logAuditEvent } from "@/lib/audit-logger";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import { approveFlightSwap, rejectFlightSwap, checkSwapConflict } from "@/services/admin-flight-swap-service";
import { Textarea } from "@/components/ui/textarea";
import { SortableHeader } from "@/components/custom/custom-sortable-header";
import { Label } from "@/components/ui/label";
import { getFlightsForAdmin, type FlightForDisplay } from "@/services/flight-service";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { aircraftTypes } from "@/schemas/flight-schema";
import { Input } from "@/components/ui/input";
import { FlightForm } from "@/components/admin/flight-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const SwapApprovalDialog = ({ swap, onClose, onAction }: { swap: StoredFlightSwap, onClose: () =&gt; void, onAction: () =&gt; void }) =&gt; {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [rejectionNotes, setRejectionNotes] = React.useState("");
    const [isRejecting, setIsRejecting] = React.useState(false);
    const [conflict, setConflict] = React.useState&lt;string | null&gt;(null);
    const [isCheckingConflict, setIsCheckingConflict] = React.useState(true);
    
    React.useEffect(() =&gt; {
        const checkConflicts = async () =&gt; {
            setIsCheckingConflict(true);
            const conflictMessage = await checkSwapConflict(swap);
            setConflict(conflictMessage);
            setIsCheckingConflict(false);
        };
        checkConflicts();
    }, [swap]);

    const handleApprove = async () =&gt; {
        if (!user) return;
        if (conflict) {
            if (!window.confirm("A scheduling conflict exists. Are you sure you want to approve this swap?")) {
                return;
            }
        }
        setIsSubmitting(true);
        try {
            await approveFlightSwap(swap.id, user.uid, user.email || "N/A");
            toast({ title: "Swap Approved", description: "The flight schedules have been updated." });
            onAction();
            onClose();
        } catch (error: unknown) {
            const e = error as Error;
            toast({ title: "Approval Failed", description: e.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleReject = async () =&gt; {
        if (!user || !rejectionNotes) {
            toast({ title: "Rejection requires notes.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await rejectFlightSwap(swap.id, user.uid, user.email || "N/A", rejectionNotes);
            toast({ title: "Swap Rejected" });
            onAction();
            onClose();
        } catch (error: unknown) {
            const e = error as Error;
            toast({ title: "Rejection Failed", description: e.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            setIsRejecting(false);
        }
    };

    return (
        &lt;Dialog open={true} onOpenChange={onClose}&gt;
            &lt;DialogContent className="max-w-3xl"&gt;
                &lt;DialogHeader&gt;
                    &lt;DialogTitle&gt;Approve Flight Swap Request&lt;/DialogTitle&gt;
                    &lt;DialogDescription&gt;Review the details below and approve or reject the swap.&lt;/DialogDescription&gt;
                &lt;/DialogHeader&gt;
                &lt;div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 text-sm"&gt;
                    &lt;Card&gt;&lt;CardHeader&gt;&lt;CardTitle className="text-base"&gt;Original Flight (Initiator)&lt;/CardTitle&gt;&lt;CardDescription&gt;{swap.initiatingUserEmail}&lt;/CardDescription&gt;&lt;/CardHeader&gt;
                        &lt;CardContent&gt;&lt;p&gt;&lt;strong&gt;Flight:&lt;/strong&gt; {swap.flightInfo.flightNumber}&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Route:&lt;/strong&gt; {swap.flightInfo.departureAirport} to {swap.flightInfo.arrivalAirport}&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Date:&lt;/strong&gt; {format(parseISO(swap.flightInfo.scheduledDepartureDateTimeUTC), "PPP")}&lt;/p&gt;&lt;/CardContent&gt;
                    &lt;/Card&gt;
                    &lt;Card&gt;&lt;CardHeader&gt;&lt;CardTitle className="text-base"&gt;Proposed Swap (Requester)&lt;/CardTitle&gt;&lt;CardDescription&gt;{swap.requestingUserEmail}&lt;/CardDescription&gt;&lt;/CardHeader&gt;
                        &lt;CardContent&gt;&lt;p&gt;&lt;strong&gt;Flight:&lt;/strong&gt; {swap.requestingFlightInfo?.flightNumber}&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Route:&lt;/strong&gt; {swap.requestingFlightInfo?.departureAirport} to {swap.requestingFlightInfo?.arrivalAirport}&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Date:&lt;/strong&gt; {format(parseISO(swap.requestingFlightInfo?.scheduledDepartureDateTimeUTC || "1970-01-01"), "PPP")}&lt;/p&gt;&lt;/CardContent&gt;
                    &lt;/Card&gt;
                &lt;/div&gt;
                {isCheckingConflict ? (
                     &lt;div className="flex items-center text-sm text-muted-foreground"&gt;&lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;Checking for potential conflicts...&lt;/div&gt;
                ) : conflict ? (
                    &lt;Alert variant="warning"&gt;
                        &lt;AlertTriangle className="h-4 w-4" /&gt;
                        &lt;AlertTitle&gt;Potential Conflict Detected&lt;/AlertTitle&gt;
                        &lt;AlertDescription&gt;{conflict}&lt;/AlertDescription&gt;
                    &lt;/Alert&gt;
                ) : (
                    &lt;Alert variant="success"&gt;
                        &lt;CheckCircle className="h-4 w-4" /&gt;
                        &lt;AlertTitle&gt;No Conflicts Detected&lt;/AlertTitle&gt;
                        &lt;AlertDescription&gt;No direct scheduling conflicts were found for this swap.&lt;/AlertDescription&gt;
                    &lt;/Alert&gt;
                )}
                 {isRejecting ? (
                    &lt;div className="space-y-2 mt-4"&gt;
                        &lt;Label htmlFor="rejection-notes"&gt;Reason for Rejection&lt;/Label&gt;
                        &lt;Textarea id="rejection-notes" value={rejectionNotes} onChange={(e) =&gt; setRejectionNotes(e.target.value)} placeholder="Provide a brief reason for rejection..." /&gt;
                    &lt;/div&gt;
                ) : null}
                &lt;DialogFooter className="mt-4"&gt;
                    {isRejecting ? (
                        &lt;&gt;
                            &lt;Button variant="ghost" onClick={() =&gt; setIsRejecting(false)}&gt;Cancel&lt;/Button&gt;
                            &lt;Button variant="destructive" onClick={handleReject} disabled={isSubmitting}&gt;
                                {isSubmitting &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}Confirm Rejection
                            &lt;/Button&gt;
                        &lt;/&gt;
                    ) : (
                        &lt;&gt;
                            &lt;Button variant="outline" onClick={onClose}&gt;Close&lt;/Button&gt;
                            &lt;Button variant="destructive" onClick={() =&gt; setIsRejecting(true)}&gt;Reject&lt;/Button&gt;
                            &lt;Button onClick={handleApprove} disabled={isSubmitting || isCheckingConflict}&gt;
                                {isSubmitting &amp;&amp; &lt;Loader2 className="mr-2 h-4 w-4 animate-spin"/&gt;}Approve Swap
                            &lt;/Button&gt;
                        &lt;/&gt;
                    )}
                &lt;/DialogFooter&gt;
            &lt;/DialogContent&gt;
        &lt;/Dialog&gt;
    );
};

interface AdminFlightsClientProps {
    initialFlights: FlightForDisplay[];
    initialAllUsers: User[];
    initialPilots: User[];
    initialPursers: User[];
    initialCabinCrew: User[];
    initialInstructors: User[];
    initialTrainees: User[];
    initialUserMap: Map&lt;string, User&gt;;
}

type SortableColumn = 'scheduledDepartureDateTimeUTC' | 'flightNumber' | 'departureAirportName' | 'purserName' | 'aircraftType' | 'crewCount';
type SortDirection = 'asc' | 'desc';

export function AdminFlightsClient({ 
    initialFlights, initialAllUsers, initialPilots, initialPursers, 
    initialCabinCrew, initialInstructors, initialTrainees, initialUserMap 
}: AdminFlightsClientProps) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [flights, setFlights] = React.useState&lt;FlightForDisplay[]&gt;(initialFlights);
    const [isLoading, setIsLoading] = React.useState(false); // Only for client-side fetches
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentFlight, setCurrentFlight] = React.useState&lt;StoredFlight | null&gt;(null);

    const [sortColumn, setSortColumn] = React.useState&lt;SortableColumn&gt;('scheduledDepartureDateTimeUTC');
    const [sortDirection, setSortDirection] = React.useState&lt;SortDirection&gt;('desc');

    const [swapToApprove, setSwapToApprove] = React.useState&lt;StoredFlightSwap | null&gt;(null);
    const [showPendingSwapsOnly, setShowPendingSwapsOnly] = React.useState(false);
    const [listenerError, setListenerError] = React.useState&lt;string | null&gt;(null);

    const [searchTerm, setSearchTerm] = React.useState("");
    const [aircraftFilter, setAircraftFilter] = React.useState&lt;string&gt;("all");
    const [purserFilter, setPurserFilter] = React.useState&lt;string&gt;("all");

     const fetchPageData = React.useCallback(async () =&gt; {
        setIsLoading(true);
        try {
            const { flights: newFlights } = await getFlightsForAdmin();
            setFlights(newFlights);
        } catch (error: unknown) {
            const e = error as Error;
            toast({ title: "Error Refreshing Data", description: e.message || "Could not fetch updated flight data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    React.useEffect(() =&gt; {
        if (!authLoading &amp;&amp; !user) router.push('/');
    }, [user, authLoading, router]);

    React.useEffect(() =&gt; {
        if (!db) return;
        setListenerError(null);
        const q = query(collection(db, "flightSwaps"), where("status", "==", "pending_approval"));
        const unsubscribe = onSnapshot(q, (snapshot) =&gt; {
            setListenerError(null);
            snapshot.docChanges().forEach((change) =&gt; {
                if (change.type === "added") {
                    const newSwap = { id: change.doc.id, ...change.doc.data() } as StoredFlightSwap;
                    toast({
                        title: "New Swap Request",
                        description: `Flight ${newSwap.flightInfo.flightNumber} has a new swap request from ${newSwap.requestingUserEmail}.`,
                        action: &lt;Button variant="secondary" size="sm" onClick={() =&gt; setSwapToApprove(newSwap)}&gt;Review&lt;/Button&gt;,
                        duration: 10000,
                    });
                    fetchPageData();
                }
            });
        }, (error) =&gt; {
            console.error("Error with swap listener:", error);
            setListenerError("Real-time connection lost. Refresh manually.");
            toast({ title: "Real-time Connection Lost", description: "Could not listen for new swap requests.", variant: "destructive" });
        });

        return () =&gt; unsubscribe();
    }, [toast, fetchPageData]);

    const sortedAndFilteredFlights = React.useMemo(() =&gt; {
        let displayFlights = [...flights];

        if (showPendingSwapsOnly) displayFlights = displayFlights.filter(f =&gt; f.pendingSwap);
        if (aircraftFilter !== 'all') displayFlights = displayFlights.filter(f =&gt; f.aircraftType === aircraftFilter);
        if (purserFilter !== 'all') displayFlights = displayFlights.filter(f =&gt; f.purserId === purserFilter);
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            displayFlights = displayFlights.filter(f =&gt; 
                f.flightNumber.toLowerCase().includes(lowerTerm) ||
                (f.departureAirportName || '').toLowerCase().includes(lowerTerm) ||
                (f.arrivalAirportName || '').toLowerCase().includes(lowerTerm)
            );
        }

        return displayFlights.sort((a, b) =&gt; {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;

            if (sortColumn === 'scheduledDepartureDateTimeUTC') {
                 comparison = new Date(valA as string).getTime() - new Date(valB as string).getTime();
            } else if (sortColumn === 'crewCount') {
                comparison = (valA as number) - (valB as number);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [flights, sortColumn, sortDirection, showPendingSwapsOnly, aircraftFilter, purserFilter, searchTerm]);

    const handleSort = (column: SortableColumn) =&gt; {
        if (sortColumn === column) {
            setSortDirection(prev =&gt; prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'scheduledDepartureDateTimeUTC' ? 'desc' : 'asc');
        }
    };
    
    const onFormSubmitSuccess = () =&gt; {
        setIsManageDialogOpen(false);
        fetchPageData();
    }

    const handleOpenDialog = (flightToEdit?: StoredFlight) =&gt; {
        if (flightToEdit) {
            setIsEditMode(true);
            setCurrentFlight(flightToEdit);
        } else {
            setIsEditMode(false);
            setCurrentFlight(null);
        }
        setIsManageDialogOpen(true);
    };

    const handleDelete = async (flightToDelete: StoredFlight) =&gt; {
        if (!user || !window.confirm(`Are you sure you want to delete flight ${flightToDelete.flightNumber}? This will also remove it from all assigned crew schedules.`)) return;
        
        try {
            const batch = writeBatch(db);
            const flightRef = doc(db, "flights", flightToDelete.id);
            batch.delete(flightRef);

            if (flightToDelete.activityIds) {
                for (const activityId of Object.values(flightToDelete.activityIds)) {
                    batch.delete(doc(db, "userActivities", activityId));
                }
            }
            
            await batch.commit();
            await logAuditEvent({ userId: user.uid, userEmail: user.email!, actionType: "DELETE_FLIGHT", entityType: "FLIGHT", entityId: flightToDelete.id, details: { flightNumber: flightToDelete.flightNumber } });
            toast({ title: "Flight Deleted", description: `Flight "${flightToDelete.flightNumber}" and associated schedule entries have been removed.` });
            fetchPageData();
        } catch (error: unknown) {
            const e = error as Error;
            toast({ title: "Deletion Failed", description: e.message || "An unexpected error occurred.", variant: "destructive" });
        }
    };

    if (authLoading) return &lt;div className="flex items-center justify-center min-h-[calc(100vh-200px)]"&gt;&lt;Loader2 className="h-12 w-12 animate-spin text-primary" /&gt;&lt;/div&gt;;
    if (!user || user.role !== 'admin') return &lt;div className="flex flex-col items-center justify-center min-h-screen text-center p-4"&gt;&lt;AlertTriangle className="h-16 w-16 text-destructive mb-4" /&gt;&lt;CardTitle className="text-2xl mb-2"&gt;Access Denied&lt;/CardTitle&gt;&lt;p className="text-muted-foreground"&gt;You do not have permission to view this page.&lt;/p&gt;&lt;Button onClick={() =&gt; router.push('/')} className="mt-6"&gt;Go to Dashboard&lt;/Button&gt;&lt;/div&gt;;
    
    return (
        &lt;div className="space-y-6"&gt;
            &lt;Card className="shadow-lg"&gt;
                &lt;CardHeader className="flex flex-col md:flex-row justify-between items-start gap-4"&gt;
                    &lt;div&gt;
                        &lt;CardTitle className="text-2xl font-headline flex items-center"&gt;&lt;Plane className="mr-3 h-7 w-7 text-primary" /&gt;Flight Management&lt;/CardTitle&gt;
                        &lt;CardDescription&gt;Schedule new flights and assign crew members.&lt;/CardDescription&gt;
                    &lt;/div&gt;
                &lt;/CardHeader&gt;
                &lt;CardContent&gt;
                     &lt;div className="flex flex-col md:flex-row gap-2"&gt;
                        &lt;div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2"&gt;
                            &lt;div className="relative"&gt;
                                &lt;Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /&gt;
                                &lt;Input type="search" placeholder="Search flights..." className="pl-8 w-full" value={searchTerm} onChange={(e) =&gt; setSearchTerm(e.target.value)} /&gt;
                            &lt;/div&gt;
                            &lt;Select value={aircraftFilter} onValueChange={setAircraftFilter}&gt;
                                &lt;SelectTrigger&gt;&lt;Filter className="mr-2 h-4 w-4" /&gt; &lt;span className="truncate"&gt;Aircraft: {aircraftFilter === 'all' ? 'All' : aircraftFilter}&lt;/span&gt;&lt;/SelectTrigger&gt;
                                &lt;SelectContent&gt;&lt;SelectItem value="all"&gt;All Aircraft&lt;/SelectItem&gt;{aircraftTypes.map(type =&gt; &lt;SelectItem key={type} value={type}&gt;{type}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;
                            &lt;/Select&gt;
                            &lt;Select value={purserFilter} onValueChange={setPurserFilter}&gt;
                                &lt;SelectTrigger&gt;&lt;Filter className="mr-2 h-4 w-4" /&gt;&lt;span className="truncate"&gt;Purser: {purserFilter === 'all' ? 'All' : initialUserMap.get(purserFilter)?.displayName}&lt;/span&gt;&lt;/SelectTrigger&gt;
                                &lt;SelectContent&gt;&lt;SelectItem value="all"&gt;All Pursers&lt;/SelectItem&gt;{initialPursers.map(p =&gt; &lt;SelectItem key={p.uid} value={p.uid}&gt;{p.displayName}&lt;/SelectItem&gt;)}&lt;/SelectContent&gt;
                            &lt;/Select&gt;
                        &lt;/div&gt;
                        &lt;div className="flex items-center space-x-2 shrink-0 mt-2 md:mt-0"&gt;
                            &lt;Label htmlFor="pending-swaps-filter" className="flex items-center gap-1 text-sm text-warning-foreground"&gt;&lt;Filter className="h-4 w-4"/&gt;Pending Swaps Only&lt;/Label&gt;
                            &lt;Switch id="pending-swaps-filter" checked={showPendingSwapsOnly} onCheckedChange={setShowPendingSwapsOnly} /&gt;
                        &lt;/div&gt;
                    &lt;/div&gt;
                &lt;/CardContent&gt;
                &lt;CardFooter className="flex-wrap items-center gap-4 border-t pt-4"&gt;
                        &lt;Button variant="outline" onClick={fetchPageData} disabled={isLoading}&gt;&lt;RefreshCw className={`mr-2 h-4 w-4 animate-spin ${isLoading ? 'animate-spin' : ''}`} /&gt;Refresh&lt;/Button&gt;
                        &lt;Button onClick={() =&gt; handleOpenDialog()}&gt;&lt;PlusCircle className="mr-2 h-4 w-4"/&gt;Create Flight&lt;/Button&gt;
                         {listenerError &amp;&amp; (
                            &lt;div className="flex items-center gap-2 text-sm text-destructive font-medium ml-auto"&gt;
                                &lt;BellOff className="h-4 w-4"/&gt;
                                &lt;span&gt;{listenerError}&lt;/span&gt;
                            &lt;/div&gt;
                        )}
                &lt;/CardFooter&gt;
            &lt;/Card&gt;

            &lt;div className="rounded-md border"&gt;
                &lt;Table&gt;
                    &lt;TableHeader&gt;
                        &lt;TableRow&gt;
                            &lt;SortableHeader column="scheduledDepartureDateTimeUTC" label="Date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;SortableHeader column="flightNumber" label="Flight No." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;SortableHeader column="departureAirportName" label="Route" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;SortableHeader column="purserName" label="Purser" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/&gt;
                            &lt;TableHead&gt;Status&lt;/TableHead&gt;
                            &lt;TableHead className="text-right"&gt;Actions&lt;/TableHead&gt;
                        &lt;/TableRow&gt;
                    &lt;/TableHeader&gt;
                    &lt;TableBody&gt;
                        {sortedAndFilteredFlights.map((f) =&gt; (
                            &lt;TableRow key={f.id}&gt;
                                &lt;TableCell className="font-medium text-xs"&gt;{format(new Date(f.scheduledDepartureDateTimeUTC), "PP")}&lt;/TableCell&gt;
                                &lt;TableCell&gt;{f.flightNumber}&lt;/TableCell&gt;
                                &lt;TableCell className="text-xs"&gt;{f.departureAirportName} → {f.arrivalAirportName}&lt;/TableCell&gt;
                                &lt;TableCell className="text-xs"&gt;
                                        &lt;Link href={`/admin/users/${f.purserId}`} className="hover:underline text-primary"&gt;
                                        {f.purserName}
                                    &lt;/Link&gt;
                                &lt;/TableCell&gt;
                                 &lt;TableCell className="space-x-2"&gt;
                                    {!f.purserReportSubmitted &amp;&amp; (&lt;Button variant="outline" size="icon" className="h-7 w-7 border-warning/80 text-warning-foreground" title="Purser Report Pending"&gt;&lt;FileSignature className="h-4 w-4" /&gt;&lt;/Button&gt;)}
                                    {f.pendingSwap &amp;&amp; (&lt;Button variant="outline" size="icon" className="h-7 w-7 border-warning text-warning-foreground animate-pulse" title="Swap Request Pending" onClick={() =&gt; setSwapToApprove(f.pendingSwap!)}&gt;&lt;Handshake className="h-4 w-4" /&gt;&lt;/Button&gt;)}
                                &lt;/TableCell&gt;
                                &lt;TableCell className="text-right space-x-1"&gt;
                                    &lt;Button variant="ghost" size="icon" onClick={() =&gt; handleOpenDialog(f)} title="Edit Flight"&gt;&lt;Edit className="h-4 w-4" /&gt;&lt;/Button&gt;
                                    &lt;Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() =&gt; handleDelete(f)} title="Delete Flight"&gt;&lt;Trash2 className="h-4 w-4" /&gt;&lt;/Button&gt;
                                &lt;/TableCell&gt;
                            &lt;/TableRow&gt;
                        ))}&lt;/TableBody&gt;
                    &lt;/TableHeader&gt;
                &lt;/Table&gt;
                {sortedAndFilteredFlights.length === 0 &amp;&amp; &lt;p className="text-center text-muted-foreground py-8"&gt;No flights found matching criteria.&lt;/p&gt;}
            &lt;/div&gt;
            
            {swapToApprove &amp;&amp; (
                &lt;SwapApprovalDialog swap={swapToApprove} onClose={() =&gt; setSwapToApprove(null)} onAction={fetchPageData} /&gt;
            )}

            &lt;Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}&gt;
                &lt;DialogContent className="max-w-4xl"&gt;
                   &lt;FlightForm
                        isEditMode={isEditMode}
                        currentFlight={currentFlight}
                        onFormSubmitSuccess={onFormSubmitSuccess}
                        allUsers={initialAllUsers}
                        userMap={initialUserMap}
                        pursers={initialPursers}
                        pilots={initialPilots}
                        cabinCrew={initialCabinCrew}
                        instructors={initialInstructors}
                        trainees={initialTrainees}
                   /&gt;
                &lt;/DialogContent&gt;
            &lt;/Dialog&gt;
        &lt;/div&gt;
    );
}
