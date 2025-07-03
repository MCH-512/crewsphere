
"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, SendHorizonal, Lightbulb, Wrench } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AnimatedCard } from "@/components/motion/animated-card";
import { TodaysScheduleCard } from "@/components/features/todays-schedule";
import { ActiveAlerts } from "@/components/features/active-alerts";
import { MyTrainingStatusCard } from "@/components/features/my-training-status";
import { MyRequestsStatusCard } from "@/components/features/my-requests-status";

export default function DashboardPage() {
  const { user } = useAuth();
  const [userNameForGreeting, setUserNameForGreeting] = React.useState<string>("User");

  React.useEffect(() => {
    if (user) {
      const name = user.displayName || (user.email ? user.email.split('@')[0] : "Crew Member");
      setUserNameForGreeting(name.charAt(0).toUpperCase() + name.slice(1));
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
                src="https://placehold.co/1200x400.png"
                alt="Airplane wing in the sky"
                data-ai-hint="airplane wing"
                fill
                priority
                className="object-cover z-0"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10" />
            <CardHeader className="relative z-20 text-white">
                <CardTitle className="text-4xl font-headline text-primary-foreground">Welcome Back, {userNameForGreeting}!</CardTitle>
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
                  <CardTitle className="font-headline text-xl">Quick Actions</CardTitle>
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
    </div>
  );
}
