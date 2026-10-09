/*
 * The browser side of Sentry (m8.sentry), started from instrumentation-client.ts. Three gates, in
 * order, before the SDK chunk is even downloaded:
 *  1. NEXT_PUBLIC_SENTRY_DSN is set and NEXT_PUBLIC_SENTRY_ENVIRONMENT is a reporting one (./env.ts);
 *  2. the visitor said yes to «Monitorizarea erorilor» (lib/consent: readConsent()?.errors === true —
 *     fish's Sentry is an optional CMP service too);
 *  3. then `import('@sentry/nextjs')` — a separate chunk, so the public pages' JS does not grow for
 *     anyone else.
 * A later «yes» (CONSENT_EVENT) starts it; a later «no» closes the client and detaches it.
 *
 * Identity (fish AuthContext.tsx:80-105): the session JWT is httpOnly, so the browser asks
 * /api/auth/session once, after init, and keeps only the numeric id and the session state; later
 * sign-ins / sign-outs (no reload) update it through ./report.ts setSessionIdentity / startNewSession.
 */

import type * as SentryNext from '@sentry/nextjs';
import type { Consent } from '@/lib/consent/model';
import { browserSentryTarget, type SentryTarget } from './env';
import { browserSentryOptions } from './options';
import { attachSdk, markSdkLoading } from './report';
import type { SessionState } from './session-state';

type BrowserSdk = Pick<typeof SentryNext, 'init' | 'getClient' | 'captureException' | 'captureMessage' | 'setTag' | 'setUser'>;

export type BrowserGateDeps = {
  target: SentryTarget | null;
  readConsent: () => Consent | null;
  subscribeConsent: (cb: (c: Consent) => void) => () => void;
  load: () => Promise<BrowserSdk>;
  identify?: (sdk: BrowserSdk) => void | Promise<void>;
};

/** Starts the gate; returns the unsubscribe (tests). Never throws. */
export function startBrowserObservability(deps: BrowserGateDeps): () => void {
  const { target } = deps;
  if (!target) return () => {};
  let status: 'off' | 'loading' | 'on' = 'off';
  let loaded: BrowserSdk | null = null;

  const wanted = () => deps.readConsent()?.errors === true;

  const start = () => {
    if (status !== 'off') return;
    status = 'loading';
    markSdkLoading();
    deps
      .load()
      .then((S) => {
        if (!wanted()) {
          status = 'off';
          attachSdk(null);
          return;
        }
        S.init(browserSentryOptions(target));
        loaded = S;
        status = 'on';
        attachSdk(S);
        void Promise.resolve(deps.identify?.(S)).catch(() => undefined);
      })
      .catch(() => {
        status = 'off';
        attachSdk(null);
      });
  };

  const stop = () => {
    attachSdk(null);
    if (status === 'on' && loaded) void loaded.getClient()?.close();
    status = 'off';
  };

  try {
    if (wanted()) start();
    // instrumentation-client.ts may have opened the gate early (./gate.ts) from the same cookie;
    // if it is closed after all, resolve 'loading' to 'off' so nothing waits in the queue.
    else attachSdk(null);
  } catch {
    // A malformed consent cookie reads as «no decision»; nothing to start.
    attachSdk(null);
  }
  return deps.subscribeConsent((c) => (c.errors ? start() : stop()));
}

/** session.state + user.id in the browser, from the httpOnly session via /api/auth/session. */
export async function identifyFromSession(sdk: Pick<BrowserSdk, 'setTag' | 'setUser'>, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
  let state: SessionState;
  let id: unknown;
  if (res.ok) {
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    id = body?.id;
    state = typeof id === 'number' ? 'valid' : 'unreadable';
  } else if (res.status === 401) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
    state = body?.error?.message === 'Signed out' ? 'none' : 'expired';
  } else {
    return; // CMS unreachable: say nothing rather than guess.
  }
  sdk.setTag('session.state', state);
  sdk.setUser(typeof id === 'number' ? { id: String(id) } : null);
}

/** The production wiring (instrumentation-client.ts). */
export async function startBrowserSentry(): Promise<void> {
  const target = browserSentryTarget();
  if (!target) return;
  const { readConsent, subscribeConsent } = await import('@/lib/consent/store');
  startBrowserObservability({
    target,
    readConsent,
    subscribeConsent,
    load: () => import('@sentry/nextjs'),
    identify: (S) => identifyFromSession(S),
  });
}
