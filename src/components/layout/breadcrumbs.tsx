
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const formatSegment = (segment: string): string => {
  if (!segment) return "";
  // Handle UUIDs or long numeric IDs gracefully
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
  users: "User Management",
  documents: "Documents",
  create: "Create",
  edit: "Edit",
  alerts: "Alerts",
  courses: "Courses",
  flights: "Flights",
  "purser-reports": "Purser Reports",
  "my-purser-reports": "Purser Reports",
  "user-requests": "User Requests",
  training: "Training Hub",
  settings: "Settings",
  schedule: "Schedule",
  requests: "Submit Request",
  "my-alerts": "My Alerts",
  "my-requests": "My Requests",
  "system-settings": "System Configuration",
  "airport-briefings": "Airport Briefing",
  "flight-duty-calculator": "Duty Calculator",
  submit: "Submit",
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
