/*
 * Server and edge side of Sentry (m8.sentry), wired by instrumentation.ts. Independent of the
 * visitor's consent: it sets no cookie and sends no PII (the scrubber drops headers, cookies,
 * tokens and e-mails; only the numeric user id and the session state are attached). Off — the SDK
 * is not even imported — unless SENTRY_DSN is set on a reporting environment (./env.ts).
 */

import type * as SentryNext from '@sentry/nextjs';
import type { Instrumentation } from 'next';
import { serverSentryTarget } from './env';
import { serverSentryOptions } from './options';
import { sessionInfoFromCookieHeader } from './session-state';

type ServerSdk = Pick<typeof SentryNext, 'init' | 'withScope' | 'captureRequestError'>;

let sdk: ServerSdk | null = null;

/** instrumentation.ts register(): init once per server instance, or nothing. */
export async function registerServerSentry(load: () => Promise<ServerSdk> = () => import('@sentry/nextjs')): Promise<void> {
  const target = serverSentryTarget();
  if (!target) return;
  const S = await load();
  S.init(serverSentryOptions(target));
  sdk = S;
}

/**
 * instrumentation.ts onRequestError: Sentry.captureRequestError with session.state and user.id read
 * from the session cookie (the JWT is decoded locally and never attached).
 */
export const onServerRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const S = sdk;
  if (!S) return;
  try {
    S.withScope((scope) => {
      const info = sessionInfoFromCookieHeader(request.headers.cookie, Date.now());
      scope.setTag('session.state', info.state);
      if (info.userId !== undefined) scope.setUser({ id: String(info.userId) });
      S.captureRequestError(error, request, context);
    });
  } catch {
    // Reporting never fails a request.
  }
};
