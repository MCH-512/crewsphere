
"use client";

import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Plane } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

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
const ON_GROUND = 8;
const VELOCITY = 9;
const TRUE_TRACK = 10;
const GEO_ALTITUDE = 13;

const LiveMap = ({ flights }: { flights: any[] }) => {
    const planeIconSVG = renderToStaticMarkup(<Plane className="h-5 w-5 text-primary stroke-[2.5]" />);
    
    return (
        <MapContainer 
          center={[40, 0]} 
          zoom={3} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%' }} 
          className="rounded-lg z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

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
        </MapContainer>
    );
};

export default LiveMap;
