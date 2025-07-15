
"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, SendHorizonal, Lightbulb, Wrench, GraduationCap, Inbox, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AnimatedCard } from "@/components/motion/animated-card";
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { ActiveAlerts } from "@/components/features/active-alerts";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { StoredCourse } from "@/schemas/course-schema";
import type { StoredUserQuizAttempt } from "@/schemas/user-progress-schema";

const trainingChartConfig = {
  count: { label: "Courses" },
  completed: { label: "Completed", color: "hsl(var(--chart-2))" },
  pending: { label: "Pending", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig

const requestsChartConfig = {
  count: { label: "Count", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

export default function DashboardPage() {
  const { user } = useAuth();
  const [userNameForGreeting, setUserNameForGreeting] = React.useState<string>("User");
  
  const [trainingChartData, setTrainingChartData] = React.useState<any[]>([]);
  const [requestsChartData, setRequestsChartData] = React.useState<any[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      const name = user.displayName || (user.email ? user.email.split('@')[0] : "Crew Member");
      setUserNameForGreeting(name.charAt(0).toUpperCase() + name.slice(1));
      
      const fetchChartData = async () => {
        setIsLoadingCharts(true);
        try {
            // Training Data
            const mandatoryCoursesQuery = query(collection(db, "courses"), where("mandatory", "==", true), where("published", "==", true));
            const attemptsQuery = query(collection(db, "userQuizAttempts"), where("userId", "==", user.uid), where("status", "==", "passed"));
            const [coursesSnap, attemptsSnap] = await Promise.all([getDocs(mandatoryCoursesQuery), getDocs(attemptsQuery)]);
            const mandatoryCoursesCount = coursesSnap.size;
            const passedCourseIds = new Set(attemptsSnap.docs.map(doc => (doc.data() as StoredUserQuizAttempt).courseId));
            const completedCount = coursesSnap.docs.filter(doc => passedCourseIds.has(doc.id)).length;
            
            setTrainingChartData([
                { name: 'Completed', count: completedCount, fill: 'var(--color-completed)' },
                { name: 'Pending', count: mandatoryCoursesCount - completedCount, fill: 'var(--color-pending)' },
            ]);

            // Requests Data
            const requestsQuery = query(collection(db, "requests"), where("userId", "==", user.uid));
            const requestsSnap = await getDocs(requestsQuery);
            const requestsByStatus = requestsSnap.docs.reduce((acc, doc) => {
                const status = doc.data().status || 'unknown';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            setRequestsChartData(Object.entries(requestsByStatus).map(([status, count]) => ({
                status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
                count,
                fill: "var(--color-count)",
            })));

        } catch (error) {
            console.error("Error fetching dashboard chart data:", error);
        } finally {
            setIsLoadingCharts(false);
        }
      };

      fetchChartData();
    }
  }, [user]);
  
  const quickActions = [
    { href: "/requests", label: "Make a Request", icon: SendHorizonal },
    { href: "/suggestion-box", label: "Submit an Idea", icon: Lightbulb },
    { href: "/toolbox", label: "Open Toolbox", icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg border-none relative overflow-hidden min-h-[220px] flex items-center">
            <Image
                src="https://images.unsplash.com/photo-1570710891163-6d3b5b47248b?q=80&w=2070&auto=format&fit=crop"
                alt="Airplane wing in the sky"
                data-ai-hint="airplane wing"
                fill
                priority
                className="object-cover z-0"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10" />
            <CardHeader className="relative z-20 text-white">
                <CardTitle as="h1" className="text-4xl font-headline text-primary-foreground">Welcome Back, {userNameForGreeting}!</CardTitle>
                <CardDescription className="text-primary-foreground/80 text-lg">This is your central command for operational tools and communication.</CardDescription>
            </CardHeader>
        </Card>
      </AnimatedCard>

      <ActiveAlerts />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatedCard delay={0.1} className="lg:col-span-1">
          <TodaysScheduleCard />
        </AnimatedCard>
        <AnimatedCard delay={0.15} className="lg:col-span-1">
           <MyTrainingStatusCard />
        </AnimatedCard>
        <AnimatedCard delay={0.2} className="lg:col-span-1">
            <MyRequestsStatusCard />
        </AnimatedCard>
        <AnimatedCard delay={0.25} className="lg:col-span-1">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader>
                  <CardTitle as="h2" className="font-headline text-xl">Quick Actions</CardTitle>
                  <CardDescription>Get started with common tasks.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 flex-grow">
                  {quickActions.map((action, index) => (
                    <Button key={index} variant="outline" className="w-full justify-start py-6 text-base" asChild>
                      <Link href={action.href}>
                        <action.icon className="mr-3 h-5 w-5"/>
                        {action.label}
                        <ArrowRight className="ml-auto h-5 w-5" />
                      </Link>
                    </Button>
                  ))}
              </CardContent>
          </Card>
        </AnimatedCard>
      </div>

       {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <AnimatedCard delay={0.3}>
              <Card className="shadow-sm">
                  <CardHeader>
                      <CardTitle as="h2" className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>Mandatory Training Progress</CardTitle>
                      <CardDescription>An overview of your required e-learning courses.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {isLoadingCharts ? (
                           <div className="flex items-center justify-center h-[250px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
                      ) : (
                      <ChartContainer config={trainingChartConfig} className="min-h-[250px] w-full">
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent nameKey="count" />} />
                            <Pie data={trainingChartData} dataKey="count" nameKey="name" innerRadius={60} strokeWidth={5}>
                                <Cell key="cell-0" fill="var(--color-completed)" />
                                <Cell key="cell-1" fill="var(--color-pending)" />
                            </Pie>
                            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                          </PieChart>
                      </ChartContainer>
                      )}
                  </CardContent>
              </Card>
          </AnimatedCard>
          <AnimatedCard delay={0.35}>
              <Card className="shadow-sm">
                  <CardHeader>
                      <CardTitle as="h2" className="flex items-center gap-2"><Inbox className="h-5 w-5 text-primary"/>My Requests Status</CardTitle>
                      <CardDescription>A summary of your recent submissions.</CardDescription>
                  </CardHeader>
                  <CardContent>
                       {isLoadingCharts ? (
                           <div className="flex items-center justify-center h-[250px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
                      ) : (
                      <ChartContainer config={requestsChartConfig} className="min-h-[250px] w-full">
                          <BarChart accessibilityLayer data={requestsChartData}>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="status" tickLine={false} tickMargin={10} axisLine={false} fontSize={12} />
                              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                              <Bar dataKey="count" radius={8} />
                          </BarChart>
                      </ChartContainer>
                      )}
                  </CardContent>
              </Card>
          </AnimatedCard>
      </div>
    </div>
  );
}
