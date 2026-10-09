/*
 * The site's one way to report to Sentry from client code (m8.sentry). Every function is a no-op
 * until the browser SDK is attached (./browser.ts: DSN set, a reporting environment, and the
 * visitor's «Monitorizarea erorilor» consent), so call sites never check anything themselves and
 * this module never imports the SDK (only its types).
 *
 * While the SDK is loading (consent given, chunk in flight) captures wait in a small queue and go
 * out once it is attached; when it is off they are dropped. 'loading' is entered synchronously by
 * instrumentation-client.ts (./gate.ts), before the first render, so a first-render crash is kept.
 */

import type * as SentryNext from '@sentry/nextjs';
import { isApiError } from '@/core/transport/errors';
import { apiErrorReport, muteAuthBurst, normalizeApiPath, resetApiErrorReporting } from './api-errors';
import type { SessionState } from './session-state';

export type SentrySdk = Pick<typeof SentryNext, 'captureException' | 'captureMessage' | 'setTag' | 'setUser'>;

export type CaptureContext = {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  fingerprint?: string[];
};

type State = 'off' | 'loading' | 'on';
let state: State = 'off';
let sdk: SentrySdk | null = null;
const MAX_QUEUED = 20;
let queue: ((s: SentrySdk) => void)[] = [];

/** instrumentation-client.ts / ./browser.ts only: the SDK is on its way. */
export function markSdkLoading(): void {
  if (state === 'off') state = 'loading';
}

/** ./browser.ts only: attach (and flush the queue) or detach (and drop it). */
export function attachSdk(next: SentrySdk | null): void {
  sdk = next;
  state = next ? 'on' : 'off';
  const pending = queue;
  queue = [];
  if (next) for (const run of pending) run(next);
}

/** True while the browser SDK is attached (for tests and diagnostics). */
export function isReporting(): boolean {
  return state === 'on';
}

function run(fn: (s: SentrySdk) => void): void {
  try {
    if (state === 'on' && sdk) fn(sdk);
    else if (state === 'loading' && queue.length < MAX_QUEUED) queue.push(fn);
  } catch {
    // Reporting never breaks a page.
  }
}

export function captureException(error: unknown, context?: CaptureContext): void {
  run((s) => s.captureException(error, context));
}

export function captureMessage(message: string, context?: CaptureContext): void {
  run((s) => s.captureMessage(message, context));
}

/**
 * session.state + user.id on every later event (fish AuthContext.tsx:80-105 recomputes both on each
 * session change). The browser signs in and out without a reload, so the callers are the sign-in
 * (app/(site)/intra/SignIn.tsx: 'valid' + id), the confirmed sign-out ('none', lib/client/sign-out.ts) and
 * the forced one ('expired', app/providers.tsx). Queued while loading, a no-op while off.
 */
export function setSessionIdentity(sessionState: SessionState, userId?: number | string): void {
  run((s) => {
    s.setTag('session.state', sessionState);
    s.setUser(userId !== undefined && userId !== null ? { id: String(userId) } : null);
  });
}

export const SESSION_DEAD_MESSAGE = 'Session rejected by the API — signing the user out';
let deadSessionReported = false;

/**
 * A new session (sign-in, 'valid' + id) or none (confirmed sign-out, 'none'): re-arm the API-error
 * dedupe and the dead-session report, and set the identity. A sign-out also mutes its own 401/403
 * burst for 60 s (./api-errors.ts muteAuthBurst). Runs even while reporting is off (module state).
 */
export function startNewSession(sessionState: 'valid' | 'none', userId?: number | string): void {
  resetApiErrorReporting();
  if (sessionState === 'none') muteAuthBurst();
  deadSessionReported = false;
  setSessionIdentity(sessionState, userId);
}

/**
 * fish api.ts:158-172 for the browser transport: one event per (status, endpoint) per page, tagged
 * api_url + api_status (./api-errors.ts). SESSION_DEAD itself is reported once per page as fish's
 * handleDeadSession message (api.ts:80-95: level error, the url; the web cannot see the header, the
 * session cookie is what carried it); the 60 s 401/403 burst after it is muted. The dead-session
 * moment is recorded even while reporting is off, so a consent given mid-burst does not report it.
 */
export function reportApiError(error: unknown): void {
  if (!isApiError(error)) return;
  if (state === 'off') {
    if (error.code === 'SESSION_DEAD') apiErrorReport(error);
    return;
  }
  const report = apiErrorReport(error);
  if (error.code === 'SESSION_DEAD') {
    if (deadSessionReported) return;
    deadSessionReported = true;
    captureMessage(SESSION_DEAD_MESSAGE, { level: 'error', extra: { url: normalizeApiPath(error.path), hadSessionCookie: true } });
    return;
  }
  if (report) captureException(error, { tags: report.tags, fingerprint: report.fingerprint });
}
