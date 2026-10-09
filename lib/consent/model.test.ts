import { describe, expect, it } from 'vitest';
import {
  CONSENT_MAX_AGE_SECONDS,
  consentCookieString,
  cookieDomainsFor,
  cookieNames,
  cookieValue,
  decide,
  isAnalyticsCookie,
  parseConsent,
  serializeConsent,
} from './model';

const AT = '2026-10-09T10:00:00.000Z';

describe('parseConsent', () => {
  it('round-trips a record', () => {
    const c = { v: 1 as const, analytics: true, errors: false, at: AT };
    expect(parseConsent(serializeConsent(c))).toEqual(c);
  });

  it('treats missing, malformed and other versions as no answer', () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent('')).toBeNull();
    expect(parseConsent('%7Bnope')).toBeNull();
    expect(parseConsent(encodeURIComponent('"x"'))).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify({ v: 2, analytics: true, errors: true, at: AT })))).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify({ v: 1, analytics: 'yes', errors: true, at: AT })))).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify({ v: 1, analytics: true, errors: true, at: 'ieri' })))).toBeNull();
  });

  it('drops unknown keys', () => {
    expect(parseConsent(encodeURIComponent(JSON.stringify({ v: 1, analytics: false, errors: true, at: AT, x: 1 })))).toEqual({
      v: 1,
      analytics: false,
      errors: true,
      at: AT,
    });
  });
});

describe('decide', () => {
  const now = new Date(AT);
  it('starts from all-off: a partial decision never opts in to the other category', () => {
    expect(decide({ errors: true }, null, now)).toEqual({ v: 1, analytics: false, errors: true, at: AT });
  });
  it('keeps the previous answer for the categories not given', () => {
    const prev = { v: 1 as const, analytics: true, errors: true, at: '2026-01-01T00:00:00.000Z' };
    expect(decide({ analytics: false }, prev, now)).toEqual({ v: 1, analytics: false, errors: true, at: AT });
  });
});

describe('cookie helpers', () => {
  it('builds the cookie with 180 days, Lax, Secure only on https', () => {
    const c = { v: 1 as const, analytics: false, errors: false, at: AT };
    expect(consentCookieString(c, false)).toBe(`bluvi_consent=${serializeConsent(c)}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax`);
    expect(consentCookieString(c, true)).toMatch(/; Secure$/);
    expect(CONSENT_MAX_AGE_SECONDS).toBe(15_552_000);
  });

  it('reads one cookie out of document.cookie', () => {
    expect(cookieValue('a=1; bluvi_consent=xyz; _ga=GA1', 'bluvi_consent')).toBe('xyz');
    expect(cookieValue('a=1', 'bluvi_consent')).toBeNull();
    expect(cookieNames('a=1; _ga=GA1; _ga_ABC=GS1')).toEqual(['a', '_ga', '_ga_ABC']);
  });

  it('recognises GA4 cookies only', () => {
    expect(['_ga', '_ga_X1Y2', '_gat', 'bluvi_session', 'ga'].map(isAnalyticsCookie)).toEqual([true, true, false, false, false]);
  });

  it('lists the host and its parent domains', () => {
    expect(cookieDomainsFor('www.bluvi.ro')).toEqual(['www.bluvi.ro', 'bluvi.ro']);
    expect(cookieDomainsFor('localhost')).toEqual(['localhost']);
    expect(cookieDomainsFor('127.0.0.1')).toEqual(['127.0.0.1']);
  });
});
