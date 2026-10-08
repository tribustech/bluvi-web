import { describe, expect, it, vi } from 'vitest';
import type { LakeIndexEntry } from '../../../lakes/schemas';
import type { PublicWaterListItem } from '../../../lakes/domain/publicWaters';
import { resolvePinVenue, type PinVenueDeps } from '../pinVenue';

// fish features/partide/helpers/__tests__/pinVenue.test.ts
const PIN = { lat: 44.55, lng: 26.15 };

const lake = (over: Partial<LakeIndexEntry> = {}): LakeIndexEntry => ({
  documentId: 'lake-1',
  name: 'Balta Roveng',
  locality: 'Snagov, Ilfov',
  lat: 44.5501, // ~15m from PIN
  lng: 26.1501,
  thumb: null,
  ...over,
});

const water = (over: Partial<PublicWaterListItem> = {}): PublicWaterListItem => ({
  id: 1,
  name: 'Lacul Snagov',
  type: 'natural_lake',
  county: 'Ilfov',
  countyId: 1,
  countyIds: [1],
  centerLat: PIN.lat,
  centerLng: PIN.lng,
  linkCode: 'L:snagov',
  areaKm2: 5.75,
  ...over,
});

function makeDeps(over: Partial<PinVenueDeps> = {}): PinVenueDeps {
  return {
    getWaterAtPoint: vi.fn().mockResolvedValue(null),
    getLakesIndex: vi.fn().mockResolvedValue([]),
    getLake: vi.fn().mockRejectedValue(new Error('should not be called')),
    claimedMap: new Map(),
    ...over,
  };
}

describe('resolvePinVenue', () => {
  it('(a) a nearby catalog lake wins over a water hit at the same pin; the pin stays the anchor', async () => {
    const deps = makeDeps({ getLakesIndex: vi.fn().mockResolvedValue([lake()]), getWaterAtPoint: vi.fn().mockResolvedValue(water()) });
    const sel = await resolvePinVenue(PIN, 'Nume ignorat', deps);
    expect(sel).toEqual({ kind: 'lake', lakeId: 'lake-1', name: 'Balta Roveng', locality: 'Snagov, Ilfov', coordinates: PIN });
    expect(deps.getWaterAtPoint).not.toHaveBeenCalled();
  });

  it('ignores catalog lakes farther than 400m from the pin', async () => {
    const deps = makeDeps({ getLakesIndex: vi.fn().mockResolvedValue([lake({ lat: 44.56 })]) }); // ~1.1km
    expect(await resolvePinVenue(PIN, 'Loc nou', deps)).toEqual({ kind: 'pin', coord: PIN, name: 'Loc nou' });
  });

  it('picks the nearest of two lakes inside the radius', async () => {
    const deps = makeDeps({ getLakesIndex: vi.fn().mockResolvedValue([lake({ documentId: 'far', lat: 44.552 }), lake({ documentId: 'near' })]) });
    expect(await resolvePinVenue(PIN, 'x', deps)).toMatchObject({ kind: 'lake', lakeId: 'near' });
  });

  it('(b) a claimed public-water hit resolves to its linked Lake via getLake, pin as coordinates', async () => {
    const deps = makeDeps({
      getWaterAtPoint: vi.fn().mockResolvedValue(water()),
      claimedMap: new Map([['L:snagov', 'lake-2']]),
      getLake: vi.fn().mockResolvedValue({ name: 'Lacul Vidraru', county: 'Argeș', countyRef: { name: 'Argeș' }, cityRef: null }),
    });
    const sel = await resolvePinVenue(PIN, 'Nume ignorat', deps);
    expect(deps.getLake).toHaveBeenCalledWith('lake-2');
    expect(deps.getWaterAtPoint).toHaveBeenCalledWith(PIN.lat, PIN.lng, 0.002);
    expect(sel).toEqual({ kind: 'lake', lakeId: 'lake-2', name: 'Lacul Vidraru', locality: 'Argeș', coordinates: PIN });
  });

  it('(c) an unclaimed public-water hit resolves to a publicWater venue with pin center + location label', async () => {
    const deps = makeDeps({ getWaterAtPoint: vi.fn().mockResolvedValue(water()) });
    expect(await resolvePinVenue(PIN, 'Nume ignorat', deps)).toEqual({ kind: 'publicWater', linkCode: 'L:snagov', name: 'Lacul Snagov', typeLabel: 'Ilfov', center: PIN });
  });

  it('(c) a nameless multi-county river reads «Apă publică» / «N județe»', async () => {
    const deps = makeDeps({ getWaterAtPoint: vi.fn().mockResolvedValue(water({ name: null, type: 'river', countyIds: [1, 2, 3] })) });
    expect(await resolvePinVenue(PIN, 'x', deps)).toMatchObject({ kind: 'publicWater', name: 'Apă publică', typeLabel: '3 județe' });
  });

  it('a water without a linkCode is no venue — plain pin', async () => {
    const deps = makeDeps({ getWaterAtPoint: vi.fn().mockResolvedValue(water({ linkCode: null })) });
    expect(await resolvePinVenue(PIN, 'Loc nou', deps)).toEqual({ kind: 'pin', coord: PIN, name: 'Loc nou' });
  });

  it('(d) nothing matches — falls through to a plain pin, preserving the given name', async () => {
    expect(await resolvePinVenue(PIN, 'Cot Dunăre', makeDeps())).toEqual({ kind: 'pin', coord: PIN, name: 'Cot Dunăre' });
  });

  it('(e) a lake-lookup throw falls through to the water tier', async () => {
    const deps = makeDeps({ getLakesIndex: vi.fn().mockRejectedValue(new Error('network down')), getWaterAtPoint: vi.fn().mockResolvedValue(water()) });
    expect((await resolvePinVenue(PIN, 'x', deps)).kind).toBe('publicWater');
  });

  it('(e) a claim-lookup throw falls through to the unclaimed water tier', async () => {
    const deps = makeDeps({
      getWaterAtPoint: vi.fn().mockResolvedValue(water()),
      claimedMap: new Map([['L:snagov', 'lake-2']]),
      getLake: vi.fn().mockRejectedValue(new Error('network down')),
    });
    expect(await resolvePinVenue(PIN, 'x', deps)).toEqual({ kind: 'publicWater', linkCode: 'L:snagov', name: 'Lacul Snagov', typeLabel: 'Ilfov', center: PIN });
  });

  it('(e) a water-hit-test throw falls through to the plain pin', async () => {
    const deps = makeDeps({ getWaterAtPoint: vi.fn().mockRejectedValue(new Error('db locked')) });
    expect(await resolvePinVenue(PIN, 'Loc nou', deps)).toEqual({ kind: 'pin', coord: PIN, name: 'Loc nou' });
  });
});
