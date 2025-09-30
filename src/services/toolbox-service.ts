import { Book, Calculator, CloudSun, Globe, Map, MessagesSquare, Mic, ScrollText, Wrench, ShieldAlert, Waypoints } from "lucide-react";
import type { ElementType } from "react";
import { z } from 'zod';

export interface Tool {
  icon: ElementType;
  title: string;
  description: string;
  href: string;
  delay: number;
}

const toolsData: Tool[] = [
   {
    icon: CloudSun,
    title: "AI Weather Decoder",
    description: "Get live METAR data for any airport, decoded and explained by AI.",
    href: "/toolbox/airport-weather",
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
    icon: Map,
    title: "Live Flight Tracker",
    description: "View live air traffic from around the world on an interactive map.",
    href: "/toolbox/live-flight-tracker",
    delay: 0.2
  },
  {
    icon: Globe,
    title: "Airport Directory",
    description: "A comprehensive database of airports, grouped by country and region.",
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

const EmptySchema = z.object({});

export async function getToolboxTools(): Promise<Tool[]> {
    EmptySchema.parse({}); // Zod validation
    // In a real application, this could fetch from a database or a CMS.
    // For now, we'll return the static data.
    return Promise.resolve(toolsData);
}
