
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      <AnimatedCard>
        <Card className="shadow-lg text-center py-10">
            <CardHeader>
                <Brain className="mx-auto h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl font-headline">Feature Deactivated</CardTitle>
                <CardDescription className="max-w-md mx-auto">
                    The AI Insights feature ("Kai") has been deactivated to improve application performance and reliability. Thank you for your understanding.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/">Return to Dashboard</Link>
                </Button>
            </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  );
}
