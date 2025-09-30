'use client'

import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg text-center">
            <div className="flex flex-col space-y-1.5 p-6">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
              <h2 className="mt-4 text-2xl font-semibold leading-none tracking-tight">Something Went Wrong</h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. This has been logged.
              </p>
            </div>
            <div className="p-6 pt-0">
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
