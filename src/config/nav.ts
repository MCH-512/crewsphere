
import {
  LayoutDashboard, Settings, Plane, ServerCog, Users, ClipboardList, 
  ClipboardCheck, MessageSquare, Activity, FileSignature, 
  Calendar as CalendarIcon, Library, GraduationCap, CheckSquare, Compass, BellRing, 
  BadgeAlert, NotebookPen, ShieldCheck, Wrench, 
  ArrowRightLeft, Handshake, Inbox, Lightbulb, FileCheck2, UserRound, Replace, CalendarClock, History, BookUser, HardHat, MessagesSquare as ChatIcon, BookMarked
} from "lucide-react";

export const mainNavConfig = {
  sidebarNav: [
     {
      title: "Mon Activité",
      items: [
        { href: "/", title: "Mon Dashboard", icon: LayoutDashboard },
        { href: "/my-schedule", title: "Mon Planning", icon: CalendarIcon },
        { href: "/purser-reports", title: "Mes Rapports de Vol", icon: FileSignature, roles: ['purser', 'admin', 'instructor'] },
        { href: "/my-logbook", title: "Mon Carnet de Vol", icon: NotebookPen },
        { href: "/my-documents", title: "Mes Documents", icon: ShieldCheck },
      ]
    },
     {
      title: "Opérations Globales",
      items: [
        { href: "/timeline", title: "Planning Global", icon: CalendarClock },
        { href: "/flight-swap", title: "Tableau des Échanges", icon: Replace },
        { href: "/my-swaps", title: "Mes Échanges", icon: Handshake },
      ]
    },
    {
      title: "Support & Ressources",
      items: [
        { href: "/toolbox", title: "Boîte à Outils", icon: Wrench },
        { href: "/document-library", title: "Bibliothèque Docs", icon: Library },
        { href: "/community-hub", title: "Hub Communautaire", icon: Compass },
        { href: "/requests", title: "Mes Demandes", icon: Inbox },
        { href: "/suggestion-box", title: "Boîte à Idées", icon: Lightbulb },
      ]
    },
    {
      title: "Développement",
      items: [
        { href: "/training", title: "E-Learning", icon: GraduationCap },
      ]
    },
     {
      title: "Admin",
      items: [
        { href: "/admin", title: "Panel Admin", icon: ServerCog, roles: ['admin'] },
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
