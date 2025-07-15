
import {
  LayoutDashboard, Settings, Plane, ServerCog, Users, ClipboardList, 
  ClipboardCheck, MessageSquare, Activity, FileSignature, 
  Calendar as CalendarIcon, Library, GraduationCap, CheckSquare, Compass, BellRing, 
  BadgeAlert, NotebookPen, ShieldCheck, Wrench, 
  ArrowRightLeft, Handshake, Inbox, Lightbulb
} from "lucide-react";

export const mainNavConfig = {
  sidebarNav: [
     {
      title: "My Day",
      items: [
        { href: "/", title: "Dashboard", icon: LayoutDashboard },
        { href: "/my-schedule", title: "My Schedule", icon: CalendarIcon },
        { href: "/my-documents", title: "My Documents", icon: ShieldCheck },
      ]
    },
    {
      title: "Operations",
      items: [
        { href: "/purser-reports", title: "Purser Reports", icon: FileSignature, roles: ['purser', 'admin', 'instructor'] },
        { href: "/timeline", title: "Global Timeline", icon: CalendarIcon },
        { href: "/flight-swap", title: "Swap Board", icon: ArrowRightLeft },
        { href: "/my-swaps", title: "My Swaps", icon: Handshake },
        { href: "/my-logbook", title: "My Logbook", icon: NotebookPen },
      ]
    },
    {
      title: "Development",
      items: [
        { href: "/training", title: "E-Learning", icon: GraduationCap },
        { href: "/document-library", title: "Document Library", icon: Library },
        { href: "/toolbox", title: "Toolbox", icon: Wrench },
      ]
    },
    {
      title: "Communication & Support",
      items: [
        { href: "/requests", title: "My Requests", icon: Inbox },
        { href: "/suggestion-box", title: "Suggestion Box", icon: Lightbulb },
        { href: "/community-hub", title: "Community Hub", icon: Compass },
      ]
    },
     {
      title: "Admin",
      items: [
        { href: "/admin", title: "Admin Console", icon: ServerCog, roles: ['admin'] },
      ]
    }
  ]
};

export const adminNavConfig = {
  sidebarNav: [
    {
      title: "Management",
      items: [
        { href: "/admin", title: "Admin Dashboard", icon: LayoutDashboard },
        { href: "/admin/users", title: "User Management", icon: Users },
        { href: "/admin/flights", title: "Flight Management", icon: Plane },
        { href: "/admin/alerts", title: "Alert Management", icon: BellRing },
        { href: "/admin/flight-swaps", title: "Flight Swaps", icon: Handshake },
        { href: "/admin/expiry-management", title: "Document Expiry", icon: BadgeAlert },
        { href: "/admin/user-requests", title: "User Requests", icon: ClipboardList },
        { href: "/admin/purser-reports", title: "Purser Reports", icon: FileSignature },
      ]
    },
     {
      title: "Training",
      items: [
        { href: "/admin/training-sessions", title: "Training Sessions", icon: ClipboardCheck },
        { href: "/admin/courses", title: "Course Management", icon: GraduationCap },
        { href: "/admin/quizzes", title: "Quiz Management", icon: CheckSquare },
      ]
    },
    {
       title: "Content & System",
       items: [
         { href: "/admin/documents", title: "Documents", icon: Library },
         { href: "/admin/suggestions", title: "Suggestions", icon: MessageSquare },
         { href: "/admin/system-settings", title: "System Settings", icon: Settings },
         { href: "/admin/audit-logs", title: "Audit Logs", icon: Activity },
       ]
    }
  ]
};
