import {
  LayoutDashboard, Settings, Plane, ServerCog, Users, ClipboardList, 
  ClipboardCheck, MessageSquare, Activity, FileSignature, 
  Calendar as CalendarIcon, Library, GraduationCap, CheckSquare, Compass, BellRing, 
  BadgeAlert, NotebookPen, ShieldCheck, Wrench, 
  Handshake, Inbox, Lightbulb, FileCheck2, History, CloudSun
} from "lucide-react";
import type { ElementType } from 'react';

interface NavItem {
  href: string;
  title: string;
  icon: ElementType;
  roles?: string[];
  description?: string;
  buttonText?: string;
  statKey?: string;
  highlightWhen?: (value: number) => boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const mainNavConfig: { sidebarNav: NavGroup[] } = {
  sidebarNav: [
     {
      title: "My Activity",
      items: [
        { href: "/", title: "Dashboard", icon: LayoutDashboard },
        { href: "/my-schedule", title: "My Schedule", icon: CalendarIcon },
        { href: "/notifications", title: "Notifications", icon: BellRing },
        { href: "/purser-reports", title: "My Flight Reports", icon: FileSignature, roles: ['purser', 'admin', 'instructor'] },
        { href: "/my-logbook", title: "My Logbook", icon: NotebookPen },
        { href: "/my-documents", title: "My Documents", icon: ShieldCheck },
      ]
    },
     {
      title: "Operations",
      items: [
        { href: "/flight-swap", title: "Swap Board", icon: Handshake },
        { href: "/my-swaps", title: "My Swaps", icon: History },
        { href: "/timeline", title: "Global Timeline", icon: Compass },
      ]
    },
    {
      title: "Resources",
      items: [
        { href: "/toolbox", title: "Toolbox", icon: Wrench },
        { href: "/document-library", title: "Document Library", icon: Library },
        { href: "/community-hub", title: "Community Hub", icon: Compass },
        { href: "/requests", title: "My Requests", icon: Inbox },
        { href: "/suggestion-box", title: "Suggestion Box", icon: Lightbulb },
      ]
    },
    {
      title: "Development",
      items: [
        { href: "/training", title: "E-Learning", icon: GraduationCap },
      ]
    },
     {
      title: "Admin",
      items: [
        { href: "/admin", title: "Admin Panel", icon: ServerCog, roles: ['admin'] },
      ]
    }
  ]
};

export const adminNavConfig: { sidebarNav: NavGroup[] } = {
  sidebarNav: [
    {
      title: "Management",
      items: [
        { href: "/admin", title: "Admin Dashboard", icon: LayoutDashboard, description: "Central hub for managing application settings and data.", buttonText: "View Dashboard" },
        { href: "/admin/users", title: "User Management", icon: Users, description: "View, create, and manage user accounts, roles, and permissions.", buttonText: "Manage Users", statKey: "users" },
        { href: "/admin/flights", title: "Flight Management", icon: Plane, description: "Schedule new flights, assign crew, and manage flight details.", buttonText: "Manage Flights", statKey: "pendingSwaps", highlightWhen: v => v > 0 },
        { href: "/admin/alerts", title: "Alert Management", icon: BellRing, description: "Create and broadcast alerts to all or specific groups of users.", buttonText: "Manage Alerts", statKey: "activeAlerts", highlightWhen: v => v > 0 },
        { href: "/admin/expiry-management", title: "Document Expiry", icon: BadgeAlert, description: "Track and manage expiry dates for all user documents and licenses.", buttonText: "Manage Expiry" },
        { href: "/admin/document-validations", title: "Doc Validations", icon: FileCheck2, description: "Review and approve documents updated or submitted by users.", buttonText: "Validate Docs", statKey: "pendingValidations", highlightWhen: v => v > 0 },
        { href: "/admin/user-requests", title: "User Requests", icon: ClipboardList, description: "Review and manage all user-submitted requests.", buttonText: "Manage Requests", statKey: "requests", highlightWhen: v => v > 0 },
        { href: "/admin/purser-reports", title: "Purser Reports", icon: FileSignature, description: "Review and manage all flight reports submitted by pursers.", buttonText: "Review Reports", statKey: "reports", highlightWhen: v => v > 0 },
      ]
    },
     {
      title: "Training",
      items: [
        { href: "/admin/training-sessions", title: "Training Sessions", icon: ClipboardCheck, description: "Plan and manage in-person training sessions for crew members.", buttonText: "Manage Sessions", statKey: "upcomingSessions" },
        { href: "/admin/courses", title: "Course Management", icon: GraduationCap, description: "Create, edit, and publish e-learning courses and their content.", buttonText: "Manage Courses", statKey: "courses" },
      ]
    },
    {
       title: "Content & System",
       items: [
         { href: "/admin/documents", title: "Documents", icon: Library, description: "Upload, manage, and distribute operational manuals.", buttonText: "Manage Documents", statKey: "documents" },
         { href: "/admin/suggestions", title: "Suggestions", icon: MessageSquare, description: "Review and manage all user-submitted suggestions.", buttonText: "Manage Suggestions", statKey: "suggestions", highlightWhen: v => v > 0 },
         { href: "/admin/system-settings", title: "System Settings", icon: Settings, description: "Configure application-wide settings and maintenance mode.", buttonText: "Configure Settings" },
         { href: "/admin/audit-logs", title: "Audit Logs", icon: Activity, description: "Review a chronological record of system activities and changes.", buttonText: "View Logs" },
       ]
    }
  ]
};
