
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
            <CardTitle className="text-2xl font-headline">Advanced Flight Duty Calculator</CardTitle>
            <CardDescription>
              Calculate flight duty periods and check basic compliance using AI. Input crew details, flight segments, and duty parameters for a more detailed analysis.
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
            <p>Provide details for crew (type, number, acclimatization), pre/post-flight duty times, and each flight segment (departure/arrival airports & UTC times).</p>
            <p>The AI will then calculate and analyze:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Total duty period (start and end times in UTC).</li>
              <li>Total flight time (block time).</li>
              <li>An estimated maximum allowable duty time based on your inputs and generic FTL rules.</li>
              <li>Whether the calculated duty time exceeds this estimated maximum.</li>
              <li>Compliance notes regarding flight time, duty time (including potential extensions), and minimum rest requirements.</li>
              <li>An overall summary of the duty period with integrated compliance notes.</li>
            </ul>
            <p className="font-semibold">Disclaimer: This calculator uses simplified, generic FTL rules for illustrative and educational purposes only. Always consult official company and regulatory documentation for operational flight planning and actual FTL compliance.</p>
        </CardContent>
      </Card>
    </div>
  );
}
