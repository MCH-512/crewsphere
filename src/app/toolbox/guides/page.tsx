"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Book } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function GuidesPage() {
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
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="etiquette">
              <AccordionTrigger className="text-lg">Professional Etiquette & Grooming</AccordionTrigger>
              <AccordionContent className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                <p>Maintaining impeccable grooming and professional etiquette is paramount. It reflects on the airline's brand and ensures a positive passenger experience.</p>
                <ul>
                  <li><strong>Uniform:</strong> Always wear the complete, clean, and well-pressed uniform. Shoes must be polished and in good condition.</li>
                  <li><strong>Grooming:</strong> Adhere strictly to company guidelines regarding hair, makeup, and accessories. A neat and professional appearance is non-negotiable.</li>
                  <li><strong>Posture and Body Language:</strong> Stand tall, walk with purpose, and maintain open body language. Avoid leaning, slouching, or crossing arms when interacting with passengers.</li>
                  <li><strong>Communication:</strong> Use polite and respectful language at all times. Address passengers with appropriate titles (e.g., "Sir," "Ma'am") unless invited to do otherwise.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="communication">
              <AccordionTrigger className="text-lg">Communication Best Practices</AccordionTrigger>
              <AccordionContent className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                <p>Clear, concise, and empathetic communication is key to safety, service, and teamwork.</p>
                <ul>
                  <li><strong>Active Listening:</strong> Pay full attention to what passengers and crew members are saying. Acknowledge and paraphrase to ensure understanding.</li>
                  <li><strong>Clarity:</strong> Use simple, unambiguous language, especially during safety briefings and announcements. Avoid jargon when speaking with passengers.</li>
                  <li><strong>Sterile Flight Deck:</strong> Respect the sterile flight deck rule below 10,000 feet. All communication should be essential to the safe operation of the aircraft.</li>
                  <li><strong>Conflict Resolution (C.A.R.E.):</strong> When faced with a complaint, use the C.A.R.E. method: Communicate understanding, Apologize sincerely, Resolve the issue, and Exceed expectations if possible.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="service">
              <AccordionTrigger className="text-lg">Passenger Service Excellence</AccordionTrigger>
              <AccordionContent className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                <p>Anticipating needs and providing outstanding service creates a memorable journey for passengers.</p>
                <ul>
                  <li><strong>Be Proactive:</strong> Anticipate passenger needs before they ask. Offer a blanket to a passenger who looks cold, or water on a long flight.</li>
                  <li><strong>Personalize Interaction:</strong> When possible, use passengers' names (from the passenger manifest). A small personal touch can make a big difference.</li>
                  <li><strong>Know Your Product:</strong> Be knowledgeable about the in-flight service, menu, and entertainment options to answer questions confidently.</li>
                  <li><strong>Teamwork in Service:</strong> Coordinate with fellow crew members to ensure a smooth and efficient service flow. Support each other, especially during busy periods.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
