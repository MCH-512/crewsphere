
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Globe, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Airport } from "@/services/airport-service";
import airportsData from '@/data/airports.json';
import { AnimatedCard } from "@/components/motion/animated-card";

// Group airports by continent and then by country
const groupedAirports = (airportsData as Airport[]).reduce((acc, airport) => {
    const { continent, country, countryCode } = airport;
    if (!continent) return acc;
    if (!acc[continent]) {
        acc[continent] = {};
    }
    if (!acc[continent][country]) {
        acc[continent][country] = { airports: [], countryCode }; 
    }
    acc[continent][country].airports.push(airport);
    return acc;
}, {} as Record<string, Record<string, { airports: Airport[], countryCode: string }>>);

const continents = Object.keys(groupedAirports).sort();

// Helper function to get flag emoji from country code
const getFlagEmoji = (countryCode: string) => {
    if (!countryCode || countryCode.length !== 2) return '';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

export default function AirportDirectoryPage() {
    const [searchTerm, setSearchTerm] = React.useState("");

    const filteredAndGroupedAirports = React.useMemo(() => {
        if (!searchTerm) {
            return groupedAirports;
        }

        const lowercasedTerm = searchTerm.toLowerCase();
        
        return Object.entries(groupedAirports).reduce((acc, [continent, countries]) => {
            const filteredCountries = Object.entries(countries).reduce((countryAcc, [country, data]) => {
                const { airports, countryCode } = data;
                const filteredAirports = airports.filter(airport =>
                    airport.name.toLowerCase().includes(lowercasedTerm) ||
                    airport.city.toLowerCase().includes(lowercasedTerm) ||
                    (airport.iata && airport.iata.toLowerCase().includes(lowercasedTerm)) ||
                    (airport.icao && airport.icao.toLowerCase().includes(lowercasedTerm)) ||
                    airport.country.toLowerCase().includes(lowercasedTerm) ||
                    getFlagEmoji(countryCode).includes(searchTerm) // Search by flag emoji
                );

                if (filteredAirports.length > 0) {
                    countryAcc[country] = { airports: filteredAirports, countryCode };
                }
                return countryAcc;
            }, {} as Record<string, { airports: Airport[], countryCode: string }>);

            if (Object.keys(filteredCountries).length > 0) {
                acc[continent] = filteredCountries;
            }

            return acc;
        }, {} as Record<string, Record<string, { airports: Airport[], countryCode: string }>>);

    }, [searchTerm]);

    const filteredContinents = Object.keys(filteredAndGroupedAirports).sort();

    return (
        <div className="space-y-6">
            <AnimatedCard>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline flex items-center">
                            <Globe className="mr-3 h-7 w-7 text-primary" />
                            Airport Directory
                        </CardTitle>
                        <CardDescription>
                            A comprehensive directory of airports, grouped by continent and country.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative max-w-lg">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by airport, city, code, or country..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </AnimatedCard>

            <AnimatedCard delay={0.1}>
                 <Tabs defaultValue={filteredContinents[0] || ""} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
                        {continents.map(continent => (
                            <TabsTrigger key={continent} value={continent} disabled={!filteredAndGroupedAirports[continent]}>
                                {continent}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    
                    {Object.entries(filteredAndGroupedAirports).map(([continent, countries]) => (
                        <TabsContent key={continent} value={continent}>
                            <Card>
                                <CardContent className="pt-6">
                                    <Accordion type="single" collapsible className="w-full">
                                        {Object.entries(countries).sort(([a], [b]) => a.localeCompare(b)).map(([country, data]) => (
                                            <AccordionItem key={country} value={country}>
                                                <AccordionTrigger className="text-lg">
                                                    <span className="flex items-center gap-3">
                                                        <span className="text-2xl">{getFlagEmoji(data.countryCode)}</span>
                                                        {country} ({data.airports.length})
                                                    </span>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Name</TableHead>
                                                                <TableHead>City</TableHead>
                                                                <TableHead>IATA</TableHead>
                                                                <TableHead>ICAO</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {data.airports.map(airport => (
                                                                <TableRow key={airport.icao || airport.iata}>
                                                                    <TableCell className="font-medium">{airport.name}</TableCell>
                                                                    <TableCell>{airport.city}</TableCell>
                                                                    <TableCell>{airport.iata || 'N/A'}</TableCell>
                                                                    <TableCell>{airport.icao || 'N/A'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))}
                 </Tabs>
                 {filteredContinents.length === 0 && searchTerm && (
                    <Card className="mt-4">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            No airports found for your search query: "{searchTerm}"
                        </CardContent>
                    </Card>
                 )}
            </AnimatedCard>
        </div>
    );
}
