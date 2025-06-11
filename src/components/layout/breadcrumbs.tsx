
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const formatSegment = (segment: string): string => {
  if (!segment) return "";
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const predefinedLabels: { [key: string]: string } = {
  admin: "Admin Console",
  users: "User Management",
  documents: "Document Library",
  upload: "Upload Document",
  alerts: "Alerts Management",
  create: "Create New", 
  courses: "Course Library", 
  flights: "Flight Management",
  "purser-reports": "Submit Purser Report", 
  "my-purser-reports": "My Purser Reports", 
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
  "my-requests": "My Submitted Requests", 
  "system-settings": "System Configuration",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); 

  if (segments.length === 0) {
    return null;
  }
  
  if (segments.length === 1 && !pathname.startsWith("/admin/edit") && !pathname.startsWith("/admin/create")) {
      if (segments[0] !== 'admin' || (segments[0] === 'admin' && segments.length === 1)) {
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
          
          if (segment.startsWith("[") && segment.endsWith("]")) {
             if (segments[index-1] === "edit" || segments[index-2] === "edit") { 
                label = "Edit";
            } else if (segments[index-1] === "courses" && segments[index-2] === "admin") {
                label = "Edit Course"; 
            } else if (segments[index-1] === "alerts" && segments[index-2] === "admin") {
                 label = "Edit Alert";
            }
            else {
                label = "Details"; 
            }
          } else if (pathname.includes("/admin/courses/edit/") && isLast) {
            label = "Edit Course";
          } else if (pathname.includes("/admin/courses/create") && isLast) {
            label = "Create Course";
          } else if (pathname.includes("/admin/flights/create") && isLast) {
            label = "Add New Flight";
          } else if (pathname.includes("/admin/purser-reports") && isLast) { 
            label = "Submitted Purser Reports";
          } else if (pathname.includes("/admin/alerts/edit/") && isLast) {
            label = "Edit Alert";
          } else if (pathname.includes("/admin/alerts/create") && isLast) {
            label = "Create Alert";
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
