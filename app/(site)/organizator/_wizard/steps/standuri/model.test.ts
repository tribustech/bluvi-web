import { describe, expect, it } from 'vitest';
import { emptyReason, perfLevels, refusedMessage, sectorCount, sortStands, standLabel, standSector, toggleStand, PERF_LEVELS } from './model';

const stand = (documentId: string, name: string, performanceScore?: number | null, competitionsCount?: number | null) => ({
  documentId,
  name,
  performanceScore,
  competitionsCount,
});

describe('sortStands', () => {
  it('sorts names numerically, like fish', () => {
    const sorted = sortStands([stand('a', '10'), stand('b', '2'), stand('c', '1'), stand('d', '2b')]);
    expect(sorted.map((s) => s.name)).toEqual(['1', '2', '2b', '10']);
  });
});

describe('toggleStand', () => {
  const base = { A: ['s1'], B: ['s2'] };

  it('adds a free stand to the selected sector', () => {
    expect(toggleStand(base, 'A', 's3')).toEqual({ kind: 'changed', allocations: { A: ['s1', 's3'], B: ['s2'] } });
  });

  it('removes a stand of the selected sector', () => {
    expect(toggleStand(base, 'A', 's1')).toEqual({ kind: 'changed', allocations: { A: [], B: ['s2'] } });
  });

  it('refuses a stand of another sector, naming it', () => {
    expect(toggleStand(base, 'A', 's2')).toEqual({ kind: 'refused', sector: 'B' });
    expect(refusedMessage('B')).toBe('Standul este deja alocat sectorului B.');
  });

  it('creates the sector list on first use and ignores a press with no sector', () => {
    expect(toggleStand({}, 'C', 's9')).toEqual({ kind: 'changed', allocations: { C: ['s9'] } });
    expect(toggleStand(base, null, 's3')).toEqual({ kind: 'ignored' });
  });

  it('does not mutate the input', () => {
    const input = { A: ['s1'] };
    toggleStand(input, 'A', 's2');
    expect(input).toEqual({ A: ['s1'] });
  });
});

describe('standSector / sectorCount', () => {
  it('finds the sector and counts', () => {
    expect(standSector({ A: ['x'], B: ['y'] }, 'y')).toBe('B');
    expect(standSector({ A: ['x'] }, 'z')).toBeNull();
    expect(sectorCount({ A: ['x', 'y'] }, 'A')).toBe(2);
    expect(sectorCount({}, 'A')).toBe(0);
  });
});

describe('perfLevels', () => {
  it('needs at least two scored stands', () => {
    expect(perfLevels([stand('a', '1', 10, 3), stand('b', '2', null, 3), stand('c', '3', 5, 0)])).toEqual({});
  });

  it('labels by percentile, best first (fish 1 − i / (n − 1))', () => {
    const stands = [stand('a', '1', 10, 2), stand('b', '2', 40, 2), stand('c', '3', 30, 2), stand('d', '4', 20, 2), stand('e', '5', 0, 1)];
    const out = perfLevels(stands);
    // b 1.0, c 0.75, d 0.5, a 0.25, e 0
    expect(out.b.text).toBe('Foarte bun');
    expect(out.c.text).toBe('Foarte bun');
    expect(out.d.text).toBe('Bun');
    expect(out.a.text).toBe('Mediu');
    expect(out.e.text).toBe('Slab');
  });

  it('skips stands without competitions or score', () => {
    const out = perfLevels([stand('a', '1', 10, 2), stand('b', '2', 20, 2), stand('c', '3', 50, 0), stand('d', '4', null, 4)]);
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });

  it('keeps fish copy for the four levels', () => {
    expect(PERF_LEVELS.map((l) => l.text)).toEqual(['Foarte bun', 'Bun', 'Mediu', 'Slab']);
  });
});

describe('emptyReason', () => {
  it('follows fish order: lake, sectors, stands', () => {
    expect(emptyReason(false, 0, 0)).toBe('no-lake');
    expect(emptyReason(true, 0, 5)).toBe('no-sectors');
    expect(emptyReason(true, 2, 0)).toBe('no-stands');
    expect(emptyReason(true, 2, 5)).toBeNull();
  });
});

describe('standLabel', () => {
  it('reads the stand, its sector and its level', () => {
    expect(standLabel('12', null)).toBe('Stand 12');
    expect(standLabel('12', 'A')).toBe('Stand 12, alocat sectorului A');
    expect(standLabel('12', 'A', PERF_LEVELS[0])).toBe('Stand 12, alocat sectorului A, Foarte bun');
  });
});
