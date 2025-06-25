
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, AlertTriangle, ServerCrash } from "lucide-react";
import { Alert, AlertDescription as ShadAlertDescription, AlertTitle as ShadAlertTitle } from "@/components/ui/alert";

export default function FlightDutyCalculatorPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <ServerCrash className="h-8 w-8 text-destructive mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">Advanced Flight Duty Calculator</CardTitle>
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
                The AI-powered flight duty calculator is no longer available. Please use official company tools for all FTL calculations.
              </ShadAlertDescription>
            </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
