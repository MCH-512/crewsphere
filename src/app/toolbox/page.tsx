"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Book, Calculator, CloudSun, Globe, Map, MessagesSquare, Mic, ScrollText, Wrench, ShieldAlert, Waypoints } from "lucide-react";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";

interface Tool {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  delay: number;
}

const tools: Tool[] = [
   {
    icon: CloudSun,
    title: "Weather Decoder",
    description: "Get a human-readable METAR or TAF weather report using our AI-powered decoder.",
    href: "/toolbox/weather-decoder",
    delay: 0.1
  },
  {
    icon: ShieldAlert,
    title: "EASA FTL Calculator",
    description: "Calculate Flight Time Limitations based on EASA regulations for crew duty and rest.",
    href: "/toolbox/ftl-calculator",
    delay: 0.15
  },
  {
    icon: Waypoints,
    title: "Flight Timeline Calculator",
    description: "Visually plan a duty day by plotting key flight events on a dynamic timeline.",
    href: "/toolbox/flight-timeline",
    delay: 0.18
  },
  {
    icon: Map,
    title: "Live Flight Tracker",
    description: "View live air traffic from around the world on an interactive map.",
    href: "/toolbox/live-flight-tracker",
    delay: 0.2
  },
  {
    icon: Globe,
    title: "Airport Directory",
    description: "Browse a comprehensive database of airports, grouped by country and region.",
    href: "/toolbox/airport-directory",
    delay: 0.25
  },
  {
    icon: Calculator,
    title: "Converters",
    description: "Convert units of measurement commonly used in aviation (knots, feet, kg, lbs, etc.).",
    href: "/toolbox/converters",
    delay: 0.3
  },
  {
    icon: MessagesSquare,
    title: "Aeronautical Jargon",
    description: "A glossary of common aeronautical terms, acronyms, and slang used by pilots and ATC.",
    href: "/toolbox/aeronautical-jargon",
    delay: 0.35
  },
  {
    icon: Mic,
    title: "Phonetic Alphabet",
    description: "A quick reference for the ICAO spelling alphabet for clear communication.",
    href: "/toolbox/phonetic-alphabet",
    delay: 0.4
  },
  {
    icon: ScrollText,
    title: "Aviation History",
    description: "Explore key dates, innovations, and historical figures that shaped modern aviation.",
    href: "/toolbox/aviation-history",
    delay: 0.45
  },
  {
    icon: Book,
    title: "Professional Guides",
    description: "Access guides on etiquette, savoir-vivre, and professional best practices for crew members.",
    href: "/toolbox/guides",
    delay: 0.5
  },
];

export default function ToolboxPage() {
  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Wrench className="mr-3 h-7 w-7 text-primary" />
              Toolbox
            </CardTitle>
            <CardDescription>
              A collection of useful tools, converters, and reference guides for your daily operations.
            </CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const IconComponent = tool.icon;
          return (
            <AnimatedCard key={tool.title} delay={tool.delay}>
              <Card className="shadow-sm h-full flex flex-col transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-4 pb-4">
                  <IconComponent className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">{tool.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {tool.description}
                  </p>
                </CardContent>
                <CardFooter>
                    <Button asChild className="w-full mt-auto">
                        <Link href={tool.href}>
                        Open Tool <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardFooter>
              </Card>
            </AnimatedCard>
          );
        })}
      </div>
    </div>
  );
}
