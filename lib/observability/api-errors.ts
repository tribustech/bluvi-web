/*
 * Which CMS failures reach Sentry, and with which tags — fish services/api/api.ts:86-172 +
 * errorReporting.ts, ported to the web's ApiError (core/transport/errors.ts):
 *  - `bluCode` errors are handled by the screens: never reported;
 *  - SESSION_DEAD is the sign-out signal (global.b.session-expired): no api-error event here (./report.ts
 *    sends fish's one «Session rejected by the API» message per page instead), and for the next 60 s
 *    the burst it causes (401 with the dead token, 403 once the screens re-render as Public) is the
 *    expected fallout, not new information — muted for that window only;
 *  - an aborted request (navigation, unmount) is not a failure;
 *  - everything else: one event per (status, endpoint) per page session, tagged `api_url` (the path
 *    with ids collapsed) and `api_status` (the HTTP status, or the transport code for no response).
 *
 * Module state on purpose: the browser transport is a singleton per page, the dedupe is too ("per
 * launch" in fish = per page load here). Pure functions, unit-tested without Sentry.
 */

import { isApiError, type ApiError } from '@/core/transport/errors';

/** `/lakes/abc123…/partide?page=2` → `/lakes/:id/partide` (fish normalizeApiPath). */
export function normalizeApiPath(url: string | undefined | null): string {
  if (!url) return 'unknown';
  const path = url.split('?')[0].split('#')[0];
  return (
    path
      .split('/')
      .map((segment) => {
        if (!segment) return segment;
        if (/^\d+$/.test(segment)) return ':id';
        if (/^[a-z0-9]{16,}$/i.test(segment)) return ':id';
        return segment;
      })
      .join('/') || '/'
  );
}

const MAX_TRACKED_KEYS = 200;
const reportedKeys = new Set<string>();

/** One event per (status, endpoint) per page session; past 200 keys, quieter rather than leaking. */
export function shouldReportApiError(status: number | string | undefined, path: string): boolean {
  const key = `${status ?? 'unknown'}:${path}`;
  if (reportedKeys.has(key)) return false;
  if (reportedKeys.size >= MAX_TRACKED_KEYS) return false;
  reportedKeys.add(key);
  return true;
}

export const DEAD_SESSION_MUTE_MS = 60_000;
let deadSessionAt: number | null = null;

/** Re-arms the dedupe and the dead-session mute (a new session's failures are new information). */
export function resetApiErrorReporting(): void {
  reportedKeys.clear();
  deadSessionAt = null;
}

/**
 * A voluntary sign-out: the 401s / 403s of queries refetching without the cookie are expected, not
 * news — the same 60 s mute as after SESSION_DEAD, without the dead-session report.
 */
export function muteAuthBurst(now = Date.now()): void {
  deadSessionAt = now;
}

function isAbort(error: ApiError): boolean {
  const cause = (error as { cause?: unknown }).cause;
  return error.code === 'NETWORK' && typeof cause === 'object' && cause !== null && (cause as { name?: unknown }).name === 'AbortError';
}

export type ApiErrorReport = {
  tags: { api_url: string; api_status: string };
  fingerprint: string[];
};

/**
 * The tags to report an API failure with, or null when it must not be reported. Records the
 * SESSION_DEAD moment and the dedupe key as side effects.
 */
export function apiErrorReport(error: unknown, now = Date.now()): ApiErrorReport | null {
  if (!isApiError(error)) return null;
  if (error.code === 'SESSION_DEAD') {
    deadSessionAt = now;
    return null;
  }
  if (error.bluCode) return null;
  if (isAbort(error)) return null;
  if (deadSessionAt !== null && now - deadSessionAt < DEAD_SESSION_MUTE_MS && (error.status === 401 || error.status === 403)) return null;
  const apiUrl = normalizeApiPath(error.path);
  const apiStatus = error.status > 0 ? String(error.status) : error.code;
  if (!shouldReportApiError(apiStatus, apiUrl)) return null;
  // One issue per endpoint and status: fish's API errors all shared one stack, so a route's 500s and
  // another route's 403s grouped together.
  return { tags: { api_url: apiUrl, api_status: apiStatus }, fingerprint: ['api-error', apiStatus, apiUrl] };
}
