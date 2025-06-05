
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlightDutyCalculatorTool } from "@/components/features/flight-duty-calculator-tool";
import { Calculator } from "lucide-react";

export default function FlightDutyCalculatorPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <Calculator className="h-8 w-8 text-primary mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">Flight Duty Calculator</CardTitle>
            <CardDescription>
              Calculate flight duty periods and check basic compliance using AI. Enter flight segments and briefing/debriefing times.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <FlightDutyCalculatorTool />
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="text-lg font-headline">How it Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Provide details for each flight segment, including departure/arrival airports and UTC times. Specify pre-flight briefing and post-flight debriefing durations.</p>
            <p>The AI will then calculate:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Total duty period (start and end times in UTC).</li>
              <li>Total flight time (block time).</li>
              <li>A basic check against generic flight time limitations.</li>
              <li>A summary of the duty period with compliance notes.</li>
            </ul>
            <p className="font-semibold">Note: This calculator uses simplified, generic rules for demonstration. Always refer to official company and regulatory documentation for actual flight time limitations and rest requirements.</p>
        </CardContent>
      </Card>
    </div>
  );
}
