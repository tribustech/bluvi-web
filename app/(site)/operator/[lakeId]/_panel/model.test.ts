import { describe, expect, it } from 'vitest';
import type { LakeOperatorStats, OperatorTrendPoint } from '@/core/lakes';
import {
  cancelledTitle,
  cashFigure,
  dayTime,
  isDimmed,
  moneyColumn,
  occupancyFigure,
  panelLinks,
  panelView,
  pendingSubtitle,
  pendingTitle,
  reviewTitle,
  scrubHeader,
  seeAllLabel,
  showAllPoints,
  todayCaption,
  trendScale,
  trendSummaryLine,
  waitedLabel,
} from './model';

const row = (over: Partial<LakeOperatorStats['today'][number]> = {}): LakeOperatorStats['today'][number] => ({
  standName: '1',
  anglerName: 'Ion',
  anglerAvatar: null,
  startDate: new Date(2026, 9, 9, 6).toISOString(),
  endDate: new Date(2026, 9, 10, 6).toISOString(),
  bookingStatus: 'confirmed',
  priceTotal: 150,
  noShow: false,
  code: 'A1',
  ...over,
});

const pt = (date: string, booked: number, cash: number, bookings = 0, total = 21): OperatorTrendPoint => ({ date, booked, total, cash, bookings });

describe('operator.panou model', () => {
  it('c1 caption: device-local weekday d MMM', () => {
    expect(todayCaption(new Date(2026, 9, 4, 23, 30))).toBe('Azi, duminică 4 oct');
    expect(todayCaption(new Date(2026, 9, 9, 0, 5))).toBe('Azi, vineri 9 oct');
  });

  it('c15 day-time: capitalised 2-letter weekday + HH:mm', () => {
    expect(dayTime(new Date(2026, 9, 5, 6, 0).toISOString())).toBe('Lu 06:00');
    expect(dayTime(new Date(2026, 9, 3, 18, 30).toISOString())).toBe('Sâ 18:30');
  });

  it('c9 age labels and the subtitle parts', () => {
    expect(waitedLabel(null)).toBeNull();
    expect(waitedLabel(25)).toBe('de 25 min');
    expect(waitedLabel(60)).toBe('de 1 oră');
    expect(waitedLabel(6 * 60 + 10)).toBe('de 6 ore');
    expect(waitedLabel(23 * 60)).toBe('de 23 de ore');
    expect(waitedLabel(24 * 60)).toBe('de 1 zi');
    expect(waitedLabel(3 * 24 * 60)).toBe('de 3 zile');
    expect(pendingSubtitle(null)).toBe('Nu sunt confirmate până le răspunzi');
    expect(pendingSubtitle({ anglerName: 'Mihai', standName: '7', waitingMinutes: 125 })).toBe('Mihai · standul 7 · de 2 ore');
    expect(pendingSubtitle({ anglerName: null, standName: null, waitingMinutes: null })).toBe('Pescar');
  });

  it('c8 c20 c21 c13 titles with Romanian plurals', () => {
    expect(pendingTitle(1)).toBe('1 cerere așteaptă răspuns');
    expect(pendingTitle(3)).toBe('3 cereri așteaptă răspuns');
    expect(pendingTitle(120)).toBe('120 de cereri așteaptă răspuns');
    expect(cancelledTitle(1)).toBe('1 rezervare anulată de un pescar');
    expect(cancelledTitle(2)).toBe('2 rezervări anulate de pescari');
    expect(reviewTitle(1)).toBe('1 partidă de evaluat');
    expect(reviewTitle(4)).toBe('4 partide de evaluat');
    expect(seeAllLabel(6)).toBe('Vezi toate (6 standuri)');
    expect(seeAllLabel(21)).toBe('Vezi toate (21 de standuri)');
  });

  it('c6 Rezervări goes to the requests only while some wait', () => {
    expect(panelLinks('L', 2).bookings).toBe('/operator/L/rezervari?status=pending');
    expect(panelLinks('L', 0).bookings).toBe('/operator/L/rezervari');
    expect(panelLinks('L', 0).calendar).toBe('/operator/L/calendar');
    expect(panelLinks('L', 0).blocks).toBe('/operator/L/blocaje');
    expect(panelLinks('L', 0).cancelled).toBe('/operator/L/rezervari?status=cancelled');
    expect(panelLinks('L', 0).toReview).toBe('/operator/L/rezervari?status=toreview');
  });

  it('c22 occupancy: now, else today, else 0/0', () => {
    const byDay = [{ date: '2026-10-08', booked: 1, total: 21 }, { date: '2026-10-09', booked: 4, total: 21 }];
    expect(occupancyFigure({ occupancyNow: { booked: 2, total: 21 }, occupancyByDay: byDay })).toEqual({ booked: 2, total: 21, label: 'Standuri ocupate acum' });
    expect(occupancyFigure({ occupancyByDay: byDay })).toEqual({ booked: 4, total: 21, label: 'Standuri ocupate azi' });
    expect(occupancyFigure({ occupancyByDay: [] })).toEqual({ booked: 0, total: 0, label: 'Standuri ocupate azi' });
  });

  it('c23 c24 cash: server figure, client fallback, sub-line variants', () => {
    const now = new Date(2026, 9, 9, 12).getTime();
    expect(cashFigure({ deIncasatAzi: 300, deIncasat7z: 1250, today: [row()] }, now)).toEqual({ today: 300, subline: 'Următoarele 7 zile: 1.250 lei (azi inclus)' });
    // Older CMS: today's confirmed arrivals, not a no-show.
    expect(cashFigure({ today: [row(), row({ noShow: true }), row({ bookingStatus: 'pending' })] }, now).today).toBe(150);
    expect(cashFigure({ deIncasatAzi: 0, deIncasat7z: 0, today: [] }, now).subline).toBe('Nicio sosire azi');
    expect(cashFigure({ deIncasatAzi: 0, deIncasat7z: 0, today: [row()] }, now).subline).toBe('Totul e achitat');
    expect(cashFigure({ deIncasatAzi: 150, today: [row()] }, now).subline).toBeNull();
  });

  it('c17 money column and c16 dimming', () => {
    expect(moneyColumn({ priceTotal: 1250, balanceDue: 1250 }, 'live')).toEqual({ total: '1.250 lei', pill: { label: 'Numerar', tone: 'success' } });
    expect(moneyColumn({ priceTotal: 150, balanceDue: 0 }, 'next')).toEqual({ total: '150 lei', pill: { label: 'Plătit', tone: 'info' } });
    expect(moneyColumn({ priceTotal: 150, balanceDue: 150 }, 'noshow')).toEqual({ total: '150 lei', pill: { label: 'N-a venit', tone: 'danger' } });
    expect(moneyColumn({ priceTotal: 0 }, 'live')).toEqual({ total: null, pill: null });
    expect(isDimmed('done')).toBe(true);
    expect(isDimmed('noshow')).toBe(true);
    expect(isDimmed('live')).toBe(false);
  });

  it('c27 y axis: occupancy on the stands, cash on its busiest bucket, whole labels; points up to 12', () => {
    const week = [pt('2026-10-05', 3, 450), pt('2026-10-06', 1, 1300)];
    expect(trendScale(week, 'occupancy')).toEqual({ max: 24, ticks: [0, 8, 16, 24] });
    expect(trendScale(week, 'cash')).toEqual({ max: 1500, ticks: [0, 500, 1000, 1500] });
    expect(showAllPoints(12)).toBe(true);
    expect(showAllPoints(31)).toBe(false);
  });

  it('c29 scrub header per window', () => {
    expect(scrubHeader(pt('2026-10-09', 3, 450), 'week')).toBe('vineri 9 oct · 3/21 · 450 lei');
    expect(scrubHeader(pt('2026-10-09', 3, 1450), 'month')).toBe('9 oct · 3/21 · 1.450 lei');
    expect(scrubHeader(pt('2026-10', 0, 12500, 1), 'year')).toBe('Octombrie · 1 rezervare · 12.500 lei');
    expect(scrubHeader(pt('2026-09', 0, 12500, 24), 'year')).toBe('Septembrie · 24 de rezervări · 12.500 lei');
  });

  it('c30 summary line', () => {
    expect(trendSummaryLine('week', null)).toBe('Săptămâna asta');
    expect(trendSummaryLine('month', { cash: 1250.4, bookings: 1, occupancyAvgPct: 12 })).toBe('Luna asta · 12% ocupare medie · 1.250 lei · 1 rezervare');
    expect(trendSummaryLine('year', { cash: 0, bookings: 21, occupancyAvgPct: 3 })).toBe('Anul acesta · 3% ocupare medie · 0 lei · 21 de rezervări');
  });

  it('c3 c4 c26 view: spinner, error, kept data on a failed refetch / window', () => {
    const data = { pending: 0 } as LakeOperatorStats;
    expect(panelView({ fresh: undefined, settled: null, window: 'week', isError: false, error: null })).toEqual({ kind: 'loading' });
    expect(panelView({ fresh: undefined, settled: null, window: 'week', isError: true, error: 'x' })).toEqual({ kind: 'error', error: 'x' });
    expect(panelView({ fresh: data, settled: null, window: 'month', isError: false, error: null })).toEqual({ kind: 'data', data, window: 'month', trendFailed: false });
    expect(panelView({ fresh: undefined, settled: { window: 'week', data }, window: 'year', isError: true, error: 'x' })).toEqual({ kind: 'data', data, window: 'week', trendFailed: true });
    expect(panelView({ fresh: undefined, settled: { window: 'week', data }, window: 'year', isError: false, error: null })).toEqual({ kind: 'data', data, window: 'week', trendFailed: false });
  });
});
