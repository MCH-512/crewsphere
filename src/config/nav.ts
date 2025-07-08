
import {
  LayoutDashboard, Settings, Plane, ServerCog, Users, ClipboardList, 
  ClipboardCheck, MessageSquare, MessagesSquare, Activity, FileSignature, 
  Calendar as CalendarIcon, Library, GraduationCap, CheckSquare, Compass, BellRing, 
  BadgeAlert, NotebookPen, ShieldCheck, Book, Calculator, CloudSun, 
  Globe, Map, Mic, ScrollText, ShieldAlert, Waypoints, Wrench, 
  ArrowRightLeft, Handshake, Inbox, Lightbulb, User
} from "lucide-react";

export const mainNavConfig = {
  items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    {
      label: "My Hub",
      icon: User,
      subItems: [
        { href: "/my-schedule", label: "My Schedule", icon: CalendarIcon },
        { href: "/my-logbook", label: "My Logbook", icon: NotebookPen },
        { href: "/my-documents", label: "My Documents", icon: ShieldCheck },
        { href: "/requests", label: "My Requests", icon: Inbox },
        { href: "/my-swaps", label: "My Swaps", icon: Handshake },
      ]
    },
    { href: "/timeline", label: "Flight Timeline", icon: CalendarIcon },
    { href: "/flight-swap", label: "Swap Board", icon: ArrowRightLeft },
    { href: "/training", label: "E-Learning", icon: GraduationCap },
    { href: "/document-library", label: "Document Library", icon: Library },
    { href: "/purser-reports", label: "Purser Reports", icon: FileSignature, roles: ['purser', 'admin', 'instructor'] },
    { href: "/suggestion-box", label: "Suggestion Box", icon: Lightbulb },
    {
      href: "/toolbox",
      label: "Toolbox",
      icon: Wrench,
      subItems: [
        { href: "/toolbox/weather-decoder", label: "Weather Decoder", icon: CloudSun },
        { href: "/toolbox/ftl-calculator", label: "FTL Calculator", icon: ShieldAlert },
        { href: "/toolbox/flight-timeline", label: "Flight Timeline", icon: Waypoints },
        { href: "/toolbox/live-flight-tracker", label: "Live Tracker", icon: Map },
        { href: "/toolbox/airport-directory", label: "Airport Directory", icon: Globe },
        { href: "/toolbox/converters", label: "Converters", icon: Calculator },
        { href: "/toolbox/aeronautical-jargon", label: "Jargon Glossary", icon: MessagesSquare },
        { href: "/toolbox/phonetic-alphabet", label: "Phonetic Alphabet", icon: Mic },
        { href: "/toolbox/aviation-history", label: "Aviation History", icon: ScrollText },
        { href: "/toolbox/guides", label: "Professional Guides", icon: Book },
      ]
    },
    { href: "/community-hub", label: "Community Hub", icon: Compass },
    { href: "/admin", label: "Admin Console", icon: ServerCog, roles: ['admin'] },
  ]
};

export const adminNavConfig = {
  items: [
    { href: "/admin", label: "Admin Dashboard", icon: ServerCog },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/flights", label: "Flight Management", icon: Plane },
    { href: "/admin/alerts", label: "Alert Management", icon: BellRing },
    { href: "/admin/flight-swaps", label: "Flight Swaps", icon: Handshake },
    { href: "/admin/expiry-management", label: "Document Expiry", icon: BadgeAlert },
    { href: "/admin/user-requests", label: "User Requests", icon: ClipboardList },
    { href: "/admin/purser-reports", label: "Purser Reports", icon: FileSignature },
    { href: "/admin/training-sessions", label: "Training Sessions", icon: ClipboardCheck },
    { href: "/admin/courses", label: "Course Management", icon: GraduationCap },
    { href: "/admin/quizzes", label: "Quiz Management", icon: CheckSquare },
    { href: "/admin/documents", label: "Documents", icon: Library },
    { href: "/admin/suggestions", label: "Suggestions", icon: MessageSquare },
    { href: "/admin/system-settings", label: "System Settings", icon: Settings },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: Activity },
  ]
};
