
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Brain, MapPin, Cloudy, FileWarning, Globe, Building2, Sparkles, Loader2, AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { searchAirports, type Airport } from "@/services/airport-service";
import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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

  const handleSelectAirport = (airport: Airport | null) => {
    setSelectedAirport(airport);
    setBriefing(null); // Clear previous briefing
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
              Search for an airport to get essential data and an AI-generated operational briefing. This is a reference tool and does not replace official sources.
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
    </div>
  );
}
