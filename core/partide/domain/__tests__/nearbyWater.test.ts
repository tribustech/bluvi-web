import { describe, expect, it } from 'vitest';
import type { LakeIndexEntry } from '../../../lakes/schemas';
import {
  MIN_HIT_TOLERANCE_DEG,
  createLatestGuard,
  detectionEnabled,
  hitToleranceForSpan,
  nearestLakeWithin,
  waterPillText,
} from '../nearbyWater';

// fish features/partide/helpers/__tests__/nearbyWater.test.ts
const lake = (id: string, lat: number, lng: number, locality: string | null = 'Ilfov'): LakeIndexEntry => ({ documentId: id, name: `Balta ${id}`, locality, lat, lng, thumb: null });

describe('nearestLakeWithin', () => {
  it('returns the nearest lake inside the radius', () => {
    const pin = { lat: 44.5, lng: 26.1 };
    expect(nearestLakeWithin(pin, [lake('far', 44.503, 26.1), lake('near', 44.5005, 26.1)])?.documentId).toBe('near');
  });
  it('returns null when every lake is beyond the radius, or the index is empty / missing', () => {
    const pin = { lat: 44.5, lng: 26.1 };
    expect(nearestLakeWithin(pin, [lake('far', 44.51, 26.1)])).toBeNull();
    expect(nearestLakeWithin(pin, [])).toBeNull();
    expect(nearestLakeWithin(pin, undefined)).toBeNull();
  });
  it('honours a custom radius', () => {
    expect(nearestLakeWithin({ lat: 44.5, lng: 26.1 }, [lake('a', 44.51, 26.1)], 2_000)?.documentId).toBe('a');
  });
});

describe('detection + tolerance', () => {
  it('turns detection off above county-level spans', () => {
    expect(detectionEnabled(0.1)).toBe(true);
    expect(detectionEnabled(0.35)).toBe(true);
    expect(detectionEnabled(0.36)).toBe(false);
  });
  it('scales the hit tolerance with the span, never below the floor', () => {
    expect(hitToleranceForSpan(0.01)).toBe(MIN_HIT_TOLERANCE_DEG);
    expect(hitToleranceForSpan(0.3)).toBeCloseTo(0.006);
  });
});

describe('waterPillText', () => {
  it('prefers the lake, with its locality when known', () => {
    expect(waterPillText(lake('a', 0, 0), { name: 'Olt', type: 'river' })).toBe('Balta a · Ilfov');
    expect(waterPillText(lake('a', 0, 0, null), null)).toBe('Balta a');
  });
  it('falls back to the water name + type, «Apă publică» when nameless', () => {
    expect(waterPillText(null, { name: 'Olt', type: 'river' })).toBe('Olt · Râu');
    expect(waterPillText(null, { name: null, type: 'reservoir_lake' })).toBe('Apă publică · Lac de acumulare');
    expect(waterPillText(null, null)).toBeNull();
  });
});

describe('createLatestGuard', () => {
  it('only the newest token is current', () => {
    const g = createLatestGuard();
    const a = g.next();
    const b = g.next();
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(b)).toBe(true);
  });
});
