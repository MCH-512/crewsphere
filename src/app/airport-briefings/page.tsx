
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Brain, MapPin, Cloudy, FileWarning, Globe, Building2, Sparkles, Loader2, AlertTriangle as AlertTriangleIcon, Flag, PlaneTakeoff, CheckCircle } from "lucide-react";
import { searchAirports, type Airport } from "@/services/airport-service";
import airportsData from '@/data/airports.json';
import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";


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
  
  // State for dialog
  const [isAirportListOpen, setIsAirportListOpen] = React.useState(false);
  const [airportsInDialog, setAirportsInDialog] = React.useState<Airport[]>([]);
  const [countryInDialog, setCountryInDialog] = React.useState<string>("");

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
  
  const handleOpenAirportList = (country: string, airports: Airport[]) => {
    setCountryInDialog(country);
    setAirportsInDialog(airports);
    setIsAirportListOpen(true);
  };
  
  const handleSelectAirportFromDialog = (airport: Airport) => {
    handleSelectAirport(airport);
    setIsAirportListOpen(false);
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
              <CardTitle className="flex items-center gap-2"><MapPin className="text-primary"/>{selectedAirport.name}</CardTitle>
              <CardDescription>{selectedAirport.city}, {selectedAirport.country}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground"/>
                        <strong>ICAO:</strong> 
                        <Badge variant="secondary">{selectedAirport.icao}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground"/>
                        <strong>IATA:</strong> 
                        <Badge variant="secondary">{selectedAirport.iata}</Badge>
                    </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center"><Sparkles className="mr-2 h-5 w-5 text-accent" />AI Operational Briefing</h3>
                  
                  {isBriefingLoading && (
                     <div className="space-y-4 p-4 border rounded-lg">
                        <div className="flex items-center space-x-3"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-5 w-1/3" /></div>
                        <Skeleton className="h-16 w-full" />
                        <div className="flex items-center space-x-3"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-5 w-1/3" /></div>
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
                    <div className="space-y-4">
                       <Alert>
                            <PlaneTakeoff className="h-4 w-4" />
                            <AlertTitle>Operational Summary</AlertTitle>
                            <AlertDescription className="whitespace-pre-line text-foreground/80">
                                {briefing.operationalSummary}
                            </AlertDescription>
                        </Alert>
                        <Alert variant="warning">
                            <AlertTriangleIcon className="h-4 w-4" />
                            <AlertTitle>Potential Challenges</AlertTitle>
                            <AlertDescription className="whitespace-pre-line">
                                {briefing.potentialChallenges}
                            </AlertDescription>
                        </Alert>
                        <Alert variant="success">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Crew Recommendations</AlertTitle>
                            <AlertDescription className="whitespace-pre-line">
                                {briefing.crewRecommendations}
                            </AlertDescription>
                        </Alert>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {Object.entries(groupedAirports[continent] || {}).map(([country, airportsInCountry]) => (
                        <Card
                          key={country}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleOpenAirportList(country, airportsInCountry)}
                        >
                          <CardHeader className="flex flex-row items-center justify-between p-4">
                            <div className="flex items-center gap-2">
                              <Flag className="h-4 w-4 text-muted-foreground"/>
                              <p className="font-semibold">{country}</p>
                            </div>
                            <Badge variant="secondary">{airportsInCountry.length}</Badge>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
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
       
       {isAirportListOpen && (
        <Dialog open={isAirportListOpen} onOpenChange={setIsAirportListOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Airports in {countryInDialog}</DialogTitle>
              <DialogDescription>
                Select an airport to view its briefing.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="flex flex-col gap-1 p-1">
                {airportsInDialog.map((airport) => (
                  <Button
                    key={airport.icao}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => handleSelectAirportFromDialog(airport)}
                  >
                    <div>
                      <p className="font-semibold">{airport.name} ({airport.iata})</p>
                      <p className="text-xs text-muted-foreground">{airport.city}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
