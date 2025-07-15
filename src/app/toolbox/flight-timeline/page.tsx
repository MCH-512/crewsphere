
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Waypoints, Loader2, AlertTriangle, Plane } from "lucide-react";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import type { StoredFlight } from "@/schemas/flight-schema";
import { getAirportByCode, type Airport } from "@/services/airport-service";
import { cn } from "@/lib/utils";
import { AnimatedCard } from "@/components/motion/animated-card";

type FlightStatus = "Scheduled" | "En Route" | "Arrived" | "Unknown";

interface FlightForDisplay extends StoredFlight {
    departureAirportInfo?: Airport | null;
    arrivalAirportInfo?: Airport | null;
    status: FlightStatus;
}

const getFlightStatus = (flight: StoredFlight): FlightStatus => {
    const now = new Date();
    try {
        const departureTime = parseISO(flight.scheduledDepartureDateTimeUTC);
        const arrivalTime = parseISO(flight.scheduledArrivalDateTimeUTC);
        if (isBefore(now, departureTime)) return "Scheduled";
        if (isAfter(now, arrivalTime)) return "Arrived";
        if (isAfter(now, departureTime) && isBefore(now, arrivalTime)) return "En Route";
    } catch (e) {
        return "Unknown";
    }
    return "Unknown";
};

export default function CompanyFlightTrackerPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [flights, setFlights] = React.useState<FlightForDisplay[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push("/login");
            return;
        }

        const fetchFlights = async () => {
            setIsLoading(true);
            try {
                const flightsQuery = query(collection(db, "flights"), orderBy("scheduledDepartureDateTimeUTC", "desc"));
                const querySnapshot = await getDocs(flightsQuery);
                
                const fetchedFlights = await Promise.all(
                    querySnapshot.docs.map(async (doc) => {
                        const data = { id: doc.id, ...doc.data() } as StoredFlight;
                        const [depAirport, arrAirport] = await Promise.all([
                            getAirportByCode(data.departureAirport),
                            getAirportByCode(data.arrivalAirport),
                        ]);
                        return {
                            ...data,
                            departureAirportInfo: depAirport,
                            arrivalAirportInfo: arrAirport,
                            status: getFlightStatus(data),
                        } as FlightForDisplay;
                    })
                );
                setFlights(fetchedFlights);
            } catch (error) {
                console.error("Error fetching flights:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFlights();
    }, [user, authLoading, router]);

    const getStatusBadgeVariant = (status: FlightStatus) => {
        switch (status) {
            case "Arrived": return "success";
            case "En Route": return "default";
            case "Scheduled": return "secondary";
            default: return "outline";
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center">
                        <Waypoints className="mr-3 h-7 w-7 text-primary" />
                        Company Flight Tracker
                    </CardTitle>
                    <CardDescription>
                        A real-time overview of all company flight operations.
                    </CardDescription>
                </CardHeader>
            </Card>

            <AnimatedCard delay={0.1}>
                <Card>
                    <CardContent className="pt-6">
                         <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Flight</TableHead>
                                        <TableHead>Route</TableHead>
                                        <TableHead>Departure (UTC)</TableHead>
                                        <TableHead>Arrival (UTC)</TableHead>
                                        <TableHead>Aircraft</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {flights.map((flight) => (
                                        <TableRow key={flight.id}>
                                            <TableCell className="font-medium">{flight.flightNumber}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{flight.departureAirportInfo?.city || flight.departureAirport} ({flight.departureAirport})</span>
                                                    <span className="text-muted-foreground">→ {flight.arrivalAirportInfo?.city || flight.arrivalAirport} ({flight.arrivalAirport})</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{format(parseISO(flight.scheduledDepartureDateTimeUTC), "MMM d, HH:mm")}</TableCell>
                                            <TableCell>{format(parseISO(flight.scheduledArrivalDateTimeUTC), "MMM d, HH:mm")}</TableCell>
                                            <TableCell>{flight.aircraftType}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(flight.status)}>{flight.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {flights.length === 0 && !isLoading && (
                            <p className="text-center text-muted-foreground py-8">No flights found.</p>
                        )}
                    </CardContent>
                </Card>
            </AnimatedCard>
        </div>
    );
}
