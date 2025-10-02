'use client';

// This is a failsafe, dependency-free error boundary for page-level errors.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      display: 'flex',
      minHeight: 'calc(100vh - 8rem)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        border: '1px solid #d0d7de',
        borderRadius: '0.5rem',
        padding: '2rem',
        width: '100%',
        maxWidth: '512px',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0 0 1rem 0', color: '#cf222e' }}>
          Something went wrong!
        </h2>
        <p style={{ marginTop: '0.5rem', color: '#57606a' }}>
          An error occurred while rendering this page.
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
