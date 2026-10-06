import 'server-only';
import * as z from 'zod';
import { call, isApiError, type Transport } from '@/core/transport';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import { withTimeout } from './deadline';

/**
 * What a null from getViewer() really was. getViewer() maps every /users/me failure to «signed
 * out»; with a session cookie that would show a signed-in user «Intră» (the top bar) or the
 * sign-in gate (the page) on a CMS hiccup. Ask once more and tell the cases apart:
 * - `none`: no session cookie — signed out;
 * - `dead`: the CMS refused the session (401) — signed out;
 * - `unreachable`: no answer, or another error — unknown (the bar's retry slot, the page's load
 *   error), never «signed out»;
 * - `live`: it answered now — the first read was the hiccup; also unknown for this render.
 * The page and the layout share this, so the chrome and the page never disagree about the session.
 * TODO(lib/server/viewer): report this from getViewer() itself (and use it in app/(site)/layout.tsx
 * via the SiteShell TODO) — this task may only touch T4.
 */
export type SessionRecheck = 'none' | 'dead' | 'unreachable' | 'live';

export async function recheckSession(ms: number, t?: Transport): Promise<SessionRecheck> {
  if (!(await getSessionToken())) return 'none';
  try {
    await call(t ?? withTimeout(createServerTransport(), ms), { method: 'GET', path: '/users/me', auth: 'required' }, z.unknown());
    return 'live';
  } catch (e) {
    return isApiError(e) && (e.status === 401 || e.code === 'SESSION_DEAD') ? 'dead' : 'unreachable';
  }
}

/** `promise`, or `fallback` after `ms` (the timer is cleared either way). */
export async function within<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<F>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
