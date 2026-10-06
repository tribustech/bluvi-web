import { describe, expect, it } from 'vitest';
import {
  getBestNColumns,
  getBestOfColumns,
  getBestOfTiersColumns,
  getQualityColumns,
  getQuantityColumns,
} from '@/core/competitions/domain/table/getTableColumns';
import { isPodium, winnerMode } from '@/components/ranking/rankingColumns';

describe('winnerMode', () => {
  it('sector types: isWinner = the sector winners (general places 1..S)', () => {
    expect(winnerMode(getQuantityColumns())).toBe('sector');
    expect(winnerMode(getQualityColumns(3))).toBe('sector');
  });
  it('bestOf / bestOfTiers / Best N: isWinner = the top W overall', () => {
    expect(winnerMode(getBestOfColumns(3, 4))).toBe('prize');
    expect(winnerMode(getBestOfColumns(3, 1))).toBe('prize');
    expect(winnerMode(getBestOfTiersColumns(5, [3, 5]))).toBe('prize');
    expect(winnerMode(getBestNColumns())).toBe('prize');
  });
});

describe('isPodium', () => {
  it('places 1–3 with a catch only', () => {
    expect(isPodium(1, false)).toBe(true);
    expect(isPodium(3, false)).toBe(true);
    expect(isPodium(4, false)).toBe(false);
    expect(isPodium(2, true)).toBe(false);
    expect(isPodium(0, false)).toBe(false);
  });
});
