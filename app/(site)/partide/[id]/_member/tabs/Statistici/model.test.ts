import { describe, expect, it } from 'vitest';
import type { LocalEvent, LocalSession } from '@/core/partide';
import { anyWeighed, bandTile, kgTile, tripStatsOf, venueScope, venueSiblings } from './model';

const H = 3_600_000;
const NOW = new Date(2026, 9, 7, 15, 0).getTime();

const session = (patch: Partial<LocalSession> = {}): LocalSession =>
  ({
    clientId: 'cur',
    serverId: 'doc-cur',
    venueType: 'lake',
    lakeId: 'lake-1',
    publicWaterCode: null,
    anchorLat: 44.43,
    anchorLng: 26.01,
    startedAt: NOW - 3 * H,
    endedAt: null,
    rods: [],
    ...patch,
  }) as LocalSession;

const ev = (patch: Partial<LocalEvent> = {}): LocalEvent =>
  ({
    clientId: Math.random().toString(36).slice(2),
    sessionClientId: 'cur',
    outcome: 'capture',
    rodIndex: 1,
    bait: 'Porumb',
    baitType: null,
    baitSize: null,
    distance: 60,
    lat: null,
    lng: null,
    weightKg: 4,
    species: 'Crap',
    occurredAt: NOW - H,
    ...patch,
  }) as LocalEvent;

describe('venueSiblings (c7: the viewer’s own partide at the same venue)', () => {
  it('same lake only, never the current one, newest first; rows without a documentId are left out', () => {
    const list = [
      session(), // the current one, as the list carries it
      session({ clientId: 'a', serverId: 'doc-a', startedAt: NOW - 50 * H }),
      session({ clientId: 'b', serverId: 'doc-b', startedAt: NOW - 20 * H }),
      session({ clientId: 'c', serverId: 'doc-c', lakeId: 'other' }),
      session({ clientId: 'd', serverId: null }),
    ];
    const r = venueSiblings(list, session(), 'doc-cur');
    expect(r.all.map(s => s.clientId)).toEqual(['b', 'a']);
    expect(r.toRead.map(s => s.clientId)).toEqual(['b', 'a']);
  });

  it('a pin: within 40 m of the anchor', () => {
    const pin = session({ venueType: 'pin', lakeId: null });
    const list = [
      session({ clientId: 'near', serverId: 'n', venueType: 'pin', lakeId: null, anchorLat: 44.43005 }), // ~6 m
      session({ clientId: 'far', serverId: 'f', venueType: 'pin', lakeId: null, anchorLat: 44.44 }), // ~1.1 km
    ];
    expect(venueSiblings(list, pin, 'doc-cur').all.map(s => s.clientId)).toEqual(['near']);
  });

  it('caps the detail reads (the current partidă counts as one)', () => {
    const list = Array.from({ length: 30 }, (_, i) => session({ clientId: `s${i}`, serverId: `d${i}`, startedAt: NOW - (i + 5) * H }));
    const r = venueSiblings(list, session(), 'doc-cur', 20);
    expect(r.all).toHaveLength(30);
    expect(r.toRead).toHaveLength(19);
    expect(r.toRead[0].clientId).toBe('s0');
  });
});

describe('venueScope (fish usePatterns over the partide read)', () => {
  it('counts every partidă at the venue; bait ranking, recap and heatmap over all their events', () => {
    const siblings = [session({ clientId: 'a', serverId: 'doc-a' }), session({ clientId: 'b', serverId: 'doc-b' })];
    const p = venueScope(
      session(),
      [ev({ bait: 'Boilies', weightKg: 9 })],
      siblings,
      [0, 1, 2].map(() => ev({ sessionClientId: 'a', bait: 'Porumb' })),
      NOW,
    );
    expect(p.recap.sessionCount).toBe(3);
    expect(p.recap.bestBait).toBe('Porumb');
    expect(p.recap.bestBand).toBe('60–65 m');
    expect(p.baitRanking.map(r => r.baitLabel)).toEqual(['Porumb', 'Boilies']);
    expect(p.heatmapByHour[new Date(NOW - H).getHours()]).toBe(4);
  });

  it('too little history: «—» material (no combo reaches 3 events)', () => {
    const p = venueScope(session(), [ev()], [], [], NOW);
    expect(p.recap).toMatchObject({ sessionCount: 1, bestBait: null, bestBand: null });
    expect(p.recap.bestHours).not.toBeNull();
  });
});

describe('tile values', () => {
  it('tripStatsOf: elapsed from the start to the end (or now)', () => {
    expect(tripStatsOf(session(), [ev(), ev({ outcome: 'lost' })], NOW).capturesPerHour).toBeCloseTo(1 / 3);
  });
  it('kgTile: comma kg + unit, «—» when nothing was weighed', () => {
    expect(kgTile(6.45, true)).toEqual({ value: '6,45', unit: 'kg' });
    expect(kgTile(null, false)).toEqual({ value: '—' });
    expect(kgTile(0, false)).toEqual({ value: '—' });
  });
  it('anyWeighed: a weighed capture only', () => {
    expect(anyWeighed([ev({ weightKg: null }), ev({ outcome: 'lost', weightKg: 3 })])).toBe(false);
    expect(anyWeighed([ev()])).toBe(true);
  });
  it('bandTile: the figure apart from «m»', () => {
    expect(bandTile('60–65 m')).toEqual({ value: '60–65', unit: 'm' });
    expect(bandTile(null)).toEqual({ value: '—' });
  });
});
