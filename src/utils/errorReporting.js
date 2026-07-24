import * as Sentry from '@sentry/react';

let initialized = false;

/**
 * No-ops when VITE_SENTRY_DSN isn't set (local/dev by default) so this never
 * requires a Sentry account to build or run the app.
 */
export function initErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: __APP_VERSION__,
    tracesSampleRate: 0,
  });
  initialized = true;
}

export function reportError(error, extra) {
  if (!initialized) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
