import { describe, expect, it } from 'vitest';
import {
  SectorWithStandGrid,
  clearStandGrids,
  pruneStandGrids,
  setStandGrid,
  standGrid,
  standGridGroups,
  valuedStandCount,
} from './standFishNumbers';

const sector: SectorWithStandGrid = { name: 'A', minFishNumber: 4 };

describe('standFishNumbers', () => {
  it('standGrid falls back to the sector grid', () => {
    expect(standGrid({ ...sector, standFishNumbers: { s1: 8 } }, 's1')).toBe(8);
    expect(standGrid({ ...sector, standFishNumbers: { s1: 8 } }, 's2')).toBe(4);
    expect(standGrid(sector, 's1')).toBe(4);
  });

  it('setStandGrid stores only values that differ from the sector', () => {
    const a = setStandGrid(sector, 's1', 8);
    expect(a.standFishNumbers).toEqual({ s1: 8 });
    const b = setStandGrid(a, 's1', 4);
    expect('standFishNumbers' in b).toBe(false);
    expect(setStandGrid(a, 's2', 0).standFishNumbers).toEqual({ s1: 8 });
  });

  it('clearStandGrids removes the key', () => {
    expect(clearStandGrids({ ...sector, standFishNumbers: { s1: 8 } })).toEqual(sector);
  });

  it('pruneStandGrids drops stands no longer in the sector and values equal to its grid', () => {
    const sectors: SectorWithStandGrid[] = [
      { ...sector, standFishNumbers: { s1: 8, s2: 2, s3: 4 } },
      { name: 'B', minFishNumber: 3, standFishNumbers: { s9: 5 } },
      { name: 'C', minFishNumber: 3 },
    ];
    expect(pruneStandGrids(sectors, { A: ['s1', 's3'], B: [] })).toEqual([
      { ...sector, standFishNumbers: { s1: 8 } },
      { name: 'B', minFishNumber: 3 },
      { name: 'C', minFishNumber: 3 },
    ]);
  });

  it('valuedStandCount', () => {
    expect(valuedStandCount(sector)).toBe(0);
    expect(valuedStandCount({ ...sector, standFishNumbers: { s1: 8, s2: 2 } })).toBe(2);
  });

  it('standGridGroups groups every stand by grid, highest first, names in natural order', () => {
    const groups = standGridGroups({
      ...sector,
      standFishNumbers: { s9: 8, s5: 8, s1: 2 },
      stands: [
        { documentId: 's1', name: 'B1' },
        { documentId: 's9', name: 'B9' },
        { documentId: 's5', name: 'B5' },
        { documentId: 's10', name: 'B10' },
        { documentId: 's6', name: 'B6' },
      ],
    });
    expect(groups).toEqual([
      { fishNumber: 8, standNames: ['B5', 'B9'] },
      { fishNumber: 4, standNames: ['B6', 'B10'] },
      { fishNumber: 2, standNames: ['B1'] },
    ]);
    expect(standGridGroups({ ...sector, stands: [{ documentId: 's1', name: 'B1' }] })).toEqual([]);
  });
});
