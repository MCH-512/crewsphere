
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";

const DynamicMap = dynamic(() => import('@/components/features/live-map'), {
    ssr: false,
    loading: () => <div className="h-[600px] w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2">Loading Map...</p></div>,
});


export default function LiveFlightTrackerPage() {
    const [flights, setFlights] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

    const fetchFlights = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('https://opensky-network.org/api/states/all');
            if (!response.ok) {
                throw new Error(`Failed to fetch flight data: ${response.statusText}`);
            }
            const data = await response.json();
            const positionedFlights = data.states
              .filter((s: any) => s[5] !== null && s[6] !== null)
              .slice(0, 300); // Limit to 300 for performance
            setFlights(positionedFlights);
            setLastUpdated(new Date());
        } catch (err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchFlights();
        const interval = setInterval(fetchFlights, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, [fetchFlights]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <MapIcon className="mr-3 h-7 w-7 text-primary" />
                            Live Flight Tracker
                        </CardTitle>
                        <CardDescription>
                            A real-time view of air traffic from the OpenSky Network. Data is refreshed automatically.
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <Button variant="outline" onClick={fetchFlights} disabled={isLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh Now
                        </Button>
                        {lastUpdated && <p className="text-xs text-muted-foreground mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>}
                    </div>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <div className="h-[600px] bg-muted rounded-lg flex flex-col items-center justify-center text-destructive">
                            <AlertTriangle className="h-10 w-10 mb-4"/>
                            <p className="font-semibold">Could not load flight data</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : (
                        <div className="h-[600px] w-full">
                           <DynamicMap flights={flights} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
