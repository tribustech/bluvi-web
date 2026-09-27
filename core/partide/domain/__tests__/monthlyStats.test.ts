import { describe, it, expect } from 'vitest';
import { monthlyStats } from '../monthlyStats';
import type { LocalSession } from '../types';
import type { Aggregate } from '../historyView';

const sess = (over: Partial<LocalSession>): LocalSession =>
  ({
    clientId: 'x',
    lakeName: null,
    publicWaterName: null,
    manualVenueName: null,
    anchorName: null,
    startedAt: 0,
    endedAt: null,
    rods: [],
    venueType: 'lake',
    standName: null,
    locality: null,
    detailsHydrated: true,
    ...over,
  } as unknown as LocalSession);

const aggMap = (m: Record<string, Partial<Aggregate>>): Record<string, Aggregate> =>
  Object.fromEntries(
    Object.entries(m).map(([k, v]) => [
      k,
      { captures: 0, recordKg: null, totalKg: 0, photoUri: null, photoUris: [], photos: [], ...v },
    ])
  );

describe('monthlyStats', () => {
  it('buckets sessions into the last 7 calendar months across a year boundary', () => {
    const now = new Date(2026, 0, 15); // 15 Jan 2026 — window is Jul 2025..Jan 2026
    const sessions = [
      sess({ clientId: 'a', startedAt: new Date(2025, 11, 20).getTime(), endedAt: new Date(2025, 11, 20, 2).getTime() }), // Dec 2025
      sess({ clientId: 'b', startedAt: new Date(2026, 0, 5).getTime(), endedAt: new Date(2026, 0, 5, 3).getTime() }), // Jan 2026
      sess({ clientId: 'old', startedAt: new Date(2025, 4, 1).getTime(), endedAt: new Date(2025, 4, 1, 1).getTime() }), // May 2025 — outside window
    ];
    const aggregates = aggMap({ a: { captures: 2 }, b: { captures: 3 }, old: { captures: 99 } });

    const result = monthlyStats(sessions, aggregates, now);

    expect(result.months.map(m => m.label)).toEqual(['IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC', 'IAN']);
    expect(result.months.map(m => m.count)).toEqual([0, 0, 0, 0, 0, 2, 3]);
  });

  it('sums hours from ended sessions only, ignoring open sessions', () => {
    const now = new Date(2026, 6, 21);
    const sessions = [
      sess({ clientId: 'ended1', startedAt: 0, endedAt: 4 * 3_600_000 }), // 4h
      sess({ clientId: 'ended2', startedAt: 0, endedAt: 2 * 3_600_000 }), // 2h
      sess({ clientId: 'open', startedAt: 0, endedAt: null }), // never-ended — excluded
    ];
    const aggregates = aggMap({});

    const result = monthlyStats(sessions, aggregates, now);

    expect(result.totalHours).toBe(6);
    expect(result.avgHoursPerPartida).toBe(3); // 6h / 2 ended sessions, NOT 3
  });

  it('picks the best catch across aggregates by recordKg and reports its venue', () => {
    const now = new Date(2026, 6, 21);
    const sessions = [
      sess({ clientId: 'a', lakeName: 'Vidraru', startedAt: 0, endedAt: 1 }),
      sess({ clientId: 'b', lakeName: 'Tineretului', startedAt: 0, endedAt: 1 }),
    ];
    const aggregates = aggMap({ a: { recordKg: 3.1 }, b: { recordKg: 4.9 } });

    const result = monthlyStats(sessions, aggregates, now);

    expect(result.bestCatch).toEqual({ weightKg: 4.9, species: null, venueName: 'Tineretului' });
  });

  it('returns zeroed months and null stats for an empty history', () => {
    const now = new Date(2026, 6, 21);

    const result = monthlyStats([], {}, now);

    expect(result.months).toHaveLength(7);
    expect(result.months.every(m => m.count === 0)).toBe(true);
    expect(result.months.map(m => m.label)).toEqual(['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL']);
    expect(result.bestCatch).toBeNull();
    expect(result.totalHours).toBe(0);
    expect(result.avgHoursPerPartida).toBeNull();
  });
});
