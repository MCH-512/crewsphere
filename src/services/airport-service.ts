
import airportsData from '@/data/airports.json';

export interface Airport {
  name: string;
  city: string;
  country: string;
  continent: string;
  iata: string | null;
  icao: string | null;
  lat: number;
  lon: number;
  alt: number;
  tz: string;
}

const airports: Airport[] = airportsData as Airport[];

// Create maps for quick lookups
const airportByIcao = new Map<string, Airport>();
const airportByIata = new Map<string, Airport>();

airports.forEach(airport => {
  if (airport.icao) {
    airportByIcao.set(airport.icao.toUpperCase(), airport);
  }
  if (airport.iata) {
    airportByIata.set(airport.iata.toUpperCase(), airport);
  }
});

/**
 * Finds an airport by its ICAO or IATA code.
 * @param code The ICAO or IATA code (case-insensitive).
 * @returns The Airport object or null if not found.
 */
export async function getAirportByCode(code: string): Promise<Airport | null> {
    if (!code) return null;
    const upperCode = code.toUpperCase();
    const airport = airportByIcao.get(upperCode) || airportByIata.get(upperCode);
    return airport || null;
}

/**
 * Searches for airports based on a query string.
 * The query is matched against the airport name, city, IATA, and ICAO codes.
 * @param query The search query string.
 * @param limit The maximum number of results to return.
 * @returns An array of matching Airport objects.
 */
export async function searchAirports(query: string, limit: number = 10): Promise<Airport[]> {
    if (!query) {
        return [];
    }
    const lowerCaseQuery = query.toLowerCase();
    const results: Airport[] = [];

    for (const airport of airports) {
        if (results.length >= limit) {
            break;
        }

        const name = airport.name.toLowerCase();
        const city = airport.city.toLowerCase();
        const iata = airport.iata?.toLowerCase() || '';
        const icao = airport.icao?.toLowerCase() || '';

        if (
            name.includes(lowerCaseQuery) ||
            city.includes(lowerCaseQuery) ||
            iata.startsWith(lowerCaseQuery) ||
            icao.startsWith(lowerCaseQuery)
        ) {
            results.push(airport);
        }
    }

    return results;
}
