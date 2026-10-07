import { describe, expect, it } from 'vitest';
import {
  isPersistablePick,
  MAX_RECENT_VENUE_SEARCHES,
  parseRecentVenueSearches,
  pushRecentVenuePick,
  type RecentVenuePick,
} from '@/components/partide/venue/recentVenueSearches';

/* fish features/partide/components/community/recentVenueSearches.ts (partide.exploreaza c18, c20). */

const pick = (key: string, name = key): RecentVenuePick => ({ key, name, helper: null, imageUrl: null });

describe('recent venue picks', () => {
  it('accepts only committable venue keys with a name', () => {
    expect(isPersistablePick(pick('lake:a'))).toBe(true);
    expect(isPersistablePick(pick('water:R:1'))).toBe(true);
    expect(isPersistablePick(pick('lake:'))).toBe(false);
    expect(isPersistablePick(pick('county:1'))).toBe(false);
    expect(isPersistablePick({ key: 'lake:a', name: '', helper: null, imageUrl: null })).toBe(false);
    expect(isPersistablePick({ key: 'lake:a', name: 'A', helper: 3, imageUrl: null })).toBe(false);
    expect(isPersistablePick(null)).toBe(false);
  });

  it('parses stored JSON, dropping invalid entries, at most 5', () => {
    const stored = [pick('lake:1'), { nope: true }, pick('lake:'), ...[2, 3, 4, 5, 6, 7].map(i => pick(`lake:${i}`))];
    const out = parseRecentVenueSearches(JSON.stringify(stored));
    expect(out.map(p => p.key)).toEqual(['lake:1', 'lake:2', 'lake:3', 'lake:4', 'lake:5']);
    expect(parseRecentVenueSearches('{bad json')).toEqual([]);
    expect(parseRecentVenueSearches('{"a":1}')).toEqual([]);
    expect(parseRecentVenueSearches(null)).toEqual([]);
  });

  it('pushes the pick first, deduplicated by key, capped', () => {
    const current = [1, 2, 3, 4, 5].map(i => pick(`lake:${i}`));
    const next = pushRecentVenuePick(current, pick('lake:3', 'Trei'));
    expect(next.map(p => p.key)).toEqual(['lake:3', 'lake:1', 'lake:2', 'lake:4', 'lake:5']);
    expect(next[0].name).toBe('Trei');
    expect(pushRecentVenuePick(current, pick('water:new'))).toHaveLength(MAX_RECENT_VENUE_SEARCHES);
    expect(pushRecentVenuePick(current, pick('lake:'))).toBe(current);
  });
});
