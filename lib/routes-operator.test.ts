import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from '@/proxy';
import { routes, withBookingDetail } from './routes';

describe('M7 operator routes (docs/parity/areas/operator.yml web_route)', () => {
  it('builds the picker and a lake panel', () => {
    expect(routes.operator()).toBe('/operator');
    expect(routes.operator('l 1')).toBe('/operator/l%201');
    expect(routes.operatorCalendar('l1')).toBe('/operator/l1/calendar');
  });

  it('builds the inbox with the status vocabulary and focus', () => {
    expect(routes.operatorBookings('l1')).toBe('/operator/l1/rezervari');
    for (const s of ['pending', 'cancelled', 'rejected', 'toreview', 'all'] as const) {
      expect(routes.operatorBookings('l1', s)).toBe(`/operator/l1/rezervari?status=${s}`);
    }
    expect(routes.operatorBookings('l1', 'all', 'b 9')).toBe('/operator/l1/rezervari?status=all&focus=b+9');
    expect(routes.operatorBookings('l1', undefined, 'b9')).toBe('/operator/l1/rezervari?focus=b9');
  });

  it('builds the blocks pages', () => {
    expect(routes.operatorBlocks('l1')).toBe('/operator/l1/blocaje');
    expect(routes.operatorBlockNew('l1')).toBe('/operator/l1/blocaje/nou');
  });

  it('builds the walk-in steps with the same selection codec as the angler flow', () => {
    const sel = { stand: 's1', start: '2026-10-08T06:00:00.000Z', end: '2026-10-09T06:00:00.000Z', extras: ['e1', 'e2'] };
    const q = 'stand=s1&start=2026-10-08T06%3A00%3A00.000Z&end=2026-10-09T06%3A00%3A00.000Z&extra=e1&extra=e2';
    expect(routes.operatorCalendarExtras('l1', sel)).toBe(`/operator/l1/calendar/extra?${q}`);
    expect(routes.operatorCalendarReview('l1', sel)).toBe(`/operator/l1/calendar/confirmare?${q}`);
    expect(routes.lakeBookingExtras('l1', sel)).toBe(`/balti/l1/rezerva/extra?${q}`);
    expect(routes.lakeBookingReview('l1', { stand: 's1', start: 'a', end: 'b' })).toBe('/balti/l1/rezerva/confirmare?stand=s1&start=a&end=b');
  });

  it('builds «Evaluează pescarul» with its header facts', () => {
    expect(routes.operatorRateAngler('b1')).toBe('/operator/evalueaza/b1');
    expect(
      routes.operatorRateAngler('b1', {
        anglerName: 'Ion Pop',
        anglerId: 'u1',
        anglerAvatar: 'https://x.test/a.jpg',
        standName: 'Standul 3',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
      }),
    ).toBe(
      '/operator/evalueaza/b1?anglerName=Ion+Pop&anglerId=u1&anglerAvatar=https%3A%2F%2Fx.test%2Fa.jpg&standName=Standul+3&startDate=2026-10-01&endDate=2026-10-02',
    );
  });

  it('opens the booking detail on any href, keeping its query and hash', () => {
    expect(withBookingDetail('/operator/l1', 'b1')).toBe('/operator/l1?rezervare=b1');
    expect(withBookingDetail('/operator/l1/rezervari?status=pending', 'b1')).toBe('/operator/l1/rezervari?status=pending&rezervare=b1');
    expect(withBookingDetail('/operator/l1?rezervare=old#azi', 'b 2')).toBe('/operator/l1?rezervare=b+2#azi');
  });
});

describe('proxy matcher: M7 operator (operator.b.role-gating)', () => {
  const SESSION = { bluvi_session: 'jwt' };
  const matches = (url: string, cookies?: Record<string, string>) => unstable_doesMiddlewareMatch({ config, url, cookies });

  it.each(['/operator', '/operator/l1', '/operator/l1/rezervari?status=pending', '/operator/l1/blocaje/nou', '/operator/evalueaza/b1?anglerName=x'])(
    '%s: cookie-less → proxied; with a session → not',
    (url) => {
      expect(matches(url)).toBe(true);
      expect(matches(url, SESSION)).toBe(false);
    },
  );

  it('never matches lookalike public paths', () => {
    expect(matches('/operatori')).toBe(false);
    expect(matches('/balti/l1')).toBe(false);
  });

  it('redirects the picker to /intra?next=/operator', () => {
    const res = proxy(new NextRequest('http://localhost:3000/operator'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/intra?next=%2Foperator');
  });
});
