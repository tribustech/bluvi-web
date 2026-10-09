import type { Instrumentation } from 'next';

/*
 * Server / edge observability (m8.sentry): Sentry only when SENTRY_DSN is set on a reporting
 * environment (lib/observability/env.ts). Otherwise nothing is imported and nothing is sent.
 */

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const { registerServerSentry } = await import('./lib/observability/server');
  await registerServerSentry();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!process.env.SENTRY_DSN) return;
  const { onServerRequestError } = await import('./lib/observability/server');
  await onServerRequestError(error, request, context);
};
