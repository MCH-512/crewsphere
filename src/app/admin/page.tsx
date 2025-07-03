
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServerCog, Users, Activity, GraduationCap, Plane, Settings, Loader2, FilePlus, Bell, FileSignature, ClipboardCheck, CheckSquare, MessageSquare, ArrowRight, School } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getCountFromServer, Timestamp } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";

interface Stat {
  value: number | null;
  isLoading: boolean;
  label: string;
}

interface AdminSection {
  icon: React.ElementType;
  title: string;
  description: string;
  buttonText: string;
  href: string;
  delay: number;
  stat?: Stat;
  highlightWhen?: (value: number | null) => boolean;
}


export default function AdminConsolePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [stats, setStats] = React.useState({
    pendingRequests: { value: null, isLoading: true, label: "Pending" } as Stat,
    users: { value: null, isLoading: true, label: "Total Users" } as Stat,
    documents: { value: null, isLoading: true, label: "Documents" } as Stat,
    publishedCourses: { value: null, isLoading: true, label: "Published Courses" } as Stat,
    flightsToday: { value: null, isLoading: true, label: "Flights Today" } as Stat,
    trainingSessions: { value: null, isLoading: true, label: "Upcoming Sessions" } as Stat,
    quizzes: { value: null, isLoading: true, label: "Total Quizzes" } as Stat,
    purserReports: { value: null, isLoading: true, label: "Total Reports" } as Stat,
    suggestions: { value: null, isLoading: true, label: "New Suggestions" } as Stat,
  });

  const fetchCounts = React.useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setStats(prev => Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: { ...prev[key as keyof typeof prev], isLoading: false } }), {} as typeof stats));
      return;
    }

    const fetcher = async (key: keyof typeof stats, q: any) => {
      try {
        const snapshot = await getCountFromServer(q);
        setStats(prev => ({ ...prev, [key]: { ...prev[key], value: snapshot.data().count, isLoading: false } }));
      } catch (error) {
        console.error(`Error fetching ${key} count:`, error);
        toast({ title: "Error", description: `Could not fetch count for ${key}.`, variant: "destructive" });
        setStats(prev => ({ ...prev, [key]: { ...prev[key], value: 0, isLoading: false } }));
      }
    };
    
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    fetcher('pendingRequests', query(collection(db, "requests"), where("status", "==", "pending")));
    fetcher('users', collection(db, "users"));
    fetcher('documents', collection(db, "documents"));
    fetcher('publishedCourses', query(collection(db, "courses"), where("published", "==", true)));
    fetcher('flightsToday', query(collection(db, "flights"), where("scheduledDepartureDateTimeUTC", ">=", todayStart), where("scheduledDepartureDateTimeUTC", "<=", todayEnd)));
    fetcher('trainingSessions', query(collection(db, "trainingSessions"), where("sessionDateTimeUTC", ">=", todayStart)));
    fetcher('quizzes', collection(db, "quizzes"));
    fetcher('purserReports', collection(db, "purserReports"));
    fetcher('suggestions', query(collection(db, "suggestions"), where("status", "==", "new")));

  }, [user, toast]);

  React.useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const adminSections: AdminSection[] = [
    { 
      icon: Users, 
      title: "User Management", 
      description: "View, create, and manage user accounts, roles, and permissions.", 
      buttonText: "Manage Users", 
      href: "/admin/users",
      stat: stats.users,
      delay: 0.1 
    },
    { 
      icon: ClipboardCheck, 
      title: "User Requests", 
      description: "Review and respond to user-submitted requests (leave, roster changes, etc.).", 
      buttonText: "Manage Requests", 
      href: "/admin/user-requests",
      stat: stats.pendingRequests,
      highlightWhen: (value) => value !== null && value > 0,
      delay: 0.15
    },
    { 
      icon: FilePlus, 
      title: "Documents", 
      description: "Create, upload, and manage all shared documents, notes, and procedures.", 
      buttonText: "Manage Documents", 
      href: "/admin/documents", 
      stat: stats.documents,
      delay: 0.2
    },
    { 
      icon: Bell, 
      title: "Alerts", 
      description: "Broadcast global or user-specific alerts that appear on user dashboards.", 
      buttonText: "Manage Alerts", 
      href: "/admin/alerts",
      delay: 0.25
    },
    { 
      icon: GraduationCap, 
      title: "Courses (E-Learning)", 
      description: "Create and manage e-learning courses, including content, quizzes, and certifications.", 
      buttonText: "Manage Courses", 
      href: "/admin/courses",
      stat: stats.publishedCourses,
      delay: 0.3
    },
     { 
      icon: School, 
      title: "Training Sessions", 
      description: "Schedule and manage in-person training sessions for crew members.", 
      buttonText: "Manage Sessions", 
      href: "/admin/training-sessions",
      stat: stats.trainingSessions,
      delay: 0.35
    },
    { 
      icon: CheckSquare,
      title: "Quizzes",
      description: "View all quizzes in the system. Quizzes are managed within their respective courses.",
      buttonText: "View Quizzes",
      href: "/admin/quizzes",
      stat: stats.quizzes,
      delay: 0.38,
    },
    { 
      icon: Plane, 
      title: "Flights", 
      description: "Create, view, and manage flight schedules, including recurring flight generation.", 
      buttonText: "Manage Flights", 
      href: "/admin/flights",
      stat: stats.flightsToday,
      delay: 0.4
    },
    { 
      icon: MessageSquare, 
      title: "Suggestions", 
      description: "Review and manage all user-submitted suggestions for improvement.", 
      buttonText: "Manage Suggestions", 
      href: "/admin/suggestions",
      stat: stats.suggestions,
      highlightWhen: (value) => value !== null && value > 0,
      delay: 0.45
    },
    { 
      icon: Settings, 
      title: "System Settings", 
      description: "Configure application-wide settings like maintenance mode and AI models.", 
      buttonText: "Configure Settings", 
      href: "/admin/system-settings", 
      delay: 0.48
    },
    { 
      icon: Activity, 
      title: "Audit Logs", 
      description: "Review a detailed, chronological record of system activities and changes.", 
      buttonText: "View Logs", 
      href: "/admin/audit-logs", 
      delay: 0.51
    },
  ];

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-start gap-4">
            <ServerCog className="h-8 w-8 text-primary mt-1" />
            <div>
              <CardTitle className="text-2xl font-headline">Admin Dashboard</CardTitle>
              <CardDescription>
                Centralized hub for managing application settings, users, content, and operational data.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </AnimatedCard>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => {
          const IconComponent = section.icon;
          const shouldHighlight = section.highlightWhen?.(section.stat?.value ?? null);

          return (
            <AnimatedCard 
                key={section.title} 
                delay={section.delay}
            >
              <Card className={cn(
                "shadow-sm h-full flex flex-col transition-all hover:shadow-md",
                shouldHighlight && "ring-2 ring-destructive/50 bg-destructive/5"
              )}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-6 w-6 text-primary" />
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                   {section.stat && (
                    <div className="flex justify-end">
                       <Badge variant={shouldHighlight ? "destructive" : "secondary"} className="shrink-0">
                          {section.stat.isLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : section.stat.value}
                          <span className="ml-1.5 hidden sm:inline">{section.stat.label}</span>
                       </Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <p className="text-sm text-muted-foreground mb-4">
                    {section.description}
                  </p>
                  <Button asChild className="w-full mt-auto">
                    <Link href={section.href}>
                      {section.buttonText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                      {shouldHighlight && !section.stat?.isLoading && (
                        <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs bg-white text-destructive hover:bg-white">
                          {section.stat?.value}
                        </Badge>
                      )}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </AnimatedCard>
          );
        })}
      </div>
    </div>
  );
}
