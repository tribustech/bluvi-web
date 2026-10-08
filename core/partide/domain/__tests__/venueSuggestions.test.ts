import { describe, expect, it } from 'vitest';
import type { LakeCard, LakeIndexEntry } from '../../../lakes/schemas';
import type { PublicWaterListItem } from '../../../lakes/domain/publicWaters';
import type { SessionListItemDTO } from '../../schemas';
import {
  buildNearbySuggestions,
  buildRandomSuggestions,
  buildRecentSuggestions,
  buildVenueSections,
  formatDistanceLabel,
  recentVenueSessionOf,
  type RecentVenueSession,
} from '../venueSuggestions';
import { lakeCardThumb, mergeVenueResults } from '../venueSearch';

// fish features/partide/helpers/__tests__/venueSuggestions.test.ts (+ venueSearch)
const ORIGIN = { lat: 44.4, lng: 26.1 };

const makeLake = (o: Partial<LakeIndexEntry> & { documentId: string }): LakeIndexEntry => ({ name: `Lake ${o.documentId}`, locality: 'Ilfov', lat: 44.4, lng: 26.1, thumb: null, ...o });
const makeWater = (o: Partial<PublicWaterListItem> & { id: number }): PublicWaterListItem => ({
  name: `Water ${o.id}`,
  type: 'river',
  county: 'Ilfov',
  countyId: 1,
  countyIds: [1],
  centerLat: 44.4,
  centerLng: 26.1,
  linkCode: `R:${o.id}`,
  areaKm2: null,
  ...o,
});
const makeSession = (o: Partial<RecentVenueSession>): RecentVenueSession => ({
  venueType: 'pin',
  lakeId: null,
  lakeName: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  locality: null,
  anchorLat: 44.4,
  anchorLng: 26.1,
  startedAt: 0,
  ...o,
});
const card = (i: number, o: Partial<LakeCard> = {}) => ({ documentId: `c${i}`, name: `Card ${i}`, images: [], county: null, countyRef: null, cityRef: null, ...o }) as unknown as LakeCard;

describe('formatDistanceLabel', () => {
  it('shows «sub 1 km» under 1 km, else one decimal with a comma', () => {
    expect(formatDistanceLabel(0.4)).toBe('sub 1 km');
    expect(formatDistanceLabel(2.44)).toBe('2,4 km');
    expect(formatDistanceLabel(12)).toBe('12,0 km');
  });
});

describe('buildNearbySuggestions', () => {
  it('caps at 3 lakes, fills to 5 with waters, and orders the whole list by distance', () => {
    const lakes = [makeLake({ documentId: 'far', lat: 44.8 }), makeLake({ documentId: 'near', lat: 44.41 }), makeLake({ documentId: 'mid', lat: 44.5 }), makeLake({ documentId: 'farthest', lat: 45.4 })];
    const waters = [makeWater({ id: 1, centerLat: 44.42 }), makeWater({ id: 2, centerLat: 44.6 }), makeWater({ id: 3, centerLat: 45.0 })];
    expect(buildNearbySuggestions(lakes, waters, ORIGIN).map(s => s.key)).toEqual(['lake-near', 'water-R:1', 'lake-mid', 'water-R:2', 'lake-far']);
  });
  it('drops lakes whose coordinates are not finite numbers', () => {
    const lakes = [makeLake({ documentId: 'nan', lat: NaN }), makeLake({ documentId: 'good', lat: 44.41 })];
    expect(buildNearbySuggestions(lakes, [], ORIGIN).map(s => s.key)).toEqual(['lake-good']);
  });
  it('carries the index thumbnail, seeds the coordinates and appends the distance', () => {
    const [s] = buildNearbySuggestions([makeLake({ documentId: 'a', lat: 44.42, thumb: 'https://cdn/t.jpg' })], [], ORIGIN);
    expect(s.thumb).toBe('https://cdn/t.jpg');
    expect(s.selection).toMatchObject({ kind: 'lake', lakeId: 'a', coordinates: { lat: 44.42, lng: 26.1 } });
    expect(s.subtitle).toBe('Ilfov · 2,2 km');
  });
  it('excludes waters without a linkCode and labels waters with type + location + distance', () => {
    const out = buildNearbySuggestions([], [makeWater({ id: 1, linkCode: null }), makeWater({ id: 2, type: 'natural_lake' })], ORIGIN);
    expect(out.map(s => s.key)).toEqual(['water-R:2']);
    expect(out[0].subtitle).toBe('Lac natural · Ilfov · sub 1 km');
  });
  it('drops venues beyond 150 km (a coarse or wrong fix never says «Aproape de tine»)', () => {
    const lakes = [makeLake({ documentId: 'in', lat: ORIGIN.lat + 1.3 }), makeLake({ documentId: 'out', lat: ORIGIN.lat + 1.4 })];
    expect(buildNearbySuggestions(lakes, [], ORIGIN).map(s => s.key)).toEqual(['lake-in']);
    expect(buildNearbySuggestions(lakes, [makeWater({ id: 1, centerLat: 47.5 })], { lat: 37.78, lng: -122.4 })).toEqual([]);
  });
});

describe('buildRecentSuggestions', () => {
  it('orders newest-first and dedups by venue ref across sessions', () => {
    const out = buildRecentSuggestions([
      makeSession({ venueType: 'lake', lakeId: 'L1', lakeName: 'Balta 1', startedAt: 100 }),
      makeSession({ venueType: 'lake', lakeId: 'L1', lakeName: 'Balta 1', startedAt: 300 }),
      makeSession({ venueType: 'publicWater', publicWaterCode: 'R:9', publicWaterName: 'Olt', startedAt: 200 }),
    ]);
    expect(out.map(s => s.key)).toEqual(['lake-L1', 'water-R:9']);
    expect(out[0].selection).toMatchObject({ kind: 'lake', lakeId: 'L1', name: 'Balta 1' });
  });
  it('dedups pins by 4-decimal rounded coords and reuses the saved name', () => {
    const out = buildRecentSuggestions([
      makeSession({ manualVenueName: 'Cotul meu', anchorLat: 44.40001, anchorLng: 26.10001, startedAt: 2 }),
      makeSession({ manualVenueName: 'Cotul meu', anchorLat: 44.40002, anchorLng: 26.10002, startedAt: 1 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].selection).toMatchObject({ kind: 'pin', name: 'Cotul meu' });
    expect(out[0].subtitle).toBe('Loc pe hartă');
  });
  it('excludes keys already shown in nearby, respects a limit, skips sessions missing their ref and caps at 5', () => {
    const sessions = [
      makeSession({ venueType: 'lake', lakeId: 'L1', startedAt: 10 }),
      makeSession({ venueType: 'publicWater', publicWaterCode: 'R:9', startedAt: 9 }),
      makeSession({ anchorLat: 47, startedAt: 3 }),
      makeSession({ anchorLat: 46, startedAt: 2 }),
    ];
    expect(buildRecentSuggestions(sessions, { exclude: new Set(['lake-L1']), limit: 3 }).map(s => s.key)).toEqual(['water-R:9', 'pin-47.0000,26.1000', 'pin-46.0000,26.1000']);
    const many = [makeSession({ venueType: 'lake', lakeId: null, startedAt: 99 }), ...Array.from({ length: 7 }, (_, i) => makeSession({ anchorLat: 44 + i, startedAt: i }))];
    expect(buildRecentSuggestions(many)).toHaveLength(5);
  });
});

describe('recentVenueSessionOf', () => {
  const item = (o: Partial<SessionListItemDTO> = {}) => ({ venueType: 'lake', lakeId: 'L', lakeName: 'Balta', publicWaterCode: null, publicWaterName: null, manualVenueName: null, locality: 'Ilfov', anchorLat: 44.1, anchorLong: 26.2, startedAt: '2026-10-01T10:00:00.000Z', ...o }) as SessionListItemDTO;
  it('maps a /feed/sessions/mine row (anchorLong → anchorLng, ISO → epoch)', () => {
    expect(recentVenueSessionOf(item())).toMatchObject({ venueType: 'lake', lakeId: 'L', anchorLat: 44.1, anchorLng: 26.2, startedAt: Date.parse('2026-10-01T10:00:00.000Z') });
  });
  it('drops a row without an anchor', () => {
    expect(recentVenueSessionOf(item({ anchorLat: null }))).toBeNull();
  });
});

describe('buildRandomSuggestions', () => {
  const cards = Array.from({ length: 8 }, (_, i) => card(i));
  it('is deterministic with a seeded random and returns at most 5, coordinates null', () => {
    const a = buildRandomSuggestions(cards, () => 0.5);
    expect(a.map(s => s.key)).toEqual(buildRandomSuggestions(cards, () => 0.5).map(s => s.key));
    expect(a).toHaveLength(5);
    expect(a[0].selection).toMatchObject({ kind: 'lake', coordinates: null });
  });
});

describe('buildVenueSections', () => {
  const nearby = buildNearbySuggestions([makeLake({ documentId: 'n', lat: 44.41 })], [], ORIGIN);
  const sessions = Array.from({ length: 6 }, (_, i) => makeSession({ anchorLat: 40 + i, startedAt: i }));
  it('recent shrinks to 3 under nearby, random stays empty', () => {
    const s = buildVenueSections({ nearby, sessions, randomPool: [card(1)] });
    expect(s.recent).toHaveLength(3);
    expect(s.random).toEqual([]);
  });
  it('recent alone keeps 5; random only when both are empty', () => {
    expect(buildVenueSections({ nearby: [], sessions, randomPool: [card(1)] }).recent).toHaveLength(5);
    const empty = buildVenueSections({ nearby: [], sessions: [], randomPool: [card(1), card(2)] });
    expect(empty.random.map(r => r.key).sort()).toEqual(['lake-c1', 'lake-c2']);
  });
});

describe('venueSearch', () => {
  it('lakes first, then waters with a linkCode; type + location label', () => {
    const out = mergeVenueResults([card(1, { countyRef: { name: 'Ilfov' } } as Partial<LakeCard>)], [makeWater({ id: 1, linkCode: null }), makeWater({ id: 2, type: 'river', countyIds: [1, 2] })]);
    expect(out).toEqual([
      { kind: 'lake', lakeId: 'c1', name: 'Card 1', locality: 'Ilfov', coordinates: null },
      { kind: 'publicWater', linkCode: 'R:2', name: 'Water 2', typeLabel: 'Râu · 2 județe', center: { lat: 44.4, lng: 26.1 } },
    ]);
  });
  it('thumb: thumbnail, else url, else null', () => {
    expect(lakeCardThumb({ images: [{ url: 'u', thumbnailUrl: 't', mediumUrl: null, smallUrl: null }] })).toBe('t');
    expect(lakeCardThumb({ images: [{ url: 'u', mediumUrl: null, smallUrl: null }] })).toBe('u');
    expect(lakeCardThumb({ images: [] })).toBeNull();
  });
});
