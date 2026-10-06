import { describe, expect, it } from 'vitest';
import type { StandStat } from '../../schemas';
import { parseStandSortParam, sortStands, STAND_SORT_OPTIONS, standSortValue } from '../standSort';

const stand = (over: Partial<StandStat> & { name: string }): StandStat => ({
  standId: over.name,
  partide: 1,
  catches: 0,
  totalKg: 0,
  recordKg: null,
  ...over,
});

describe('STAND_SORT_OPTIONS', () => {
  it('matches fish: Kg total, Capturi, Record', () => {
    expect(STAND_SORT_OPTIONS).toEqual([
      { value: 'kg', label: 'Kg total' },
      { value: 'catches', label: 'Capturi' },
      { value: 'record', label: 'Record' },
    ]);
  });
});

describe('standSortValue', () => {
  const s = stand({ name: '1', catches: 4, totalKg: 12.5, recordKg: 6 });
  it('reads the sorted field', () => {
    expect(standSortValue(s, 'kg')).toBe(12.5);
    expect(standSortValue(s, 'catches')).toBe(4);
    expect(standSortValue(s, 'record')).toBe(6);
  });
});

describe('sortStands', () => {
  const rows = [
    stand({ name: 'B', catches: 2, totalKg: 5, recordKg: 3 }),
    stand({ name: 'A', catches: 2, totalKg: 5, recordKg: null }),
    stand({ name: 'Ș', catches: 0, totalKg: 0, recordKg: null }),
    stand({ name: 'C', catches: 7, totalKg: 9, recordKg: 4 }),
  ];
  it('ranks by the value, descending, ties by name (Romanian collation)', () => {
    expect(sortStands(rows, 'kg').map(s => s.name)).toEqual(['C', 'A', 'B', 'Ș']);
    expect(sortStands(rows, 'catches').map(s => s.name)).toEqual(['C', 'A', 'B', 'Ș']);
  });
  it('sinks stands without a record to the bottom (never sorted as 0), ordered by name', () => {
    expect(sortStands(rows, 'record').map(s => s.name)).toEqual(['C', 'B', 'A', 'Ș']);
  });
  it('sorts a copy', () => {
    const before = rows.map(s => s.name);
    sortStands(rows, 'kg');
    expect(rows.map(s => s.name)).toEqual(before);
  });
  it('uses Romanian collation (Ș after S)', () => {
    const r = [stand({ name: 'Ș' }), stand({ name: 'T' }), stand({ name: 'S' })];
    expect(sortStands(r, 'record').map(s => s.name)).toEqual(['S', 'Ș', 'T']);
  });
});

describe('parseStandSortParam', () => {
  it('keeps a known sort, defaults anything else to kg', () => {
    expect(parseStandSortParam('catches')).toBe('catches');
    expect(parseStandSortParam('record')).toBe('record');
    expect(parseStandSortParam('kg')).toBe('kg');
    expect(parseStandSortParam(undefined)).toBe('kg');
    expect(parseStandSortParam('weight')).toBe('kg');
  });
});
