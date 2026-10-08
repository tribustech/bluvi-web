import { describe, expect, it } from 'vitest';
// Ported from fish `features/partide/helpers/__tests__/patterns.test.ts` (+ the web helpers).
import {
  computeArrivalRecap,
  computeBaitRanking,
  computeCombos,
  computeHotZone,
  computeTripStats,
  computeVenuePatterns,
  eventHeatmapByHour,
  scopeEvents,
} from '../patterns';
import type { LocalEvent, LocalSession } from '../types';

const DAY = 86_400_000;
const NOW = 1_751_800_000_000;

const mkSession = (over: Partial<LocalSession>): LocalSession => ({
  clientId: 's1', serverId: null, syncStatus: 'synced', clientUpdatedAt: 1,
  venueType: 'lake', lakeId: 'lake-9', lakeName: 'Roveng', publicWaterCode: null,
  publicWaterName: null, manualVenueName: null, standId: null, standName: null,
  locality: null,
  anchorLat: 44.4300, anchorLng: 26.0100, anchorName: null,
  startedAt: NOW - 10 * DAY, endedAt: NOW - 9 * DAY, warnedAt: null, autoCloseAt: null, plannedDurationMs: DAY, notes: null,
  targetSpecies: [], rods: [], rodRuntimes: [], detailsHydrated: true, visibleOnProfile: true,
  projectionRev: 0, ...over,
});

const mkEvent = (over: Partial<LocalEvent>): LocalEvent => ({
  clientId: Math.random().toString(36).slice(2), serverId: null, serverNumericId: null,
  syncStatus: 'synced', clientUpdatedAt: 1, sessionClientId: 's1',
  outcome: 'capture', rodIndex: 1, rodLabel: 'L1', rodColor: '#fff',
  bait: 'Boilies Squid', baitType: 'boilies', baitSize: 20, baitFlavor: 'squid',
  lane: 'center', distance: 65, lat: null, lng: null, weightKg: 5, weightEstimated: false, species: 'Crap', speciesId: null,
  photoLocalUri: null, photoUploadStatus: 'none', photoUrl: null, notes: null,
  occurredAt: NOW - 9.5 * DAY, ...over,
});

describe('scopeEvents', () => {
  const anchorNear = { lat: 44.43005, lng: 26.01005 };  // ~7m away
  const sFar = mkSession({ clientId: 's2', anchorLat: 44.4400, anchorLng: 26.0200 }); // ~1.4km away
  const sessions = [mkSession({}), sFar];
  const events = [mkEvent({}), mkEvent({ sessionClientId: 's2' })];

  it('lake venue: venue-wide events, anchor-scoped subset by proximity', () => {
    const r = scopeEvents(sessions, events, { venueType: 'lake', lakeId: 'lake-9' }, anchorNear);
    expect(r.venueEvents).toHaveLength(2);
    expect(r.anchorEvents).toHaveLength(1);
    expect(r.anchorEvents[0].sessionClientId).toBe('s1');
    expect(r.sessionCount).toBe(2);
  });

  it('pin venue: everything scoped to the pin radius', () => {
    const r = scopeEvents(sessions, events, { venueType: 'pin', anchor: anchorNear });
    expect(r.venueEvents).toHaveLength(1);
    expect(r.venueEvents).toEqual(r.anchorEvents);
  });
});

describe('computeCombos', () => {
  it('requires MIN_CYCLES_TO_QUALIFY cycles and ranks by recency-weighted captures', () => {
    const oldWins = [0, 1, 2, 3].map(i => mkEvent({ baitType: 'boilies', occurredAt: NOW - 400 * DAY - i }));
    const freshPair = [0, 1, 2].map(i => mkEvent({ baitType: 'pop_up', bait: 'Pop-up', occurredAt: NOW - 1 * DAY - i }));
    const single = [mkEvent({ baitType: 'pellets', bait: 'Pellets' })]; // 1 cycle → filtered out
    const combos = computeCombos([...oldWins, ...freshPair, ...single], NOW);
    expect(combos.find(c => c.baitKey.startsWith('pellets'))).toBeUndefined();
    // 3 fresh captures outweigh 4 year-old ones with a 90-day half-life
    // (grouping key is now the free-text bait name, not the taxonomy type)
    expect(combos[0].baitKey).toContain('pop-up');
  });

  it('groups by free-text bait name (case-insensitive), collapsing casing variants', () => {
    const casingVariants = [
      mkEvent({ bait: 'Tigernut', baitType: 'boilies', baitSize: 20 }),
      mkEvent({ bait: 'tigernut', baitType: 'boilies', baitSize: 20 }),
      mkEvent({ bait: ' TIGERNUT ', baitType: 'boilies', baitSize: 20 }),
    ];
    const combos = computeCombos(casingVariants, NOW);
    expect(combos).toHaveLength(1);
    expect(combos[0].captures).toBe(3);
    expect(combos[0].baitKey).toBe('tigernut');
    // label preserves the first occurrence's casing, not the taxonomy label
    expect(combos[0].baitLabel).toBe('Tigernut');
  });

  it('named bait beats stale/drifted taxonomy — same name still groups together even when baitType/baitSize disagree', () => {
    const events = [
      mkEvent({ bait: 'Squid Boilie', baitType: 'boilies', baitSize: 20 }),
      mkEvent({ bait: 'Squid Boilie', baitType: 'pellets', baitSize: 15 }), // drifted taxonomy
      mkEvent({ bait: 'Squid Boilie', baitType: null, baitSize: null }), // no taxonomy at all
    ];
    const combos = computeCombos(events, NOW);
    expect(combos).toHaveLength(1);
    expect(combos[0].captures).toBe(3);
    expect(combos[0].baitKey).toBe('squid boilie');
    expect(combos[0].baitLabel).toBe('Squid Boilie');
  });

  it('falls back to taxonomy (baitType+baitSize) when no free-text name was given', () => {
    const events = [0, 1, 2].map(() => mkEvent({ bait: '', baitType: 'wafters', baitSize: 16 }));
    const combos = computeCombos(events, NOW);
    expect(combos).toHaveLength(1);
    expect(combos[0].baitKey).toBe('wafters:16');
    expect(combos[0].baitLabel).toBe('Wafters 16');
  });

  it('falls back to "altele" when neither a free-text name nor taxonomy is present', () => {
    const events = [0, 1, 2].map(() => mkEvent({ bait: '   ', baitType: null, baitSize: null }));
    const combos = computeCombos(events, NOW);
    expect(combos).toHaveLength(1);
    expect(combos[0].baitKey).toBe('altele');
    expect(combos[0].baitLabel).toBe('Necunoscută');
  });

  it('buckets geodesic distance when lat/lng present', () => {
    const anchoredAt = { lat: 44.43, lng: 26.01 };
    const events = [0, 1, 2].map(() => mkEvent({ lat: 44.43055, lng: 26.01, distance: 999 })); // ~61m north
    const combos = computeCombos(events, NOW, anchoredAt);
    expect(combos[0].band).toBe('60–65 m');
  });

  it('falls back to rod distance without coordinates', () => {
    const combos = computeCombos([0, 1, 2].map(() => mkEvent({ distance: 63 })), NOW);
    expect(combos[0].band).toBe('60–65 m');
  });
});

describe('computeArrivalRecap', () => {
  it('tier 1 always; tier 2 spatial line only with enough anchor history', () => {
    const venueEvents = [0, 1, 2].map(i => mkEvent({ occurredAt: NOW - DAY + i * 3_600_000 }));
    const recap = computeArrivalRecap({ venueEvents, anchorEvents: [], sessionCount: 2 }, NOW);
    expect(recap.bestBait).toBeTruthy();
    expect(recap.bestHours).toMatch(/–/);
    expect(recap.spatialLine).toBeNull();
    expect(recap.sessionCount).toBe(2);

    const withAnchor = computeArrivalRecap({ venueEvents, anchorEvents: venueEvents, sessionCount: 2 }, NOW);
    expect(withAnchor.spatialLine).toBeTruthy();
  });

  it('is all-null on no history', () => {
    const recap = computeArrivalRecap({ venueEvents: [], anchorEvents: [], sessionCount: 0 }, NOW);
    expect(recap.bestBait).toBeNull();
  });
});

describe('computeHotZone', () => {
  it('finds the densest cluster of positioned bites', () => {
    const cluster = [0, 1, 2, 3].map(i => mkEvent({ lat: 44.43050 + i * 0.00002, lng: 26.01 }));
    const stray = [mkEvent({ lat: 44.44, lng: 26.02 })];
    const hz = computeHotZone([...cluster, ...stray]);
    expect(hz!.count).toBe(4);
    expect(hz!.lat).toBeCloseTo(44.4305, 3);
  });

  it('is null under 3 positioned bites', () => {
    expect(computeHotZone([mkEvent({ lat: 44.43, lng: 26.01 })])).toBeNull();
    expect(computeHotZone([mkEvent({})])).toBeNull(); // blanks/unpositioned don't count
  });
});

describe('computeBaitRanking', () => {
  it('aggregates on bait name only — distance is not part of the identity', () => {
    const rows = computeBaitRanking([
      mkEvent({ bait: 'Porumb', distance: 40, weightKg: 4 }),
      mkEvent({ bait: 'Porumb', distance: 80, weightKg: 6 }), // different band, same bait → one row
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ baitLabel: 'Porumb', captures: 2, maxKg: 6 });
    expect(rows[0].avgKg).toBeCloseTo(5);
  });

  it('folds casing into one group but keeps the first-seen label', () => {
    const rows = computeBaitRanking([
      mkEvent({ bait: 'Tigernut', weightKg: 3 }),
      mkEvent({ bait: 'tigernut', weightKg: 5 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].baitLabel).toBe('Tigernut');
    expect(rows[0].captures).toBe(2);
  });

  it('ranks by captures then max, and lists every bait with a capture (no minimum-cycle bar)', () => {
    const rows = computeBaitRanking([
      mkEvent({ bait: 'Boilies', weightKg: 8 }),                 // 1 capture, max 8
      mkEvent({ bait: 'Porumb', weightKg: 2 }),                  // 2 captures → ranks first
      mkEvent({ bait: 'Porumb', weightKg: 3 }),
    ]);
    expect(rows.map(r => r.baitLabel)).toEqual(['Porumb', 'Boilies']);
  });

  it('counts only landed captures — lost and blank are ignored', () => {
    const rows = computeBaitRanking([
      mkEvent({ bait: 'Porumb', outcome: 'capture', weightKg: 4 }),
      mkEvent({ bait: 'Porumb', outcome: 'lost', weightKg: null }),
      mkEvent({ bait: 'Porumb', outcome: 'blank', weightKg: null }),
    ]);
    expect(rows[0].captures).toBe(1);
  });

  it('leaves avg/max null when no capture in the group carried a weight', () => {
    const rows = computeBaitRanking([mkEvent({ bait: 'Porumb', weightKg: null })]);
    expect(rows[0]).toMatchObject({ captures: 1, avgKg: null, maxKg: null });
  });
});

describe('computeTripStats', () => {
  it('aggregates captures, record, total, rate, best rod, dominant species', () => {
    const events = [
      mkEvent({ rodIndex: 1, weightKg: 6.4, species: 'Crap' }),
      mkEvent({ rodIndex: 2, weightKg: 3.0, species: 'Crap' }),
      mkEvent({ rodIndex: 2, weightKg: 2.0, species: 'Somn' }),
      mkEvent({ outcome: 'lost', weightKg: null }),
      mkEvent({ outcome: 'blank', weightKg: null }),
    ];
    const s = computeTripStats(events, 2 * 3_600_000);
    expect(s.captures).toBe(3);
    expect(s.recordKg).toBe(6.4);
    expect(s.totalKg).toBeCloseTo(11.4);
    expect(s.capturesPerHour).toBeCloseTo(1.5);
    expect(s.bestRodIndex).toBe(2);
    expect(s.dominantSpecies).toBe('Crap');
    expect(s.capturesByRod).toEqual({ 1: 1, 2: 2 });
  });

  it('is safe on an empty trip', () => {
    const s = computeTripStats([], 0);
    expect(s).toMatchObject({ captures: 0, recordKg: null, totalKg: 0, capturesPerHour: null, bestRodIndex: null, dominantSpecies: null });
  });
});

describe('eventHeatmapByHour (fish StatisticiScene tripHeatmap / usePatterns heatmapByHour)', () => {
  it('counts captures and lost fish by local hour, never blanks', () => {
    const at = (h: number) => new Date(2026, 9, 7, h, 30).getTime();
    const hours = eventHeatmapByHour([
      mkEvent({ outcome: 'capture', occurredAt: at(5) }),
      mkEvent({ outcome: 'lost', occurredAt: at(5) }),
      mkEvent({ outcome: 'blank', occurredAt: at(5) }),
      mkEvent({ outcome: 'capture', occurredAt: at(23) }),
    ]);
    expect(hours).toHaveLength(24);
    expect(hours[5]).toBe(2);
    expect(hours[23]).toBe(1);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('computeVenuePatterns (fish usePatterns)', () => {
  it('scopes to the venue, then recap + ranking + heatmap over the venue events', () => {
    const sessions = [mkSession({}), mkSession({ clientId: 's2' }), mkSession({ clientId: 's3', lakeId: 'other' })];
    const events = [
      ...[0, 1, 2].map(i => mkEvent({ bait: 'Porumb', occurredAt: NOW - DAY + i })),
      mkEvent({ sessionClientId: 's2', bait: 'Boilies', weightKg: 9 }),
      mkEvent({ sessionClientId: 's3', bait: 'Viermi' }),
    ];
    const p = computeVenuePatterns(sessions, events, { venueType: 'lake', lakeId: 'lake-9' }, undefined, NOW);
    expect(p.recap.sessionCount).toBe(2);
    expect(p.recap.bestBait).toBe('Porumb');
    expect(p.recap.bestBand).toBe('65–70 m');
    expect(p.baitRanking.map(r => r.baitLabel)).toEqual(['Porumb', 'Boilies']);
    expect(p.heatmapByHour.reduce((a, b) => a + b, 0)).toBe(4);
    expect(p.eventCount).toBe(4);
  });

  it('a venue with no session: zero sessions, every recap field null', () => {
    const p = computeVenuePatterns([mkSession({})], [mkEvent({})], { venueType: 'lake', lakeId: 'none' }, undefined, NOW);
    expect(p.recap).toEqual({ bestBait: null, bestBand: null, bestHours: null, spatialLine: null, sessionCount: 0 });
    expect(p.baitRanking).toEqual([]);
  });

  it('public water: the code AND the 40 m anchor radius', () => {
    const anchor = { lat: 44.43, lng: 26.01 };
    const sessions = [
      mkSession({ venueType: 'publicWater', lakeId: null, publicWaterCode: 'RO1' }),
      mkSession({ clientId: 's2', venueType: 'publicWater', lakeId: null, publicWaterCode: 'RO1', anchorLat: 44.44 }),
    ];
    const r = scopeEvents(sessions, [], { venueType: 'publicWater', publicWaterCode: 'RO1' }, anchor);
    expect(r.sessionCount).toBe(1);
  });
});
