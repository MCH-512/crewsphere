"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Book, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const guides = [
  {
    id: "etiquette",
    title: "Professional Etiquette & Grooming",
    content: (
        <>
            <p>Maintaining impeccable grooming and professional etiquette is paramount. It reflects on the airline&apos;s brand and ensures a positive passenger experience.</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Uniform:</strong> Always wear the complete, clean, and well-pressed uniform. Shoes must be polished and in good condition.</li>
                <li><strong>Grooming:</strong> Adhere strictly to company guidelines regarding hair, makeup, and accessories. A neat and professional appearance is non-negotiable.</li>
                <li><strong>Posture and Body Language:</strong> Stand tall, walk with purpose, and maintain open body language. Avoid leaning, slouching, or crossing arms when interacting with passengers.</li>
                <li><strong>Communication:</strong> Use polite and respectful language at all times. Address passengers with appropriate titles (e.g., &quot;Sir,&quot; &quot;Ma&apos;am&quot;) unless invited to do otherwise.</li>
            </ul>
        </>
    ),
    keywords: "uniform, grooming, posture, communication, etiquette",
  },
  {
    id: "communication",
    title: "Communication Best Practices",
    content: (
        <>
            <p>Clear, concise, and empathetic communication is key to safety, service, and teamwork.</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Active Listening:</strong> Pay full attention to what passengers and crew members are saying. Acknowledge and paraphrase to ensure understanding.</li>
                <li><strong>Clarity:</strong> Use simple, unambiguous language, especially during safety briefings and announcements. Avoid jargon when speaking with passengers.</li>
                <li><strong>Sterile Flight Deck:</strong> Respect the sterile flight deck rule below 10,000 feet. All communication should be essential to the safe operation of the aircraft.</li>
                <li><strong>Conflict Resolution (C.A.R.E.):</strong> When faced with a complaint, use the C.A.R.E. method: Communicate understanding, Apologize sincerely, Resolve the issue, and Exceed expectations if possible.</li>
            </ul>
        </>
    ),
    keywords: "active listening, clarity, sterile flight deck, conflict resolution, care",
  },
  {
    id: "service",
    title: "Passenger Service Excellence",
    content: (
        <>
            <p>Anticipating needs and providing outstanding service creates a memorable journey for passengers.</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Be Proactive:</strong> Anticipate passenger needs before they ask. Offer a blanket to a passenger who looks cold, or water on a long flight.</li>
                <li><strong>Personalize Interaction:</strong> When possible, use passengers&apos; names (from the passenger manifest). A small personal touch can make a big difference.</li>
                <li><strong>Know Your Product:</strong> Be knowledgeable about the in-flight service, menu, and entertainment options to answer questions confidently.</li>
                <li><strong>Teamwork in Service:</strong> Coordinate with fellow crew members to ensure a smooth and efficient service flow. Support each other, especially during busy periods.</li>
            </ul>
        </>
    ),
    keywords: "proactive, personalize, product, teamwork, service",
  },
];

export default function GuidesPage() {
    const [searchTerm, setSearchTerm] = React.useState("");

    const filteredGuides = React.useMemo(() => {
        if (!searchTerm) return guides;
        const lowercasedTerm = searchTerm.toLowerCase();
        return guides.filter(guide => 
            guide.title.toLowerCase().includes(lowercasedTerm) ||
            guide.keywords.toLowerCase().includes(lowercasedTerm)
        );
      }, [searchTerm]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Book className="mr-3 h-7 w-7 text-primary" />
            Professional Guides
          </CardTitle>
          <CardDescription>
            Guides on etiquette, savoir-vivre, and best practices for cabin crew.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search guides..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        {filteredGuides.length > 0 ? (
            filteredGuides.map(guide => (
                <Card key={guide.id}>
                  <Accordion type="single" collapsible defaultValue="item-1">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-lg p-6">
                           {guide.title}
                        </AccordionTrigger>
                        <AccordionContent className="p-6 pt-0">
                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                                {guide.content}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                 </Accordion>
                </Card>
            ))
        ) : (
            <p className="text-center text-muted-foreground py-6">No guides found matching &quot;{searchTerm}&quot;.</p>
        )}
      </div>
    </div>
  );
}