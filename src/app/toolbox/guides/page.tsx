"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Book, Construction } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function GuidesPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Book className="mr-3 h-7 w-7 text-primary" />
            Professional Guides
          </CardTitle>
          <CardDescription>
            Guides on etiquette, savoir-vivre, and best practices.
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
