import { Building, Flag, Shield, Globe, HelpCircle } from "lucide-react";
import type { ElementType } from "react";

export const documentCategories = [
  "SOPs (Standard Operating Procedures)",
  "SEP (Safety & Emergency Procedures)",
  "CRM & FRMS",
  "AVSEC (Aviation Security)",
  "Cabin & Service Operations",
  "Dangerous Goods (DGR)",
  "Manuals",
  "Training & Formations",
  "Regulations & References",
];

// These now represent the main "families" for document grouping.
export const documentSources = [
  "Company Documentation",
  "Tunisian Documentation",
  "European Documentation",
  "International Documentation",
  "Other",
];

export const familyConfig: Record<string, { icon: ElementType, description: string }> = {
    "Company Documentation": { icon: Building, description: "Internal SOPs, manuals, and memos." },
    "Tunisian Documentation": { icon: Flag, description: "Regulations from Tunisian civil aviation authorities." },
    "European Documentation": { icon: Shield, description: "Rules and guidance from EASA." },
    "International Documentation": { icon: Globe, description: "Standards from ICAO and IATA." },
    "Other": { icon: HelpCircle, description: "Miscellaneous documents and external references." }
};
