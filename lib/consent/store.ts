/*
 * The browser side of the consent layer (m8.consent): the one place that reads and writes the
 * `bluvi_consent` cookie. Safe to import from server code — every function is a no-op (or null)
 * without `window`. Public API, kept stable for M8-B2 (GA4 / Sentry wiring): see ./README.md.
 */

import {
  type Consent,
  type ConsentChoice,
  CONSENT_COOKIE,
  consentCookieString,
  cookieDomainsFor,
  cookieNames,
  cookieValue,
  decide,
  isAnalyticsCookie,
  parseConsent,
} from './model';

/** Fired on window after every decision: `detail` is the new Consent. */
export const CONSENT_EVENT = 'bluvi:consent';
/** Fired on window by openConsentSettings(): the mounted ConsentProvider opens the preferences dialog. */
export const CONSENT_OPEN_EVENT = 'bluvi:consent-open';

declare global {
  interface WindowEventMap {
    [CONSENT_EVENT]: CustomEvent<Consent>;
    [CONSENT_OPEN_EVENT]: CustomEvent<null>;
  }
}

let cachedRaw: string | null | undefined;
let cached: Consent | null = null;

/** The visitor's current decision, or null (none yet, malformed, or an older version). */
export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = cookieValue(document.cookie, CONSENT_COOKIE);
  // A stable object per cookie value (useSyncExternalStore compares snapshots by identity).
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseConsent(raw);
  }
  return cached;
}

/** Calls `cb` with each new decision (this tab). Returns the unsubscribe. */
export function subscribeConsent(cb: (consent: Consent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: CustomEvent<Consent>) => cb(e.detail);
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

/**
 * Records a decision: the given categories over the current ones (all off when there are none),
 * `at` = now. Writes the cookie, removes GA4's cookies when analytics is off, then fires
 * CONSENT_EVENT. Returns the stored record (null outside the browser).
 */
export function setConsent(partial: Partial<ConsentChoice>): Consent | null {
  if (typeof document === 'undefined') return null;
  const next = decide(partial, readConsent());
  document.cookie = consentCookieString(next, window.location.protocol === 'https:');
  if (!next.analytics) clearAnalyticsCookies();
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: next }));
  return next;
}

/** Opens the preferences dialog from anywhere (a link, a footer, a settings row). */
export function openConsentSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT, { detail: null }));
}

/** Withdrawal: deletes `_ga` / `_ga_*` on the current host and its parent domains. */
export function clearAnalyticsCookies(): void {
  if (typeof document === 'undefined') return;
  const expired = 'Path=/; Max-Age=0; SameSite=Lax';
  for (const name of cookieNames(document.cookie).filter(isAnalyticsCookie)) {
    document.cookie = `${name}=; ${expired}`;
    for (const domain of cookieDomainsFor(window.location.hostname)) document.cookie = `${name}=; ${expired}; Domain=${domain}`;
  }
}
