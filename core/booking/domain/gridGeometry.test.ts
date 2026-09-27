import { describe, expect, it } from 'vitest';

import { buildGridGeometryFromSlots, classifySlot, formatInterval, formatSelectionLabel, formatSlotLabel, generateSlots, visibleColumnRange, type Slot } from './gridGeometry';

// Same as fish: device-local geometry is asserted in the Romanian zone.
process.env.TZ = 'Europe/Bucharest';

function slots(pairs: [string, string][]): Slot[] {
  return pairs.map(([start, end]) => ({ start, end }));
}

describe('formatInterval', () => {
  it('uses hour-only when both endpoints are on the hour', () => {
    expect(formatInterval('2026-06-13T06:00:00', '2026-06-13T18:00:00')).toBe('06–18');
    expect(formatInterval('2026-06-13T18:00:00', '2026-06-14T06:00:00')).toBe('18–06');
  });
  it('uses full HH:mm when any endpoint has minutes', () => {
    expect(formatInterval('2026-06-13T07:30:00', '2026-06-13T19:30:00')).toBe('07:30–19:30');
    expect(formatInterval('2026-06-13T06:00:00', '2026-06-13T18:15:00')).toBe('06:00–18:15');
  });
});

describe('formatSelectionLabel', () => {
  it('same day → full times, no weekday', () => {
    expect(formatSelectionLabel('2026-06-01T06:00:00', '2026-06-01T18:00:00')).toBe('06:00 – 18:00');
  });
  it('crosses days (full 24h) → weekday + full time each end', () => {
    expect(formatSelectionLabel('2026-06-01T06:00:00', '2026-06-02T06:00:00')).toBe('Lu 06:00 – Ma 06:00');
  });
  it('crosses days (overnight) → weekday + full time', () => {
    expect(formatSelectionLabel('2026-06-01T18:00:00', '2026-06-02T06:00:00')).toBe('Lu 18:00 – Ma 06:00');
  });
  it('always includes minutes', () => {
    expect(formatSelectionLabel('2026-06-01T07:30:00', '2026-06-01T19:30:00')).toBe('07:30 – 19:30');
  });
});

describe('buildGridGeometryFromSlots — bands', () => {
  const twoSlot = slots([
    ['2026-06-13T06:00:00', '2026-06-13T18:00:00'],
    ['2026-06-13T18:00:00', '2026-06-14T06:00:00'],
  ]);

  it('emits two day headers spanning the overnight slot', () => {
    const g = buildGridGeometryFromSlots(twoSlot);
    expect(g.days.map(d => d.dayNumber)).toEqual(['13', '14']);
    expect(g.days[0].dayIndex).toBe(0);
    expect(g.days[1].dayIndex).toBe(1);
  });

  it('places the daytime slot as one band, mid-day, in day 0', () => {
    const g = buildGridGeometryFromSlots(twoSlot);
    const day = g.bands.filter(b => b.cellIndex === 0);
    expect(day).toHaveLength(1);
    expect(day[0].dayIndex).toBe(0);
    expect(day[0].isSegmentOfSplit).toBe(false);
    expect(day[0].label).toBe('06–18');
    expect(day[0].leftPx).toBeCloseTo((6 / 24) * g.dayWidthPx);
    expect(day[0].widthPx).toBeCloseTo((12 / 24) * g.dayWidthPx);
  });

  it('splits the overnight slot into two ¼ bands sharing one cellIndex', () => {
    const g = buildGridGeometryFromSlots(twoSlot);
    const overnight = g.bands.filter(b => b.cellIndex === 1);
    expect(overnight).toHaveLength(2);
    expect(overnight.every(b => b.isSegmentOfSplit)).toBe(true);
    expect(overnight.every(b => b.label === '18–06')).toBe(true);
    const tail = overnight.find(b => b.dayIndex === 0)!;
    expect(tail.leftPx).toBeCloseTo((18 / 24) * g.dayWidthPx);
    expect(tail.widthPx).toBeCloseTo((6 / 24) * g.dayWidthPx);
    const head = overnight.find(b => b.dayIndex === 1)!;
    expect(head.leftPx).toBeCloseTo(1 * g.dayWidthPx + 0);
    expect(head.widthPx).toBeCloseTo((6 / 24) * g.dayWidthPx);
  });

  it('handles a single 24h slot per day as one full-width band, no split', () => {
    const g = buildGridGeometryFromSlots(
      slots([
        ['2026-06-13T00:00:00', '2026-06-14T00:00:00'],
        ['2026-06-14T00:00:00', '2026-06-15T00:00:00'],
      ])
    );
    expect(g.bands).toHaveLength(2);
    expect(g.bands[0].widthPx).toBeCloseTo(g.dayWidthPx);
    expect(g.bands[0].isSegmentOfSplit).toBe(false);
    expect(g.bands[1].dayIndex).toBe(1);
  });

  it('does not hang and lays out correctly across a DST fall-back day', () => {
    const g = buildGridGeometryFromSlots(slots([
      ['2025-10-26T00:00:00', '2025-10-27T00:00:00'],
      ['2025-10-27T00:00:00', '2025-10-28T00:00:00'],
    ]));
    expect(g.bands).toHaveLength(2);
    expect(g.days.map(d => d.dayNumber)).toEqual(['26', '27']);
    expect(g.bands[0].dayIndex).toBe(0);
    expect(g.bands[1].dayIndex).toBe(1);
  });

  it('splits a multi-day cell into one band per spanned day', () => {
    const g = buildGridGeometryFromSlots(slots([['2026-06-13T00:00:00', '2026-06-16T00:00:00']]));
    const bands = g.bands.filter(b => b.cellIndex === 0);
    expect(bands).toHaveLength(3);
    expect(bands.map(b => b.dayIndex)).toEqual([0, 1, 2]);
    expect(bands.every(b => b.isSegmentOfSplit)).toBe(true);
    expect(bands.every(b => b.widthPx === g.dayWidthPx)).toBe(true);
  });

  it('leaves untiled time unpainted (no band) for non-tiling configs', () => {
    const g = buildGridGeometryFromSlots(
      slots([
        ['2026-06-13T08:00:00', '2026-06-13T12:00:00'],
        ['2026-06-13T14:00:00', '2026-06-13T18:00:00'],
      ])
    );
    expect(g.bands).toHaveLength(2);
    expect(g.bands.every(b => !b.isSegmentOfSplit)).toBe(true);
    expect(g.bands[0].leftPx).toBeCloseTo((8 / 24) * g.dayWidthPx);
  });
});

describe('buildGridGeometryFromSlots — sizing', () => {
  it('sizes HOUR_W so the narrowest pressable CELL clears the touch-target floor', () => {
    const g = buildGridGeometryFromSlots(slots([
      ['2026-06-13T06:00:00', '2026-06-13T18:00:00'],
      ['2026-06-13T18:00:00', '2026-06-14T06:00:00'],
    ]));
    // A cell's segments merge back into one pill (mergeRowBands keys on cellIndex), so
    // the tap target is the cell's total width — not any single midnight-split segment.
    const widthByCell = new Map<number, number>();
    for (const b of g.bands) widthByCell.set(b.cellIndex, (widthByCell.get(b.cellIndex) ?? 0) + b.widthPx);
    expect(Math.min(...widthByCell.values())).toBeGreaterThanOrEqual(44);
  });
  it('does not inflate the column for a cell that merely straddles midnight', () => {
    // 06/18 + 12h, the canonical config: the night's 6h half must NOT drive the width.
    const g = buildGridGeometryFromSlots(slots([
      ['2026-06-13T06:00:00', '2026-06-13T18:00:00'],
      ['2026-06-13T18:00:00', '2026-06-14T06:00:00'],
    ]));
    expect(g.dayWidthPx).toBe(120);
  });
  it('still widens the column when a genuinely short cell needs the touch target', () => {
    // A standalone 6h cell has no split to hide behind — it must be sized up.
    // (Below 6h the HOUR_W_MAX cap takes over and the floor can no longer be met.)
    const g = buildGridGeometryFromSlots(slots([['2026-06-13T08:00:00', '2026-06-13T14:00:00']]));
    expect(g.bands[0].widthPx).toBeGreaterThanOrEqual(44);
    expect(g.dayWidthPx).toBeGreaterThan(120);
  });
  it('clamps day width so a single 24h slot does not produce an enormous column', () => {
    const g = buildGridGeometryFromSlots(slots([['2026-06-13T00:00:00', '2026-06-14T00:00:00']]));
    expect(g.dayWidthPx).toBeLessThanOrEqual(240);
  });
});

describe('generateSlots', () => {
  it('expands two 12h slots per day across a 2-day window', () => {
    const s = generateSlots({ from: '2026-06-13T00:00:00', to: '2026-06-15T00:00:00', slotStartTimes: ['06:00', '18:00'], incrementHours: 12 });
    expect(s).toHaveLength(4);
    expect(new Date(s[0].start).getHours()).toBe(6);
    expect(new Date(s[1].start).getHours()).toBe(18);
    expect(new Date(s[1].end).getDate()).toBe(14); // overnight crosses midnight
    expect(new Date(s[2].start).getDate()).toBe(14);
  });
  it('single 24h slot/day → one slot per day', () => {
    const s = generateSlots({ from: '2026-06-13T00:00:00', to: '2026-06-15T00:00:00', slotStartTimes: ['00:00'], incrementHours: 24 });
    expect(s).toHaveLength(2);
  });
  it('parses the Strapi time format "HH:mm:ss.SSS" for slot starts (not just "HH:mm")', () => {
    const s = generateSlots({ from: '2026-06-13T00:00:00', to: '2026-06-14T00:00:00', slotStartTimes: ['06:00:00.000', '18:00:00.000'], incrementHours: 12 });
    expect(s).toHaveLength(2);
    expect(new Date(s[0].start).getHours()).toBe(6);
    expect(new Date(s[1].start).getHours()).toBe(18);
  });
  it('skips malformed slot start times instead of throwing', () => {
    const s = generateSlots({ from: '2026-06-13T00:00:00', to: '2026-06-14T00:00:00', slotStartTimes: ['06:00', 'garbage', ''], incrementHours: 12 });
    expect(s).toHaveLength(1);
    expect(new Date(s[0].start).getHours()).toBe(6);
  });
  it('feeds buildGridGeometryFromSlots: overnight slot splits into two ¼ bands sharing one cellIndex', () => {
    const g = buildGridGeometryFromSlots(generateSlots({ from: '2026-06-13T00:00:00', to: '2026-06-14T00:00:00', slotStartTimes: ['06:00', '18:00'], incrementHours: 12 }));
    const overnight = g.bands.filter(b => b.cellIndex === 1);
    expect(overnight).toHaveLength(2);
    expect(overnight.every(b => b.isSegmentOfSplit)).toBe(true);
  });
});

describe('classifySlot', () => {
  it('a same-day slot is a day slot', () => {
    expect(classifySlot(12, 1)).toBe('day');
  });

  it('a sub-24h slot crossing midnight is a night slot', () => {
    expect(classifySlot(12, 2)).toBe('night');
    // Lazuri: 18:00 -> 17:00 next day is 23h, still a night tour.
    expect(classifySlot(23, 2)).toBe('night');
  });

  it('24h and longer is neither day nor night', () => {
    expect(classifySlot(24, 2)).toBe('long');   // 18:00 -> 18:00
    expect(classifySlot(24, 2)).toBe('long');   // 12:00 -> 12:00, two calendar days
    expect(classifySlot(36, 2)).toBe('long');   // Chita's 36h tour
    expect(classifySlot(48, 3)).toBe('long');
  });
});

describe('formatSlotLabel', () => {
  it('day and night slots keep the compact interval', () => {
    expect(formatSlotLabel('2026-08-18T06:00:00+03:00', '2026-08-18T18:00:00+03:00', 'day', 12)).toBe('06–18');
    expect(formatSlotLabel('2026-08-18T18:00:00+03:00', '2026-08-19T06:00:00+03:00', 'night', 12)).toBe('18–06');
  });

  it('long slots lead with the duration, because "18–18" reads as zero length', () => {
    expect(formatSlotLabel('2026-08-18T18:00:00+03:00', '2026-08-19T18:00:00+03:00', 'long', 24)).toBe(
      '24h · 18:00 → 18:00'
    );
    expect(formatSlotLabel('2026-08-18T06:00:00+03:00', '2026-08-19T18:00:00+03:00', 'long', 36)).toBe(
      '36h · 06:00 → 18:00'
    );
  });

  it('keeps a fractional duration readable', () => {
    expect(formatSlotLabel('2026-08-18T06:00:00+03:00', '2026-08-19T11:30:00+03:00', 'long', 29.5)).toBe(
      '29.5h · 06:00 → 11:30'
    );
  });
});

describe('headerSlots', () => {
  it('one header cell per slot, at slot start, full duration width', () => {
    // Two 12h slots: day 06–18 and overnight 18–06.
    const slots = [
      { start: '2026-08-18T06:00:00+03:00', end: '2026-08-18T18:00:00+03:00' },
      { start: '2026-08-18T18:00:00+03:00', end: '2026-08-19T06:00:00+03:00' },
    ];
    const g = buildGridGeometryFromSlots(slots);
    expect(g.headerSlots).toHaveLength(2);
    const [d, n] = g.headerSlots;
    const halfDay = g.dayWidthPx / 2;
    expect(d.label).toBe('06–18');
    expect(d.leftPx).toBeCloseTo(g.dayWidthPx * 0.25); // 06:00 = quarter day in
    expect(d.widthPx).toBeCloseTo(halfDay);
    expect(n.label).toBe('18–06');
    expect(d.kind).toBe('day');
    expect(n.kind).toBe('night');
    expect(n.leftPx).toBeCloseTo(g.dayWidthPx * 0.75);
    expect(n.widthPx).toBeCloseTo(halfDay); // overnight width NOT clipped at midnight
  });

  it('classifies a 24h slot as long, not night', () => {
    const slots = [
      { start: '2026-08-18T18:00:00+03:00', end: '2026-08-19T18:00:00+03:00' },
      { start: '2026-08-19T18:00:00+03:00', end: '2026-08-20T18:00:00+03:00' },
    ];
    const g = buildGridGeometryFromSlots(slots);
    expect(g.headerSlots.map(h => h.kind)).toEqual(['long', 'long']);
    expect(g.headerSlots[0].label).toBe('24h · 18:00 → 18:00');
  });

  it('returns an empty array for the zero-slots branch', () => {
    const g = buildGridGeometryFromSlots([]);
    expect(g.headerSlots).toEqual([]);
  });
});

describe('visibleColumnRange', () => {
  it('returns the day-index window around the scroll offset (with buffer)', () => {
    // dayWidth 100, viewport 350, scrollX 250 → visible days 2..6; buffer 1 → 1..7
    expect(visibleColumnRange(250, 350, 100, 1)).toEqual({ firstDay: 1, lastDay: 7 });
  });
  it('clamps firstDay at 0', () => {
    expect(visibleColumnRange(0, 300, 100, 2).firstDay).toBe(0);
  });
  it('larger buffer widens the window', () => {
    const r = visibleColumnRange(500, 200, 100, 3);
    expect(r.firstDay).toBe(2);  // floor(500/100)=5 -3 =2
    expect(r.lastDay).toBe(10);  // floor((500+200)/100)=7 +3 =10
  });
});
