import { describe, expect, it } from 'vitest';
import { statisticFacts } from './StatisticFacts';

const stands = (total: number, withFish: number) => ({ total, withFish, one: 'stand', many: 'standuri' });

describe('statisticFacts', () => {
  it('averages per catch and per stand, and counts stands with and without fish', () => {
    expect(statisticFacts({ totalCatchesCount: 4, totalQuantity: 10 }, stands(4, 2))).toEqual({
      perCatch: 2.5,
      stands: { total: 4, withFish: 2, without: 2, perStandKg: 2.5, catchesPerStand: 1, one: 'stand', many: 'standuri' },
    });
  });

  it('counts feeder teams (or club teams) the same way, carrying what an entrant is', () => {
    expect(statisticFacts({ totalCatchesCount: 40, totalQuantity: 100 }, { total: 20, withFish: 20, one: 'echipă', many: 'echipe' })).toEqual({
      perCatch: 2.5,
      stands: { total: 20, withFish: 20, without: 0, perStandKg: 5, catchesPerStand: 2, one: 'echipă', many: 'echipe' },
    });
  });

  it('has no per-entrant facts when nobody is counted, still the average catch', () => {
    expect(statisticFacts({ totalCatchesCount: 2, totalQuantity: 7 }, null)).toEqual({ perCatch: 3.5, stands: null });
    expect(statisticFacts({ totalCatchesCount: 2, totalQuantity: 7 }, stands(0, 0))).toEqual({ perCatch: 3.5, stands: null });
  });

  it('has no facts without a catch', () => {
    expect(statisticFacts({ totalCatchesCount: 0, totalQuantity: 0 }, stands(1, 0))).toEqual({ perCatch: null, stands: null });
  });
});
