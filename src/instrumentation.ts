
import * as Sentry from "@sentry/nextjs";

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    if (process.env.SENTRY_DSN && !process.env.SENTRY_DSN.includes('REPLACE_WITH_YOUR_SENTRY_DSN')) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            tracesSampleRate: 1.0,
            profilesSampleRate: 1.0,
        });
        console.log("Sentry initialized.");
    } else {
        console.log("Sentry DSN not found or is a placeholder. Skipping Sentry initialization.");
    }
  }
}
