import { describe, it, expect } from 'vitest';
import { venuePartideHref } from '../venuePartideHref';

describe('venuePartideHref', () => {
  it('routes a lake to its partide page', () => {
    expect(venuePartideHref({ key: 'lake:abc', venueType: 'lake', lakeId: 'abc' })).toBe('/lakes/abc/partide');
  });

  it('routes a public water by the ANAR code carried in the key', () => {
    expect(
      venuePartideHref({ key: 'water:RV:RO4-2-3-0-0-0-0', venueType: 'publicWater', lakeId: null })
    ).toBe('/public-waters/RV%3ARO4-2-3-0-0-0-0/partide');
  });

  it('returns null for a manual pin, which has no venue page', () => {
    expect(venuePartideHref({ key: 'name:lacul din spate', venueType: 'pin', lakeId: null })).toBeNull();
  });

  it('returns null for a lake row that arrived without a lakeId', () => {
    expect(venuePartideHref({ key: 'lake:abc', venueType: 'lake', lakeId: null })).toBeNull();
  });

  it('returns null for a public water whose key carries no code', () => {
    expect(venuePartideHref({ key: 'water:', venueType: 'publicWater', lakeId: null })).toBeNull();
  });
});
