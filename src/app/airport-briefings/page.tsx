
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AirportBriefingTool } from "@/components/features/airport-briefing-tool";
import { Navigation } from "lucide-react";
import { AnimatedCard } from "@/components/motion/animated-card";

export default function AirportBriefingsPage() {
  return (
    <div className="space-y-6">
      <AnimatedCard>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-start gap-4">
            <Navigation className="h-8 w-8 text-primary mt-1" />
            <div>
              <CardTitle className="text-2xl font-headline">Airport Briefing Generator</CardTitle>
              <CardDescription>
                Generate comprehensive briefings for airports worldwide using AI. Enter an airport identifier (e.g., KJFK, EGLL) to get started.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AirportBriefingTool />
          </CardContent>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={0.1}>
        <Card className="shadow-md">
          <CardHeader>
              <CardTitle className="text-lg font-headline">How it Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Enter an ICAO or IATA airport code. Our AI model will then generate a briefing including:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Key operational characteristics (runways, procedures).</li>
                <li>Typical weather patterns and seasonal considerations.</li>
                <li>Notable NOTAMs or advisories (if generally known).</li>
                <li>Useful information for crew (e.g., local amenities, transport).</li>
              </ul>
              <p className="font-semibold">Note: Briefings are AI-generated and should be supplemented with official documentation.</p>
          </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  );
}
