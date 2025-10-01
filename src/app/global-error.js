'use client';

import React, { useEffect } from 'react';

/**
 * A failsafe, dependency-free global error boundary.
 * It uses pure React.createElement calls to avoid any JSX transform issues.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log the error to the console for debugging
    console.error(error);
  }, [error]);

  // Using React.createElement directly to bypass any potential JSX compilation issues.
  return React.createElement(
    'html',
    null,
    React.createElement(
      'body',
      null,
      React.createElement(
        'div',
        {
          style: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            display: 'flex',
            minHeight: '100vh',
            textAlign: 'center',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f6f8fa',
            color: '#24292f'
          }
        },
        React.createElement(
          'div',
          {
            style: {
              border: '1px solid #d0d7de',
              borderRadius: '0.5rem',
              padding: '2rem',
              maxWidth: '450px',
              backgroundColor: '#ffffff',
              boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)'
            }
          },
          React.createElement('h2', { style: { fontSize: '1.5rem', fontWeight: '600', margin: '0 0 1rem 0' } }, 'Something Went Wrong'),
          React.createElement(
            'p',
            { style: { color: '#57606a', margin: '0 0 1.5rem 0' } },
            'An unexpected error occurred. This has been logged.'
          ),
          React.createElement(
            'button',
            {
              onClick: () => reset(),
              style: {
                backgroundColor: '#2da44e',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }
            },
            'Try Again'
          )
        )
      )
    )
  );
}
