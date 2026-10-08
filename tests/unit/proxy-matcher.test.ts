import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from '@/proxy';
import { NextRequest } from 'next/server';

/*
 * proxy.ts — the signed-out gate's fast path: a cookie-less request to a signed-in-only page gets a
 * 307 to /intra?next=<path+query>; with the session cookie the proxy does not run (the page's own
 * gate decides). Public pages never match.
 */
const SESSION = { bluvi_session: 'jwt' };
const matches = (url: string, cookies?: Record<string, string>) => unstable_doesMiddlewareMatch({ config, url, cookies });

describe('proxy matcher: M6 organizer (organizer.b.signed-out-gate)', () => {
  const gated = [
    '/organizator',
    '/organizator/concursuri/nou/detalii',
    '/organizator/concursuri/nou/clasament?explicatie=quantity',
    '/concursuri/c1/editeaza/detalii',
    '/concursuri/c1/sectoare',
    '/concursuri/c1/alocare',
    '/concursuri/c1/alocare?mansa=2',
    '/concursuri/c1/cantar',
    '/concursuri/c1/cantar/s1',
    '/concursuri/c1/cantar/s1/w1/modificari',
    '/concursuri/c1/penalizari',
    '/concursuri/c1/penalizari/stand',
    '/concursuri/c1/penalizari/aplica?inscriere=r1',
  ];
  it.each(gated)('%s: cookie-less → proxied; with a session → not', (url) => {
    expect(matches(url)).toBe(true);
    expect(matches(url, SESSION)).toBe(false);
  });

  it.each(['/concursuri/c1', '/concursuri/c1/participanti', '/concursuri/c1/cantare', '/concursuri/c1/clasament', '/concursuri'])(
    'public %s never matches',
    (url) => {
      expect(matches(url)).toBe(false);
    },
  );

  it('redirects to /intra with the page and its query as `next`', () => {
    const res = proxy(new NextRequest('http://localhost:3000/organizator/concursuri/nou/detalii?ciorna=d1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/intra?next=%2Forganizator%2Fconcursuri%2Fnou%2Fdetalii%3Fciorna%3Dd1');
  });
});
