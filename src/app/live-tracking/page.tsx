
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, RefreshCw, PlaneTakeoff, MapPin, TrendingUp, Wind, Compass, DownloadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Constants for Tunis-Carthage Airport (DTTA) and bounding box
const DTTA_LAT = 36.851002;
const DTTA_LON = 10.227000;
const LAT_SPAN = 1.5; // Approx +/- 1.5 degrees latitude
const LON_SPAN = 1.5; // Approx +/- 1.5 degrees longitude

const BOUNDING_BOX = {
  latMin: DTTA_LAT - LAT_SPAN / 2,
  lonMin: DTTA_LON - LON_SPAN / 2,
  latMax: DTTA_LAT + LAT_SPAN / 2,
  lonMax: DTTA_LON + LON_SPAN / 2,
};

const REFRESH_INTERVAL = 60000; // 60 seconds

interface OpenSkyStateVector {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null; // m/s
  true_track: number | null; // degrees
  vertical_rate: number | null; // m/s
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  category?: number; // Optional: A=Airplane, B=Helicopter, etc.
}

interface TransformedFlightState {
  id: string; // Using icao24
  callsign: string;
  originCountry: string;
  altitudeFt: number | null;
  speedKt: number | null;
  heading: number | null;
  verticalRateFpm: number | null;
  latitude: number | null;
  longitude: number | null;
  lastContact: string;
  category: string;
}

// Helper to transform OpenSky array data to object
const transformOpenskyData = (states: any[]): TransformedFlightState[] => {
  if (!states || states.length === 0) return [];
  return states
    .filter(state => !state[8] && state[5] !== null && state[6] !== null) // Filter out on_ground and no-lat/lon
    .map((state): TransformedFlightState => {
      const baroAltitudeM = state[7] as number | null;
      const geoAltitudeM = state[13] as number | null;
      const altitudeM = baroAltitudeM ?? geoAltitudeM;
      const velocityMs = state[9] as number | null;
      const verticalRateMs = state[11] as number | null;
      const categoryNum = state[17] as number | undefined;

      let categoryStr = "Unknown";
      if (categoryNum !== undefined) {
          // Based on OpenSky documentation for 'category'
          const categories: Record<number, string> = {
            0: "No Info", 1: "No ADS-B Emitter Category Information", 2: "Light (< 15500 lbs)",
            3: "Small (15500 to 75000 lbs)", 4: "Large (75000 to 300000 lbs)",
            5: "High Vortex Large", 6: "Heavy (> 300000 lbs)", 7: "High Performance (> 5g acceleration and > 400 kts)",
            8: "Rotorcraft", 9: "Glider / Sailplane", 10: "Lighter-than-air", 11: "Parachutist / Skydiver",
            12: "Ultralight / Hang-glider / Paraglider", 13: "Reserved", 14: "UAV", 15: "Space / Trans-atmospheric vehicle",
            16: "Surface Vehicle – Emergency", 17: "Surface Vehicle – Service",
            18: "Point Obstacle", 19: "Cluster Obstacle", 20: "Line Obstacle"
          };
          categoryStr = categories[categoryNum] || "Reserved/Other";
      }


      return {
        id: state[0] as string, // icao24
        callsign: (state[1] as string || "N/A").trim(),
        originCountry: state[2] as string,
        altitudeFt: altitudeM ? Math.round(altitudeM * 3.28084) : null,
        speedKt: velocityMs ? Math.round(velocityMs * 1.94384) : null,
        heading: state[10] !== null ? Math.round(state[10] as number) : null,
        verticalRateFpm: verticalRateMs ? Math.round(verticalRateMs * 196.85) : null,
        latitude: state[6] as number | null,
        longitude: state[5] as number | null,
        lastContact: format(new Date((state[4] as number) * 1000), "HH:mm:ss 'UTC'"),
        category: categoryStr,
      };
    });
};


export default function LiveTrackingPage() {
  const { toast } = useToast();
  const [flights, setFlights] = React.useState<TransformedFlightState[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const fetchFlightData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `https://opensky-network.org/api/states/all?lamin=${BOUNDING_BOX.latMin}&lomin=${BOUNDING_BOX.lonMin}&lamax=${BOUNDING_BOX.latMax}&lomax=${BOUNDING_BOX.lonMax}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OpenSky API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const transformed = transformOpenskyData(data.states || []);
      setFlights(transformed);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching live flight data:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred while fetching flight data.");
      toast({
        title: "Fetch Error",
        description: "Could not retrieve live flight data from OpenSky Network.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchFlightData(); // Initial fetch
    const intervalId = setInterval(fetchFlightData, REFRESH_INTERVAL);
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchFlightData]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <PlaneTakeoff className="mr-3 h-7 w-7 text-primary" />
            Live Flight Tracking
          </CardTitle>
          <CardDescription>
            Real-time flight data for aircraft in the vicinity of Tunis-Carthage Airport (DTTA).
            Data automatically refreshes approximately every {REFRESH_INTERVAL / 1000} seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button onClick={fetchFlightData} disabled={isLoading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Now
            </Button>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Last updated: {format(lastUpdated, "HH:mm:ss")}
              </p>
            )}
          </div>

          {isLoading && flights.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Fetching live flight data...</p>
            </div>
          )}

          {error && !isLoading && (
            <Card className="my-4 p-4 border-destructive bg-destructive/10">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-lg text-destructive-foreground flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Error Loading Flight Data
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-sm text-destructive-foreground/90">{error}</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && flights.length === 0 && (
            <div className="text-center py-10">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold">No aircraft detected in the monitored area.</p>
              <p className="text-sm text-muted-foreground">This could be due to no current traffic or API limitations.</p>
            </div>
          )}

          {!isLoading && !error && flights.length > 0 && (
            <div className="rounded-md border">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Callsign</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead className="text-right">Altitude (ft)</TableHead>
                    <TableHead className="text-right">Speed (kt)</TableHead>
                    <TableHead className="text-right">Heading (°)</TableHead>
                    <TableHead className="text-right">V/S (fpm)</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Last Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flights.map((flight) => (
                    <TableRow key={flight.id}>
                      <TableCell className="font-medium">
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help">{flight.callsign || "N/A"}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>ICAO24: {flight.id}</p>
                                {flight.latitude && flight.longitude && <p>Lat: {flight.latitude.toFixed(3)}, Lon: {flight.longitude.toFixed(3)}</p>}
                            </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{flight.originCountry}</TableCell>
                      <TableCell className="text-right">{flight.altitudeFt?.toLocaleString() ?? "N/A"}</TableCell>
                      <TableCell className="text-right">{flight.speedKt?.toLocaleString() ?? "N/A"}</TableCell>
                      <TableCell className="text-right">{flight.heading?.toString() ?? "N/A"}</TableCell>
                      <TableCell className="text-right">
                        {flight.verticalRateFpm !== null ? (
                            <Badge variant={flight.verticalRateFpm > 200 ? "success" : flight.verticalRateFpm < -200 ? "destructive" : "outline"} className="w-[70px] justify-center">
                                {flight.verticalRateFpm > 0 && <TrendingUp className="h-3 w-3 mr-1"/>}
                                {flight.verticalRateFpm < 0 && <DownloadCloud className="h-3 w-3 mr-1"/>}
                                {flight.verticalRateFpm.toLocaleString()}
                            </Badge>
                        ) : "N/A"}
                      </TableCell>
                      <TableCell className="text-xs">
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help truncate max-w-[100px] block">{flight.category}</span>
                            </TooltipTrigger>
                            <TooltipContent><p>{flight.category}</p></TooltipContent>
                         </Tooltip>
                      </TableCell>
                      <TableCell className="text-xs">{flight.lastContact}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    