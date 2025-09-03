"use client";

import * as React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Plane, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@/components/ui/button';

// Fix for default Leaflet icon path issues in Next.js
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconShadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({
    iconUrl,
    shadowUrl: iconShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// State vectors indices from OpenSky Network API
const ICAO24 = 0;
const CALLSIGN = 1;
const ORIGIN_COUNTRY = 2;
const LONGITUDE = 5;
const LATITUDE = 6;
const BARO_ALTITUDE = 7;
const VELOCITY = 9;
const TRUE_TRACK = 10;

const planeIconSVG = renderToStaticMarkup(<Plane className="h-5 w-5 text-primary stroke-[2.5]" />);

const FlightMarkers = ({ flights }: { flights: any[] }) => {
    return (
        <>
            {flights.map((flight) => {
                const callsign = flight[CALLSIGN]?.trim() || 'N/A';
                const rotation = flight[TRUE_TRACK] || 0;

                const planeIcon = L.divIcon({
                  html: `<div style="transform: rotate(${rotation}deg);">${planeIconSVG}</div>`,
                  className: 'bg-transparent border-0',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                });

                return (
                    <Marker
                        key={flight[ICAO24]}
                        position={[flight[LATITUDE], flight[LONGITUDE]]}
                        icon={planeIcon}
                    >
                        <Popup>
                            <div className="text-sm">
                                <p><strong>Flight:</strong> {callsign}</p>
                                <p><strong>Origin:</strong> {flight[ORIGIN_COUNTRY]}</p>
                                <p><strong>Altitude:</strong> {flight[BARO_ALTITUDE] ? `${(flight[BARO_ALTITUDE] * 3.28084).toFixed(0)} ft` : 'N/A'}</p>
                                <p><strong>Speed:</strong> {flight[VELOCITY] ? `${(flight[VELOCITY] * 1.94384).toFixed(0)} kts` : 'N/A'}</p>
                                <p><strong>Heading:</strong> {flight[TRUE_TRACK] ? `${flight[TRUE_TRACK].toFixed(0)}°` : 'N/A'}</p>
                            </div>
                        </Popup>
                        <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={false}>
                          {callsign}
                        </Tooltip>
                    </Marker>
                );
            })}
        </>
    );
};

const MapWrapper = React.memo(({ flights, center, zoom }: { flights: any[], center: L.LatLngExpression, zoom: number }) => {
    return (
        <MapContainer 
            center={center}
            zoom={zoom}
            scrollWheelZoom={true} 
            style={{ height: '100%', width: '100%' }} 
            className="rounded-lg z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlightMarkers flights={flights} />
        </MapContainer>
    );
});
MapWrapper.displayName = 'MapWrapper';


const LiveMap = () => {
    const [flights, setFlights] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
    const [mapState, setMapState] = React.useState({ center: [40, 0] as L.LatLngExpression, zoom: 3, key: Date.now() });

    const fetchFlights = React.useCallback(async (isManualRefresh = false) => {
        setIsLoading(true);
        if(isManualRefresh) {
            setError(null);
        }
        try {
            const response = await fetch('https://opensky-network.org/api/states/all');
            if (!response.ok) {
                throw new Error(`Failed to fetch flight data: ${response.statusText}`);
            }
            const data = await response.json();
            const positionedFlights = data.states
              ?.filter((s: any) => s[LONGITUDE] !== null && s[LATITUDE] !== null)
              .slice(0, 300) || []; // Limit for performance and handle null states
            setFlights(positionedFlights);
            setLastUpdated(new Date());
            setError(null); // Clear previous errors on successful fetch
        } catch (err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchFlights();
        const interval = setInterval(() => fetchFlights(false), 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, [fetchFlights]);
    
    const handleManualRefresh = () => {
        // Change key to force remount of map component if there was an error
        if (error) {
            setMapState(prev => ({ ...prev, key: Date.now() }));
        }
        fetchFlights(true);
    }

    return (
      <div className="h-full w-full relative">
        <div className="absolute top-2 right-2 z-[1000] bg-background/80 p-1.5 rounded-md flex items-center gap-2">
           {lastUpdated && !isLoading && !error && <p className="text-xs text-muted-foreground">Updated: {lastUpdated.toLocaleTimeString()}</p>}
           <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
        </div>

        {error && (
             <div className="absolute inset-0 z-[1000] bg-muted/80 rounded-lg flex flex-col items-center justify-center text-destructive backdrop-blur-sm">
                <AlertTriangle className="h-10 w-10 mb-4"/>
                <p className="font-semibold">Could not load flight data</p>
                <p className="text-sm">{error}</p>
            </div>
        )}

        {isLoading && flights.length === 0 && !error && (
             <div className="absolute inset-0 z-[1000] bg-muted/80 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="mt-2">Loading live flight data...</p>
            </div>
        )}

        <MapWrapper key={mapState.key} flights={flights} center={mapState.center} zoom={mapState.zoom} />
      </div>
    );
};

export default LiveMap;
