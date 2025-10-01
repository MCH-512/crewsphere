'use client';

import React from 'react';

// This is a failsafe component that uses only basic HTML and inline styles
// to ensure it can render even if the rest of the application's styles or components are broken.
// It avoids any dependency on the project's UI library (Card, Button, etc.).
function GlobalError({ error, reset }) {
  React.useEffect(() => {
    // Log the error to the console for debugging
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          display: 'flex',
          minHeight: '100vh',
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
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Something went wrong</h2>
            <p style={{ color: '#57606a', margin: '0 0 1.5rem 0' }}>
              An unexpected application error occurred. This has been logged.
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

export default GlobalError;
