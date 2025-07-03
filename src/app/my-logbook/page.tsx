"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { NotebookPen, Loader2, AlertTriangle, ArrowRight, Hourglass, Route, Sigma } from "lucide-react";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { StoredFlight } from "@/schemas/flight-schema";
import { AnimatedCard } from "@/components/motion/animated-card";

interface LogbookEntry extends StoredFlight {
    flightDurationMinutes: number;
    userRoleOnFlight: string;
}

const formatDuration = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return "0h 0m";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
};

export default function MyLogbookPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [logbookEntries, setLogbookEntries] = React.useState<LogbookEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchLogbook = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const flightsQuery = query(
                    collection(db, "flights"),
                    where("allCrewIds", "array-contains", user.uid),
                    orderBy("scheduledDepartureDateTimeUTC", "desc")
                );

                const querySnapshot = await getDocs(flightsQuery);
                const entries: LogbookEntry[] = querySnapshot.docs.map(doc => {
                    const data = { id: doc.id, ...doc.data() } as StoredFlight;
                    const departure = parseISO(data.scheduledDepartureDateTimeUTC);
                    const arrival = parseISO(data.scheduledArrivalDateTimeUTC);
                    const flightDurationMinutes = differenceInMinutes(arrival, departure);

                    let userRoleOnFlight = "Crew";
                    if (data.purserId === user.uid) userRoleOnFlight = "Purser";
                    else if (data.pilotIds?.includes(user.uid)) userRoleOnFlight = "Pilot";
                    else if (data.cabinCrewIds?.includes(user.uid)) userRoleOnFlight = "Cabin Crew";

                    return { ...data, flightDurationMinutes, userRoleOnFlight };
                });
                setLogbookEntries(entries);
            } catch (err: any) {
                console.error("Error fetching logbook:", err);
                setError("Could not load flight logbook data. The necessary database indexes might still be building. Please try again in a few minutes.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogbook();
    }, [user, authLoading, router]);

    const summaryStats = React.useMemo(() => {
        const totalFlights = logbookEntries.length;
        const totalFlightMinutes = logbookEntries.reduce((acc, entry) => acc + entry.flightDurationMinutes, 0);
        return {
            totalFlights,
            totalFlightTime: formatDuration(totalFlightMinutes),
        };
    }, [logbookEntries]);
    
    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (error) {
        return (
            <div className="text-center py-10">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                <p className="mt-4 text-lg">{error}</p>
            </div>
        );
    }
    
     if (!user) return null;

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <NotebookPen className="mr-3 h-7 w-7 text-primary" />
                            My Flight Logbook
                        </CardTitle>
                        <CardDescription>
                            A synchronized record of all your completed flights.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

             <div className="grid gap-4 md:grid-cols-2">
                <AnimatedCard delay={0.1}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Flights</CardTitle>
                            <Sigma className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.totalFlights}</div>
                        </CardContent>
                    </Card>
                </AnimatedCard>
                <AnimatedCard delay={0.15}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Flight Time</CardTitle>
                            <Hourglass className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.totalFlightTime}</div>
                        </CardContent>
                    </Card>
                </AnimatedCard>
            </div>

            <AnimatedCard delay={0.2}>
                 <Card>
                    <CardHeader>
                         <CardTitle>Logbook Entries</CardTitle>
                         <CardDescription>Your flights are listed from most recent to oldest.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {logbookEntries.length > 0 ? (
                             <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Flight</TableHead>
                                            <TableHead>Route</TableHead>
                                            <TableHead>Aircraft</TableHead>
                                            <TableHead>Duration</TableHead>
                                            <TableHead>Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logbookEntries.map((entry) => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="font-medium text-xs">{format(parseISO(entry.scheduledDepartureDateTimeUTC), "yyyy-MM-dd")}</TableCell>
                                                <TableCell>{entry.flightNumber}</TableCell>
                                                <TableCell className="text-xs">{entry.departureAirport} → {entry.arrivalAirport}</TableCell>
                                                <TableCell>{entry.aircraftType}</TableCell>
                                                <TableCell>{formatDuration(entry.flightDurationMinutes)}</TableCell>
                                                <TableCell>{entry.userRoleOnFlight}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                <p>No completed flights found in your logbook.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </AnimatedCard>
        </div>
    );
}
