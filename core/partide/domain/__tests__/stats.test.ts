import { describe, it, expect } from 'vitest';
import { computeHourHeatmap, computeLeaderboard, computeRodStats, distanceBand, heatLevel, isBite } from '../stats';
import type { SessionEvent } from '../types';

const ev = (over: Partial<SessionEvent>): SessionEvent => ({
  id: Math.random().toString(36).slice(2),
  outcome: 'capture',
  rodIndex: 1,
  rodLabel: 'Lanseta 1',
  rodColor: '#F43F5E',
  bait: 'Boilies 20mm',
  lane: 'center',
  distance: 65,
  occurredAt: new Date(2025, 0, 1, 8, 0, 0).getTime(),
  ...over,
});

describe('distanceBand', () => {
  it('buckets to 5 m bands', () => {
    expect(distanceBand(63)).toBe('60–65 m');
    expect(distanceBand(65)).toBe('65–70 m');
    expect(distanceBand(68)).toBe('65–70 m');
  });
  it('honours a custom band size', () => {
    expect(distanceBand(63, 10)).toBe('60–70 m');
  });
});

describe('isBite', () => {
  it('counts capture + lost, not blank', () => {
    expect(isBite(ev({ outcome: 'capture' }))).toBe(true);
    expect(isBite(ev({ outcome: 'lost' }))).toBe(true);
    expect(isBite(ev({ outcome: 'blank' }))).toBe(false);
  });
});

describe('computeLeaderboard', () => {
  it('groups by bait × distance-band and ranks by count then max', () => {
    const events = [
      ev({ bait: 'Boilies 20mm', distance: 63, weightKg: 6 }),
      ev({ bait: 'Boilies 20mm', distance: 62, weightKg: 4 }), // same band 60–65
      ev({ bait: 'Pop-up 16mm', distance: 40, weightKg: 9 }),
      ev({ outcome: 'blank', bait: 'Boilies 20mm', distance: 63 }), // ignored (not capture)
    ];
    const rows = computeLeaderboard(events);
    expect(rows[0]).toMatchObject({ bait: 'Boilies 20mm', distanceBand: '60–65 m', count: 2, max: 6 });
    expect(rows[0].avg).toBeCloseTo(5, 5);
    expect(rows[1]).toMatchObject({ bait: 'Pop-up 16mm', count: 1, max: 9 });
  });

  it('falls back to "Altele" for empty bait', () => {
    const rows = computeLeaderboard([ev({ bait: '', weightKg: 3 })]);
    expect(rows[0].bait).toBe('Altele');
  });

  it('returns [] with no captures', () => {
    expect(computeLeaderboard([ev({ outcome: 'lost' })])).toEqual([]);
  });

  it('a weightless capture counts but does not drag the average down', () => {
    const rows = computeLeaderboard([
      ev({ outcome: 'capture', bait: 'Boilies', distance: 60, weightKg: 4 }),
      ev({ outcome: 'capture', bait: 'Boilies', distance: 60, weightKg: undefined }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
    expect(rows[0].avg).toBe(4);
    expect(rows[0].max).toBe(4);
  });

  it('a group with no weighed capture at all reports zero, not NaN or -Infinity', () => {
    const rows = computeLeaderboard([ev({ outcome: 'capture', bait: 'Porumb', distance: 30, weightKg: undefined })]);
    expect(rows[0].count).toBe(1);
    expect(rows[0].avg).toBe(0);
    expect(rows[0].max).toBe(0);
  });
});

describe('computeHourHeatmap', () => {
  it('buckets bites by hour-of-day, ignoring blanks', () => {
    const events = [
      ev({ occurredAt: new Date(2025, 0, 1, 8, 10).getTime() }),
      ev({ outcome: 'lost', occurredAt: new Date(2025, 0, 1, 8, 50).getTime() }),
      ev({ occurredAt: new Date(2025, 0, 1, 20, 0).getTime() }),
      ev({ outcome: 'blank', occurredAt: new Date(2025, 0, 1, 8, 0).getTime() }),
    ];
    const hours = computeHourHeatmap(events);
    expect(hours).toHaveLength(24);
    expect(hours[8]).toBe(2);
    expect(hours[20]).toBe(1);
    expect(hours[0]).toBe(0);
  });
});

describe('heatLevel', () => {
  it('maps value/max to 0–4 buckets', () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(2, 10)).toBe(1);
    expect(heatLevel(5, 10)).toBe(2);
    expect(heatLevel(7, 10)).toBe(3);
    expect(heatLevel(10, 10)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });
});

describe('computeRodStats', () => {
  const lev = (over: Partial<import('../../domain/types').LocalEvent>): import('../../domain/types').LocalEvent => ({
    clientId: Math.random().toString(36).slice(2),
    serverId: null,
    serverNumericId: null,
    syncStatus: 'pending',
    clientUpdatedAt: 1,
    sessionClientId: 's1',
    outcome: 'capture',
    rodIndex: 1,
    rodLabel: 'L1',
    rodColor: '#fff',
    bait: 'Boilies',
    baitType: null,
    baitSize: null,
    baitFlavor: null,
    lane: 'center',
    distance: 60,
    lat: null,
    lng: null,
    weightKg: null,
    weightEstimated: false,
    species: null,
    speciesId: null,
    photoLocalUri: null,
    photoUploadStatus: 'none',
    photoUrl: null,
    notes: null,
    occurredAt: 1,
    ...over,
  });

  it('tallies captures/bites/bestKg only for the given rod (blanks are not bites)', () => {
    const events = [
      lev({ rodIndex: 1, outcome: 'capture', weightKg: 4.2 }),
      lev({ rodIndex: 1, outcome: 'capture', weightKg: 6.1 }),
      lev({ rodIndex: 1, outcome: 'lost' }),
      lev({ rodIndex: 1, outcome: 'blank' }),
      lev({ rodIndex: 2, outcome: 'capture', weightKg: 9.9 }), // other rod — ignored
      lev({ rodIndex: null, outcome: 'capture', weightKg: 8.0 }), // rod-less — ignored
    ];
    expect(computeRodStats(events, 1)).toEqual({ captures: 2, bites: 3, bestKg: 6.1 });
  });

  it('returns the empty tally for a rod with no events', () => {
    expect(computeRodStats([lev({ rodIndex: 2 })], 1)).toEqual({ captures: 0, bites: 0, bestKg: null });
  });
});
