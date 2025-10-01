'use client';

import React, { useEffect } from 'react';

/**
 * A failsafe, dependency-free global error boundary.
 * It uses plain JSX and basic Tailwind classes to avoid any conflicts
 * with the UI library or CSS that might occur during a critical application-wide error.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log the error to the console for debugging.
    // In a real app, this would also report to a service like Sentry.
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
          <div className="w-full max-w-md text-center shadow-lg border rounded-lg bg-card p-6">
            <div className="mx-auto h-12 w-12 text-destructive">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <path d="M12 9v4"/>
                    <path d="M12 17h.01"/>
                </svg>
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Something Went Wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected application error occurred. This has been logged.
            </p>
            <div className="mt-6">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
