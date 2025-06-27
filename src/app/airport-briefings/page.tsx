
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Brain, MapPin, Cloudy, FileWarning, Globe, Building2 } from "lucide-react";
import { searchAirports, type Airport } from "@/services/airport-service";
import { CustomAutocompleteAirport } from "@/components/ui/custom-autocomplete-airport";
import { AnimatedCard } from "@/components/motion/animated-card";

const DEBOUNCE_DELAY = 300;

export default function AirportBriefingPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Airport[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedAirport, setSelectedAirport] = React.useState<Airport | null>(null);

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
  
  // Simplified handler: directly use the airport object from the selection.
  const handleSelectAirport = (airport: Airport | null) => {
    setSelectedAirport(airport);
  }

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Brain className="mr-3 h-7 w-7 text-primary" />
              Airport Briefing Tool
            </CardTitle>
            <CardDescription>
              Search for an airport to get essential operational information. This is a reference tool and does not replace official sources.
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
