
import airportsData from '@/data/airports.json';

export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
}

// Simulate an async operation, though with local JSON it's immediate.
// This makes it easier to switch to an API later.
export async function searchAirports(searchTerm: string): Promise<Airport[]> {
  if (!searchTerm.trim()) {
    return [];
  }

  const lowercasedSearchTerm = searchTerm.toLowerCase();

  const filteredAirports = airportsData.filter(airport => {
    return (
      airport.name.toLowerCase().includes(lowercasedSearchTerm) ||
      airport.iata.toLowerCase().includes(lowercasedSearchTerm) ||
      airport.icao.toLowerCase().includes(lowercasedSearchTerm) ||
      airport.city.toLowerCase().includes(lowercasedSearchTerm) ||
      airport.country.toLowerCase().includes(lowercasedSearchTerm)
    );
  });

  // Simulate a slight delay as if fetching from an API
  // await new Promise(resolve => setTimeout(resolve, 100));

  return filteredAirports;
}

export async function getAirportByCode(code: string): Promise<Airport | undefined> {
  if (!code.trim()) {
    return undefined;
  }
  const lowercasedCode = code.toLowerCase();
  const airport = airportsData.find(
    (ap) =>
      ap.iata.toLowerCase() === lowercasedCode ||
      ap.icao.toLowerCase() === lowercasedCode
  );
  return airport;
}
