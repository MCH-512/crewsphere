
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ServerCrash } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";
import { Alert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";

export default function AirportBriefingsPage() {
  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-start gap-4">
            <ServerCrash className="h-8 w-8 text-destructive mt-1" />
            <div>
              <CardTitle className="text-2xl font-headline">Airport Briefing Generator</CardTitle>
              <CardDescription>
                This feature has been deprecated.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
             <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <ShadAlertTitle>Feature Unavailable</ShadAlertTitle>
              <ShadAlertDescription>
                The AI-powered airport briefing generator is no longer available. Please refer to official sources for all operational information.
              </ShadAlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  );
}
