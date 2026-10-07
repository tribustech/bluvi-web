import { describe, expect, it } from 'vitest';
import { anchorCoord, bearingDeg, DIST_HARD_MAX, distanceFromAnchor, haversineMeters, viewMaxFor } from '../castGeometry';

// fish features/partide/helpers/__tests__/castGeometry.test.ts + geo.test.ts

describe('viewMaxFor', () => {
  it('picks the first tier ≥ distance, capped at the hard max', () => {
    expect(viewMaxFor(10)).toBe(150);
    expect(viewMaxFor(150)).toBe(150);
    expect(viewMaxFor(151)).toBe(200);
    expect(viewMaxFor(999)).toBe(DIST_HARD_MAX);
  });
});

describe('anchorCoord', () => {
  it('returns the coord for a valid anchor', () => {
    expect(anchorCoord(44.43, 26.01)).toEqual({ lat: 44.43, lng: 26.01 });
  });

  it('rejects missing, non-finite and 0/0 legacy anchors', () => {
    expect(anchorCoord(null, 26.01)).toBeNull();
    expect(anchorCoord(undefined, undefined)).toBeNull();
    expect(anchorCoord(NaN, 26.01)).toBeNull();
    expect(anchorCoord(0, 0)).toBeNull();
  });

  it('accepts a coordinate with a single zero component (equator/meridian)', () => {
    expect(anchorCoord(0, 26.01)).toEqual({ lat: 0, lng: 26.01 });
  });
});

describe('haversineMeters', () => {
  it('is 0 for the same point', () => {
    expect(haversineMeters({ lat: 44.4, lng: 26.1 }, { lat: 44.4, lng: 26.1 })).toBe(0);
  });

  it('measures ~111.2 km per degree of latitude', () => {
    expect(haversineMeters({ lat: 44, lng: 26 }, { lat: 45, lng: 26 })).toBeCloseTo(111_195, -1);
  });

  it('is symmetric', () => {
    const a = { lat: 44.43, lng: 26.1 };
    const b = { lat: 44.4312, lng: 26.1023 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 9);
  });
});

describe('distanceFromAnchor', () => {
  it('rounds to 5 m by default', () => {
    const a = { lat: 44.43, lng: 26.1 };
    // ~0.00063° of latitude ≈ 70 m
    const d = distanceFromAnchor(a, { lat: 44.43063, lng: 26.1 });
    expect(d % 5).toBe(0);
    expect(d).toBe(70);
  });

  it('honours a custom step', () => {
    expect(distanceFromAnchor({ lat: 44, lng: 26 }, { lat: 44.0001, lng: 26 }, 1)).toBe(11);
  });
});

describe('bearingDeg', () => {
  const o = { lat: 44, lng: 26 };
  it('north is 0, east 90, south 180, west 270', () => {
    expect(bearingDeg(o, { lat: 44.01, lng: 26 })).toBeCloseTo(0, 3);
    expect(bearingDeg(o, { lat: 44, lng: 26.01 })).toBeCloseTo(90, 1);
    expect(bearingDeg(o, { lat: 43.99, lng: 26 })).toBeCloseTo(180, 3);
    expect(bearingDeg(o, { lat: 44, lng: 25.99 })).toBeCloseTo(270, 1);
  });
});
