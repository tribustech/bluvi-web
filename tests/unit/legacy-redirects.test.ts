import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { LEGACY_CASES, NOT_REDIRECTED } from '../e2e/legacy-redirects.cases';

/*
 * next.config.ts redirects() alone (global.b.legacy-path-redirects): every fish legacy path lands on
 * its web route with the right status, the specific rules win over the generic ones, and none of the
 * web's own routes is caught. The running server is checked by tests/e2e/legacy-redirects.spec.ts.
 */
const ORIGIN = 'https://bluvi.test';

describe('legacy path redirects (global.b.legacy-path-redirects)', () => {
  it.each(LEGACY_CASES.map((c) => [c.from, c] as const))('%s', async (_from, c) => {
    const res = await unstable_getResponseFromNextConfig({ url: `${ORIGIN}${c.from}`, nextConfig });
    expect(res.status, c.why).toBe(c.status);
    const location = new URL(getRedirectUrl(res) ?? '', ORIGIN);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname, c.why).toBe(c.path);
    if (c.hasParams) return; // see LegacyCase.hasParams: the e2e checks the query
    for (const [key, value] of Object.entries(c.query ?? {})) expect(location.searchParams.get(key), key).toBe(value);
    for (const key of c.absent ?? []) expect(location.searchParams.has(key), key).toBe(false);
  });

  it.each(NOT_REDIRECTED)('%s is a web route: not redirected', async (path) => {
    const res = await unstable_getResponseFromNextConfig({ url: `${ORIGIN}${path}`, nextConfig });
    expect(getRedirectUrl(res)).toBeNull();
  });
});
