import { TRACES_SAMPLE_RATE, type SentryTarget } from './env';
import { scrubBreadcrumb, scrubEvent } from './scrub';

/*
 * The Sentry.init options for each runtime. No Session Replay (the browser SDK only adds it when
 * asked), no default PII (no IP, no cookies, no headers' values), the scrubber on every event,
 * transaction and breadcrumb. `release` is left to the SDK: Vercel's commit SHA on the server, the
 * value withSentryConfig injects in the browser when source maps are uploaded (next.config.ts), so
 * both match the uploaded maps.
 *
 * The browser sends errors ONLY — what the «Monitorizarea erorilor» disclosure promises
 * (lib/consent/catalog.ts: «Trimite un raport doar când apare o eroare»): no release-health session
 * per page load (BrowserSession) and no page-load / navigation transactions (BrowserTracing, which
 * would start late anyway, after the consent gate and the SDK chunk). The server keeps 5 % tracing.
 */

/** Default integrations the browser must not run (they send without an error). */
export const BROWSER_DROPPED_INTEGRATIONS = ['BrowserSession', 'BrowserTracing'] as const;

type Named = { name: string };

function baseOptions(target: SentryTarget) {
  return {
    dsn: target.dsn,
    environment: target.environment,
    sendDefaultPii: false,
    initialScope: { tags: { app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown' } },
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}

/** Node + edge (instrumentation.ts). */
export function serverSentryOptions(target: SentryTarget) {
  return { ...baseOptions(target), tracesSampleRate: TRACES_SAMPLE_RATE };
}

/** The browser (./browser.ts): errors only, no tracing, no sessions. */
export function browserSentryOptions(target: SentryTarget) {
  return {
    ...baseOptions(target),
    tracesSampleRate: 0,
    integrations: <T extends Named>(defaults: T[]): T[] =>
      defaults.filter((i) => !(BROWSER_DROPPED_INTEGRATIONS as readonly string[]).includes(i.name)),
  };
}
