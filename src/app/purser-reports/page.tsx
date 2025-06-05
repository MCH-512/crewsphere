
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
            <CardTitle className="text-2xl font-headline">Purser Report Generator</CardTitle>
            <CardDescription>
              Generate comprehensive Purser Reports using AI. Fill in the details below to create a new report.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <PurserReportTool />
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="text-lg font-headline">About Purser Reports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>The Purser Report is a critical document for post-flight analysis and record-keeping. It includes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Detailed flight information and passenger load.</li>
              <li>Summaries of the flight's conduct.</li>
              <li>Reports on any safety, security, or medical incidents.</li>
              <li>Passenger feedback, catering notes, and maintenance issues observed.</li>
              <li>Other relevant observations for operational review.</li>
            </ul>
            <p className="font-semibold">The AI will help structure this information into a formal report and identify key highlights.</p>
        </CardContent>
      </Card>
    </div>
  );
}

