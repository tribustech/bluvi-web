import { describe, expect, it } from 'vitest';
import { mergeRowBands, type RowBandInput } from './rowRuns';

// Day width 100 for easy math. Overnight cell = two touching ¼ segments at the day seam.
function band(p: Partial<RowBandInput> & { cellIndex: number; leftPx: number; widthPx: number }): RowBandInput {
  return { label: 'x', status: 'available', selected: false, block: null, isPast: false, tooSoon: false, ...p };
}

describe('mergeRowBands', () => {
  it('merges the two segments of one (overnight) cell into a single run with one label', () => {
    const runs = mergeRowBands(
      [
        band({ cellIndex: 1, leftPx: 75, widthPx: 25, label: '18–06' }), // tail ¼ of day 0 (75..100)
        band({ cellIndex: 1, leftPx: 100, widthPx: 25, label: '18–06' }), // head ¼ of day 1 (100..125)
      ],
      null
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ leftPx: 75, widthPx: 50, label: '18–06', cellIndex: 1, selected: false });
  });

  it('merges every touching band of the same block into one run, one trophy', () => {
    const block = {
      reason: 'competition',
      start: '2026-09-04T00:00:00+03:00',
      end: '2026-09-07T00:00:00+03:00',
      label: 'Cupa',
      competitionId: 'c1',
    };
    const runs = mergeRowBands(
      [
        band({ cellIndex: 0, leftPx: 0, widthPx: 50, status: 'blocked', block }),
        band({ cellIndex: 1, leftPx: 50, widthPx: 50, status: 'blocked', block }),
        band({ cellIndex: 2, leftPx: 100, widthPx: 50, status: 'blocked', block }),
        band({ cellIndex: 3, leftPx: 150, widthPx: 50, status: 'available' }),
      ],
      null
    );
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ leftPx: 0, widthPx: 150, status: 'blocked', cellIndex: 0, block });
    expect(runs[1]).toMatchObject({ leftPx: 150, widthPx: 50, status: 'available' });
  });

  it('keeps two different blocks apart, and a past segment of a block apart from its future one', () => {
    const a = { reason: 'competition', start: 'a', end: 'b', label: null, competitionId: 'c1' };
    const c = { reason: 'closure', start: 'b', end: 'c', label: 'Golire', competitionId: null };
    const runs = mergeRowBands(
      [
        band({ cellIndex: 0, leftPx: 0, widthPx: 50, status: 'blocked', block: a, isPast: true }),
        band({ cellIndex: 1, leftPx: 50, widthPx: 50, status: 'blocked', block: a }),
        band({ cellIndex: 2, leftPx: 100, widthPx: 50, status: 'blocked', block: c }),
      ],
      null
    );
    expect(runs.map(r => [r.leftPx, r.widthPx])).toEqual([
      [0, 50],
      [50, 50],
      [100, 50],
    ]);
  });

  it('keeps distinct UNSELECTED cells as separate runs even when touching', () => {
    const runs = mergeRowBands(
      [
        band({ cellIndex: 0, leftPx: 25, widthPx: 50, label: '06–18' }), // 25..75
        band({ cellIndex: 1, leftPx: 75, widthPx: 25, label: '18–06' }), // 75..100 (touching but different cell)
      ],
      null
    );
    expect(runs).toHaveLength(2);
    expect(runs.map(r => r.label)).toEqual(['06–18', '18–06']);
  });

  it('merges a selected contiguous run across cells into one pill with the selection label', () => {
    const runs = mergeRowBands(
      [
        band({ cellIndex: 0, leftPx: 25, widthPx: 50, label: '06–18', selected: true }), // 25..75
        band({ cellIndex: 1, leftPx: 75, widthPx: 25, label: '18–06', selected: true }), // 75..100
        band({ cellIndex: 1, leftPx: 100, widthPx: 25, label: '18–06', selected: true }), // 100..125
      ],
      '06–06'
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ leftPx: 25, widthPx: 100, label: '06–06', selected: true, cellIndex: 0 });
  });

  it('does not merge same-key bands separated by a gap (non-touching)', () => {
    const runs = mergeRowBands(
      [
        band({ cellIndex: 2, leftPx: 0, widthPx: 20, label: '08–12' }),
        band({ cellIndex: 2, leftPx: 50, widthPx: 20, label: '08–12' }), // gap (20 != 50)
      ],
      null
    );
    expect(runs).toHaveLength(2);
  });

  it('selected and unselected portions form separate runs', () => {
    const runs = mergeRowBands(
      [
        band({ cellIndex: 0, leftPx: 25, widthPx: 50, label: '06–18', selected: true }),
        band({ cellIndex: 1, leftPx: 75, widthPx: 25, label: '18–06', selected: false }),
      ],
      '06–18'
    );
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ selected: true, label: '06–18' });
    expect(runs[1]).toMatchObject({ selected: false, label: '18–06' });
  });
});
