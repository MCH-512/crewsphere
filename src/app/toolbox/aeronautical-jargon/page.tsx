"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessagesSquare, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

const jargonTerms = [
  { term: "ATC", definition: "Air Traffic Control. A service provided by ground-based controllers who direct aircraft on the ground and through controlled airspace." },
  { term: "Squawk", definition: "A four-digit code assigned by ATC to an aircraft's transponder. It helps in identifying the aircraft on radar screens. For example, 'Squawk 7500' is for hijacking, '7600' for communication failure, and '7700' for a general emergency." },
  { term: "Deadhead", definition: "A crew member flying on a passenger jet as a passenger, while on duty, to get to a destination for their next flight assignment." },
  { term: "Mayday", definition: "The international distress signal used in radio communications. It signifies a life-threatening emergency and is repeated three times: 'Mayday, Mayday, Mayday'." },
  { term: "Pan-pan", definition: "The international urgency signal. It is used when there is a state of urgency on board an aircraft, but no immediate danger to anyone's life. It is also repeated three times: 'Pan-pan, Pan-pan, Pan-pan'." },
  { term: "Roger", definition: "A term used in radiotelephony to mean 'I have received all of your last transmission.' It does not mean 'yes' or 'I agree'." },
  { term: "Wilco", definition: "An abbreviation for 'Will Comply'. It means the speaker has received the message, understands it, and will comply with the instructions." },
  { term: "Zulu Time", definition: "Another name for Coordinated Universal Time (UTC), the primary time standard by which the world regulates clocks and time. It's used in aviation to avoid confusion with local time zones." },
];

export default function AeronauticalJargonPage() {
    const [searchTerm, setSearchTerm] = React.useState("");

    const filteredTerms = React.useMemo(() => {
        if (!searchTerm) return jargonTerms;
        const lowercasedTerm = searchTerm.toLowerCase();
        return jargonTerms.filter(
            (item) =>
                item.term.toLowerCase().includes(lowercasedTerm) ||
                item.definition.toLowerCase().includes(lowercasedTerm)
        );
    }, [searchTerm]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <MessagesSquare className="mr-3 h-7 w-7 text-primary" />
            Aeronautical Jargon Glossary
          </CardTitle>
          <CardDescription>
            A glossary of common terms and acronyms used in aviation. Search for a term or keyword.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search terms or definitions..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
           <Accordion type="multiple" className="w-full">
            {filteredTerms.length > 0 ? (
                filteredTerms.map((item) => (
                    <AccordionItem key={item.term} value={item.term}>
                        <AccordionTrigger className="text-lg font-medium">{item.term}</AccordionTrigger>
                        <AccordionContent className="text-base text-muted-foreground">
                            {item.definition}
                        </AccordionContent>
                    </AccordionItem>
                ))
            ) : (
                <p className="text-center text-muted-foreground py-6">No terms found for "{searchTerm}".</p>
            )}
           </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
