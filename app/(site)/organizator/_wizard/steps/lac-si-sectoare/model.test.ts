import { describe, expect, it } from 'vitest';
import type { LakeCard } from '@/core/lakes';
import {
  addSector,
  exceedsStands,
  keepAllocations,
  lakeOption,
  lakePlace,
  orderLakes,
  parseMinFish,
  removalNeedsConfirm,
  removeSector,
  stepMinFish,
} from './model';

const lake = (documentId: string, name: string, over: Partial<LakeCard> = {}): LakeCard => ({
  documentId,
  name,
  county: null,
  countyRef: null,
  cityRef: null,
  regime: null,
  reviewsMeta: null,
  images: [],
  facility: [],
  fishSpecies: [],
  ...over,
});

describe('orderLakes (c3)', () => {
  const lakes = [lake('1', 'Ștefănești'), lake('2', 'balta Mare'), lake('3', 'Ciorogârla'), lake('4', 'Așchileu'), lake('5', 'Zăvoi')];
  it('recent first in recency order, then the rest by Romanian name, case-insensitive', () => {
    expect(orderLakes(lakes, ['5', '3'], '').map(l => l.documentId)).toEqual(['5', '3', '4', '2', '1']);
  });
  it('keeps the server order while searching', () => {
    expect(orderLakes(lakes, ['5'], 'a').map(l => l.documentId)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('lakeOption (c4)', () => {
  it('photo avatar, «oraș, județ», the current lake disabled', () => {
    const l = lake('x', 'Balta Belin', {
      cityRef: { documentId: 'c', name: 'Belin' },
      countyRef: { documentId: 'k', name: 'Covasna' },
      images: [{ url: 'u', smallUrl: 's', mediumUrl: 'm' }],
    });
    expect(lakeOption(l, undefined)).toMatchObject({ id: 'x', label: 'Balta Belin', helper: 'Belin, Covasna', avatar: { src: 's', square: true }, disabled: false });
    expect(lakeOption(l, 'x')).toMatchObject({ disabled: true, selected: true });
  });
  it('falls back to the legacy county text', () => {
    expect(lakePlace(lake('y', 'Y', { county: 'Giurgiu' }))).toBe('Giurgiu');
  });
});

describe('sectors (c9–c12)', () => {
  it('adds A, B, C… with min fish 1, up to the maximum', () => {
    let s = addSector([], 3);
    s = addSector(s, 3);
    s = addSector(s, 3);
    expect(s).toEqual([{ name: 'A', minFishNumber: 1 }, { name: 'B', minFishNumber: 1 }, { name: 'C', minFishNumber: 1 }]);
    expect(addSector(s, 3)).toHaveLength(3);
    const full = Array.from({ length: 24 }).reduce<ReturnType<typeof addSector>>(acc => addSector(acc, 24), []);
    expect(full.at(-1)?.name).toBe('X');
    expect(addSector(full, 24)).toHaveLength(24);
  });
  it('removing renames in order', () => {
    const s = [{ name: 'A', minFishNumber: 1 }, { name: 'B', minFishNumber: 4 }, { name: 'C', minFishNumber: 2 }];
    expect(removeSector(s, 0)).toEqual([{ name: 'A', minFishNumber: 4 }, { name: 'B', minFishNumber: 2 }]);
  });
  it('asks before removing a changed min fish (quality types only)', () => {
    expect(removalNeedsConfirm({ name: 'A', minFishNumber: 1 }, true)).toBe(false);
    expect(removalNeedsConfirm({ name: 'A', minFishNumber: 3 }, true)).toBe(true);
    expect(removalNeedsConfirm({ name: 'A', minFishNumber: 3 }, false)).toBe(false);
  });
  it('min fish: digits only, empty = 0, never below 0', () => {
    expect(parseMinFish('1a2')).toBe(12);
    expect(parseMinFish('')).toBe(0);
    expect(stepMinFish([{ name: 'A', minFishNumber: 0 }], 0, -1)[0].minFishNumber).toBe(0);
    expect(stepMinFish([{ name: 'A', minFishNumber: 1 }], 0, 1)[0].minFishNumber).toBe(2);
  });
  it('drops allocations of vanished sectors', () => {
    expect(keepAllocations({ A: ['s1'], B: ['s2'], C: ['s3'] }, [{ name: 'A', minFishNumber: 1 }, { name: 'B', minFishNumber: 1 }])).toEqual({ A: ['s1'], B: ['s2'] });
  });
});

describe('exceedsStands (c7)', () => {
  it('only once the stands are known, and never for a lake without stands', () => {
    expect(exceedsStands('30', 21)).toBe(true);
    expect(exceedsStands('21', 21)).toBe(false);
    expect(exceedsStands('30', null)).toBe(false);
    expect(exceedsStands('30', 0)).toBe(false);
    expect(exceedsStands(undefined, 5)).toBe(false);
  });
});
