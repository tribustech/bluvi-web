/*
 * The cookie-consent record (m8.consent) — pure, no DOM. See ./README.md for the public API.
 *
 * Stored as the first-party cookie `bluvi_consent` = JSON { v, analytics, errors, at }:
 *  - v         CONSENT_VERSION; a record of another version is treated as no answer (the banner asks again);
 *  - analytics Google Analytics 4 (category «Analiză»);
 *  - errors    Sentry in the browser (category «Monitorizarea erorilor»);
 *  - at        when the visitor decided (ISO 8601).
 * Both optional categories are OFF until the visitor opts in (GDPR / ePrivacy), unlike fish where
 * GA is «mandatory» (CMP/config/cmp.config.ts).
 */

export const CONSENT_VERSION = 1;
export const CONSENT_COOKIE = 'bluvi_consent';
/** 180 days, in seconds. */
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type Consent = {
  v: typeof CONSENT_VERSION;
  analytics: boolean;
  errors: boolean;
  at: string;
};

/** The optional categories — the keys a visitor can switch. */
export type ConsentChoice = Pick<Consent, 'analytics' | 'errors'>;
export type ConsentCategory = keyof ConsentChoice;

export const NO_CHOICE: ConsentChoice = { analytics: false, errors: false };
export const ALL_ACCEPTED: ConsentChoice = { analytics: true, errors: true };

/** Parses the cookie's (URL-encoded) value. Anything malformed or of another version → null. */
export function parseConsent(raw: string | null | undefined): Consent | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  if (o.v !== CONSENT_VERSION) return null;
  if (typeof o.analytics !== 'boolean' || typeof o.errors !== 'boolean') return null;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  return { v: CONSENT_VERSION, analytics: o.analytics, errors: o.errors, at: o.at };
}

/** The record for a decision now: `previous` (or all-off) with `partial` over it. */
export function decide(partial: Partial<ConsentChoice>, previous: Consent | null, now: Date = new Date()): Consent {
  const base = previous ?? { ...NO_CHOICE };
  return {
    v: CONSENT_VERSION,
    analytics: partial.analytics ?? base.analytics,
    errors: partial.errors ?? base.errors,
    at: now.toISOString(),
  };
}

/** The cookie's value (URL-encoded JSON). */
export function serializeConsent(c: Consent): string {
  return encodeURIComponent(JSON.stringify(c));
}

/** The whole Set-Cookie / document.cookie string. `secure` on https. */
export function consentCookieString(c: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${serializeConsent(c)}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** The value of cookie `name` in a `document.cookie` string, or null. */
export function cookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

/** GA4's cookies: `_ga` and `_ga_<container>`. */
export function isAnalyticsCookie(name: string): boolean {
  return name === '_ga' || name.startsWith('_ga_');
}

/** Names of the cookies in a `document.cookie` string. */
export function cookieNames(cookieHeader: string): string[] {
  return cookieHeader
    .split(';')
    .map((p) => p.split('=')[0]?.trim() ?? '')
    .filter(Boolean);
}

/**
 * The domains a cookie set by GA4 may sit on for `hostname`: the host itself and every parent
 * (GA4's cookie_domain «auto» writes on the top-most settable one, e.g. .bluvi.ro from www.bluvi.ro).
 */
export function cookieDomainsFor(hostname: string): string[] {
  const parts = hostname.split('.');
  if (parts.length < 2 || /^\d+$/.test(parts[parts.length - 1] ?? '')) return [hostname];
  const out: string[] = [];
  for (let i = 0; i <= parts.length - 2; i++) out.push(parts.slice(i).join('.'));
  return out;
}
