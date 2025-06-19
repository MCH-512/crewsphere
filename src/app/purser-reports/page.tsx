
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PurserReportTool } from "@/components/features/purser-report-tool";
import { FileSignature } from "lucide-react";

export default function PurserReportsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <FileSignature className="h-8 w-8 text-primary mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">
              Submit Flight Purser Report
            </CardTitle>
            <CardDescription>
              Fill in the flight details, observations, and crew evaluations. The AI will help generate a structured report.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <PurserReportTool />
        </CardContent>
      </Card>
    </div>
  );
}
