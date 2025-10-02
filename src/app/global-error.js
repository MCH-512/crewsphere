'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body>
        <div style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          height: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f4fa',
          color: '#1e293b'
        }}>
          <div style={{ padding: '2rem', maxWidth: '450px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: 'white' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0 0 1rem 0', color: '#dc2626' }}>
              Application Error
            </h2>
            <p style={{ color: '#475569', margin: '0 0 1.5rem 0' }}>
              A critical error occurred that prevented the application from loading.
            </p>
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: '#498FBD',
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
  )
}
