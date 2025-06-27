
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Brain, MapPin, Cloudy, FileWarning, Globe, Building2, Sparkles, Loader2, AlertTriangle as AlertTriangleIcon, Flag, PlaneTakeoff } from "lucide-react";
import { searchAirports, type Airport } from "@/services/airport-service";
import airportsData from '@/data/airports.json';
import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

// AI Flow imports
import { briefAirport, type AirportBriefingOutput } from "@/ai/flows/brief-airport-flow";


const DEBOUNCE_DELAY = 300;

export default function AirportBriefingPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Airport[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedAirport, setSelectedAirport] = React.useState<Airport | null>(null);

  // State for AI Briefing
  const [briefing, setBriefing] = React.useState<AirportBriefingOutput | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = React.useState(false);
  const [briefingError, setBriefingError] = React.useState<string | null>(null);

  // State for browsing
  const [groupedAirports, setGroupedAirports] = React.useState<Record<string, Record<string, Airport[]>>>({});
  const [continents, setContinents] = React.useState<string[]>([]);

  // Effect for search autocomplete
  React.useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    const handler = setTimeout(async () => {
      try {
        const results = await searchAirports(searchTerm);
        setSuggestions(results);
      } catch (error) {
        console.error("Error searching airports:", error);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Effect for processing and grouping airports for browsing
  React.useEffect(() => {
    const processAirports = () => {
        const grouped: Record<string, Record<string, Airport[]>> = {};
        airportsData.forEach((airport) => {
            const continent = (airport as Airport).continent || 'Other';
            const country = airport.country;

            if (!grouped[continent]) {
                grouped[continent] = {};
            }
            if (!grouped[continent][country]) {
                grouped[continent][country] = [];
            }
            grouped[continent][country].push(airport as Airport);
        });

        for (const continent in grouped) {
            const countries = Object.keys(grouped[continent]).sort();
            const sortedCountries: Record<string, Airport[]> = {};
            for (const country of countries) {
                // sort airports within country
                grouped[continent][country].sort((a, b) => a.name.localeCompare(b.name));
                sortedCountries[country] = grouped[continent][country];
            }
            grouped[continent] = sortedCountries;
        }

        const continentNames = Object.keys(grouped).sort();
        
        setGroupedAirports(grouped);
        setContinents(continentNames);
    };

    processAirports();
  }, []);

  const handleSelectAirport = (airport: Airport | null) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedAirport(airport);
    setBriefing(null);
    setBriefingError(null);
    if (airport) {
      generateBriefing(airport);
    }
  };

  const generateBriefing = async (airport: Airport) => {
    setIsBriefingLoading(true);
    setBriefingError(null);
    setBriefing(null);
    try {
      const briefingResult = await briefAirport({
        icao: airport.icao,
        iata: airport.iata,
        name: airport.name,
        city: airport.city,
        country: airport.country,
      });
      setBriefing(briefingResult);
    } catch (error) {
      console.error("Error generating briefing:", error);
      setBriefingError("An error occurred while generating the AI briefing. Please try again.");
    } finally {
      setIsBriefingLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Brain className="mr-3 h-7 w-7 text-primary" />
              AI-Powered Airport Briefing
            </CardTitle>
            <CardDescription>
              Search for an airport or browse by continent to get essential data and an AI-generated operational briefing. This is a reference tool and does not replace official sources.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <CustomAutocompleteAirport
                onSelect={handleSelectAirport}
                placeholder="Search by name, IATA, or ICAO code..."
                airports={suggestions}
                isLoading={isLoading}
                onInputChange={setSearchTerm}
                currentSearchTerm={searchTerm}
              />
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>

      {selectedAirport && (
        <AnimatedCard delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="text-primary"/>{selectedAirport.name} ({selectedAirport.iata})</CardTitle>
              <CardDescription>{selectedAirport.city}, {selectedAirport.country}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md"><Globe className="h-4 w-4 text-muted-foreground"/><strong>ICAO:</strong> {selectedAirport.icao}</div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md"><Building2 className="h-4 w-4 text-muted-foreground"/><strong>IATA:</strong> {selectedAirport.iata}</div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center"><Sparkles className="mr-2 h-5 w-5 text-accent" />AI Operational Briefing</h3>
                  
                  {isBriefingLoading && (
                     <div className="space-y-4 p-4 border rounded-lg">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                  )}

                  {briefingError && (
                    <Alert variant="destructive">
                      <AlertTriangleIcon className="h-4 w-4" />
                      <AlertTitle>Briefing Generation Failed</AlertTitle>
                      <AlertDescription>
                        {briefingError}
                        <Button variant="link" size="sm" onClick={() => generateBriefing(selectedAirport)} className="p-0 h-auto ml-1">Try again</Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {briefing && (
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="font-semibold mb-1">Operational Summary</h4>
                        <p className="text-muted-foreground whitespace-pre-line">{briefing.operationalSummary}</p>
                      </div>
                       <div>
                        <h4 className="font-semibold mb-1">Potential Challenges</h4>
                        <p className="text-muted-foreground whitespace-pre-line">{briefing.potentialChallenges}</p>
                      </div>
                       <div>
                        <h4 className="font-semibold mb-1">Crew Recommendations</h4>
                        <p className="text-muted-foreground whitespace-pre-line">{briefing.crewRecommendations}</p>
                      </div>
                    </div>
                  )}

                </div>
                
                <Separator />

                <Alert>
                    <Cloudy className="h-4 w-4" />
                    <AlertTitle>Weather (METAR/TAF)</AlertTitle>
                    <AlertDescription>
                        Weather data integration is planned for a future update. Please refer to official sources.
                    </AlertDescription>
                </Alert>
                <Alert>
                    <FileWarning className="h-4 w-4" />
                    <AlertTitle>Notices to Airmen (NOTAMs)</AlertTitle>
                    <AlertDescription>
                        NOTAM data integration is planned for a future update. Please refer to official sources.
                    </AlertDescription>
                </Alert>
            </CardContent>
          </Card>
        </AnimatedCard>
      )}
      
       <AnimatedCard delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary"/>
              Browse Airports by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            {continents.length > 0 ? (
              <Tabs defaultValue={continents[0]} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  {continents.map(continent => (
                    <TabsTrigger key={continent} value={continent}>{continent}</TabsTrigger>
                  ))}
                </TabsList>
                {continents.map(continent => (
                  <TabsContent key={continent} value={continent} className="pt-4">
                    <Accordion type="single" collapsible className="w-full">
                      {Object.entries(groupedAirports[continent] || {}).map(([country, airportsInCountry]) => (
                        <AccordionItem key={country} value={country}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Flag className="h-4 w-4 text-muted-foreground"/>
                              {country} <Badge variant="secondary">{airportsInCountry.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-col items-start gap-1 pl-4">
                              {airportsInCountry.map(airport => (
                                <Button
                                  key={airport.icao}
                                  variant="link"
                                  className="h-auto p-1 text-left text-sm text-muted-foreground hover:text-primary"
                                  onClick={() => handleSelectAirport(airport)}
                                >
                                  {airport.name} ({airport.iata})
                                </Button>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
               <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary"/>
               </div>
            )}
          </CardContent>
        </Card>
       </AnimatedCard>
    </div>
  );
}
