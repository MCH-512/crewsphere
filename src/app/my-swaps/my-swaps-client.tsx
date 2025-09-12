
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, History, X, Check, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { type StoredFlightSwap } from "@/schemas/flight-swap-schema";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Badge } from "@/components/ui/badge";
import { getMySwaps, cancelMySwap } from "@/services/flight-swap-service";

interface MySwapsClientProps {
    initialSwaps: StoredFlightSwap[];
}

export function MySwapsClient({ initialSwaps }: MySwapsClientProps) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [mySwaps, setMySwaps] = React.useState<StoredFlightSwap[]>(initialSwaps);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState<string | null>(null);

    const fetchData = React.useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const swaps = await getMySwaps(user.uid);
            setMySwaps(swaps);
            toast({title: "Refreshed", description: "Your swaps have been updated."})
        } catch (error) {
            console.error("Error fetching user swaps:", error);
            toast({ title: "Error", description: "Could not fetch your swaps.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    React.useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const handleCancel = async (swapId: string) => {
        if (!user || !window.confirm("Are you sure you want to cancel this swap posting?")) return;
        setIsCancelling(swapId);
        try {
            await cancelMySwap(swapId, user.uid);
            toast({ title: "Swap Cancelled", description: "Your flight swap posting has been removed." });
            fetchData();
        } catch (error: any) {
            toast({ title: "Cancellation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsCancelling(null);
        }
    };
    
    const getStatusBadgeVariant = (status: StoredFlightSwap['status']) => {
        switch (status) {
            case "posted": return "secondary";
            case "pending_approval": return "warning";
            case "approved": return "success";
            case "rejected":
            case "cancelled": return "destructive";
            default: return "outline";
        }
    };

    if (authLoading && mySwaps.length === 0) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader className="flex-row justify-between items-center">
                        <div>
                            <CardTitle className="text-2xl font-headline flex items-center">
                                <History className="mr-3 h-7 w-7 text-primary" />
                                My Swaps History
                            </CardTitle>
                            <CardDescription>
                                Track the status of your posted and requested flight swaps.
                            </CardDescription>
                        </div>
                         <div className="flex items-center gap-2">
                            <Button onClick={fetchData} variant="outline" disabled={isLoading}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button asChild variant="default">
                                <Link href="/flight-swap">
                                    <ArrowRightLeft className="mr-2 h-4 w-4"/> View Swap Board
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            {mySwaps.length === 0 ? (
                 <Card className="text-center py-12">
                     <CardContent>
                        <p className="text-muted-foreground">You have not posted any flights for swapping.</p>
                     </CardContent>
                 </Card>
            ) : (
                mySwaps.map((swap, index) => (
                    <AnimatedCard key={swap.id} delay={0.1 + index * 0.05}>
                        <Card className="shadow-sm">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg">Flight {swap.flightInfo.flightNumber}</CardTitle>
                                    <Badge variant={getStatusBadgeVariant(swap.status)} className="capitalize">
                                        {swap.status.replace('_', ' ')}
                                    </Badge>
                                </div>
                                 <CardDescription>
                                    {swap.flightInfo.departureAirport} → {swap.flightInfo.arrivalAirport} on {format(parseISO(swap.flightInfo.scheduledDepartureDateTimeUTC), "PP")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {swap.status === 'pending_approval' && swap.requestingUserEmail && (
                                    <p className="text-sm text-muted-foreground">
                                        Swap requested by <strong>{swap.requestingUserEmail}</strong>. Awaiting admin approval.
                                    </p>
                                )}
                                 {swap.status === 'approved' && (
                                    <p className="text-sm text-success flex items-center gap-2"><Check className="h-4 w-4"/>Swap approved! Your schedule has been updated.</p>
                                 )}
                                {swap.status === 'rejected' && (
                                    <p className="text-sm text-destructive">Swap rejected. Notes: {swap.adminNotes || 'No notes provided.'}</p>
                                )}
                            </CardContent>
                            {(swap.status === 'posted') && (
                                <CardFooter>
                                    <Button variant="destructive" size="sm" onClick={() => handleCancel(swap.id)} disabled={isCancelling === swap.id}>
                                        {isCancelling === swap.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4"/>}
                                        Cancel Post
                                    </Button>
                                </CardFooter>
                            )}
                        </Card>
                    </AnimatedCard>
                ))
            )}
        </div>
    );
}
