"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, type User } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, PlusCircle, Handshake, Plane, Info, History, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { StoredFlight } from "@/schemas/flight-schema";
import { StoredFlightSwap } from "@/schemas/flight-swap-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAirportByCode } from "@/services/airport-service";
import { requestFlightSwap, postFlightSwap, getAvailableSwaps, type SwapWithConflict } from "@/services/flight-swap-service";

interface FlightForSwap extends StoredFlight {
    departureAirportIATA?: string;
    arrivalAirportIATA?: string;
}

const PostSwapDialog = ({ open, onOpenChange, userFlights, onPost }: { open: boolean, onOpenChange: (open: boolean) => void, userFlights: FlightForSwap[], onPost: (flightId: string) => Promise<void> }) => {
    const [selectedFlightId, setSelectedFlightId] = React.useState<string | null>(null);
    const [isPosting, setIsPosting] = React.useState(false);

    const handlePost = async () => {
        if (!selectedFlightId) return;
        setIsPosting(true);
        await onPost(selectedFlightId);
        setIsPosting(false);
        onOpenChange(false);
        setSelectedFlightId(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Post a Flight for Swap</DialogTitle>
                    <DialogDescription>Select one of your upcoming flights to make it available for swapping with other crew members.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3 max-h-[50vh] overflow-y-auto">
                    {userFlights.length > 0 ? userFlights.map(flight => (
                        <Card key={flight.id} className={`cursor-pointer transition-all ${selectedFlightId === flight.id ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'}`} onClick={() => setSelectedFlightId(flight.id)}>
                            <CardContent className="p-3">
                                <p className="font-semibold">Flight {flight.flightNumber}</p>
                                <p className="text-sm text-muted-foreground">{flight.departureAirportIATA} → {flight.arrivalAirportIATA}</p>
                                <p className="text-xs text-muted-foreground">{format(parseISO(flight.scheduledDepartureDateTimeUTC), "PPPp")}</p>
                            </CardContent>
                        </Card>
                    )) : (
                        <p className="text-center text-muted-foreground py-6">You have no upcoming flights eligible for swapping.</p>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handlePost} disabled={!selectedFlightId || isPosting}>
                        {isPosting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Post Selected Flight
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const RequestSwapDialog = ({ open, onOpenChange, userFlights, onConfirm, swapToRequest }: { open: boolean; onOpenChange: (open: boolean) => void; userFlights: FlightForSwap[]; onConfirm: (flightId: string) => Promise<void>; swapToRequest: StoredFlightSwap | null; }) => {
    const [selectedFlightId, setSelectedFlightId] = React.useState<string | null>(null);
    const [isRequesting, setIsRequesting] = React.useState(false);

    const handleConfirm = async () => {
        if (!selectedFlightId) return;
        setIsRequesting(true);
        await onConfirm(selectedFlightId);
        setIsRequesting(false);
        onOpenChange(false);
        setSelectedFlightId(null);
    };
    
    if (!swapToRequest) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request Flight Swap</DialogTitle>
                    <DialogDescription>Select one of your flights to offer in exchange for Flight {swapToRequest.flightInfo.flightNumber}.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3 max-h-[50vh] overflow-y-auto">
                    {userFlights.length > 0 ? userFlights.map(flight => (
                        <Card key={flight.id} className={`cursor-pointer transition-all ${selectedFlightId === flight.id ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'}`} onClick={() => setSelectedFlightId(flight.id)}>
                            <CardContent className="p-3">
                                <p className="font-semibold">Flight {flight.flightNumber}</p>
                                <p className="text-sm text-muted-foreground">{flight.departureAirportIATA} → {flight.arrivalAirportIATA}</p>
                                <p className="text-xs text-muted-foreground">{format(parseISO(flight.scheduledDepartureDateTimeUTC), "PPPp")}</p>
                            </CardContent>
                        </Card>
                    )) : (
                        <p className="text-center text-muted-foreground py-6">You have no upcoming flights to offer for a swap.</p>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleConfirm} disabled={!selectedFlightId || isRequesting}>
                        {isRequesting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirm Swap Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function FlightSwapPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [availableSwaps, setAvailableSwaps] = React.useState<SwapWithConflict[]>([]);
    const [userFlights, setUserFlights] = React.useState<FlightForSwap[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isPostDialogOpen, setIsPostDialogOpen] = React.useState(false);

    const [isRequestDialogOpen, setIsRequestDialogOpen] = React.useState(false);
    const [selectedSwapToRequest, setSelectedSwapToRequest] = React.useState<StoredFlightSwap | null>(null);

    const fetchData = React.useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // Fetch available swaps with conflict info
            const swapsWithConflicts = await getAvailableSwaps(user.uid);
            setAvailableSwaps(swapsWithConflicts);

            // Fetch user's upcoming flights to allow them to post one or request a swap
            const now = new Date().toISOString();
            const flightsQuery = query(
                collection(db, "flights"),
                where("allCrewIds", "array-contains", user.uid),
                where("scheduledDepartureDateTimeUTC", ">=", now),
                orderBy("scheduledDepartureDateTimeUTC", "asc")
            );
            const flightsSnapshot = await getDocs(flightsQuery);
            
             // We need to know which of the user's flights are already involved in ANY swap
            const allUserSwapsQuery = query(collection(db, "flightSwaps"), where("participantIds", "array-contains", user.uid));
            const allUserSwapsSnapshot = await getDocs(allUserSwapsQuery);
            const activeSwapFlightIds = allUserSwapsSnapshot.docs
                .map(doc => doc.data() as StoredFlightSwap)
                .filter(s => s.status === 'posted' || s.status === 'pending_approval')
                .flatMap(s => [s.initiatingFlightId, s.requestingFlightId].filter(Boolean));

            const eligibleFlights = await Promise.all(
                flightsSnapshot.docs
                    .filter(doc => !activeSwapFlightIds.includes(doc.id)) 
                    .map(async doc => {
                         const data = doc.data() as StoredFlight;
                         const [depAirport, arrAirport] = await Promise.all([
                            getAirportByCode(data.departureAirport),
                            getAirportByCode(data.arrivalAirport)
                        ]);
                        return { 
                            id: doc.id, 
                            ...data,
                            departureAirportIATA: depAirport?.iata,
                            arrivalAirportIATA: arrAirport?.iata,
                        };
                    })
            );
            setUserFlights(eligibleFlights);

        } catch (error) {
            console.error("Error fetching flight swap data:", error);
            toast({ title: "Error", description: "Could not load flight swap board.", variant: "destructive" });
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

    const handlePostSwap = async (flightId: string) => {
        if (!user) return;
        const flightToPost = userFlights.find(f => f.id === flightId);
        if (!flightToPost) {
            toast({ title: "Error", description: "Selected flight not found.", variant: "destructive" });
            return;
        }

        try {
            await postFlightSwap(flightToPost, user);
            toast({ title: "Success", description: `Flight ${flightToPost.flightNumber} has been posted for swapping.` });
            fetchData();
        } catch (error) {
            console.error("Error posting flight for swap:", error);
            toast({ title: "Post Failed", description: "Could not post your flight for swapping.", variant: "destructive" });
        }
    };
    
    const handleRequestSwap = async (requestingFlightId: string) => {
        if (!user || !selectedSwapToRequest) return;
        const flightToOffer = userFlights.find(f => f.id === requestingFlightId);
        if (!flightToOffer) {
            toast({ title: "Error", description: "The flight you offered could not be found.", variant: "destructive" });
            return;
        }

        try {
            await requestFlightSwap(selectedSwapToRequest.id, flightToOffer, user);
            toast({ title: "Request Sent!", description: "Your swap request has been sent for admin approval."});
            fetchData();
        } catch (error: unknown) {
            const e = error as Error;
            toast({ title: "Request Failed", description: e.message, variant: "destructive"});
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
                            <ArrowRightLeft className="mr-3 h-7 w-7 text-primary" />
                            Flight Swap Board
                        </CardTitle>
                        <CardDescription>
                            Browse available flights to swap or post one of your own.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsPostDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Post a Flight
                        </Button>
                         <Button asChild variant="outline">
                            <Link href="/my-swaps"><History className="mr-2 h-4 w-4"/>My Swaps</Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Alert>
                <Info className="h-4 w-4"/>
                <AlertTitle>How it works</AlertTitle>
                <AlertDescription>
                   This board shows flights other crew members want to swap. The system automatically checks for conflicts with your schedule.
                </AlertDescription>
            </Alert>
            
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableSwaps.map((swap, index) => (
                    <AnimatedCard key={swap.id} delay={0.1 + index * 0.05}>
                        <Card className="shadow-sm h-full flex flex-col hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                   <Plane className="h-5 w-5 text-primary"/> Flight {swap.flightInfo.flightNumber}
                                </CardTitle>
                                <CardDescription>
                                    Posted by: {swap.initiatingUserEmail}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="font-semibold">{swap.flightInfo.departureAirport} → {swap.flightInfo.arrivalAirport}</p>
                                <p className="text-sm text-muted-foreground">{format(parseISO(swap.flightInfo.scheduledDepartureDateTimeUTC), "EEEE, PPP 'at' HH:mm")} UTC</p>
                                 {swap.conflict && (
                                    <div className="mt-3 p-2 bg-warning/10 border-l-4 border-warning text-warning-foreground text-xs rounded-r-md flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <p><strong>Conflict:</strong> {swap.conflict}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" disabled={!!swap.conflict} onClick={() => { setSelectedSwapToRequest(swap); setIsRequestDialogOpen(true); }}>
                                    <Handshake className="mr-2 h-4 w-4" />
                                    Request Swap
                                </Button>
                            </CardFooter>
                        </Card>
                    </AnimatedCard>
                ))}
             </div>
             {availableSwaps.length === 0 && !isLoading && (
                 <Card className="text-center py-12">
                     <CardContent>
                        <p className="text-muted-foreground">No flights are currently available for swapping.</p>
                     </CardContent>
                 </Card>
             )}
            
            <PostSwapDialog 
                open={isPostDialogOpen} 
                onOpenChange={setIsPostDialogOpen} 
                userFlights={userFlights}
                onPost={handlePostSwap}
            />

            <RequestSwapDialog
                open={isRequestDialogOpen}
                onOpenChange={setIsRequestDialogOpen}
                userFlights={userFlights}
                onConfirm={handleRequestSwap}
                swapToRequest={selectedSwapToRequest}
            />
        </div>
    );
}

    