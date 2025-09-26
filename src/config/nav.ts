
import {
  LayoutDashboard, Settings, Plane, ServerCog, Users, ClipboardList, 
  ClipboardCheck, MessageSquare, Activity, FileSignature, 
  Calendar as CalendarIcon, Library, GraduationCap, Compass, BellRing, 
  BadgeAlert, NotebookPen, ShieldCheck, Wrench, 
  Handshake, Inbox, Lightbulb, FileCheck2, History, AudioWaveform, Video,
  GitPullRequest
} from "lucide-react";
import type { ElementType } from 'react';

export interface AdminDashboardStats {
  pendingRequests: number;
  pendingDocValidations: number;
  newSuggestions: number;
  pendingSwaps: number;
  activeAlerts: number;
  pendingReports: number;
  openPullRequests?: number;
  [key: string]: number | undefined;
}


export interface NavItem {
  href: string;
  title: string;
  icon: ElementType;
  roles?: string[];
  description?: string;
  buttonText?: string;
  statKey?: keyof AdminDashboardStats;
  highlightWhen?: (value: number) => boolean;
}

export interface NavGroup {
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
      title: "Operations",
      items: [
        { href: "/admin", title: "Dashboard", icon: LayoutDashboard, description: "Vue centralisée pour la gestion de l'application et l'analyse des données opérationnelles.", buttonText: "View Dashboard" },
        { href: "/admin/flights", title: "Flight Management", icon: Plane, description: "Créez et assignez des vols, gérez les équipages et traitez les demandes d'échange de vols.", buttonText: "Manage Flights", statKey: "pendingSwaps", highlightWhen: v => v > 0 },
        { href: "/admin/training-sessions", title: "Training Sessions", icon: ClipboardCheck, description: "Organisez et planifiez des sessions de formation en présentiel pour tous les membres d'équipage.", buttonText: "Manage Sessions" },
      ]
    },
    {
      title: "Crew Management",
      items: [
        { href: "/admin/users", title: "User Management", icon: Users, description: "Gérez les profils des utilisateurs, assignez des rôles et supervisez le statut des comptes dans toute l'application.", buttonText: "Manage Users" },
        { href: "/admin/user-requests", title: "User Requests", icon: ClipboardList, description: "Suivez, répondez et résolvez toutes les requêtes administratives soumises par les membres d'équipage.", buttonText: "Manage Requests", statKey: "pendingRequests", highlightWhen: v => v > 0 },
        { href: "/admin/purser-reports", title: "Purser Reports", icon: FileSignature, description: "Analysez les rapports de vol des chefs de cabine, consultez les résumés IA et suivez les actions à entreprendre.", buttonText: "Review Reports", statKey: "pendingReports", highlightWhen: v => v > 0 },
      ]
    },
    {
      title: "Content & Compliance",
      items: [
        { href: "/admin/courses", title: "Course Management", icon: GraduationCap, description: "Créez et publiez des cours interactifs avec génération de quiz assistée par l'IA.", buttonText: "Manage Courses" },
        { href: "/admin/documents", title: "Document Library", icon: Library, description: "Distribuez et versionnez la documentation officielle (manuels, procédures) pour tous les équipages.", buttonText: "Manage Documents" },
        { href: "/admin/document-validations", title: "Doc Validations", icon: FileCheck2, description: "Validez et approuvez les documents mis à jour par les utilisateurs (licences, passeports) pour garantir la conformité.", buttonText: "Validate Docs", statKey: "pendingDocValidations", highlightWhen: v => v > 0 },
        { href: "/admin/expiry-management", title: "Document Expiry", icon: BadgeAlert, description: "Surveillez et gérez de manière proactive les dates d'expiration des documents critiques des utilisateurs.", buttonText: "Manage Expiry" },
        { href: "/admin/suggestions", title: "Suggestions", icon: MessageSquare, description: "Examinez, catégorisez et suivez le statut des idées et feedbacks soumis par la communauté.", buttonText: "Manage Suggestions", statKey: "newSuggestions", highlightWhen: v => v > 0 },
      ]
    },
     {
      title: "System",
      items: [
         { href: "/admin/alerts", title: "Alert Management", icon: BellRing, description: "Diffusez des alertes en temps réel (critiques, informatives) à des groupes d'utilisateurs ciblés.", buttonText: "Manage Alerts", statKey: "activeAlerts", highlightWhen: v => v > 0 },
         { href: "/admin/audio-studio", title: "Audio Studio", icon: AudioWaveform, description: "Utilisez l'IA Text-to-Speech pour créer des annonces vocales professionnelles.", buttonText: "Open Studio" },
         { href: "/admin/video-studio", title: "Video Studio", icon: Video, description: "Générez de courts clips vidéo à partir de texte ou en animant une image statique via l'IA.", buttonText: "Open Studio" },
         { href: "/admin/system-settings", title: "System Settings", icon: Settings, description: "Gérez les paramètres de l'application, activez le mode maintenance et effectuez des actions de data seeding.", buttonText: "Configure Settings" },
         { href: "/admin/audit-logs", title: "Audit Logs", icon: Activity, description: "Consultez un journal détaillé de toutes les actions administratives et des événements système importants.", buttonText: "View Logs" },
         { href: "https://github.com/VOTRE_USER/VOTRE_REPO/pulls", title: "Pull Requests", icon: GitPullRequest, description: "Accédez au dépôt GitHub pour réviser et fusionner les pull requests en attente, y compris les mises à jour automatiques.", buttonText: "Review PRs", statKey: "openPullRequests", highlightWhen: v => v > 0 },
       ]
    }
  ]
};
