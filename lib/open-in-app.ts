/*
 * «Deschide în aplicație / Continuă în browser» (owner 2026-10-14: nobody knows bluvi.ro yet, so a
 * phone visitor is offered the app on whatever page they land on, the way 9gag does). Phones only
 * (iPhone, iPad, Android), never on the sign-in page; after either choice it stays away for 3 days,
 * per browser, in localStorage (every access try/catch: no storage → it is offered on every visit,
 * never an exception).
 *
 * The link is the same path on app.bluvi.ro: the app (fish features/deep-links) maps bluvi.ro's
 * paths to its screens, and without the app proxy.ts sends the phone to its store.
 */
import { APP_ORIGIN } from './app-links';

export const OPEN_IN_APP_KEY = '@bluvi/open-in-app/answered-at/v1';

/** How long a choice keeps the sheet away (owner 2026-10-14: 3 days). */
export const OPEN_IN_APP_QUIET_MS = 3 * 24 * 60 * 60 * 1000;

export type Phone = 'ios' | 'android';

/** The phone the page runs on, or null (a computer). iPadOS reports a Mac with a touch screen. */
export function phoneOf(userAgent: string, maxTouchPoints = 0): Phone | null {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return null;
}

/** Pages that never get the sheet: signing in (it would cover the sign-in buttons). */
export function isQuietPath(pathname: string): boolean {
  return pathname === '/intra' || pathname.startsWith('/intra/');
}

/** Whether the visitor answered less than 3 days ago. */
export function answeredRecently(answeredAt: string | null, now: number): boolean {
  const at = Number(answeredAt);
  return Number.isFinite(at) && at > 0 && now - at < OPEN_IN_APP_QUIET_MS;
}

/** The page's own address on app.bluvi.ro. */
export function openInAppHref(pathname: string, search: string): string {
  return `${APP_ORIGIN}${pathname}${search}`;
}

export function readAnsweredAt(): string | null {
  try {
    return localStorage.getItem(OPEN_IN_APP_KEY);
  } catch {
    return null;
  }
}

export function markAnswered(now = Date.now()): void {
  try {
    localStorage.setItem(OPEN_IN_APP_KEY, String(now));
  } catch {
    // Storage unavailable: offered again on the next visit.
  }
}
