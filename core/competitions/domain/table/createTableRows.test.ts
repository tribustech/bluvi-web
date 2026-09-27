import { describe, expect, it } from 'vitest';
import {
  createBaseRow,
  createQualityRow,
  createQualityQuantityRow,
  createBestOfRow,
  createBestNRow,
  createBestOfTiersRow,
} from './createTableRows';
import type {
  BaseStandRanking,
  QualityStandRanking,
  QualityQuantityStandRanking,
  BestOfStandRanking,
  BestNStandRanking,
  BestOfTiersStandRanking,
} from '../../schemas';
import { getBestOfTiersColumns } from './getTableColumns';

const baseRanking = {
  sectorId: 's1',
  sectorName: 'A',
  standId: '42',
  standName: '4',
  teamName: null,
  guestName: null,
  participant: { username: 'andrei' },
  biggestFish: 2.5,
  catchCount: 3,
  sectorPosition: 1,
  generalPosition: 1,
  penalties: [],
} as unknown as BaseStandRanking;

describe('createBaseRow', () => {
  it('carries standId onto the row for tap-to-open mapping', () => {
    const row = createBaseRow(baseRanking, { A: '#fff' }, { isWinner: false });
    expect(row.standId).toBe('42');
  });

  it('still builds the position label and participant name', () => {
    const row = createBaseRow(baseRanking, { A: '#fff' }, { isWinner: false });
    expect(row.position).toBe('A/4');
    expect(row.participant).toBe('andrei');
  });
});

// Weight (kg) columns must always show 3 decimals, e.g. 64 → "64.000", 12.5 → "12.500", 0 → "0.000".
// Points columns are excluded — they keep their own (max 1-decimal) formatting.
describe('weight columns render with padded 3 decimals', () => {
  const sectorColors = { A: '#fff' };
  const context = { isWinner: false };

  it('createQualityRow.quality: whole and one-decimal weights are padded to 3 decimals', () => {
    const whole = createQualityRow(
      { ...baseRanking, quality: 64, qualityPoints: 6.5, catches: [] } as unknown as QualityStandRanking,
      0,
      sectorColors,
      context,
    );
    const half = createQualityRow(
      { ...baseRanking, quality: 12.5, qualityPoints: 6.5, catches: [] } as unknown as QualityStandRanking,
      0,
      sectorColors,
      context,
    );
    expect(whole.quality).toBe('64.000');
    expect(half.quality).toBe('12.500');
    // Points stay untouched — max one decimal, not padded.
    expect(whole.qualityPoints).toBe(6.5);
  });

  it('createQualityQuantityRow.quality: zero renders as "0.000" (not dropped to "-")', () => {
    const row = createQualityQuantityRow(
      {
        ...baseRanking,
        quality: 0,
        quantity: 3,
        qualityPoints: 1,
        quantityPoints: 2,
        catches: [],
      } as unknown as QualityQuantityStandRanking,
      0,
      sectorColors,
      context,
    );
    expect(row.quality).toBe('0.000');
    expect(row.quantity).toBe('3.000');
  });

  it('createBestOfRow.topNCatchesAvarage is a padded 3-decimal string', () => {
    const row = createBestOfRow(
      { ...baseRanking, topNCatchesAvarage: 5, bestOfCount: 2, catches: [] } as unknown as BestOfStandRanking,
      0,
      sectorColors,
      context,
    );
    expect(row.topNCatchesAvarage).toBe('5.000');
  });

  it('createBestNRow.averageBestN pads a whole number and degrades to "-" when missing', () => {
    const present = createBestNRow(
      { ...baseRanking, averageBestN: 7, position: 1 } as unknown as BestNStandRanking,
      sectorColors,
      context,
    );
    const missing = createBestNRow(
      { ...baseRanking, averageBestN: undefined, position: 1 } as unknown as BestNStandRanking,
      sectorColors,
      context,
    );
    expect(present.averageBestN).toBe('7.000');
    expect(missing.averageBestN).toBe('-');
  });
});

describe('bestOfTiers tier columns', () => {
  const sectorColors = { A: '#fff' };
  const context = { isWinner: true };
  const tiers = [9, 7, 5, 3];

  const tiersRanking = {
    ...baseRanking,
    catches: [{ weight: 6.5 }, { weight: 5.2 }, { weight: 4.1 }],
    catchCount: 3,
    totalQuantity: 15.8,
    topNByTier: { 9: null, 7: null, 5: null, 3: 5.266 },
    tierWonAt: 4,
  } as unknown as BestOfTiersStandRanking;

  it('emits one cell per tier, keyed by tier size', () => {
    const row = createBestOfTiersRow(tiersRanking, 3, sectorColors, context, tiers);
    expect(Object.keys(row)).toEqual(expect.arrayContaining(['tier9', 'tier7', 'tier5', 'tier3']));
  });

  it('formats the tier average with 3 decimals and flags the tier that was won', () => {
    const row = createBestOfTiersRow(tiersRanking, 3, sectorColors, context, tiers);
    expect(row.tier3).toEqual({ weight: '5.266', isTier: true, isTierWin: true });
  });

  it('shows 0.000 for tiers the competitor never reached, still part of the tier block', () => {
    const row = createBestOfTiersRow(tiersRanking, 3, sectorColors, context, tiers);
    expect(row.tier9).toEqual({ weight: '0.000', isTier: true });
  });

  it('does not flag a tier win on a competitor who won nothing', () => {
    const row = createBestOfTiersRow(
      { ...tiersRanking, tierWonAt: null } as unknown as BestOfTiersStandRanking,
      3,
      sectorColors,
      { isWinner: false },
      tiers,
    );
    expect(row.tier3).toEqual({ weight: '5.266', isTier: true });
  });

  it('displays the tier columns small to big', () => {
    const titles = getBestOfTiersColumns(3, tiers)
      .filter(c => c.isTier)
      .map(c => c.title);
    expect(titles).toEqual(['Best 3', 'Best 5', 'Best 7', 'Best 9']);
  });

  it('adds a Best N column per tier, between Nr. Buc and the general position', () => {
    const columns = getBestOfTiersColumns(3, tiers).map(c => c.key);
    expect(columns).toEqual(['position', 'participant', 'catch1', 'catch2', 'catch3', 'catchCount', 'tier3', 'tier5', 'tier7', 'tier9', 'generalPosition']);
    expect(getBestOfTiersColumns(3, tiers).find(c => c.key === 'tier9')?.title).toBe('Best 9');
  });
});
