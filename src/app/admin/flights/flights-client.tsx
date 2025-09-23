
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Plane, Loader2, AlertTriangle, RefreshCw, Edit, PlusCircle, Trash2, ArrowRightLeft, Handshake, FileSignature, Filter, BellOff, Search, CheckCircle } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aircraftTypes } from "@/schemas/flight-schema";
import { Input } from "@/components/ui/input";
import { FlightForm } from "@/components/admin/flight-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const SwapApprovalDialog = ({ swap, onClose, onAction }: { swap: StoredFlightSwap, onClose: () => void, onAction: () => void }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [rejectionNotes, setRejectionNotes] = React.useState("");
    const [isRejecting, setIsRejecting] = React.useState(false);
    const [conflict, setConflict] = React.useState<string | null>(null);
    const [isCheckingConflict, setIsCheckingConflict] = React.useState(true);
    
    React.useEffect(() => {
        const checkConflicts = async () => {
            setIsCheckingConflict(true);
            const conflictMessage = await checkSwapConflict(swap);
            setConflict(conflictMessage);
            setIsCheckingConflict(false);
        };
        checkConflicts();
    }, [swap]);

    const handleApprove = async () => {
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
    
    const handleReject = async () => {
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
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Approve Flight Swap Request</DialogTitle>
                    <DialogDescription>Review the details below and approve or reject the swap.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 text-sm">
                    <Card><CardHeader><CardTitle className="text-base">Original Flight (Initiator)</CardTitle><CardDescription>{swap.initiatingUserEmail}</CardDescription></CardHeader>
                        <CardContent><p><strong>Flight:</strong> {swap.flightInfo.flightNumber}</p><p><strong>Route:</strong> {swap.flightInfo.departureAirport} to {swap.flightInfo.arrivalAirport}</p><p><strong>Date:</strong> {format(parseISO(swap.flightInfo.scheduledDepartureDateTimeUTC), "PPP")}</p></CardContent>
                    </Card>
                    <Card><CardHeader><CardTitle className="text-base">Proposed Swap (Requester)</CardTitle><CardDescription>{swap.requestingUserEmail}</CardDescription></CardHeader>
                        <CardContent><p><strong>Flight:</strong> {swap.requestingFlightInfo?.flightNumber}</p><p><strong>Route:</strong> {swap.requestingFlightInfo?.departureAirport} to {swap.requestingFlightInfo?.arrivalAirport}</p><p><strong>Date:</strong> {format(parseISO(swap.requestingFlightInfo?.scheduledDepartureDateTimeUTC || "1970-01-01"), "PPP")}</p></CardContent>
                    </Card>
                </div>
                {isCheckingConflict ? (
                     <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Checking for potential conflicts...</div>
                ) : conflict ? (
                    <Alert variant="warning">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Potential Conflict Detected</AlertTitle>
                        <AlertDescription>{conflict}</AlertDescription>
                    </Alert>
                ) : (
                    <Alert variant="success">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>No Conflicts Detected</AlertTitle>
                        <AlertDescription>No direct scheduling conflicts were found for this swap.</AlertDescription>
                    </Alert>
                )}
                 {isRejecting ? (
                    <div className="space-y-2 mt-4">
                        <Label htmlFor="rejection-notes">Reason for Rejection</Label>
                        <Textarea id="rejection-notes" value={rejectionNotes} onChange={(e) => setRejectionNotes(e.target.value)} placeholder="Provide a brief reason for rejection..." />
                    </div>
                ) : null}
                <DialogFooter className="mt-4">
                    {isRejecting ? (
                        <>
                            <Button variant="ghost" onClick={() => setIsRejecting(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirm Rejection
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={onClose}>Close</Button>
                            <Button variant="destructive" onClick={() => setIsRejecting(true)}>Reject</Button>
                            <Button onClick={handleApprove} disabled={isSubmitting || isCheckingConflict}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Approve Swap
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
    initialUserMap: Map<string, User>;
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
    
    const [flights, setFlights] = React.useState<FlightForDisplay[]>(initialFlights);
    const [isLoading, setIsLoading] = React.useState(false); // Only for client-side fetches
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [currentFlight, setCurrentFlight] = React.useState<StoredFlight | null>(null);

    const [sortColumn, setSortColumn] = React.useState<SortableColumn>('scheduledDepartureDateTimeUTC');
    const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');

    const [swapToApprove, setSwapToApprove] = React.useState<StoredFlightSwap | null>(null);
    const [showPendingSwapsOnly, setShowPendingSwapsOnly] = React.useState(false);
    const [listenerError, setListenerError] = React.useState<string | null>(null);

    const [searchTerm, setSearchTerm] = React.useState("");
    const [aircraftFilter, setAircraftFilter] = React.useState<string>("all");
    const [purserFilter, setPurserFilter] = React.useState<string>("all");

     const fetchPageData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const { flights } = await getFlightsForAdmin();
            setFlights(flights);
        } catch (err: unknown) {
            const e = err as Error;
            toast({ title: "Error Refreshing Data", description: e.message || "Could not fetch updated flight data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    React.useEffect(() => {
        if (!authLoading && !user) router.push('/');
    }, [user, authLoading, router]);

    React.useEffect(() => {
        if (!db) return;
        setListenerError(null);
        const q = query(collection(db, "flightSwaps"), where("status", "==", "pending_approval"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setListenerError(null);
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const newSwap = { id: change.doc.id, ...change.doc.data() } as StoredFlightSwap;
                    toast({
                        title: "New Swap Request",
                        description: `Flight ${newSwap.flightInfo.flightNumber} has a new swap request from ${newSwap.requestingUserEmail}.`,
                        action: <Button variant="secondary" size="sm" onClick={() => setSwapToApprove(newSwap)}>Review</Button>,
                        duration: 10000,
                    });
                    fetchPageData();
                }
            });
        }, (error) => {
            console.error("Error with swap listener:", error);
            setListenerError("Real-time connection lost. Refresh manually.");
            toast({ title: "Real-time Connection Lost", description: "Could not listen for new swap requests.", variant: "destructive" });
        });

        return () => unsubscribe();
    }, [toast, fetchPageData]);

    const sortedAndFilteredFlights = React.useMemo(() => {
        let displayFlights = [...flights];

        if (showPendingSwapsOnly) displayFlights = displayFlights.filter(f => f.pendingSwap);
        if (aircraftFilter !== 'all') displayFlights = displayFlights.filter(f => f.aircraftType === aircraftFilter);
        if (purserFilter !== 'all') displayFlights = displayFlights.filter(f => f.purserId === purserFilter);
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            displayFlights = displayFlights.filter(f => 
                f.flightNumber.toLowerCase().includes(lowerTerm) ||
                f.departureAirportName?.toLowerCase().includes(lowerTerm) ||
                f.arrivalAirportName?.toLowerCase().includes(lowerTerm)
            );
        }

        return displayFlights.sort((a, b) => {
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

    const handleSort = (column: SortableColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'scheduledDepartureDateTimeUTC' ? 'desc' : 'asc');
        }
    };
    
    const onFormSubmitSuccess = () => {
        setIsManageDialogOpen(false);
        fetchPageData();
    }

    const handleOpenDialog = (flightToEdit?: StoredFlight) => {
        if (flightToEdit) {
            setIsEditMode(true);
            setCurrentFlight(flightToEdit);
        } else {
            setIsEditMode(false);
            setCurrentFlight(null);
        }
        setIsManageDialogOpen(true);
    };

    const handleDelete = async (flightToDelete: StoredFlight) => {
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

    if (authLoading) return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!user || user.role !== 'admin') return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">You do not have permission to view this page.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><Plane className="mr-3 h-7 w-7 text-primary" />Flight Management</CardTitle>
                        <CardDescription>Schedule new flights and assign crew members.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-col md:flex-row gap-2">
                        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input type="search" placeholder="Search flights..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
                                <SelectTrigger><Filter className="mr-2 h-4 w-4" /> <span className="truncate">Aircraft: {aircraftFilter === 'all' ? 'All' : aircraftFilter}</span></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Aircraft</SelectItem>{aircraftTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={purserFilter} onValueChange={setPurserFilter}>
                                <SelectTrigger><Filter className="mr-2 h-4 w-4" /><span className="truncate">Purser: {purserFilter === 'all' ? 'All' : initialUserMap.get(purserFilter)?.displayName}</span></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Pursers</SelectItem>{initialPursers.map(p => <SelectItem key={p.uid} value={p.uid}>{p.displayName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 mt-2 md:mt-0">
                            <Label htmlFor="pending-swaps-filter" className="flex items-center gap-1 text-sm text-warning-foreground"><Filter className="h-4 w-4"/>Pending Swaps Only</Label>
                            <Switch id="pending-swaps-filter" checked={showPendingSwapsOnly} onCheckedChange={setShowPendingSwapsOnly} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-wrap items-center gap-4 border-t pt-4">
                        <Button variant="outline" onClick={fetchPageData} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 animate-spin ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Create Flight</Button>
                         {listenerError && (
                            <div className="flex items-center gap-2 text-sm text-destructive font-medium ml-auto">
                                <BellOff className="h-4 w-4"/>
                                <span>{listenerError}</span>
                            </div>
                        )}
                </CardFooter>
            </Card>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableHeader column="scheduledDepartureDateTimeUTC" label="Date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <SortableHeader column="flightNumber" label="Flight No." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <SortableHeader column="departureAirportName" label="Route" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <SortableHeader column="purserName" label="Purser" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}/>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedAndFilteredFlights.map((f) => (
                            <TableRow key={f.id}>
                                <TableCell className="font-medium text-xs">{format(new Date(f.scheduledDepartureDateTimeUTC), "PP")}</TableCell>
                                <TableCell>{f.flightNumber}</TableCell>
                                <TableCell className="text-xs">{f.departureAirportName} → {f.arrivalAirportName}</TableCell>
                                <TableCell className="text-xs">
                                        <Link href={`/admin/users/${f.purserId}`} className="hover:underline text-primary">
                                        {f.purserName}
                                    </Link>
                                </TableCell>
                                 <TableCell className="space-x-2">
                                    {!f.purserReportSubmitted && (<Button variant="outline" size="icon" className="h-7 w-7 border-warning/80 text-warning-foreground" title="Purser Report Pending"><FileSignature className="h-4 w-4" /></Button>)}
                                    {f.pendingSwap && (<Button variant="outline" size="icon" className="h-7 w-7 border-warning text-warning-foreground animate-pulse" title="Swap Request Pending" onClick={() => setSwapToApprove(f.pendingSwap!)}><Handshake className="h-4 w-4" /></Button>)}
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(f)} title="Edit Flight"><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(f)} title="Delete Flight"><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {sortedAndFilteredFlights.length === 0 && <p className="text-center text-muted-foreground py-8">No flights found matching criteria.</p>}
            </div>
            
            {swapToApprove && (
                <SwapApprovalDialog swap={swapToApprove} onClose={() => setSwapToApprove(null)} onAction={fetchPageData} />
            )}

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="max-w-4xl">
                   <FlightForm
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
                   />
                </DialogContent>
            </Dialog>
        </div>
    );
}
