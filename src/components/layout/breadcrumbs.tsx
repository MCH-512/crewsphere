
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

// Helper function to capitalize and format path segments
const formatSegment = (segment: string): string => {
  if (!segment) return "";
  // Replace hyphens with spaces and capitalize each word
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Predefined labels for specific paths to make them more user-friendly
const predefinedLabels: { [key: string]: string } = {
  admin: "Admin Console",
  users: "User Management",
  documents: "Document Library",
  upload: "Upload Document",
  alerts: "Alerts Management",
  create: "Create New", // Generic "Create"
  courses: "Courses Management",
  flights: "Flight Management",
  "purser-reports": "Purser Reports",
  "user-requests": "User Requests",
  "airport-briefings": "Airport Briefings",
  "flight-duty-calculator": "Duty Calculator",
  insights: "AI Insights",
  training: "Training Hub",
  quizzes: "Quizzes",
  settings: "Settings",
  schedule: "My Schedule",
  requests: "Submit Request",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // Filter out empty strings

  // Don't show breadcrumbs on the root dashboard or for paths with only one segment (e.g., /settings)
  // unless it's a deeper path like /admin/users (which has 2 segments)
  if (segments.length === 0) {
    return null;
  }
  if (segments.length === 1 && !pathname.startsWith("/admin/")) {
      // Hide for top-level pages like /settings, /documents, etc.
      // but allow for /admin (which we might want to treat as a root for its section)
      if (segments[0] !== 'admin') return null;
  }


  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
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
          const label = predefinedLabels[segment] || formatSegment(segment);

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
