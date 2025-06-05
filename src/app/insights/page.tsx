import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiOperationalInsights } from "@/components/features/ai-operational-insights";
import { Brain } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <Brain className="h-8 w-8 text-primary mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">AI-Driven Operational Insights</CardTitle>
            <CardDescription>
              Leverage AI to analyze safety reports and incident logs. Gain valuable insights to enhance operational safety and efficiency.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <AiOperationalInsights />
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="text-lg font-headline">How it Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Our AI model processes anonymized operational data, including safety reports and incident logs, to identify patterns, potential risks, and areas for improvement.</p>
            <p>The generated summary provides actionable recommendations to help maintain the highest safety standards and optimize operational procedures.</p>
            <p className="font-semibold">Note: The data used for analysis is illustrative. In a real-world scenario, this tool would integrate with live operational databases.</p>
        </CardContent>
      </Card>
    </div>
  );
}
