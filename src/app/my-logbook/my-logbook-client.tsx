"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { NotebookPen, Loader2, AlertTriangle, Sigma, Hourglass, Plane, UserSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StoredFlight } from "@/schemas/flight-schema";
import { AnimatedCard } from "@/components/motion/animated-card";

export interface LogbookEntry extends StoredFlight {
    flightDurationMinutes: number;
    userRoleOnFlight: string;
}

const formatDuration = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return "0h 0m";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
};

export function MyLogbookClient({ initialEntries }: { initialEntries: LogbookEntry[] }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [logbookEntries, setLogbookEntries] = React.useState<LogbookEntry[]>(initialEntries);
    const [isLoading, setIsLoading] = React.useState(false); // Used for subsequent fetches, not initial load
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const summaryStats = React.useMemo(() => {
        const totalFlights = logbookEntries.length;
        const totalFlightMinutes = logbookEntries.reduce((acc, entry) => acc + (entry.flightDurationMinutes || 0), 0);
        
        const hoursByAircraft = logbookEntries.reduce((acc, entry) => {
            const type = entry.aircraftType || "Unknown";
            const currentMinutes = acc[type] || 0;
            acc[type] = currentMinutes + (entry.flightDurationMinutes || 0);
            return acc;
        }, {} as Record<string, number>);

        const hoursByRole = logbookEntries.reduce((acc, entry) => {
            const role = entry.userRoleOnFlight || "Unknown";
            const currentMinutes = acc[role] || 0;
            acc[role] = currentMinutes + (entry.flightDurationMinutes || 0);
            return acc;
        }, {} as Record<string, number>);

        return {
            totalFlights,
            totalFlightTime: formatDuration(totalFlightMinutes),
            hoursByAircraft: Object.entries(hoursByAircraft).map(([type, minutes]) => ({ type, time: formatDuration(minutes) })).sort((a,b) => b.time.localeCompare(a.time)),
            hoursByRole: Object.entries(hoursByRole).map(([role, minutes]) => ({ role, time: formatDuration(minutes) })).sort((a,b) => b.time.localeCompare(a.time)),
        };
    }, [logbookEntries]);
    
    if (authLoading) {
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
                            A synchronized record of all your completed flights with detailed statistics.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </AnimatedCard>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <AnimatedCard delay={0.2}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Hours by Aircraft</CardTitle>
                            <Plane className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="h-16 overflow-y-auto">
                            {summaryStats.hoursByAircraft.length > 0 ? (
                                <div className="text-xs space-y-1">
                                    {summaryStats.hoursByAircraft.map(item => (
                                        <div key={item.type} className="flex justify-between">
                                            <span className="font-medium text-foreground">{item.type}</span>
                                            <span className="text-muted-foreground">{item.time}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-muted-foreground">No data</p>}
                        </CardContent>
                    </Card>
                </AnimatedCard>
                <AnimatedCard delay={0.25}>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Hours by Role</CardTitle>
                            <UserSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="h-16 overflow-y-auto">
                            {summaryStats.hoursByRole.length > 0 ? (
                                <div className="text-xs space-y-1">
                                    {summaryStats.hoursByRole.map(item => (
                                        <div key={item.role} className="flex justify-between">
                                            <span className="font-medium text-foreground">{item.role}</span>
                                            <span className="text-muted-foreground">{item.time}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-muted-foreground">No data</p>}
                        </CardContent>
                    </Card>
                </AnimatedCard>
            </div>

            <AnimatedCard delay={0.3}>
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
