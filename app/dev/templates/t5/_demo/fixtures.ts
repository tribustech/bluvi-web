import { dayKey } from './format';
import type { LakeOperatorStats, OperatorStatsWindowName, OperatorTrendPoint, OperatorUpcomingBooking, OperatorWindowTotals } from '@/core/lakes';

/*
 * Simulated operator stats for the demo's edge states. The local CMS has a quiet Chita (no
 * bookings today), so «busy» / «legacy» are built here, around the real lake (name, stand total),
 * in the exact DTO shape `lakeOperatorStatsSchema` parses.
 *
 * They are anchored to TODAY's calendar day, not to «now»: the simulated states run at a fixed
 * demo time (`demoNow`, today 14:00 in Bucharest) and every booking hour counts from today's
 * 00:00, so «Azi la baltă» always lists today's stands and screenshots only change at midnight.
 */

const H = 3600_000;
const TZ = 'Europe/Bucharest';
const iso = (ms: number) => new Date(ms).toISOString();

/** The demo's fixed hour of the day for the simulated states. */
export const DEMO_HOUR = 14;

/** Bucharest's UTC offset at `ms`, in ms. */
function tzOffsetMs(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - (ms - (ms % 1000));
}

/** Today (Bucharest) at `hour`:00 — the simulated states' «now». */
export function demoNow(nowMs: number, hour = DEMO_HOUR): number {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(nowMs)).split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  return wall - tzOffsetMs(wall);
}

/** `start` / `end`: hours from today's 00:00 (negative = yesterday, above 24 = tomorrow). */
function booking(p: Partial<OperatorUpcomingBooking> & { standName: string; start: number; end: number }, dayStartMs: number): OperatorUpcomingBooking {
  const { start, end, ...rest } = p;
  return {
    anglerName: null,
    anglerAvatar: null,
    bookingStatus: 'confirmed',
    priceTotal: 0,
    noShow: false,
    code: `D${Math.abs(start)}`.slice(0, 8),
    documentId: null,
    balanceDue: null,
    ...rest,
    // On the hour, as real bookings are.
    startDate: iso(dayStartMs + start * H),
    endDate: iso(dayStartMs + end * H),
  };
}

/** A deterministic 0..1 sequence, so screenshots are stable. */
function wave(i: number, seed: number) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A UTC-midnight date as a day key (calendar maths run on UTC days, never the viewer's zone). */
const utcKey = (d: Date) => d.toISOString().slice(0, 10);

export function trendFixture(window: OperatorStatsWindowName, total: number, nowMs: number): { days: OperatorTrendPoint[]; windowTotals: OperatorWindowTotals } {
  // Today on the lake's calendar (Bucharest), as a UTC midnight: the same days on the server and in
  // any viewer's browser.
  const [ty, tm, td] = dayKey(new Date(nowMs)).split('-').map(Number);
  const now = new Date(Date.UTC(ty, tm - 1, td));
  let days: OperatorTrendPoint[];
  if (window === 'year') {
    days = Array.from({ length: 12 }, (_, m) => {
      const season = Math.sin(((m - 2) / 12) * Math.PI) * 0.8 + 0.1;
      const booked = Math.max(0, Math.round(total * Math.max(0, season) * (0.6 + wave(m, 3) * 0.4)));
      const bookings = Math.round(booked * 9 + wave(m, 4) * 8);
      return { date: `${ty}-${String(m + 1).padStart(2, '0')}`, booked, total, cash: bookings * 210, bookings };
    });
  } else {
    // The CMS window is a WHOLE calendar week (Mon–Sun) or month, future days included.
    const first =
      window === 'week'
        ? Date.UTC(ty, tm - 1, td - ((now.getUTCDay() + 6) % 7))
        : Date.UTC(ty, tm - 1, 1);
    const length = window === 'week' ? 7 : new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    days = Array.from({ length }, (_, i) => {
      const d = new Date(first + i * 86_400_000);
      const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 || d.getUTCDay() === 5;
      const booked = Math.min(total, Math.round(total * ((weekend ? 0.55 : 0.18) + wave(i, window === 'week' ? 1 : 2) * 0.3)));
      const bookings = Math.max(0, Math.round(booked * 0.7));
      return { date: utcKey(d), booked, total, cash: bookings * 180 + Math.round(wave(i, 5) * 4) * 50, bookings };
    });
  }
  const cash = days.reduce((s, p) => s + p.cash, 0);
  const bookings = days.reduce((s, p) => s + p.bookings, 0);
  const occupancyAvgPct = Math.round((days.reduce((s, p) => s + p.booked / Math.max(1, p.total), 0) / days.length) * 100);
  return { days, windowTotals: { cash, bookings, occupancyAvgPct } };
}

/**
 * A full day at `nowMs` = demoNow (14:00): pending requests, 8 stands (turnover, live, done,
 * no-show), drop-outs, reviews. Hours count from today's 00:00.
 */
export function busyFixture(base: LakeOperatorStats, nowMs: number): LakeOperatorStats {
  const total = base.occupancyNow?.total ?? base.occupancyByDay.at(-1)?.total ?? 21;
  const dayStart = demoNow(nowMs, 0);
  const b = (p: Parameters<typeof booking>[0]) => booking(p, dayStart);
  const today = [
    b({ standName: '1', anglerName: 'Mihai Popescu', start: 4, end: 28, priceTotal: 250, balanceDue: 250, documentId: 'fx1' }),
    b({ standName: '2', anglerName: 'Andrei Ionescu', start: -8, end: 12, priceTotal: 300, documentId: 'fx2' }),
    b({ standName: '2', anglerName: 'Radu Stan', start: 17, end: 29, priceTotal: 180, balanceDue: 180, documentId: 'fx3' }),
    b({ standName: '3', anglerName: 'Cristian Dobre', start: 6, end: 13, priceTotal: 120, documentId: 'fx4' }),
    b({ standName: '4', anglerName: 'Vlad Matei', start: 8, end: 32, priceTotal: 250, noShow: true, documentId: 'fx5' }),
    b({ standName: '5', anglerName: 'Ioana Marin', start: 19, end: 43, priceTotal: 0, documentId: 'fx6' }),
    b({ standName: '7', anglerName: 'George Enache', start: 10, end: 34, priceTotal: 280 }),
    b({ standName: '9', anglerName: null, start: -16, end: 32, priceTotal: 480 }),
    b({ standName: '10', anglerName: 'Paul Constantin', start: 12, end: 24, priceTotal: 150, balanceDue: 150, documentId: 'fx9' }),
    b({ standName: '12', anglerName: 'Dan Georgescu', start: 20, end: 44, priceTotal: 250, bookingStatus: 'pending' }),
  ];
  const trend = trendFixture('week', total, nowMs);
  return {
    ...base,
    occupancyNow: { booked: 6, total },
    pending: 3,
    oldestPending: { anglerName: 'Dan Georgescu', standName: '12', waitingMinutes: 135 },
    today,
    cancelledLast24h: 2,
    pendingFeedback: 1,
    deIncasatAzi: 430,
    // Five digits on purpose: the KPI tiles must hold a real week («12.400 lei») on one line.
    deIncasat7z: 12400,
    todayCompetition: null,
    days: trend.days,
    windowTotals: trend.windowTotals,
  };
}

/** The busy day with `pending` requests waiting (1: the singular copy; above 99: the «99+» badge). */
export function pendingFixture(base: LakeOperatorStats, nowMs: number, pending: number): LakeOperatorStats {
  const busy = busyFixture(base, nowMs);
  return {
    ...busy,
    pending,
    oldestPending: pending === 1 ? { anglerName: 'Dan Georgescu', standName: '12', waitingMinutes: 25 } : { anglerName: 'Dan Georgescu', standName: '12', waitingMinutes: 60 * 50 },
  };
}

/** The busy day as an older CMS sends it: no occupancyNow, server cash, oldestPending or totals. */
export function legacyFixture(base: LakeOperatorStats, nowMs: number): LakeOperatorStats {
  const busy = busyFixture(base, nowMs);
  const rest: LakeOperatorStats = { ...busy };
  for (const k of ['occupancyNow', 'deIncasatAzi', 'deIncasat7z', 'windowTotals', 'pendingFeedback'] as const) delete rest[k];
  return { ...rest, oldestPending: undefined, occupancyByDay: [...busy.occupancyByDay.slice(0, -1), { date: dayKey(new Date(nowMs)), booked: 7, total: busy.occupancyNow?.total ?? 21 }] };
}

/** Nothing today: no requests, no bookings, no competition, no trend points. */
export function emptyFixture(base: LakeOperatorStats): LakeOperatorStats {
  return {
    ...base,
    pending: 0,
    oldestPending: null,
    today: [],
    cancelledLast24h: 0,
    pendingFeedback: 0,
    deIncasatAzi: 0,
    deIncasat7z: 0,
    todayCompetition: null,
    days: [],
    windowTotals: null,
    occupancyNow: base.occupancyNow ? { booked: 0, total: base.occupancyNow.total } : undefined,
  };
}

/**
 * The simulated states' fallback when the local CMS is slow or down: the QA account's lake as the
 * fixtures need it (name, 21 stands, a quiet day). The simulated states are fixtures — they must
 * render the requested state (and their visual baselines) whatever the CMS does; only the real
 * states (ready, empty, not-owner, no-lake, slow) depend on it.
 */
export const BASE_LAKE = { documentId: 'demo-chita', name: 'Chita Lake' } as const;

export function baseFixture(): LakeOperatorStats {
  return {
    occupancyByDay: [],
    occupancyNow: { booked: 0, total: 21 },
    pending: 0,
    oldestPending: null,
    today: [],
    cancelledLast24h: 0,
    pendingFeedback: 0,
    deIncasatAzi: 0,
    deIncasat7z: 0,
    todayCompetition: null,
    days: [],
    windowTotals: null,
  };
}
