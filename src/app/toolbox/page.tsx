
import "server-only";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wrench } from "lucide-react";
import Link from "next/link";
import { AnimatedCard } from "@/components/motion/animated-card";
import { getToolboxTools, type Tool } from "@/services/toolbox-service";


export default async function ToolboxPage() {
  const tools: Tool[] = await getToolboxTools();

  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <Wrench className="mr-3 h-7 w-7 text-primary" />
              Toolbox
            </CardTitle>
            <CardDescription>
              A collection of useful tools, converters, and reference guides for your daily operations.
            </CardDescription>
          </CardHeader>
        </Card>
      </AnimatedCard>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const IconComponent = tool.icon;
          return (
            <AnimatedCard key={tool.title} delay={tool.delay}>
              <Card className="shadow-sm h-full flex flex-col transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-4 pb-4">
                  <IconComponent className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">{tool.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {tool.description}
                  </p>
                </CardContent>
                <CardFooter>
                    <Button asChild className="w-full mt-auto">
                        <Link href={tool.href}>
                        Open Tool <ArrowRight className="ml-2 h-4 w-4" />
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
