import { describe, expect, it } from 'vitest';
import type { QuoteExtraLine } from '../schemas';
import { extrasSummary } from './bookingCard';

function extra(over: Partial<QuoteExtraLine> = {}): QuoteExtraLine {
  return { key: 'cabin', label: 'Cabană', unit: 'perNight', unitPrice: 75, quantity: 1, total: 75, ...over };
}

describe('extrasSummary', () => {
  it('sums the line totals, not the unit prices', () => {
    const { total } = extrasSummary([
      extra({ unitPrice: 75, quantity: 2, total: 150 }),
      extra({ key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 30, total: 30 }),
    ]);
    expect(total).toBe(180);
  });

  it('names a single extra and counts several', () => {
    expect(extrasSummary([extra()]).headline).toBe('Cabană');
    expect(extrasSummary([extra(), extra({ key: 'boat', label: 'Barcă' })]).headline).toBe('2 extra');
  });

  it('does not offer to expand a single extra charged once', () => {
    expect(extrasSummary([extra()]).expandable).toBe(false);
  });

  it('expands when a second extra exists, or when the one extra was charged more than once', () => {
    expect(extrasSummary([extra(), extra({ key: 'boat' })]).expandable).toBe(true);
    expect(extrasSummary([extra({ quantity: 2, total: 150 })]).expandable).toBe(true);
  });

  it('survives an empty list — the row renders nothing, but the helper is called first', () => {
    expect(extrasSummary([])).toEqual({ total: 0, headline: '', expandable: false });
  });
});
