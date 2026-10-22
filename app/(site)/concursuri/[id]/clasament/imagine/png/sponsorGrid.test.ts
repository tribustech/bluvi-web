import { describe, expect, it } from 'vitest';
import { chunkByRows, sponsorGridLayout } from './sponsorGrid';

const W = 1220; // 1300 − 2 × 16 − 2 × 24

describe('sponsorGridLayout', () => {
  it('no sponsors → nothing', () => {
    expect(sponsorGridLayout(0, { maxWidth: W }).rows).toEqual([]);
  });
  it('a few: 240 × 150 tiles in one row', () => {
    expect(sponsorGridLayout(3, { maxWidth: W })).toMatchObject({ tileWidth: 240, tileHeight: 150, rows: [3], width: 752 });
  });
  it('never wider than the sheet, 1–50', () => {
    for (let n = 1; n <= 50; n++) {
      const g = sponsorGridLayout(n, { maxWidth: W });
      expect(g.rows.reduce((a, b) => a + b, 0)).toBe(n);
      expect(g.width).toBeLessThanOrEqual(W);
    }
  });
  it('12 → two rows of 6; 50 → 8 balanced rows of 144 px tiles', () => {
    expect(sponsorGridLayout(12, { maxWidth: W }).rows).toEqual([6, 6]);
    const g = sponsorGridLayout(50, { maxWidth: W });
    expect(g).toMatchObject({ tileWidth: 144, tileHeight: 90, rows: [7, 7, 6, 6, 6, 6, 6, 6] });
    expect(g.height).toBe(8 * 90 + 7 * 16);
  });
  it('chunkByRows keeps the order', () => {
    expect(chunkByRows(['a', 'b', 'c'], [2, 1])).toEqual([['a', 'b'], ['c']]);
  });
});
