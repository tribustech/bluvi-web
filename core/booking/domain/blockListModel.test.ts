import { describe, expect, it } from 'vitest';
import { formatBlockPeriodShort, groupBlocks, scopeLabel, sectionBlocks } from './blockListModel';
import type { AvailabilityBlockDTO } from '../schemas';

const iso = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

const block = (over: Partial<AvailabilityBlockDTO>): AvailabilityBlockDTO => ({
  documentId: 'x',
  startDate: iso(2026, 9, 4),
  endDate: iso(2026, 9, 7),
  reason: 'competition',
  standKey: null,
  ...over,
});

describe('formatBlockPeriodShort', () => {
  it('whole days show the last included day', () => {
    expect(formatBlockPeriodShort(iso(2026, 9, 4), iso(2026, 9, 7))).toBe('Vi 4 – Du 6 sep');
  });
  it('whole days across months repeat the month', () => {
    expect(formatBlockPeriodShort(iso(2026, 9, 28), iso(2026, 10, 3))).toBe('Lu 28 sep – Vi 2 oct');
  });
  it('same day shows the hours', () => {
    expect(formatBlockPeriodShort(iso(2026, 9, 25, 6), iso(2026, 9, 25, 18))).toBe('Vi 25 sep · 06:00–18:00');
  });
  it('multi-day with hours shows both ends', () => {
    expect(formatBlockPeriodShort(iso(2026, 9, 18, 18), iso(2026, 9, 20, 6))).toBe('Vi 18 sep 18:00 – Du 20 sep 06:00');
  });
});

describe('groupBlocks', () => {
  it('folds same period+reason+note stand blocks into one row, stands natural-sorted', () => {
    const rows = groupBlocks([
      block({ documentId: 'a', standKey: 's10', stand: { documentId: 's10', name: '10' } }),
      block({ documentId: 'b', standKey: 's5', stand: { documentId: 's5', name: '5' } }),
      block({ documentId: 'c', standKey: 's6', stand: { documentId: 's6', name: '6' }, note: 'alt' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].documentIds).toEqual(['a', 'b']);
    expect(rows[0].standNames).toEqual(['5', '10']);
    expect(rows[1].note).toBe('alt');
  });
  it('whole-lake and stand blocks stay separate rows, sorted by start', () => {
    const rows = groupBlocks([
      block({ documentId: 'late', startDate: iso(2026, 9, 11), endDate: iso(2026, 9, 14) }),
      block({ documentId: 'early' }),
    ]);
    expect(rows.map(r => r.documentIds[0])).toEqual(['early', 'late']);
  });
});

describe('scopeLabel', () => {
  it('reads naturally', () => {
    expect(scopeLabel([])).toBe('Tot lacul');
    expect(scopeLabel(['5'])).toBe('Standul 5');
    expect(scopeLabel(['5', '6'])).toBe('Standurile 5, 6');
  });
});

describe('sectionBlocks', () => {
  it('sections upcoming rows by month and parks finished ones', () => {
    const now = new Date(2026, 8, 10).getTime();
    const { sections, past } = sectionBlocks(
      [
        block({ documentId: 'done' }),
        block({ documentId: 'sep', startDate: iso(2026, 9, 11), endDate: iso(2026, 9, 14) }),
        block({ documentId: 'oct', startDate: iso(2026, 10, 2), endDate: iso(2026, 10, 3) }),
      ],
      now
    );
    expect(past.map(r => r.documentIds[0])).toEqual(['done']);
    expect(sections.map(s => [s.title, s.data.length])).toEqual([
      ['Septembrie 2026', 1],
      ['Octombrie 2026', 1],
    ]);
  });
  it('past rows are newest-first', () => {
    const now = new Date(2026, 9, 1).getTime();
    const { past } = sectionBlocks(
      [
        block({ documentId: 'older' }),
        block({ documentId: 'newer', startDate: iso(2026, 9, 11), endDate: iso(2026, 9, 14) }),
      ],
      now
    );
    expect(past.map(r => r.documentIds[0])).toEqual(['newer', 'older']);
  });
  it('an ongoing block is upcoming, not past', () => {
    const now = new Date(2026, 8, 5).getTime();
    const { sections, past } = sectionBlocks([block({})], now);
    expect(past).toHaveLength(0);
    expect(sections[0].data).toHaveLength(1);
  });
});
