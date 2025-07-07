
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Handshake, Loader2, AlertTriangle, RefreshCw, Check, X, Plane, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { StoredFlightSwap, FlightSwapStatus } from "@/schemas/flight-swap-schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { approveFlightSwap, rejectFlightSwap } from "@/services/admin-flight-swap-service";
import type { VariantProps } from "class-variance-authority";
import { getAirportByCode } from "@/services/airport-service";

interface FlightSwapForDisplay extends StoredFlightSwap {
    flightInfo: {
        flightNumber: string;
        departureAirport: string;
        arrivalAirport: string;
        scheduledDepartureDateTimeUTC: string;
        departureAirportDisplay?: string;
        arrivalAirportDisplay?: string;
    };
    requestingFlightInfo?: {
        flightNumber: string;
        departureAirport: string;
        arrivalAirport: string;
        scheduledDepartureDateTimeUTC: string;
        departureAirportDisplay?: string;
        arrivalAirportDisplay?: string;
    };
}


const getStatusBadgeVariant = (status: FlightSwapStatus): VariantProps<typeof Badge>["variant"] => {
    switch (status) {
        case "posted": return "secondary";
        case "pending_approval": return "default";
        case "approved": return "success";
        case "rejected": return "destructive";
        case "cancelled": return "outline";
        default: return "secondary";
    }
};

export default function AdminFlightSwapsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [swaps, setSwaps] = React.useState<FlightSwapForDisplay[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [selectedSwap, setSelectedSwap] = React.useState<FlightSwapForDisplay | null>(null);
    const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [rejectionNotes, setRejectionNotes] = React.useState("");
    const [actionType, setActionType] = React.useState<'approve' | 'reject' | null>(null);

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const swapsQuery = query(collection(db, "flightSwaps"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(swapsQuery);

            const swapsData = await Promise.all(snapshot.docs.map(async (doc) => {
                const swap = { id: doc.id, ...doc.data() } as StoredFlightSwap;

                const [initDep, initArr] = await Promise.all([
                    getAirportByCode(swap.flightInfo.departureAirport),
                    getAirportByCode(swap.flightInfo.arrivalAirport)
                ]);
                
                (swap.flightInfo as any).departureAirportDisplay = initDep ? `${initDep.city} (${initDep.iata})` : swap.flightInfo.departureAirport;
                (swap.flightInfo as any).arrivalAirportDisplay = initArr ? `${initArr.city} (${initArr.iata})` : swap.flightInfo.arrivalAirport;

                if (swap.requestingFlightInfo) {
                    const [reqDep, reqArr] = await Promise.all([
                        getAirportByCode(swap.requestingFlightInfo.departureAirport),
                        getAirportByCode(swap.requestingFlightInfo.arrivalAirport)
                    ]);
                    (swap.requestingFlightInfo as any).departureAirportDisplay = reqDep ? `${reqDep.city} (${reqDep.iata})` : swap.requestingFlightInfo.departureAirport;
                    (swap.requestingFlightInfo as any).arrivalAirportDisplay = reqArr ? `${reqArr.city} (${reqArr.iata})` : swap.requestingFlightInfo.arrivalAirport;
                }
                return swap;
            }));
            
            setSwaps(swapsData as FlightSwapForDisplay[]);
        } catch (error) {
            toast({ title: "Error", description: "Could not load flight swaps.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (!authLoading && user?.role === 'admin') {
            fetchData();
        } else if (!authLoading) {
            router.push('/');
        }
    }, [user, authLoading, router, fetchData]);

    const handleOpenDialog = (swap: FlightSwapForDisplay, type: 'approve' | 'reject') => {
        setSelectedSwap(swap);
        setActionType(type);
        setRejectionNotes("");
        setIsManageDialogOpen(true);
    };

    const handleConfirmAction = async () => {
        if (!selectedSwap || !user || !actionType) return;
        setIsSubmitting(true);
        try {
            if (actionType === 'approve') {
                await approveFlightSwap(selectedSwap.id, user.uid, user.email || '');
                toast({ title: "Swap Approved", description: "The flight schedules have been updated." });
            } else if (actionType === 'reject') {
                if (!rejectionNotes) {
                    toast({ title: "Validation Error", description: "Rejection notes are required.", variant: "destructive"});
                    setIsSubmitting(false);
                    return;
                }
                await rejectFlightSwap(selectedSwap.id, user.uid, user.email || '', rejectionNotes);
                toast({ title: "Swap Rejected", description: "The swap request has been rejected." });
            }
            fetchData();
            setIsManageDialogOpen(false);
        } catch (error: any) {
            toast({ title: "Action Failed", description: error.message, variant: "destructive"});
        } finally {
            setIsSubmitting(false);
        }
    };

    const filterSwaps = (status: FlightSwapStatus) => swaps.filter(s => s.status === status);

    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex-row justify-between items-center">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center"><Handshake className="mr-3 h-7 w-7 text-primary" />Flight Swap Management</CardTitle>
                        <CardDescription>Approve or reject pending flight swap requests from crew members.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={fetchData} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                </CardHeader>
            </Card>

            <Tabs defaultValue="pending_approval">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="pending_approval">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                </TabsList>
                
                {(['pending_approval', 'approved', 'rejected', 'cancelled'] as FlightSwapStatus[]).map(status => (
                    <TabsContent key={status} value={status}>
                        <Card>
                            <CardContent className="pt-6">
                                {filterSwaps(status).length > 0 ? (
                                <div className="space-y-4">
                                    {filterSwaps(status).map(swap => (
                                        <Card key={swap.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_150px] items-center p-4 gap-4">
                                            <div className="text-sm">
                                                <p className="text-xs text-muted-foreground">Initiator</p>
                                                <p className="font-semibold">{swap.initiatingUserEmail}</p>
                                                <p>Flight {swap.flightInfo.flightNumber}</p>
                                                <p className="text-xs text-muted-foreground">{swap.flightInfo.departureAirportDisplay} → {swap.flightInfo.arrivalAirportDisplay}</p>
                                            </div>
                                            <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
                                            <div className="text-sm">
                                                 <p className="text-xs text-muted-foreground">Requestor</p>
                                                 <p className="font-semibold">{swap.requestingUserEmail || "N/A"}</p>
                                                 {swap.requestingFlightInfo ? (
                                                     <>
                                                         <p>Flight {swap.requestingFlightInfo.flightNumber}</p>
                                                         <p className="text-xs text-muted-foreground">{swap.requestingFlightInfo.departureAirportDisplay} → {swap.requestingFlightInfo.arrivalAirportDisplay}</p>
                                                     </>
                                                 ) : <p>N/A</p>}
                                            </div>
                                            <div className="flex gap-2 justify-self-end">
                                                {status === 'pending_approval' && (
                                                    <>
                                                        <Button size="sm" variant="success" onClick={() => handleOpenDialog(swap, 'approve')}><Check className="mr-1 h-4 w-4"/>Approve</Button>
                                                        <Button size="sm" variant="destructive" onClick={() => handleOpenDialog(swap, 'reject')}><X className="mr-1 h-4 w-4"/>Reject</Button>
                                                    </>
                                                )}
                                                {status !== 'pending_approval' && <Badge variant={getStatusBadgeVariant(swap.status)} className="capitalize">{swap.status.replace('_', ' ')}</Badge>}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">No swaps with status "{status.replace('_', ' ')}".</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>

            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}</DialogTitle>
                        <DialogDescription>
                            {actionType === 'approve' ? 'Review the details below before approving the swap.' : 'Please provide a reason for rejecting this swap.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="my-4 space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <Card className="p-3"><CardHeader className="p-1 pb-2"><CardTitle className="text-sm">Original Flight</CardTitle></CardHeader><CardContent className="text-xs p-1 space-y-1">
                                <p><strong>User:</strong> {selectedSwap?.initiatingUserEmail}</p>
                                <p><strong>Flight:</strong> {selectedSwap?.flightInfo.flightNumber}</p>
                                <p><strong>Route:</strong> {selectedSwap?.flightInfo.departureAirportDisplay} → {selectedSwap?.flightInfo.arrivalAirportDisplay}</p>
                                <p><strong>Date:</strong> {format(parseISO(selectedSwap?.flightInfo.scheduledDepartureDateTimeUTC || '_'), 'PP')}</p>
                            </CardContent></Card>
                            <Card className="p-3"><CardHeader className="p-1 pb-2"><CardTitle className="text-sm">Requested Flight</CardTitle></CardHeader><CardContent className="text-xs p-1 space-y-1">
                                <p><strong>User:</strong> {selectedSwap?.requestingUserEmail}</p>
                                <p><strong>Flight:</strong> {selectedSwap?.requestingFlightInfo?.flightNumber}</p>
                                <p><strong>Route:</strong> {selectedSwap?.requestingFlightInfo?.departureAirportDisplay} → {selectedSwap?.requestingFlightInfo?.arrivalAirportDisplay}</p>
                                <p><strong>Date:</strong> {format(parseISO(selectedSwap?.requestingFlightInfo?.scheduledDepartureDateTimeUTC || '_'), 'PP')}</p>
                            </CardContent></Card>
                         </div>

                        {actionType === 'reject' && (
                            <div className="space-y-2">
                                <Label htmlFor="rejection-notes">Rejection Notes (visible to users)</Label>
                                <Textarea id="rejection-notes" value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)} />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button variant={actionType === 'approve' ? 'success' : 'destructive'} onClick={handleConfirmAction} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
