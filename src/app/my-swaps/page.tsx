
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Handshake, Loader2, AlertTriangle, ArrowRight, Plane, ArrowLeft, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { StoredFlightSwap, FlightSwapStatus } from "@/schemas/flight-swap-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cancelMySwap } from "@/services/flight-swap-service";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { VariantProps } from "class-variance-authority";

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

const SwapCard = ({ swap, isInitiator, onCancel }: { swap: StoredFlightSwap, isInitiator: boolean, onCancel: (swapId: string) => Promise<void>}) => {
    const flightToShow = isInitiator ? swap.flightInfo : swap.requestingFlightInfo;
    const otherParty = isInitiator ? swap.requestingUserEmail : swap.initiatingUserEmail;
    
    const handleCancel = async () => {
        await onCancel(swap.id);
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Plane className="h-5 w-5 text-primary"/>
                        Flight {flightToShow?.flightNumber}
                    </CardTitle>
                    <CardDescription className="text-xs">
                        {format(parseISO(flightToShow?.scheduledDepartureDateTimeUTC || new Date().toISOString()), "PPP 'at' HH:mm 'UTC'")}
                    </CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(swap.status)} className="capitalize">{swap.status.replace('_', ' ')}</Badge>
            </CardHeader>
            <CardContent>
                <div className="text-sm">
                    <p><strong>Route:</strong> {flightToShow?.departureAirport} → {flightToShow?.arrivalAirport}</p>
                    {otherParty && <p><strong>Counterparty:</strong> {otherParty}</p>}
                    {swap.status === 'rejected' && swap.adminNotes && <p className="text-destructive text-xs mt-2"><strong>Admin Note:</strong> {swap.adminNotes}</p>}
                </div>
            </CardContent>
            {(isInitiator && swap.status === 'posted') && (
                 <CardFooter>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm"><XCircle className="mr-2 h-4 w-4"/>Cancel Post</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will remove your flight from the swap board. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Back</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCancel}>Confirm Cancellation</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            )}
        </Card>
    );
};


export default function MySwapsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [myPostedSwaps, setMyPostedSwaps] = React.useState<StoredFlightSwap[]>([]);
    const [myRequestedSwaps, setMyRequestedSwaps] = React.useState<StoredFlightSwap[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const fetchData = React.useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const postedQuery = query(collection(db, "flightSwaps"), where("initiatingUserId", "==", user.uid), orderBy("createdAt", "desc"));
            const requestedQuery = query(collection(db, "flightSwaps"), where("requestingUserId", "==", user.uid), orderBy("createdAt", "desc"));

            const [postedSnapshot, requestedSnapshot] = await Promise.all([
                getDocs(postedQuery),
                getDocs(requestedQuery)
            ]);

            setMyPostedSwaps(postedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap)));
            setMyRequestedSwaps(requestedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredFlightSwap)));
        } catch (error) {
            console.error("Error fetching user's swaps:", error);
            toast({ title: "Error", description: "Could not load your swap history.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        fetchData();
    }, [user, authLoading, router, fetchData]);
    
    const handleCancelSwap = async (swapId: string) => {
        if(!user) return;
        try {
            await cancelMySwap(swapId, user.uid);
            toast({ title: "Swap Cancelled", description: "Your flight swap post has been removed."});
            fetchData();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive"});
        }
    };

    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex-row justify-between items-center">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <Handshake className="mr-3 h-7 w-7 text-primary" />
                            My Flight Swaps
                        </CardTitle>
                        <CardDescription>Track the status of your posted flights and swap requests.</CardDescription>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/flight-swap"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Swap Board</Link>
                    </Button>
                </CardHeader>
            </Card>

            <Tabs defaultValue="my-posts" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="my-posts">My Posted Swaps ({myPostedSwaps.length})</TabsTrigger>
                    <TabsTrigger value="my-requests">My Requests ({myRequestedSwaps.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="my-posts">
                     <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myPostedSwaps.length > 0 ? (
                            myPostedSwaps.map(swap => <SwapCard key={swap.id} swap={swap} isInitiator={true} onCancel={handleCancelSwap} />)
                        ) : (
                            <p className="col-span-full text-center text-muted-foreground py-8">You haven't posted any flights for swapping.</p>
                        )}
                    </div>
                </TabsContent>
                 <TabsContent value="my-requests">
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                         {myRequestedSwaps.length > 0 ? (
                            myRequestedSwaps.map(swap => <SwapCard key={swap.id} swap={swap} isInitiator={false} onCancel={handleCancelSwap} />)
                        ) : (
                            <p className="col-span-full text-center text-muted-foreground py-8">You haven't requested any swaps.</p>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
