import { describe, expect, it } from 'vitest';
import { statisticFacts } from './StatisticFacts';

describe('statisticFacts', () => {
  it('averages per catch and per stand, and counts stands with and without fish', () => {
    const rows = [{ catchCount: 3 }, { catchCount: 0 }, { catchCount: 1 }, {}];
    expect(statisticFacts({ totalCatchesCount: 4, totalQuantity: 10 }, rows)).toEqual({
      perCatch: 2.5,
      stands: { total: 4, withFish: 2, without: 2, perStandKg: 2.5, catchesPerStand: 1 },
    });
  });

  it('has no per-stand facts without rows (club rankings), still the average catch', () => {
    expect(statisticFacts({ totalCatchesCount: 2, totalQuantity: 7 }, undefined)).toEqual({ perCatch: 3.5, stands: null });
    expect(statisticFacts({ totalCatchesCount: 2, totalQuantity: 7 }, [])).toEqual({ perCatch: 3.5, stands: null });
  });

  it('has no facts without a catch', () => {
    expect(statisticFacts({ totalCatchesCount: 0, totalQuantity: 0 }, [{ catchCount: 0 }])).toEqual({ perCatch: null, stands: null });
  });
});
