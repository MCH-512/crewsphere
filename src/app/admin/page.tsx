
"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServerCog, Users, Activity, Settings, Loader2, ArrowRight, MessageSquare, FileSignature, ClipboardList, Library, GraduationCap, CheckSquare, BarChart2, PieChart as PieChartIcon, Compass, Plane, BellRing, BadgeAlert, ClipboardCheck, Handshake, FileCheck2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, where, query, Timestamp, orderBy, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { AnimatedCard } from "@/components/motion/animated-card";
import { cn } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import { formatDistanceToNowStrict } from "date-fns";
import type { AuditLogData } from "@/lib/audit-logger";
import { Separator } from "@/components/ui/separator";
import { adminNavConfig } from "@/config/nav";

interface DisplayAuditLog extends AuditLogData {
  id: string;
  timestamp: Timestamp;
}

interface Stat {
  value: number;
  label: string;
}

interface AdminDashboardStats {
    users: Stat;
    flights: Stat;
    suggestions: Stat;
    reports: Stat;
    requests: Stat;
    documents: Stat;
    pendingValidations: Stat;
    courses: Stat;
    quizzes: Stat;
    activeAlerts: Stat;
    upcomingSessions: Stat;
    pendingSwaps: Stat;
    [key: string]: Stat; // Index signature
}


const requestsChartConfig = {
  count: {
    label: "Count",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

async function getDashboardData() {
    const usersSnapPromise = getDocs(collection(db, "users"));
    const flightsSnapPromise = getDocs(collection(db, "flights"));
    const suggestionsPromise = getDocs(query(collection(db, "suggestions"), where("status", "==", "new")));
    const reportsPromise = getDocs(query(collection(db, "purserReports"), where("status", "==", "submitted")));
    const requestsPromise = getDocs(collection(db, "requests"));
    const documentsSnapPromise = getDocs(collection(db, "documents"));
    const pendingValidationsPromise = getDocs(query(collection(db, "userDocuments"), where("status", "==", "pending-validation")));
    const coursesSnapPromise = getDocs(collection(db, "courses"));
    const quizzesSnapPromise = getDocs(collection(db, "quizzes"));
    const alertsSnapPromise = getDocs(query(collection(db, "alerts"), where("isActive", "==", true)));
    const sessionsSnapPromise = getDocs(query(collection(db, "trainingSessions"), where("sessionDateTimeUTC", ">=", Timestamp.now())));
    const swapsSnapPromise = getDocs(query(collection(db, "flightSwaps"), where("status", "==", "pending_approval")));
    const auditLogsPromise = getDocs(query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(5)));
    const allSuggestionsPromise = getDocs(collection(db, "suggestions"));

    const [
        usersSnap, flightsSnap, suggestionsSnap, reportsSnap, requestsSnap,
        documentsSnap, pendingValidationsSnap, coursesSnap, quizzesSnap, alertsSnap, sessionsSnap, swapsSnap, auditLogsSnap, allSuggestionsSnap
    ] = await Promise.all([
        usersSnapPromise, flightsSnapPromise, suggestionsPromise, reportsPromise, requestsPromise,
        documentsSnapPromise, pendingValidationsPromise, coursesSnapPromise, quizzesSnapPromise, alertsSnapPromise, sessionsSnapPromise, swapsSnapPromise, auditLogsPromise, allSuggestionsPromise
    ]);
    
    const allSuggestions = allSuggestionsSnap.docs.map(doc => doc.data());
    const requests = requestsSnap.docs.map(doc => doc.data());

    const stats: AdminDashboardStats = {
        users: { value: usersSnap.size, label: "Total Users" },
        flights: { value: flightsSnap.size, label: "Total Flights" },
        suggestions: { value: suggestionsSnap.size, label: "New Suggestions" },
        reports: { value: reportsSnap.size, label: "New Reports" },
        requests: { value: requests.filter((r: any) => r.status === 'pending').length, label: "Pending Requests" },
        documents: { value: documentsSnap.size, label: "Total Documents" },
        pendingValidations: { value: pendingValidationsSnap.size, label: "Pending Validations" },
        courses: { value: coursesSnap.size, label: "Total Courses" },
        quizzes: { value: quizzesSnap.size, label: "Total Quizzes" },
        activeAlerts: { value: alertsSnap.size, label: "Active Alerts" },
        upcomingSessions: { value: sessionsSnap.size, label: "Upcoming Sessions"},
        pendingSwaps: { value: swapsSnap.size, label: "Pending Swaps" },
    };

    const requestsByStatus = requests.reduce((acc, req: any) => {
        const status = req.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const requestsChartData = Object.entries(requestsByStatus).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
        count,
        fill: "var(--color-count)",
    }));

    const suggestionsByCategory = allSuggestions.reduce((acc, sug: any) => {
        const category = sug.category || 'Other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const suggestionCategories = Object.keys(suggestionsByCategory);
    const suggestionsChartConfig = suggestionCategories.reduce((acc, category, index) => {
        acc[category] = { label: category, color: `hsl(var(--chart-${(index % 5) + 1}))` };
        return acc;
    }, { count: { label: "Count" } } as ChartConfig);

    const suggestionsChartData = suggestionCategories.map((name) => ({
        name,
        count: suggestionsByCategory[name],
        fill: `var(--color-${name})`
    }));
    
    const usersData = usersSnap.docs.map(doc => doc.data());
    const rolesDistribution = usersData.reduce((acc, u: any) => {
        const role = u.role || 'Other';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const userRoles = Object.keys(rolesDistribution);
    const userRolesChartConfig = userRoles.reduce((acc, role, index) => {
        acc[role] = { label: role.charAt(0).toUpperCase() + role.slice(1), color: `hsl(var(--chart-${(index % 5) + 1}))` };
        return acc;
    }, { count: { label: "Count" } } as ChartConfig);

    const userRolesChartData = userRoles.map((name) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: rolesDistribution[name],
        fill: `var(--color-${name})`
    }));
    
    const recentLogs = auditLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DisplayAuditLog));
    
    return {
        stats, requestsChartData, suggestionsChartData, suggestionsChartConfig,
        userRolesChartData, userRolesChartConfig, recentLogs
    };
}


export default function AdminConsolePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [stats, setStats] = React.useState<AdminDashboardStats | null>(null);
  const [requestsChartData, setRequestsChartData] = React.useState<any[]>([]);
  const [suggestionsChartData, setSuggestionsChartData] = React.useState<any[]>([]);
  const [suggestionsChartConfig, setSuggestionsChartConfig] = React.useState<ChartConfig>({});
  const [userRolesChartData, setUserRolesChartData] = React.useState<any[]>([]);
  const [userRolesChartConfig, setUserRolesChartConfig] = React.useState<ChartConfig>({});
  const [recentLogs, setRecentLogs] = React.useState<DisplayAuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await getDashboardData();
            setStats(data.stats);
            setRequestsChartData(data.requestsChartData);
            setSuggestionsChartData(data.suggestionsChartData);
            setSuggestionsChartConfig(data.suggestionsChartConfig);
            setUserRolesChartData(data.userRolesChartData);
            setUserRolesChartConfig(data.userRolesChartConfig);
            setRecentLogs(data.recentLogs);
        } catch (error) {
            console.error("Error fetching admin dashboard data:", error);
            toast({ title: "Error", description: "Could not load dashboard statistics.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [user, loading, router, toast]);

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8">
           <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
           <p className="text-muted-foreground mb-4">Could not load dashboard data.</p>
         </div>
       );
  }
  
  return (
    <div className="space-y-8">
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
                  <CardContent className="h-[300px] pb-0">
                       <ChartContainer config={suggestionsChartConfig}>
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
                  <CardContent className="h-[300px] pb-0">
                       <ChartContainer config={userRolesChartConfig}>
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

      <AnimatedCard delay={0.25}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/>Recent System Activity</CardTitle>
            <CardDescription>A log of the last 5 important actions performed in the admin console.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs.length > 0 ? (
              <div className="space-y-4">
                {recentLogs.map((log, index) => (
                  <React.Fragment key={log.id}>
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-x-2">
                            <Badge variant="secondary" className="w-fit mb-1 sm:mb-0">{log.actionType.replace(/_/g, ' ')}</Badge>
                            <span className="text-muted-foreground">by</span>
                            <Link href={`/admin/users/${log.userId}`} className="font-semibold hover:underline">{log.userEmail}</Link>
                        </div>
                        <span className="text-muted-foreground text-xs">{formatDistanceToNowStrict(log.timestamp.toDate(), { addSuffix: true })}</span>
                    </div>
                    {index < recentLogs.length - 1 && <Separator />}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No recent activity found.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" size="sm" className="ml-auto">
                <Link href="/admin/audit-logs">View Full Audit Log</Link>
            </Button>
          </CardFooter>
        </Card>
      </AnimatedCard>
      
      {adminNavConfig.sidebarNav.map((group, groupIndex) => (
          <section key={groupIndex}>
              <h2 className="text-2xl font-bold tracking-tight mb-4">{group.title}</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((item, itemIndex) => {
                      const IconComponent = item.icon;
                      const stat = item.statKey ? stats[item.statKey] : undefined;
                      const shouldHighlight = stat && item.highlightWhen?.(stat.value);
                      const animationDelay = 0.3 + (itemIndex * 0.05);

                      return (
                          <AnimatedCard key={item.href} delay={animationDelay}>
                              <Card className={cn("shadow-sm h-full flex flex-col transition-all hover:shadow-md", shouldHighlight && "ring-2 ring-destructive/50 bg-destructive/5")}>
                                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                                      <div className="flex items-center gap-3">
                                          <IconComponent className="h-6 w-6 text-primary" />
                                          <CardTitle className="text-lg">{item.title}</CardTitle>
                                      </div>
                                      {stat && (
                                          <div className="flex justify-end">
                                              <Badge variant={shouldHighlight ? "destructive" : "secondary"} className="shrink-0">
                                                  {stat.value}
                                              </Badge>
                                          </div>
                                      )}
                                  </CardHeader>
                                  <CardContent className="flex-grow">
                                      <p className="text-sm text-muted-foreground">{item.description}</p>
                                  </CardContent>
                                  <CardFooter>
                                      <Button asChild className="w-full mt-auto">
                                          <Link href={item.href}>
                                              {item.buttonText || 'Manage'}
                                              <ArrowRight className="ml-2 h-4 w-4" />
                                              {shouldHighlight && stat?.value && stat.value > 0 && (
                                                  <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs bg-white text-destructive hover:bg-white">{stat?.value}</Badge>
                                              )}
                                          </Link>
                                      </Button>
                                  </CardFooter>
                              </Card>
                          </AnimatedCard>
                      );
                  })}
              </div>
          </section>
      ))}
    </div>
  );
}
