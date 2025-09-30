'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="mt-4 text-2xl">Something went wrong!</CardTitle>
          <CardDescription>
            An unexpected error occurred. This has been logged. You can try to recover by clicking the button below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => reset()}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
