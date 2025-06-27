"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessagesSquare, Construction } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AeronauticalJargonPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <MessagesSquare className="mr-3 h-7 w-7 text-primary" />
            Aeronautical Jargon
          </CardTitle>
          <CardDescription>
            A glossary of common terms and acronyms.
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
