
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const formatSegment = (segment: string): string => {
  if (!segment) return "";
  if (/^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(segment) || /^\d{5,}$/.test(segment) || /^[a-zA-Z0-9]{20,}$/.test(segment)) {
    return "Details";
  }
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const predefinedLabels: { [key: string]: string } = {
  admin: "Admin Console",
  flights: "Flight Management",
  "flight-swap": "Swap Board",
  "my-swaps": "My Swaps",
  users: "User Management",
  create: "Create",
  edit: "Edit",
  "user-requests": "User Requests",
  "purser-reports": "Purser Reports",
  history: "History",
  submit: "Submit",
  settings: "Settings",
  requests: "My Requests",
  "system-settings": "System Configuration",
  "suggestion-box": "Suggestion Box",
  suggestions: "Suggestion Box",
  toolbox: "Toolbox",
  converters: "Converters",
  guides: "Professional Guides",
  "aviation-history": "Aviation History",
  "aeronautical-jargon": "Aeronautical Jargon",
  "phonetic-alphabet": "Phonetic Alphabet",
  "audit-logs": "Audit Logs",
  "my-schedule": "My Schedule",
  "my-logbook": "My Logbook",
  "my-documents": "My Documents",
  "document-library": "Document Library",
  documents: "Document Management",
  courses: "E-Learning Courses",
  quizzes: "Quiz Management",
  quiz: "Quiz",
  training: "E-Learning Center",
  "community-hub": "Community Hub",
  "weather-decoder": "Weather Decoder",
  "live-flight-tracker": "Live Flight Tracker",
  "ftl-calculator": "EASA FTL Calculator",
  "airport-directory": "Airport Directory",
  "flight-timeline": "Flight Timeline Calculator",
  alerts: "Alert Management",
  "expiry-management": "Expiry Management",
  "training-sessions": "Training Sessions",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || pathname === "/") {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground hidden md:block">
      <ol className="flex items-center space-x-1.5">
        <li>
          <Link
            href="/"
            className="hover:text-primary transition-colors flex items-center"
          >
            <Home className="h-4 w-4 mr-1.5" />
            Dashboard
          </Link>
        </li>
        {segments.map((segment, index) => {
          const currentPath = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          
          let label = predefinedLabels[segment] || formatSegment(segment);
          // Special case for dynamic user detail page
          if (segments[index-1] === 'users' && formatSegment(segment) === 'Details') {
            label = "User Details";
          }

          return (
            <React.Fragment key={currentPath}>
              <li>
                <ChevronRight className="h-4 w-4" />
              </li>
              <li>
                {isLast ? (
                  <span className="font-medium text-foreground">{label}</span>
                ) : (
                  <Link
                    href={currentPath}
                    className="hover:text-primary transition-colors"
                  >
                    {label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
