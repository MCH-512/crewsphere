
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ServerCrash } from "lucide-react";

export default function PurserReportsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <ServerCrash className="h-8 w-8 text-destructive mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">
              Submit Flight Purser Report
            </CardTitle>
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
              The AI-assisted purser report generator is no longer available. Please use standard company procedures for flight reporting.
            </ShadAlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
