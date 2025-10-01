'use client';

import React from 'react';

/**
 * A failsafe, dependency-free global error boundary.
 * This version is stripped down to the absolute basics to ensure it renders
 * under all circumstances, avoiding subtle runtime errors.
 */
export default function GlobalError({ error, reset }) {
  // The error is logged on the server and client console by Next.js by default.
  // A useEffect is removed here as a final measure to prevent any hook-related runtime errors.
  
  return (
    <html>
      <body>
        <div style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          display: 'flex',
          height: '100vh',
          textAlign: 'center',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f6f8fa',
          color: '#24292f'
        }}>
          <div style={{
            border: '1px solid #d0d7de',
            borderRadius: '0.5rem',
            padding: '2rem',
            maxWidth: '450px',
            backgroundColor: '#ffffff',
            boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Something Went Wrong</h2>
            <p style={{ color: '#57606a', margin: '0 0 1.5rem 0' }}>
              An unexpected application error occurred.
            </p>
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: '#2da44e',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
