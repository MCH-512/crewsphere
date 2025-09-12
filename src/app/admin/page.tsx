"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, AlertTriangle, ServerCog } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AnimatedCard } from "@/components/motion/animated-card";
import { adminNavConfig } from "@/config/nav";
import { cn } from "@/lib/utils";


export default function AdminConsolePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
        router.push('/login');
        return;
    }
    if (user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
      
      {adminNavConfig.sidebarNav.map((group, groupIndex) => (
          <section key={groupIndex}>
              <h2 className="text-2xl font-bold tracking-tight mb-4">{group.title}</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((item, itemIndex) => {
                      const IconComponent = item.icon;
                      const animationDelay = 0.1 + (itemIndex * 0.05);

                      return (
                          <AnimatedCard key={item.href} delay={animationDelay}>
                              <Card className={cn("shadow-sm h-full flex flex-col transition-all hover:shadow-md")}>
                                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                                      <div className="flex items-center gap-3">
                                          <IconComponent className="h-6 w-6 text-primary" />
                                          <CardTitle className="text-lg">{item.title}</CardTitle>
                                      </div>
                                  </CardHeader>
                                  <CardContent className="flex-grow">
                                      <p className="text-sm text-muted-foreground">{item.description}</p>
                                  </CardContent>
                                  <CardFooter>
                                      <Button asChild className="w-full mt-auto">
                                          <Link href={item.href}>
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
