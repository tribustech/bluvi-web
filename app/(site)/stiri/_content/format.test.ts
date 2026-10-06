import { describe, expect, it } from 'vitest';
import { categoryLabel, newsDate } from './format';

describe('news format', () => {
  it('dates read «DD MMMM YYYY» in Romanian, uppercase, in Bucharest time', () => {
    expect(newsDate('2026-09-07T11:45:41.143Z')).toBe('07 SEPTEMBRIE 2026');
    // 23:30 UTC on 31 Dec is already 1 January in Bucharest.
    expect(newsDate('2025-12-31T23:30:00.000Z')).toBe('01 IANUARIE 2026');
    expect(newsDate('nope')).toBe('');
  });

  it('category badges read with diacritics', () => {
    expect(categoryLabel('Noutati')).toBe('Noutăți');
    expect(categoryLabel('Nou')).toBe('Nou');
  });
});
