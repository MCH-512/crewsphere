'use client';

import React, { useEffect } from 'react';

// Use a named export and then export as default for maximum compatibility.
export const GlobalError = ({ error, reset }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg text-center">
            <div className="flex flex-col space-y-1.5 p-6 items-center">
              {/* Using inline SVG for lucide-react replacement to remove dependencies */}
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <h3 className="mt-4 text-2xl font-semibold leading-none tracking-tight">Something Went Wrong</h3>
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
};

export default GlobalError;
