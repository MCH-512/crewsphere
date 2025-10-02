'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      minHeight: 'calc(100vh - 8rem)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)'
    }}>
      <div style={{
        border: '1px solid hsl(var(--border))',
        borderRadius: '0.5rem',
        padding: '2rem',
        width: '100%',
        maxWidth: '512px',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        backgroundColor: 'var(--card)'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginTop: '1rem', color: 'hsl(var(--destructive))' }}>
          Something went wrong!
        </h2>
        <p style={{ marginTop: '0.5rem', color: 'hsl(var(--muted-foreground))' }}>
          An error occurred in this part of the application.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
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
  )
}
