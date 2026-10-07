import type { Page, Route } from '@playwright/test';

/*
 * Mocked /feed/bookings/mine and /feed/bookings/to-review for tests/e2e/rezervari.spec.ts (the
 * browser's /api/cms proxy calls). Dates are relative to the run's clock so «Începe mâine», the live
 * progress and the dead variants hold whatever day the suite runs.
 */

const H = 3_600_000;
const LAKE_THUMB = 'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/thumbnail_Pexels_Photo_247600_1b3160e366.jpeg';

/** Local midnight + `days` days + `hour` hours, as ISO. */
export function at(days: number, hour: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(hour);
  return d.toISOString();
}

type Over = Record<string, unknown>;

export function booking(id: string, over: Over = {}) {
  return {
    documentId: id,
    code: `BK-${id.toUpperCase()}`,
    startDate: at(1, 6),
    endDate: at(1, 18),
    bookingStatus: 'confirmed',
    priceTotal: 150,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '+40700000000',
    noShow: false,
    paymentMode: 'offline',
    basis: { durationHours: 12, rowLabel: null, composedFrom: [12], tourPrice: 150, extras: [] },
    lake: {
      documentId: 'lake-chita',
      name: 'Chita Lake',
      contactPhone: '0712345678',
      minCancelNoticeHours: 24,
      checkoutBufferMinutes: 0,
      thumbUrl: LAKE_THUMB,
      locality: 'Giurgiu',
    },
    stand: { documentId: `stand-${id}`, name: '5' },
    ...over,
  };
}

const lake = (over: Over) => ({ ...booking('x').lake, ...over });

/** Every row variant of c13–c19 (one per card). */
export const VARIANTS = {
  pending: booking('pending', { bookingStatus: 'pending', startDate: at(3, 6), endDate: at(3, 18), priceTotal: 1250 }),
  today: booking('today', { startDate: new Date(Date.now() + 10 * 60_000).toISOString(), endDate: new Date(Date.now() + 12 * H).toISOString(), lake: lake({ name: 'Lacul Știucii', thumbUrl: null }) }),
  tomorrow: booking('tomorrow', {
    basis: {
      durationHours: 12,
      rowLabel: null,
      composedFrom: [12],
      tourPrice: 120,
      extras: [
        { key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 30, quantity: 1, total: 30 },
        { key: 'night', label: 'Noapte', unit: 'perNight', unitPrice: 20, quantity: 1, total: 20 },
      ],
    },
  }),
  inDays: booking('indays', { startDate: at(25, 6), endDate: at(25, 18), stand: { documentId: 's25', name: '12A' } }),
  live: booking('live', {
    startDate: new Date(Date.now() - 3.5 * H).toISOString(),
    endDate: new Date(Date.now() + 8.5 * H).toISOString(),
    lake: lake({ checkoutBufferMinutes: 0 }),
  }),
  completed: booking('completed', { bookingStatus: 'completed', startDate: at(-10, 6), endDate: at(-10, 18) }),
  cancelledByMe: booking('cancme', { bookingStatus: 'cancelled', cancelledBy: 'angler', cancelReason: 'Nu mai pot ajunge, s-a schimbat programul.', startDate: at(-4, 6), endDate: at(-4, 18) }),
  cancelledByLake: booking('canclake', {
    bookingStatus: 'cancelled',
    cancelledBy: 'operator',
    cancelReason:
      'Lucrări la baltă. Am golit parțial lacul pentru igienizare și nu putem primi pescari în perioada asta, ne pare rău, vă așteptăm cu drag după ce terminăm lucrările de la mal și de la standuri.',
    startDate: at(5, 6),
    endDate: at(5, 18),
  }),
  cancelledAuto: booking('cancauto', { bookingStatus: 'cancelled', cancelledBy: 'system', cancelReason: 'Cererea a expirat.', startDate: at(-2, 6), endDate: at(-2, 18) }),
  rejected: booking('rejected', { bookingStatus: 'rejected', cancelReason: 'Standul nu este disponibil pe acest interval.', startDate: at(-6, 6), endDate: at(-6, 18) }),
  noShow: booking('noshow', { noShow: true, noShowComment: 'Pescarul nu s-a prezentat.', startDate: at(-8, 6), endDate: at(-8, 18) }),
  noShowNote: booking('noshownote', { noShow: true, noShowComment: 'A sunat la 5 dimineața că nu mai vine.', startDate: at(-9, 6), endDate: at(-9, 18) }),
  unknown: booking('unknown', { bookingStatus: 'paused', lake: undefined, stand: undefined, startDate: at(2, 6), endDate: at(2, 18) }),
  buffer: booking('buffer', { startDate: at(4, 6), endDate: at(4, 18), lake: lake({ checkoutBufferMinutes: 30 }) }),
} as const;

export const ALL_VARIANTS = Object.values(VARIANTS);

export type MineCall = { bucket: string | null; sub: string | null; page: number; pageSize: number };

export type MineMock = (q: MineCall, n: number) => { status?: number; body?: unknown; delayMs?: number } | 'fallback';

/** A page body as the CMS sends it ({ data, meta }). */
export function page(rows: unknown[], { pendingCount = 0, page = 1, pageSize = 20 } = {}) {
  return { data: rows, meta: { pendingCount, page, pageSize } };
}

/** Routes /api/cms/feed/bookings/mine*; records every call. */
export async function mockMine(p: Page, fn: MineMock) {
  const calls: MineCall[] = [];
  await p.route('**/api/cms/feed/bookings/mine**', async (r: Route) => {
    const url = new URL(r.request().url());
    if (url.pathname.endsWith('/count')) return r.fallback();
    const q: MineCall = {
      bucket: url.searchParams.get('bucket'),
      sub: url.searchParams.get('sub'),
      page: Number(url.searchParams.get('page') ?? '1'),
      pageSize: Number(url.searchParams.get('pageSize') ?? '0'),
    };
    calls.push(q);
    const out = fn(q, calls.length);
    if (out === 'fallback') return r.fallback();
    if (out.delayMs) await new Promise((res) => setTimeout(res, out.delayMs));
    const status = out.status ?? 200;
    const body = status >= 400 ? { data: null, error: { status, message: 'Eroare server' } } : out.body;
    return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

export type ToReview = { lakeId: string; lakeName: string; bookingId: string; endDate: string };

/** Routes /api/cms/feed/bookings/to-review; counts the calls. */
export async function mockToReview(p: Page, lakes: ToReview[] | (() => ToReview[]) | number) {
  const calls = { n: 0 };
  await p.route('**/feed/bookings/to-review', async (r: Route) => {
    calls.n += 1;
    if (typeof lakes === 'number') {
      return r.fulfill({ status: lakes, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: lakes, message: 'x' } }) });
    }
    const data = typeof lakes === 'function' ? lakes() : lakes;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  return calls;
}

export const REVIEW_ONE: ToReview[] = [{ lakeId: 'lake-chita', lakeName: 'Chita Lake', bookingId: 'b-done', endDate: at(-3, 18) }];
export const REVIEW_MANY = (n: number): ToReview[] =>
  Array.from({ length: n }, (_, i) => ({ lakeId: `lake-${i}`, lakeName: i === 0 ? 'Chita Lake' : `Lac ${i}`, bookingId: `b-${i}`, endDate: at(-3 - i, 18) }));
