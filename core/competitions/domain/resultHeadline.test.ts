import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resultHeadline } from './resultHeadline';

/*
 * Real ranking payloads (/competitions/:id/ranking), trimmed to the podium and anonymised:
 * tests/fixtures/rankings/<rankingType>.json — prod, except fipsed (local CMS seed: no finished
 * FIPSed competition on prod yet).
 */
type Fixture = { metadata: Record<string, unknown>; rankings: Record<string, unknown>[] };
const fixture = (type: string): Fixture =>
  JSON.parse(readFileSync(path.resolve(__dirname, '../../../tests/fixtures/rankings', `${type}.json`), 'utf8')) as Fixture;

const headlines = (type: string) => {
  const f = fixture(type);
  return f.rankings.map((r) => resultHeadline(f.metadata.rankingType as string, r, f.metadata));
};

describe('resultHeadline', () => {
  it('every fixture is the type it is named after', () => {
    for (const t of ['quantity', 'quality', 'quantityQuality', 'qualityQuantity', 'bestOf', 'bestOfTiers', 'calitateCalitate', 'calitateCantitateCMMC', 'nationalChampionship', 'fipsed', 'feederRounds']) {
      expect(fixture(t).metadata.rankingType).toBe(t);
    }
  });

  it('quantity: kg total, the most win', () => {
    const [first] = headlines('quantity');
    expect(first).toEqual({ value: 11.7, unit: 'kg', label: 'kg total', lowerIsBetter: false });
  });

  it('quality: the quality average in kg', () => {
    const [first, second] = headlines('quality');
    expect(first).toEqual({ value: 10.16, unit: 'kg', label: 'calitate', lowerIsBetter: false });
    expect(second.value).toBeLessThanOrEqual(first.value!);
  });

  it('quantityQuality / qualityQuantity: quality + quantity points, the fewest win — never the kg total', () => {
    for (const t of ['quantityQuality', 'qualityQuantity']) {
      const f = fixture(t);
      const hs = headlines(t);
      expect(hs[0]).toEqual({ value: 2, unit: 'puncte', label: 'puncte', lowerIsBetter: true });
      hs.forEach((h, i) => expect(h.value).toBe((f.rankings[i].qualityPoints as number) + (f.rankings[i].quantityPoints as number)));
      expect(hs[0].value).not.toBe(f.rankings[0].quantity);
    }
  });

  it('calitateCalitate: totalPoints (the payload has no `quality`)', () => {
    const f = fixture('calitateCalitate');
    expect(f.rankings[0].quality).toBeUndefined();
    expect(headlines('calitateCalitate')[0]).toEqual({ value: 3, unit: 'puncte', label: 'puncte', lowerIsBetter: true });
  });

  it('calitateCantitateCMMC: totalPoints, the fewest win', () => {
    const hs = headlines('calitateCantitateCMMC');
    expect(hs[0]).toEqual({ value: 3, unit: 'puncte', label: 'puncte', lowerIsBetter: true });
    expect(hs[1].value).toBeGreaterThanOrEqual(hs[0].value!);
  });

  it('nationalChampionship / fipsed: the club points, the fewest win', () => {
    expect(headlines('nationalChampionship').map((h) => h.value)).toEqual([7, 8, 9]);
    const fipsed = headlines('fipsed');
    expect(fipsed[0]).toMatchObject({ unit: 'puncte', lowerIsBetter: true, value: fixture('fipsed').rankings[0].clubPoints });
    expect(fipsed[1].value).toBeGreaterThanOrEqual(fipsed[0].value!);
  });

  it('feederRounds: the sum of the leg points, the fewest win', () => {
    expect(headlines('feederRounds')[0]).toEqual({ value: 2, unit: 'puncte', label: 'puncte', lowerIsBetter: true });
  });

  it('bestOf: the top-N average in kg', () => {
    expect(headlines('bestOf')[0]).toEqual({ value: 17.238, unit: 'kg', label: 'medie', lowerIsBetter: false });
  });

  it('bestOfTiers: the average at the tier the row won at, never the kg total', () => {
    const f = fixture('bestOfTiers');
    expect(f.metadata.bestOfTierSizes).toEqual([9, 7, 5, 3]);
    const hs = headlines('bestOfTiers');
    // tierWonAt 1 → Best 9, 2 → Best 7, 3 → Best 5.
    expect(hs[0]).toEqual({ value: 17.461, unit: 'kg', label: 'medie Best 9', lowerIsBetter: false });
    expect(hs[1]).toMatchObject({ value: 17.093, label: 'medie Best 7' });
    expect(hs[2]).toMatchObject({ value: 17.77, label: 'medie Best 5' });
    expect(hs[0].value).not.toBe(f.rankings[0].totalQuantity);
    // Without the tier sizes the value is unknown, not guessed.
    expect(resultHeadline('bestOfTiers', f.rankings[0], {})).toMatchObject({ value: null, label: 'medie' });
  });

  it('a field the row does not carry is null, not another field', () => {
    expect(resultHeadline('quality', { quantity: 10 })).toMatchObject({ value: null, label: 'calitate' });
    expect(resultHeadline('quantityQuality', { qualityPoints: 1 })).toMatchObject({ value: null, unit: 'puncte' });
    expect(resultHeadline(undefined, { quantity: 4.5 })).toMatchObject({ value: 4.5, label: 'kg total' });
  });
});
