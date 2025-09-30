
"use client";

import { useEffect } from "react";
import * as Sentry from '@sentry/nextjs';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md text-center shadow-lg">
            <CardHeader>
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
              <CardTitle className="mt-4 text-2xl font-headline">Something Went Wrong</CardTitle>
              <CardDescription className="text-muted-foreground">
                An unexpected error occurred. This has been logged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="default" onClick={() => reset()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
