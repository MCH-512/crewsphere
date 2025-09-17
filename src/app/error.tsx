
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error])

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="mt-4 text-2xl">Something went wrong!</CardTitle>
          <CardDescription>
            An unexpected error occurred. Our team has been notified. You can try to recover from this error by clicking the button below.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <pre className="mt-2 mb-4 whitespace-pre-wrap rounded-md bg-muted p-4 text-left font-mono text-xs text-muted-foreground">
             {error.message || "An unknown error has occurred."}
           </pre>
          <Button onClick={() => reset()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
