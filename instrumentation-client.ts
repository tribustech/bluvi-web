/*
 * Browser observability (m8.sentry). With NEXT_PUBLIC_SENTRY_DSN unset at build time this whole
 * branch is dead code: no chunk is loaded, Sentry.init is never called. When it is set, the SDK
 * still waits for a reporting environment and the visitor's «Monitorizarea erorilor» consent
 * (lib/observability/browser.ts), and arrives as its own chunk, after hydration.
 *
 * The gate is decided here, synchronously, before the first render (lib/observability/gate.ts): a
 * crash during the first render is queued until the SDK attaches instead of being dropped.
 */

import { browserSentryTarget } from './lib/observability/env';
import { browserGateOpen } from './lib/observability/gate';
import { attachSdk, markSdkLoading } from './lib/observability/report';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    if (browserGateOpen(browserSentryTarget(), document.cookie)) markSdkLoading();
  } catch {
    // No cookie access: ./browser.ts decides on its own.
  }
  import('./lib/observability/browser')
    .then((m) => m.startBrowserSentry())
    .catch(() => attachSdk(null));
}

export {};
