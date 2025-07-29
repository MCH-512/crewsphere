
"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, SendHorizonal, Lightbulb, Wrench } from "lucide-react";
import Link from "next/link";
import { useAuth, type User } from "@/contexts/auth-context";
import { AnimatedCard } from "@/components/motion/animated-card";
import { ActiveAlerts } from "@/components/features/active-alerts";
import { Suspense } from "react";

export default function DashboardClientPage({ children }: { children: React.ReactNode }) {
  const { user } = useAuth() as { user: User };
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
        <Card className="shadow-lg border-none relative overflow-hidden min-h-[220px] flex flex-col justify-between p-6">
            <Image
                src="https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=1974&auto=format&fit=crop"
                alt="Airplane on the tarmac at sunset"
                data-ai-hint="airplane tarmac"
                fill
                priority
                className="object-cover z-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
            <div className="relative z-20 text-white w-full flex justify-between items-end">
                 <div>
                    <CardTitle as="h1" className="text-4xl font-headline text-primary-foreground">Welcome Back, {userNameForGreeting}!</CardTitle>
                    <CardDescription className="text-primary-foreground/80 text-lg mt-1">This is your central command for operational tools and communication.</CardDescription>
                </div>
            </div>
        </Card>
      </AnimatedCard>

      <Suspense>
        <ActiveAlerts />
      </Suspense>
      
       <AnimatedCard delay={0.1} className="lg:col-span-1">
          {scheduleWidget}
       </AnimatedCard>
       
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatedCard delay={0.15}>
          {trainingWidget}
        </AnimatedCard>
        <AnimatedCard delay={0.2}>
          {requestsWidget}
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
           {trainingChart}
        </AnimatedCard>
         <AnimatedCard delay={0.35}>
           {requestsChart}
        </AnimatedCard>
      </div>
    </div>
  );
}
