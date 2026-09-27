import { describe, expect, it } from 'vitest';
import { mergePages, monthWindow } from './availabilityPaging';
import type { LakeAvailability } from '../schemas';

// Same as fish: the device-local month boundaries are asserted in the Romanian zone.
process.env.TZ = 'Europe/Bucharest';

describe('monthWindow', () => {
  it('offset 0 = current month [start, nextStart)', () => {
    const w = monthWindow(0, new Date('2026-06-15T10:00:00'));
    expect(w.from.slice(0, 10)).toBe('2026-06-01');
    expect(w.to.slice(0, 10)).toBe('2026-07-01');
  });
  it('offset -1 = previous month', () => {
    const w = monthWindow(-1, new Date('2026-06-15T10:00:00'));
    expect(w.from.slice(0, 10)).toBe('2026-05-01');
    expect(w.to.slice(0, 10)).toBe('2026-06-01');
  });
  it('offset +2 = two months ahead', () => {
    const w = monthWindow(2, new Date('2026-06-15T10:00:00'));
    expect(w.from.slice(0, 10)).toBe('2026-08-01');
    expect(w.to.slice(0, 10)).toBe('2026-09-01');
  });
});

describe('mergePages', () => {
  it('unions stands/config from the first page and dedupes intervals', () => {
    const base = {
      lakeId: 'l', bookingEnabled: true, incrementHours: 12, slotStartTimes: ['06:00'], timezone: 'Europe/Bucharest',
      stands: [{ documentId: 's1', name: '1', coordinates: null, extras: [] }],
    };
    const p1 = { ...base, bookings: [{ standDocumentId: 's1', start: 'A', end: 'B' }], blocks: [], window: { from: 'm1', to: 'm2' } };
    const p2 = { ...base,
      bookings: [{ standDocumentId: 's1', start: 'A', end: 'B' }, { standDocumentId: 's1', start: 'C', end: 'D' }],
      blocks: [{ standDocumentId: null, start: 'E', end: 'F', reason: 'competition' }],
      window: { from: 'm2', to: 'm3' } };
    const merged = mergePages([p1 as unknown as LakeAvailability, p2 as unknown as LakeAvailability]);
    expect(merged.stands).toHaveLength(1);
    expect(merged.bookings).toHaveLength(2); // (A,B) deduped
    expect(merged.blocks).toHaveLength(1);
    expect(merged.loadedRange).toEqual({ from: 'm1', to: 'm3' });
  });
  it('mergePages([]) returns a safe empty result (no throw)', () => {
    const m = mergePages([]);
    expect(m.stands).toEqual([]);
    expect(m.bookings).toEqual([]);
    expect(m.blocks).toEqual([]);
    expect(m.loadedRange).toEqual({ from: '', to: '' });
  });
  it('preserves config (timezone/slotStartTimes/incrementHours) from the first page', () => {
    const base = { lakeId: 'l', bookingEnabled: true, incrementHours: 12, slotStartTimes: ['06:00','18:00'], timezone: 'Europe/Bucharest', stands: [], bookings: [], blocks: [] };
    const merged = mergePages([{ ...base, window: { from: 'a', to: 'b' } } as unknown as LakeAvailability]);
    expect(merged.timezone).toBe('Europe/Bucharest');
    expect(merged.slotStartTimes).toEqual(['06:00','18:00']);
    expect(merged.incrementHours).toBe(12);
  });
  it('carries the per-lake leadHours from the first page, defaulting to 24 when the backend omits it', () => {
    const base = { lakeId: 'l', bookingEnabled: true, incrementHours: 12, slotStartTimes: ['06:00'], timezone: 'Europe/Bucharest', stands: [], bookings: [], blocks: [] };
    expect(mergePages([{ ...base, leadHours: 6, window: { from: 'a', to: 'b' } } as unknown as LakeAvailability]).leadHours).toBe(6);
    expect(mergePages([{ ...base, window: { from: 'a', to: 'b' } } as unknown as LakeAvailability]).leadHours).toBe(24);
    expect(mergePages([]).leadHours).toBe(24);
  });

  it('carries the lake extras from the first page', () => {
    const base = { lakeId: 'l', bookingEnabled: true, incrementHours: 12, slotStartTimes: ['06:00'], timezone: 'Europe/Bucharest', stands: [], bookings: [], blocks: [], extras: [{ key: 'cabin', label: 'Cabană', price: 150, unit: 'perNight' }] };
    const merged = mergePages([{ ...base, window: { from: 'a', to: 'b' } } as unknown as LakeAvailability]);
    expect(merged.extras).toEqual([{ key: 'cabin', label: 'Cabană', price: 150, unit: 'perNight' }]);
  });
});
