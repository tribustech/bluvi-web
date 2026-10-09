/*
 * When Sentry reports (m8.sentry, global.b.observability). fish app/_layout.tsx:35-51 reports only
 * from the production and staging builds; the web's matches are Vercel's `production` and `preview`
 * deployments, plus an explicit `staging`. Everything else (local `next dev` / `next start`, e2e,
 * unit tests, an unknown environment) never calls Sentry.init: no network, no events.
 *
 * Inputs, all from the environment, none in code:
 *  - server / edge: SENTRY_DSN + SENTRY_ENVIRONMENT (fallback VERCEL_ENV);
 *  - browser:       NEXT_PUBLIC_SENTRY_DSN + NEXT_PUBLIC_SENTRY_ENVIRONMENT (next.config.ts computes it
 *                   at build time from SENTRY_ENVIRONMENT / VERCEL_ENV), and the visitor's consent.
 */

const REPORTING_ENVIRONMENTS = new Set(['production', 'preview', 'staging']);

export type SentryTarget = { dsn: string; environment: string };

/** The DSN + environment to report to, or null when Sentry stays off. Pure. */
export function sentryTarget(dsn: string | undefined, environment: string | undefined): SentryTarget | null {
  const d = dsn?.trim();
  const env = environment?.trim().toLowerCase();
  if (!d || !env || !REPORTING_ENVIRONMENTS.has(env)) return null;
  return { dsn: d, environment: env };
}

/** Server / edge runtime (read at runtime, never inlined into the browser bundle). */
export function serverSentryTarget(env: Record<string, string | undefined> = process.env): SentryTarget | null {
  return sentryTarget(env.SENTRY_DSN, env.SENTRY_ENVIRONMENT || env.VERCEL_ENV);
}

/** The browser build's target. Static `process.env.NEXT_PUBLIC_*` reads so Next inlines them. */
export function browserSentryTarget(): SentryTarget | null {
  return sentryTarget(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT);
}

/** fish tracesSampleRate was 0.8; the web server samples 5 % of transactions; the browser none (errors only, ./options.ts). */
export const TRACES_SAMPLE_RATE = 0.05;
