"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const timelineEvents = [
  { year: "1903", title: "First Powered Flight", description: "The Wright brothers, Orville and Wilbur, achieve the first sustained, controlled, and powered flight in Kitty Hawk, North Carolina." },
  { year: "1927", title: "First Solo Transatlantic Flight", description: "Charles Lindbergh completes the first solo non-stop transatlantic flight, flying from New York to Paris in the 'Spirit of St. Louis'." },
  { year: "1939", title: "First Jet-Powered Aircraft", description: "The German Heinkel He 178 becomes the world's first aircraft to fly under turbojet power, ushering in the jet age." },
  { year: "1947", title: "Breaking the Sound Barrier", description: "Chuck Yeager becomes the first human to officially break the sound barrier, flying the Bell X-1 rocket plane at Mach 1.06." },
  { year: "1969", title: "First Commercial Supersonic Flight", description: "The Concorde, a British-French supersonic passenger jet, makes its first test flight. It would enter commercial service in 1976." },
  { year: "1970", title: "The Boeing 747 'Jumbo Jet' Enters Service", description: "Pan Am flies the first commercial flight of the Boeing 747, the first 'jumbo jet', revolutionizing air travel with its size and capacity." },
  { year: "2007", title: "The Airbus A380 Enters Service", description: "The Airbus A380, the world's largest passenger airliner, completes its first commercial flight with Singapore Airlines." },
];

export default function AviationHistoryPage() {
    const [searchTerm, setSearchTerm] = React.useState("");

    const filteredEvents = React.useMemo(() => {
        if (!searchTerm) return timelineEvents;
        const lowercasedTerm = searchTerm.toLowerCase();
        return timelineEvents.filter(
            (event) =>
                event.year.includes(lowercasedTerm) ||
                event.title.toLowerCase().includes(lowercasedTerm) ||
                event.description.toLowerCase().includes(lowercasedTerm)
        );
    }, [searchTerm]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <ScrollText className="mr-3 h-7 w-7 text-primary" />
            Key Moments in Aviation History
          </CardTitle>
          <CardDescription>
            A brief timeline of major milestones that shaped the world of aviation.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search events by year, title, or keyword..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </CardContent>
      </Card>

       <Card>
        <CardContent className="pt-6">
            {filteredEvents.length > 0 ? (
                <div className="relative pl-8">
                    <div className="absolute left-0 top-0 h-full w-0.5 bg-border"></div>
                    <div className="space-y-10">
                    {filteredEvents.map((event) => (
                        <div key={event.year} className="relative">
                        <div className="absolute -left-[18px] top-1 h-4 w-4 bg-primary rounded-full border-4 border-background"></div>
                        <p className="text-lg font-bold text-primary">{event.year}</p>
                        <h3 className="text-md font-semibold mt-1">{event.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        </div>
                    ))}
                    </div>
                </div>
            ) : (
                <p className="text-center text-muted-foreground py-6">No historical events found for "{searchTerm}".</p>
            )}
        </CardContent>
       </Card>
    </div>
  );
}
