
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServerCog, Users, Activity, Settings, Loader2, ArrowRight, MessageSquare, FileSignature, ClipboardList, Library, GraduationCap, CheckSquare, BarChart2, PieChart as PieChartIcon, Compass, Plane, BellRing, BadgeAlert, ClipboardCheck, Handshake } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, where, query, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"

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

const requestsChartConfig = {
  count: {
    label: "Count",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function AdminConsolePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [stats, setStats({ value: usersSnap.size, isLoading: false, label: "Total Users" },
            flights: { value: flightsSnap.size, isLoading: false, label: "Total Flights" },
            suggestions: { value: suggestions.filter(s => s.status === 'new').length, isLoading: false, label: "New Suggestions" },
            reports: { value: reports.filter(r => r.status === 'submitted').length, isLoading: false, label: "New Reports" },
            requests: { value: requests.filter(r => r.status === 'pending').length, isLoading: false, label: "Pending Requests" },
            documents: { value: documentsSnap.size, isLoading: false, label: "Total Documents" },
            courses: { value: coursesSnap.size, isLoading: false, label: "Total Courses" },
            quizzes: { value: quizzesSnap.size, isLoading: false, label: "Total Quizzes" },
            activeAlerts: { value: alertsSnap.size, isLoading: false, label: "Active Alerts" },
            upcomingSessions: { value: sessionsSnap.size, isLoading: false, label: "Upcoming Sessions"},
            pendingSwaps: { value: swapsSnap.size, isLoading: false, label: "Pending Swaps" },
        });

        // --- Process data for charts ---
        // Requests by status
        const requestsByStatus = requests.reduce((acc, req) => {
            const status = req.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        setRequestsChartData(Object.entries(requestsByStatus).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
            count,
            fill: "var(--color-count)",
        })));

        // Suggestions by category
        const suggestionsByCategory = suggestions.reduce((acc, sug) => {
            const category = sug.category || 'Other';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const suggestionCategories = Object.keys(suggestionsByCategory);
        const sChartConfig = suggestionCategories.reduce((acc, category, index) => {
            acc[category] = { label: category, color: `hsl(var(--chart-${(index % 5) + 1}))` };
            return acc;
        }, { count: { label: "Count" } } as ChartConfig);
        setSuggestionsChartConfig(sChartConfig);

        setSuggestionsChartData(suggestionCategories.map((name) => ({
            name,
            count: suggestionsByCategory[name],
            fill: `var(--color-${name})`
        })));
        
        // User roles distribution
        const usersData = usersSnap.docs.map(doc => doc.data());
        const rolesDistribution = usersData.reduce((acc, u) => {
            const role = u.role || 'Other';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const userRoles = Object.keys(rolesDistribution);
        const uChartConfig = userRoles.reduce((acc, role, index) => {
            acc[role] = { label: role.charAt(0).toUpperCase() + role.slice(1), color: `hsl(var(--chart-${(index % 5) + 1}))` };
            return acc;
        }, { count: { label: "Count" } } as ChartConfig);
        setUserRolesChartConfig(uChartConfig);

        setUserRolesChartData(userRoles.map((name) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            count: rolesDistribution[name],
            fill: `var(--color-${name})`
        })));


    } catch (error) {
        console.error(`Error fetching dashboard data:`, error);
        toast({ title: "Error", description: `Could not fetch dashboard data.`, variant: "destructive" });
    }
  }, [user, toast]);

  React.useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
      icon: Plane, 
      title: "Flight Management", 
      description: "Schedule new flights, assign pursers, and manage flight details.", 
      buttonText: "Manage Flights", 
      href: "/admin/flights",
      stat: stats.flights,
      delay: 0.15
    },
    { 
      icon: BellRing, 
      title: "Alert Management", 
      description: "Create and broadcast alerts to all or specific groups of users.", 
      buttonText: "Manage Alerts", 
      href: "/admin/alerts",
      stat: stats.activeAlerts,
      highlightWhen: (value) => value !== null && value > 0,
      delay: 0.2
    },
    { 
      icon: BadgeAlert, 
      title: "Document Expiry", 
      description: "Track and manage expiry dates for all user documents and licenses.", 
      buttonText: "Manage Expiry", 
      href: "/admin/expiry-management",
      delay: 0.2
    },
    { 
      icon: ClipboardList, 
      title: "User Requests", 
      description: "Review and manage all user-submitted requests for leave, roster changes, etc.", 
      buttonText: "Manage Requests", 
      href: "/admin/user-requests",
      stat: stats.requests,
      highlightWhen: (value) => value !== null && value > 0,
      delay: 0.25
    },
    { 
      icon: Handshake, 
      title: "Flight Swap Approvals", 
      description: "Approve or reject pending flight swap requests from crew members.", 
      buttonText: "Manage Swaps", 
      href: "/admin/flight-swaps",
      stat: stats.pendingSwaps,
      highlightWhen: (value) => value !== null && value > 0,
      delay: 0.28
    },
     { 
      icon: FileSignature, 
      title: "Purser Reports", 
      description: "Review and manage all flight reports submitted by pursers.", 
      buttonText: "Review Reports", 
      href: "/admin/purser-reports",
      stat: stats.reports,
      highlightWhen: (value) => value !== null && value > 0,
      delay: 0.31
    },
     { 
      icon: ClipboardCheck, 
      title: "Training Sessions", 
      description: "Plan and manage in-person training sessions for crew members.", 
      buttonText: "Manage Sessions", 
      href: "/admin/training-sessions",
      stat: stats.upcomingSessions,
      delay: 0.34
    },
    { 
      icon: GraduationCap, 
      title: "Course Management", 
      description: "Create, edit, and publish e-learning courses and their content.", 
      buttonText: "Manage Courses", 
      href: "/admin/courses",
      stat: stats.courses,
      delay: 0.37
    },
    { 
      icon: CheckSquare, 
      title: "Quiz Management", 
      description: "View all quizzes and their associated questions.", 
      buttonText: "Manage Quizzes", 
      href: "/admin/quizzes",
      stat: stats.quizzes,
      delay: 0.4
    },
    { 
      icon: Library, 
      title: "Document Management", 
      description: "Upload, manage, and distribute operational manuals and documents.", 
      buttonText: "Manage Documents", 
      href: "/admin/documents",
      stat: stats.documents,
      delay: 0.43
    },
    { 
      icon: MessageSquare, 
      title: "Suggestions", 
      description: "Review and manage all user-submitted suggestions for improvement.", 
      buttonText: "Manage Suggestions", 
      href: "/admin/suggestions",
      stat: stats.suggestions,
      highlightWhen: (value) => value !== null && value > 0,
      delay: 0.46
    },
    { 
      icon: Settings, 
      title: "System Settings", 
      description: "Configure application-wide settings and maintenance mode.", 
      buttonText: "Configure Settings", 
      href: "/admin/system-settings", 
      delay: 0.49
    },
    { 
      icon: Activity, 
      title: "Audit Logs", 
      description: "Review a detailed, chronological record of system activities and changes.", 
      buttonText: "View Logs", 
      href: "/admin/audit-logs", 
      delay: 0.52
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
                Centralized hub for managing application settings, users, and operational data.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </AnimatedCard>
      
      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          <AnimatedCard delay={0.1}>
              <Card className="shadow-sm">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-primary"/>Requests by Status</CardTitle>
                      <CardDescription>An overview of all user requests.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ChartContainer config={requestsChartConfig} className="min-h-[250px] w-full">
                          <BarChart accessibilityLayer data={requestsChartData}>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="status" tickLine={false} tickMargin={10} axisLine={false} fontSize={12} />
                              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                              <Bar dataKey="count" radius={8} />
                          </BarChart>
                      </ChartContainer>
                  </CardContent>
              </Card>
          </AnimatedCard>
          <AnimatedCard delay={0.15}>
              <Card className="shadow-sm">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary"/>Suggestions by Category</CardTitle>
                      <CardDescription>A breakdown of submitted ideas.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center pb-0">
                       <ChartContainer config={suggestionsChartConfig} className="mx-auto aspect-square max-h-[300px]">
                          <PieChart>
                              <ChartTooltip content={<ChartTooltipContent nameKey="count" hideLabel />} />
                              <Pie data={suggestionsChartData} dataKey="count" nameKey="name" labelLine={false} />
                               <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap" />} />
                          </PieChart>
                      </ChartContainer>
                  </CardContent>
              </Card>
          </AnimatedCard>
          <AnimatedCard delay={0.2}>
              <Card className="shadow-sm">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>User Role Distribution</CardTitle>
                      <CardDescription>A breakdown of all user roles.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center pb-0">
                       <ChartContainer config={userRolesChartConfig} className="mx-auto aspect-square max-h-[300px]">
                          <PieChart>
                              <ChartTooltip content={<ChartTooltipContent nameKey="count" hideLabel />} />
                              <Pie data={userRolesChartData} dataKey="count" nameKey="name" labelLine={false} />
                               <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap" />} />
                          </PieChart>
                      </ChartContainer>
                  </CardContent>
              </Card>
          </AnimatedCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {adminSections.map((section) => {
          const IconComponent = section.icon;
          const shouldHighlight = section.highlightWhen?.(section.stat?.value ?? null);

          return (
            <AnimatedCard 
                key={section.title} 
                delay={0.3 + section.delay}
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
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </CardContent>
                <CardFooter>
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
                </CardFooter>
              </Card>
            </AnimatedCard>
          );
        })}
      </div>

    </div>
  );
}

    