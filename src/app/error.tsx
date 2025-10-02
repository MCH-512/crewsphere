
'use client';

import * as React from 'react';

// This is a robust, self-contained error boundary.
// It uses inline styles and no external components to ensure it can render even if the rest of the app's styles or components fail.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to the console for debugging
    console.error(error);
  }, [error]);

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      minHeight: 'calc(100vh - 8rem)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        border: '1px solid #d0d7de',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '512px',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginTop: '1rem', color: '#cf222e' }}>
          Something went wrong!
        </h2>
        <p style={{ marginTop: '0.5rem', color: '#57606a' }}>
          An error occurred in this part of the application.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            backgroundColor: '#0969da',
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
  );
}
