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
          backgroundColor: '#f6f8fa',
          color: '#24292f'
        }}>
          <div style={{ padding: '2rem', maxWidth: '450px', textAlign: 'center', border: '1px solid #e1e4e8', borderRadius: '6px', backgroundColor: '#fff' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0 0 1rem 0' }}>
              Application Error
            </h2>
            <p style={{ color: '#57606a', margin: '0 0 1.5rem 0' }}>
              A critical error occurred that prevented the application from loading.
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
  )
}
