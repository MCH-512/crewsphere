
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2, AlertTriangle, ArrowRight, History, Plane } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { StoredFlight } from "@/schemas/flight-schema";
import { getAirportByCode } from "@/services/airport-service";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";

interface FlightForReporting extends StoredFlight {
    id: string;
    departureAirportIATA?: string;
    arrivalAirportIATA?: string;
}

export default function PurserReportsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [flights, setFlights] = React.useState<FlightForReporting[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        if (!['purser', 'admin', 'instructor'].includes(user.role || '')) {
             toast({ title: "Access Denied", description: "This page is for authorized personnel only (Pursers, Admins, Instructors).", variant: "destructive" });
             router.push('/');
             return;
        }

        const fetchFlights = async () => {
            setIsLoading(true);
            try {
                const q = query(
                    collection(db, "flights"),
                    where("purserId", "==", user.uid),
                    where("purserReportSubmitted", "==", false),
                    orderBy("scheduledDepartureDateTimeUTC", "desc")
                );
                const querySnapshot = await getDocs(q);
                const fetchedFlights = await Promise.all(
                    querySnapshot.docs.map(async (doc) => {
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
                setFlights(fetchedFlights);
            } catch (err) {
                console.error("Error fetching flights:", err);
                toast({ title: "Loading Error", description: "Could not fetch flights needing reports.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchFlights();
    }, [user, authLoading, router, toast]);

    if (isLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

     if (!user || (!['purser', 'admin', 'instructor'].includes(user.role || ''))) {
        return <div className="flex flex-col items-center justify-center min-h-screen text-center p-4"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl mb-2">Access Denied</CardTitle><p className="text-muted-foreground">This section is for authorized personnel only.</p><Button onClick={() => router.push('/')} className="mt-6">Go to Dashboard</Button></div>;
    }

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <CardTitle className="text-2xl font-headline flex items-center">
                                <FileSignature className="mr-3 h-7 w-7 text-primary" />
                                Purser Reports
                            </CardTitle>
                            <CardDescription>Submit flight reports for your completed duties.</CardDescription>
                        </div>
                        <Button asChild variant="outline" className="w-full sm:w-auto">
                            <Link href="/purser-reports/history">
                                <History className="mr-2 h-4 w-4" />
                                View Submitted Reports
                            </Link>
                        </Button>
                    </CardHeader>
                </Card>
            </AnimatedCard>
            
            <AnimatedCard delay={0.1}>
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Flights Awaiting Report</CardTitle>
                        <CardDescription>Select a flight to begin filling out the purser report.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {flights.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No flights are currently awaiting a report. Well done!</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {flights.map(flight => (
                                    <Card key={flight.id} className="shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                               <Plane className="h-4 w-4 text-primary"/> Flight {flight.flightNumber}
                                            </CardTitle>
                                            <CardDescription>
                                                {format(parseISO(flight.scheduledDepartureDateTimeUTC), "PP")}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="font-semibold">{flight.departureAirportIATA || flight.departureAirport} → {flight.arrivalAirportIATA || flight.arrivalAirport}</p>
                                            <p className="text-xs text-muted-foreground">{flight.aircraftType}</p>
                                        </CardContent>
                                        <CardFooter>
                                            <Button className="w-full" asChild>
                                                <Link href={`/purser-reports/submit/${flight.id}`}>
                                                    Submit Report <ArrowRight className="ml-2 h-4 w-4"/>
                                                </Link>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </AnimatedCard>
        </div>
    );
}
