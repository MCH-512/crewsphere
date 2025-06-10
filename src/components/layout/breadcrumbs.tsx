
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
  courses: "Course Library", // User-facing & Admin-facing now have same name for consistency
  flights: "Flight Management",
  "purser-reports": "Purser Reports",
  "user-requests": "User Requests",
  "airport-briefings": "Airport Briefings",
  "flight-duty-calculator": "Duty Calculator",
  insights: "AI Insights",
  training: "Training Hub",
  quizzes: "My Quizzes",
  certificates: "My Certificates",
  settings: "Settings",
  schedule: "My Schedule",
  requests: "Submit Request",
  "my-alerts": "My Alerts",
  "my-requests": "My Submitted Requests", // Added label for new page
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // Filter out empty strings

  if (segments.length === 0) {
    return null;
  }
  
  // Adjusted logic for single segment admin paths like /admin/courses, /admin/users
  // and user paths like /courses, /certificates
  if (segments.length === 1 && !pathname.startsWith("/admin/edit") && !pathname.startsWith("/admin/create")) {
      // For simple top-level pages like /settings, /documents, /courses, /certificates, or /admin itself
      if (segments[0] !== 'admin' || (segments[0] === 'admin' && segments.length === 1)) {
           // If it's /admin and only /admin, we want to show "Dashboard / Admin Console"
           // For other single segment non-admin pages, no breadcrumbs.
           // If it's just /admin, it will proceed to render.
           // If it's /courses, /certificates etc. (single non-admin segment), don't render.
           if (segments[0] !== 'admin') return null;
      }
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
          
          let label = predefinedLabels[segment] || formatSegment(segment);
          
          // Special handling for dynamic segments like [courseId]
          if (segment.startsWith("[") && segment.endsWith("]")) {
            // Try to get context from previous segment or a predefined label for "edit"
             if (segments[index-1] === "edit" || segments[index-2] === "edit") { // Check current and previous segment for "edit"
                label = "Edit";
            } else if (segments[index-1] === "courses" && segments[index-2] === "admin") {
                label = "Edit Course"; // More specific if it's /admin/courses/edit/[id]
            }
            else {
                label = "Details"; // Generic fallback
            }
          } else if (pathname.includes("/admin/courses/edit/") && isLast) {
            label = "Edit Course";
          } else if (pathname.includes("/admin/courses/create") && isLast) {
            label = "Create Course";
          } else if (pathname.includes("/admin/flights/create") && isLast) {
            label = "Add New Flight";
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
