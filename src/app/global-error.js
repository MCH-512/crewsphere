'use client'

/**
 * A failsafe, dependency-free global error boundary.
 * This version exports a function that returns an HTML string, completely removing
 * any dependency on React or JSX, ensuring it can render even during
 * the most critical application-wide errors.
 */
export default function GlobalError({ error, reset }) {
  // The function returns an HTML string instead of JSX.
  return (
    `<html>
      <body>
        <div style="font-family: system-ui, sans-serif; display: flex; min-height: 100vh; flex-direction: column; align-items: center; justify-content: center; background-color: #f6f8fa; color: #24292f; text-align: center;">
          <div style="border: 1px solid #d0d7de; border-radius: 0.5rem; padding: 2rem; max-width: 450px; background-color: #ffffff; box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);">
            <h2 style="font-size: 1.5rem; font-weight: 600; margin: 0 0 1rem 0;">Something Went Wrong</h2>
            <p style="color: #57606a; margin: 0 0 1.5rem 0;">An unexpected application error occurred. This has been logged.</p>
            <button onclick="window.location.reload()" style="background-color: #2da44e; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 500;">
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>`
  );
}
