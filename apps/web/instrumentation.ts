// Next.js instrumentation — runs when the Node.js runtime is loaded.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Edge (middleware, edge routes): Sentry must be initialized via instrumentation.
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      debug: false,
    });
  }
}
