"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, Construction } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AviationHistoryPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <ScrollText className="mr-3 h-7 w-7 text-primary" />
            Aviation History
          </CardTitle>
          <CardDescription>
            Key moments and figures in the history of aviation.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Alert>
                <Construction className="h-4 w-4" />
                <AlertTitle>Under Construction</AlertTitle>
                <AlertDescription>
                    This section is currently being developed and will be available soon.
                </AlertDescription>
            </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
