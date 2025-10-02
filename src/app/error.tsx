'use client';

import * as React from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        display: 'flex',
        minHeight: 'calc(100vh - 8rem)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'var(--background, #fff)',
        color: 'var(--foreground, #000)'
    }}>
      <div style={{
        border: '1px solid hsl(var(--border, #e5e7eb))',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '512px',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginTop: '1rem', color: 'hsl(var(--destructive, #ef4444))' }}>
          Something went wrong!
        </h2>
        <p style={{ marginTop: '0.5rem', color: 'hsl(var(--muted-foreground, #6b7280))' }}>
          An unexpected error occurred within this part of the application.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            backgroundColor: 'hsl(var(--primary, #3b82f6))',
            color: 'hsl(var(--primary-foreground, #fff))',
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
