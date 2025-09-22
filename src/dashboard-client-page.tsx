
"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, SendHorizonal, Lightbulb, Wrench } from "lucide-react";
import Link from "next/link";
import { useAuth, type User } from "@/contexts/auth-context";
import { AnimatedCard } from "@/components/motion/animated-card";
import { ActiveAlerts } from "@/components/features/active-alerts";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const WidgetSkeleton = () => (
    <Card className="h-full shadow-md">
      <CardHeader>
        <Skeleton className="h-5 w-2/4 mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
      </CardContent>
       <CardFooter>
         <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
);

const ChartSkeleton = () => (
    <Card className="h-full shadow-sm">
        <CardHeader>
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-center h-[250px]">
                <Skeleton className="h-48 w-48 rounded-full" />
            </div>
        </CardContent>
    </Card>
);

interface DashboardClientPageProps {
  children: React.ReactNode;
  heroImage: { src: string; hint: string };
}

export default function DashboardClientPage({ children, heroImage }: DashboardClientPageProps) {
  const { user } = useAuth();
  const [userNameForGreeting, setUserNameForGreeting] = React.useState<string>("User");

  React.useEffect(() => {
    if (user) {
      const name = user.fullName || user.displayName || (user.email ? user.email.split('@')[0] : "Crew Member");
      setUserNameForGreeting(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, [user]);
  
  const quickActions = [
    { href: "/requests", label: "Make a Request", icon: SendHorizonal },
    { href: "/suggestion-box", label: "Submit an Idea", icon: Lightbulb },
    { href: "/toolbox", label: "Open Toolbox", icon: Wrench },
  ];

  const [scheduleWidget, trainingWidget, requestsWidget, trainingChart, requestsChart] = React.Children.toArray(children);

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg border-none relative overflow-hidden min-h-[220px] flex flex-col justify-between">
            <div className="absolute inset-0 h-full w-full">
                <Image
                    src={heroImage.src}
                    alt="Dashboard hero image"
                    data-ai-hint={heroImage.hint}
                    fill
                    priority
                    className="object-cover z-0"
                />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10" />
            <div className="relative z-20 text-white w-full flex justify-between items-end p-6">
                 <div>
                    <CardTitle as="h1" className="text-4xl font-headline text-primary-foreground">Welcome Back, {userNameForGreeting}!</CardTitle>
                    <CardDescription className="text-primary-foreground/80 text-lg mt-1 max-w-4xl">Your unified dashboard for real-time schedule updates, essential alerts, and direct access to training modules and operational resources. Stay informed, compliant, and connected with everything you need for your duty period.</CardDescription>
                </div>
            </div>
        </Card>
      </AnimatedCard>

      <Suspense>
        <ActiveAlerts />
      </Suspense>
      
       <AnimatedCard delay={0.1} className="lg:col-span-1">
          <Suspense fallback={<WidgetSkeleton />}>
            {scheduleWidget}
          </Suspense>
       </AnimatedCard>
       
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatedCard delay={0.15}>
          <Suspense fallback={<WidgetSkeleton />}>
            {trainingWidget}
          </Suspense>
        </AnimatedCard>
        <AnimatedCard delay={0.2}>
          <Suspense fallback={<WidgetSkeleton />}>
            {requestsWidget}
          </Suspense>
        </AnimatedCard>
      </div>
      
       <AnimatedCard delay={0.25}>
           <Card className="h-full shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader>
                  <CardTitle as="h2" className="font-headline text-xl">Resources & Actions</CardTitle>
                  <CardDescription>Quick access to common tools and communication channels.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
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


      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
         <AnimatedCard delay={0.3}>
           <Suspense fallback={<ChartSkeleton />}>
            {trainingChart}
          </Suspense>
        </AnimatedCard>
         <AnimatedCard delay={0.35}>
           <Suspense fallback={<ChartSkeleton />}>
            {requestsChart}
          </Suspense>
        </AnimatedCard>
      </div>
    </div>
  );
}
