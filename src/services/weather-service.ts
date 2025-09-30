'use server';

import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

const IcaoSchema = z.string().length(4, "ICAO code must be 4 characters.").regex(/^[A-Z]{4}$/, "Invalid ICAO format.");

/**
 * Fetches the latest METAR data for a given airport ICAO code.
 * @param icao The 4-letter ICAO code of the airport.
 * @returns The raw METAR string or null if not found or an error occurs.
 */
export async function getLiveWeather(icao: string): Promise<string | null> {
    const validatedIcao = IcaoSchema.safeParse(icao);
    if (!validatedIcao.success) {
        throw new Error(validatedIcao.error.issues[0].message);
    }
    
    const code = validatedIcao.data;

    const url = `https://www.aviationweather.gov/adds/dataserver_current/httpparam?dataSource=metars&requestType=retrieve&format=xml&stationString=${code.toUpperCase()}&hoursBeforeNow=2`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CrewSphere-App/1.0'
            },
            next: { revalidate: 300 } 
        });

        if (!response.ok) {
            console.error(`AviationWeather API request failed with status: ${response.status}`);
            throw new Error("Could not retrieve weather data from the server.");
        }

        const xmlText = await response.text();
        const parser = new XMLParser();
        const jsonObj = parser.parse(xmlText);
        
        const metarData = jsonObj?.response?.data?.METAR;

        if (Array.isArray(metarData) && metarData.length > 0) {
            return metarData[0].raw_text;
        } else if (metarData && typeof metarData === 'object') {
            return metarData.raw_text;
        }

        return null;

    } catch (error) {
        console.error("Error in getLiveWeather service:", error);
        throw new Error("Failed to fetch or parse live weather data.");
    }
}
