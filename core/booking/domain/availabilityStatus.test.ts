import { describe, expect, it } from 'vitest';
import { indexExceptions, resolveSlotStatus, cellA11yLabel } from './availabilityStatus';
import type { OccupiedInterval, BlockedInterval } from '../schemas';

const bookings: OccupiedInterval[] = [
  { standDocumentId: 's1', start: '2026-06-13T06:00:00Z', end: '2026-06-13T18:00:00Z', initials: 'AP' },
];
const blocks: BlockedInterval[] = [
  { standDocumentId: 's2', start: '2026-06-13T06:00:00Z', end: '2026-06-13T18:00:00Z', reason: 'maintenance', label: 'Reparăm pontonul' },
  {
    standDocumentId: null,
    start: '2026-06-14T06:00:00Z',
    end: '2026-06-15T00:00:00Z',
    reason: 'competition',
    label: 'Cupa Bluvi',
    competitionId: 'comp-1',
  }, // lake-wide
];
const idx = indexExceptions(bookings, blocks);
const slot = (s: string, e: string) => ({ start: s, end: e });

describe('resolveSlotStatus', () => {
  const now = new Date('2026-06-13T12:00:00Z').getTime();
  it('booked when a booking overlaps that stand', () => {
    expect(resolveSlotStatus('s1', slot('2026-06-13T06:00:00Z','2026-06-13T18:00:00Z'), idx, now).status).toBe('booked');
  });
  it('blocked beats booked; lake-wide block applies to all stands', () => {
    expect(resolveSlotStatus('s1', slot('2026-06-14T06:00:00Z','2026-06-14T18:00:00Z'), idx, now).status).toBe('blocked');
  });
  it('per-stand block only affects that stand', () => {
    expect(resolveSlotStatus('s2', slot('2026-06-13T06:00:00Z','2026-06-13T18:00:00Z'), idx, now).status).toBe('blocked');
    expect(resolveSlotStatus('s1', slot('2026-06-13T18:00:00Z','2026-06-14T06:00:00Z'), idx, now).status).toBe('available'); // s1, no overlap with s2's block
  });
  it('available when nothing overlaps', () => {
    expect(resolveSlotStatus('s9', slot('2026-06-20T06:00:00Z','2026-06-20T18:00:00Z'), idx, now).status).toBe('available');
  });
  it('isPast true when slot starts before now (status still resolved)', () => {
    const r = resolveSlotStatus('s1', slot('2026-06-13T06:00:00Z','2026-06-13T18:00:00Z'), idx, now);
    expect(r.isPast).toBe(true);     // 06:00 < 12:00 now
    expect(r.status).toBe('booked'); // history still shows occupancy
  });
  it('isPast false for a future slot', () => {
    expect(resolveSlotStatus('s9', slot('2026-06-20T06:00:00Z','2026-06-20T18:00:00Z'), idx, now).isPast).toBe(false);
  });
  it('carries the booker initials on a booked slot only', () => {
    const booked = resolveSlotStatus('s1', slot('2026-06-13T06:00:00Z','2026-06-13T18:00:00Z'), idx, now);
    expect(booked.initials).toBe('AP');
    expect(booked.block).toBeNull();
    const free = resolveSlotStatus('s9', slot('2026-06-20T06:00:00Z','2026-06-20T18:00:00Z'), idx, now);
    expect(free.initials).toBe('');
  });
  it('carries the competition label + id on a lake-wide competition slot', () => {
    const r = resolveSlotStatus('s1', slot('2026-06-14T06:00:00Z','2026-06-14T18:00:00Z'), idx, now);
    expect(r.block).toMatchObject({ reason: 'competition', label: 'Cupa Bluvi', competitionId: 'comp-1' });
    expect(r.block?.start).toBe('2026-06-14T06:00:00Z');
    expect(r.block?.end).toBe('2026-06-15T00:00:00Z');
    expect(r.initials).toBe('');
  });
  it('carries the operator note on a per-stand manual block', () => {
    const r = resolveSlotStatus('s2', slot('2026-06-13T06:00:00Z','2026-06-13T18:00:00Z'), idx, now);
    expect(r.block).toMatchObject({ reason: 'maintenance', label: 'Reparăm pontonul', competitionId: null });
  });
  it('reports the stand-specific block when it overlaps a competition, matching the backend', () => {
    // s2 closed for maintenance ON the competition day: the stand's own reason wins.
    const overlapping = indexExceptions([], [
      { standDocumentId: 's2', start: '2026-06-14T00:00:00Z', end: '2026-06-15T00:00:00Z', reason: 'maintenance', label: 'Reparăm pontonul' },
      { standDocumentId: null, start: '2026-06-14T06:00:00Z', end: '2026-06-15T00:00:00Z', reason: 'competition', label: 'Cupa Bluvi', competitionId: 'comp-1' },
    ]);
    const r = resolveSlotStatus('s2', slot('2026-06-14T06:00:00Z','2026-06-14T18:00:00Z'), overlapping, now);
    expect(r.block?.reason).toBe('maintenance');
    // ...while any other stand still reports the competition.
    expect(resolveSlotStatus('s1', slot('2026-06-14T06:00:00Z','2026-06-14T18:00:00Z'), overlapping, now).block?.reason).toBe('competition');
  });
  it('defaults initials/label/competitionId when an older backend omits them', () => {
    const legacy = indexExceptions(
      [{ standDocumentId: 's1', start: '2026-06-13T06:00:00Z', end: '2026-06-13T18:00:00Z' }],
      [{ standDocumentId: null, start: '2026-06-14T06:00:00Z', end: '2026-06-15T00:00:00Z', reason: 'competition' }]
    );
    expect(resolveSlotStatus('s1', slot('2026-06-13T06:00:00Z','2026-06-13T18:00:00Z'), legacy, now).initials).toBe('');
    const b = resolveSlotStatus('s1', slot('2026-06-14T06:00:00Z','2026-06-14T18:00:00Z'), legacy, now).block;
    expect(b).toMatchObject({ reason: 'competition', label: null, competitionId: null });
  });
  it('adjacent (touching, non-overlapping) intervals do not count as overlap', () => {
    // booking ends 18:00; a slot starting exactly 18:00 must NOT be booked
    expect(resolveSlotStatus('s1', slot('2026-06-13T18:00:00Z','2026-06-14T06:00:00Z'), idx, now).status).toBe('available');
  });
});

describe('tooSoon (per-lake lead hours)', () => {
  it('honors a custom leadHours instead of the 24h default', () => {
    const idx = indexExceptions([], []);
    const now = new Date('2026-06-14T00:00:00Z').getTime();
    // Starts in 6h: too soon under the default 24h, fine under a 4h lead.
    const s = slot('2026-06-14T06:00:00Z', '2026-06-14T18:00:00Z');
    expect(resolveSlotStatus('s1', s, idx, now).tooSoon).toBe(true);
    expect(resolveSlotStatus('s1', s, idx, now, 4).tooSoon).toBe(false);
    // leadHours 0 = nothing is ever too soon.
    expect(resolveSlotStatus('s1', slot('2026-06-14T00:30:00Z', '2026-06-14T12:00:00Z'), idx, now, 0).tooSoon).toBe(false);
  });
});

describe('tooSoon (24h minimum lead)', () => {
  const now = new Date('2026-06-13T12:00:00Z').getTime();
  const idx = indexExceptions([], []);
  const slot = (start: string, end: string) => ({ start, end });

  it('flags an available slot starting under 24h from now', () => {
    const r = resolveSlotStatus('s1', slot('2026-06-14T06:00:00Z', '2026-06-14T18:00:00Z'), idx, now);
    expect(r.status).toBe('available');
    expect(r.tooSoon).toBe(true);
  });

  it('does not flag a slot at/beyond the 24h boundary', () => {
    expect(resolveSlotStatus('s1', slot('2026-06-14T12:00:00Z', '2026-06-15T00:00:00Z'), idx, now).tooSoon).toBe(false);
    expect(resolveSlotStatus('s1', slot('2026-06-20T06:00:00Z', '2026-06-20T18:00:00Z'), idx, now).tooSoon).toBe(false);
  });

  // isOver is what the operator grid spends a slot on: a running interval is still
  // sellable at the gate, an ended one never is.
  it('a running slot is past but not over', () => {
    const r = resolveSlotStatus('s1', slot('2026-06-13T06:00:00Z', '2026-06-13T18:00:00Z'), idx, now);
    expect(r.isPast).toBe(true);
    expect(r.isOver).toBe(false);
  });

  it('a slot ending exactly now is over', () => {
    const r = resolveSlotStatus('s1', slot('2026-06-13T00:00:00Z', '2026-06-13T12:00:00Z'), idx, now);
    expect(r.isOver).toBe(true);
  });

  it('a future slot is neither past nor over', () => {
    const r = resolveSlotStatus('s1', slot('2026-06-14T06:00:00Z', '2026-06-14T18:00:00Z'), idx, now);
    expect(r.isPast).toBe(false);
    expect(r.isOver).toBe(false);
  });

  it('past slots are not additionally tooSoon', () => {
    const r = resolveSlotStatus('s1', slot('2026-06-13T06:00:00Z', '2026-06-13T18:00:00Z'), idx, now);
    expect(r.isPast).toBe(true);
    expect(r.tooSoon).toBe(false);
  });
});

describe('cellA11yLabel', () => {
  it('available non-past speaks disponibil (cells carry no visible text)', () => {
    expect(cellA11yLabel('A1', 'available', false, false, '')).toBe('A1, disponibil');
  });
  it('booked and blocked non-past speak indisponibil', () => {
    expect(cellA11yLabel('A1', 'booked', false, false, '')).toBe('A1, indisponibil');
    expect(cellA11yLabel('A1', 'blocked', false, false, '')).toBe('A1, indisponibil');
  });
  it('past wins over status', () => {
    expect(cellA11yLabel('A1', 'available', true, false, '')).toBe('A1, trecut');
    expect(cellA11yLabel('A1', 'booked', true, false, '')).toBe('A1, trecut');
  });
  it('selected speaks the selection interval and appends selectat last', () => {
    expect(cellA11yLabel('A1', 'available', false, true, '18–06')).toBe('A1, 18–06, disponibil, selectat');
  });
});
