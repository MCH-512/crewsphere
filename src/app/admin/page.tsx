
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServerCog, Users, Activity, Files, GraduationCap, ClipboardList, Plane, Settings, Loader2, FilePlus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";

export default function AdminConsolePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingRequestsCount, setPendingRequestsCount] = React.useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = React.useState(true);

  const fetchPendingRequestsCount = React.useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setIsLoadingCount(false);
      setPendingRequestsCount(0);
      return;
    }
    setIsLoadingCount(true);
    try {
      const requestsCollectionRef = collection(db, "requests");
      const q = query(requestsCollectionRef, where("status", "==", "pending"));
      const snapshot = await getCountFromServer(q);
      setPendingRequestsCount(snapshot.data().count);
    } catch (error) {
      console.error("Error fetching pending requests count:", error);
      toast({
        title: "Error",
        description: "Could not fetch pending requests count.",
        variant: "destructive",
      });
      setPendingRequestsCount(0); 
    } finally {
      setIsLoadingCount(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    fetchPendingRequestsCount();
  }, [fetchPendingRequestsCount]);

  const adminSections = [
    { 
      icon: Users, 
      title: "User Management", 
      description: "View, create, and manage user accounts, roles, and permissions.", 
      buttonText: "Manage Users", 
      href: "/admin/users",
      delay: 0.1 
    },
    { 
      icon: FilePlus, 
      title: "Document Management", 
      description: "Create, upload, categorize, and manage all shared documents, notes, and procedures.", 
      buttonText: "Manage Documents", 
      href: "/admin/documents", 
      delay: 0.15
    },
    { 
      icon: ServerCog, 
      title: "Alerts Management", 
      description: "Create and manage global or user-specific alerts. Creation option is available from the management page.", 
      buttonText: "Manage Alerts", 
      href: "/admin/alerts",
      delay: 0.2
    },
    { 
      icon: GraduationCap, 
      title: "Learning & Assessment Hub", 
      description: "Manage courses (including their modules, quizzes, and certification rules), training assignments, and track user progress.", 
      buttonText: "Manage Courses", 
      href: "/admin/courses", 
      delay: 0.25
    },
    { 
      icon: ClipboardList, 
      title: "User Request Management", 
      description: "Review, manage, and respond to user-submitted requests (e.g., leave, schedule changes).", 
      buttonText: "Manage Requests", 
      href: "/admin/user-requests",
      isRequestManagement: true,
      delay: 0.3
    },
    { 
      icon: Files, 
      title: "Purser Report Review", 
      description: "Access, review, and analyze submitted Purser Reports for operational insights and follow-up actions.", 
      buttonText: "Manage Reports", 
      href: "/admin/purser-reports",
      delay: 0.35
    },
    { 
      icon: Plane, 
      title: "Flight Management", 
      description: "Manage flight schedules. Add new flights from the management page.", 
      buttonText: "Manage Flights", 
      href: "/admin/flights",
      delay: 0.4
    },
    { 
      icon: Settings, 
      title: "System Settings", 
      description: "Configure application-wide settings and integrations.", 
      buttonText: "Configure Settings", 
      href: "/admin/system-settings", 
      disabled: false,
      delay: 0.45
    },
    { 
      icon: Activity, 
      title: "Audit Logs", 
      description: "Review system activity, changes, and important events.", 
      buttonText: "View Logs", 
      href: "/admin/audit-logs", 
      disabled: false, 
      delay: 0.5
    },
  ];

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-start gap-4">
            <ServerCog className="h-8 w-8 text-primary mt-1" />
            <div>
              <CardTitle className="text-2xl font-headline">Admin Console</CardTitle>
              <CardDescription>
                Centralized hub for managing application settings, users, content, and operational data.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Utilize the sections below to oversee and configure various aspects of the AirCrew Hub platform.
            </p>
          </CardContent>
        </Card>
      </AnimatedCard>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => {
          const IconComponent = section.icon;
          return (
            <AnimatedCard key={section.title} delay={section.delay}>
              <Card className="shadow-sm h-full flex flex-col">
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <IconComponent className="h-6 w-6 text-primary" />
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <p className="text-sm text-muted-foreground mb-4">
                    {section.description}
                  </p>
                  <Button asChild className="w-full mt-auto" disabled={section.disabled}>
                    <Link href={section.href}>
                      <IconComponent className="mr-2 h-4 w-4" />
                      {section.buttonText}
                      {section.isRequestManagement && pendingRequestsCount !== null && pendingRequestsCount > 0 && (
                        <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
                          {isLoadingCount ? <Loader2 className="h-3 w-3 animate-spin" /> : pendingRequestsCount}
                        </Badge>
                      )}
                      {section.isRequestManagement && pendingRequestsCount === 0 && !isLoadingCount && (
                        <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">0</Badge>
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
