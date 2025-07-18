
import {
  LayoutDashboard, Settings, Plane, ServerCog, Users, ClipboardList, 
  ClipboardCheck, MessageSquare, Activity, FileSignature, 
  Calendar as CalendarIcon, Library, GraduationCap, CheckSquare, Compass, BellRing, 
  BadgeAlert, NotebookPen, ShieldCheck, Wrench, 
  ArrowRightLeft, Handshake, Inbox, Lightbulb, FileCheck2, UserRound, Replace, CalendarClock, History, FolderOpen
} from "lucide-react";

export const mainNavConfig = {
  sidebarNav: [
     {
      title: "✈️ Flights & Missions",
      items: [
        { href: "/", title: "My Missions", icon: LayoutDashboard },
        { href: "/my-schedule", title: "My Schedule", icon: CalendarIcon },
        { href: "/my-swaps", title: "My Swaps", icon: Handshake },
      ]
    },
     {
      title: "✈️ Swap & Rotation",
      items: [
        { href: "/timeline", title: "Global Timeline", icon: CalendarClock },
        { href: "/flight-swap", title: "Swap Board", icon: Replace },
      ]
    },
    {
      title: "✈️ Flight Reports",
      items: [
        { href: "/purser-reports", title: "Purser Report", icon: FileSignature, roles: ['purser', 'admin', 'instructor'] },
        { href: "/my-logbook", title: "Personal Logbook", icon: History },
      ]
    },
    {
      title: "🎓 Training & Development",
      items: [
        { href: "/training", title: "E-Learning", icon: GraduationCap },
      ]
    },
    {
        title: "🧰 Reference Documents",
        items: [
            { href: "/document-library", title: "Document Library", icon: Library },
            { href: "/my-documents", title: "My Documents", icon: ShieldCheck },
        ]
    },
    {
      title: "🧰 Tools & Forms",
      items: [
        { href: "/toolbox", title: "Toolbox", icon: Wrench },
      ]
    },
    {
      title: "📣 Support & Communication",
      items: [
        { href: "/requests", title: "My Requests", icon: Inbox },
        { href: "/suggestion-box", title: "Suggestion Box", icon: Lightbulb },
        { href: "/community-hub", title: "Crew Hub", icon: Compass },
      ]
    },
     {
      title: "🔐 Admin Panel",
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
        { href: "/admin/expiry-management", title: "Document Expiry", icon: BadgeAlert },
        { href: "/admin/document-validations", title: "Doc Validations", icon: FileCheck2 },
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
