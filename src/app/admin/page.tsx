
"use server";

import * as React from "react";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ServerCog } from "lucide-react";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { adminNavConfig, type NavGroup, type NavItem } from "@/config/nav";
import { cn } from "@/lib/utils";
import { getAdminDashboardStats, getAdminDashboardWeeklyTrends } from "@/services/admin-dashboard-service";
import { getOpenPullRequests } from "@/services/github-service";
import { Badge } from "@/components/ui/badge";
import { WeeklyTrendsChart } from "@/components/admin/weekly-trends-chart";
import { Skeleton } from "@/components/ui/skeleton";

const ChartSkeleton = () => (
    <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
             <Skeleton className="h-6 w-1/2" />
             <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
            <div role="status" aria-label="Loading trends chart">
                <Skeleton className="h-[250px] w-full" />
            </div>
        </CardContent>
    </Card>
);

export default async function AdminConsolePage() {
  const stats = await getAdminDashboardStats();
  const weeklyTrendsDataPromise = getAdminDashboardWeeklyTrends();
  const pullRequests = await getOpenPullRequests();
  
  const navConfig = {
    sidebarNav: adminNavConfig.sidebarNav.map((group: NavGroup) => {
      if (group.title === "System") {
        return {
          ...group,
          items: group.items.map((item: NavItem) => {
            if (item.statKey === "openPullRequests") {
              return { ...item, href: pullRequests.url };
            }
            return item;
          }),
        };
      }
      return group;
    }),
  };

  const displayStats = stats ? { ...stats, openPullRequests: pullRequests.count } : { openPullRequests: pullRequests.count };

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
      
      <Suspense fallback={<ChartSkeleton />}>
          <WeeklyTrendsChart initialDataPromise={weeklyTrendsDataPromise} />
      </Suspense>

      {navConfig.sidebarNav.map((group: NavGroup, groupIndex: number) => (
          <section key={groupIndex}>
              <h2 className="text-2xl font-bold tracking-tight mb-4">{group.title}</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((item: NavItem, itemIndex: number) => {
                      if (item.href === '/admin') return null; // Don't show the dashboard card itself
                      
                      const IconComponent = item.icon;
                      const animationDelay = 0.1 + (itemIndex * 0.05);
                      
                      const statValue = displayStats && item.statKey ? displayStats[item.statKey] : undefined;
                      const shouldHighlight = statValue !== undefined && item.highlightWhen ? item.highlightWhen(statValue) : false;

                      return (
                          <AnimatedCard key={item.href} delay={animationDelay}>
                              <Card className={cn(
                                "shadow-sm h-full flex flex-col transition-all hover:shadow-md",
                                shouldHighlight && "border-primary ring-2 ring-primary/50"
                              )}>
                                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                                      <div className="flex items-center gap-3">
                                          <IconComponent className="h-6 w-6 text-primary" />
                                          <CardTitle className="text-lg">{item.title}</CardTitle>
                                      </div>
                                       {statValue !== undefined && (
                                            <Badge variant={shouldHighlight ? "destructive" : "secondary"} className={shouldHighlight ? 'animate-pulse' : ''}>
                                                {statValue}
                                            </Badge>
                                        )}
                                  </CardHeader>
                                  <CardContent className="flex-grow">
                                      <p className="text-sm text-muted-foreground">{item.description}</p>
                                  </CardContent>
                                  <CardFooter>
                                      <Button asChild className="w-full mt-auto">
                                          <Link href={item.href} target={item.href.startsWith('http') ? '_blank' : '_self'}>
                                              {item.buttonText || 'Manage'}
                                              <ArrowRight className="ml-2 h-4 w-4" />
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
