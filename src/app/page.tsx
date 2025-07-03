
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, SendHorizonal, Lightbulb, Wrench } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AnimatedCard } from "@/components/motion/animated-card";

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
        <Card className="shadow-lg bg-card border-none">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Welcome Back, {userNameForGreeting}!</CardTitle>
            <CardDescription>This is your central command for operational tools and communication.</CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AnimatedCard delay={0.15} className="lg:col-span-3">
          <Card className="h-full shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                  <CardTitle className="font-headline text-lg">Quick Actions</CardTitle>
                  <CardDescription>Get started with common tasks.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
