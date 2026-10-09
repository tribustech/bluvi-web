/*
 * The browser gate decided synchronously (m8.sentry), from instrumentation-client.ts before any
 * dynamic import: a crash during the first render (app/global-error.tsx, app/(site)/error.tsx) runs
 * its captureException before the SDK chunk — and even before ./browser.ts — has loaded. Deciding
 * here puts ./report.ts in 'loading' at once, so that capture is queued and delivered on attach,
 * instead of being dropped while the state was still 'off' (the «white screen that reported
 * nothing» fish's root Sentry.ErrorBoundary exists for, fish app/_layout.tsx:72-81).
 *
 * Pure, and imports only the pure consent model (no store, no React).
 */

import { CONSENT_COOKIE, cookieValue, parseConsent } from '@/lib/consent/model';
import type { SentryTarget } from './env';

/** True when the browser SDK will be started: a reporting target and the «errors» consent. */
export function browserGateOpen(target: SentryTarget | null, cookieHeader: string): boolean {
  if (!target) return false;
  return parseConsent(cookieValue(cookieHeader, CONSENT_COOKIE))?.errors === true;
}
