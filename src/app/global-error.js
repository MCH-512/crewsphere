'use client';

/**
 * A failsafe, dependency-free global error boundary.
 * It uses plain JSX and inline styles to avoid any conflicts with the UI library or CSS setup
 * that might occur during a critical application-wide error.
 */
export default function GlobalError({ error, reset }) {
  // We log the error on the server, and this UI is just for the user.
  // No useEffect or other hooks are used to maximize stability.
  return (
    <html>
      <body>
        <div style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f6f8fa',
          color: '#24292f',
          textAlign: 'center',
          padding: '1rem',
        }}>
          <div style={{
            padding: '2rem',
            maxWidth: '450px',
            backgroundColor: '#ffffff',
            border: '1px solid #d0d7de',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0 0 1rem' }}>
              Something Went Wrong
            </h2>
            <p style={{ color: '#57606a', margin: '0 0 1.5rem' }}>
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
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
