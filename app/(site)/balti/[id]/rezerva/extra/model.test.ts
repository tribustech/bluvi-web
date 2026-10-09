import { describe, expect, it } from 'vitest';
import { mergePages, type BookingQuote, type LakeAvailability } from '@/core/booking';
import { walkInFlow } from '@/app/(site)/operator/[lakeId]/calendar/_walkin/flowConfig';
import { stepHref } from '../_flow/params';
import { continueHeld, extraLine, extrasRedirect, keepOffered, quoteView, toggleExtra, tourNights } from './model';

process.env.TZ = 'Europe/Bucharest';

const page = (over: Partial<LakeAvailability> = {}): LakeAvailability => ({
  lakeId: 'l',
  bookingEnabled: true,
  incrementHours: 12,
  checkoutBufferMinutes: 0,
  leadHours: 24,
  slotStartTimes: ['06:00', '18:00'],
  timezone: 'Europe/Bucharest',
  stands: [
    { documentId: 's1', name: '1', coordinates: null, extras: [] },
    { documentId: 's2', name: '2', coordinates: null, extras: ['cabana', 'mat'] },
  ],
  extras: [
    { key: 'cabana', label: 'Cabană', price: 150, unit: 'perNight' },
    { key: 'mat', label: 'Saltea', price: 30, unit: 'perStay' },
  ],
  bookings: [],
  blocks: [],
  window: { from: '2026-10-01T00:00:00+03:00', to: '2026-11-01T00:00:00+02:00' },
  ...over,
});

const NIGHT = { stand: 's2', start: '2026-10-10T18:00:00+03:00', end: '2026-10-11T18:00:00+03:00' };
const DAY = { stand: 's2', start: '2026-10-10T06:00:00+03:00', end: '2026-10-10T18:00:00+03:00' };

describe('extras guard (booking.rezerva-extra.c1, c2)', () => {
  const merged = mergePages([page()]);
  const onlyNightly = mergePages([page({ stands: [{ documentId: 's2', name: '2', coordinates: null, extras: ['cabana'] }] })]);

  it('no selection → the bare grid, before the availability is known', () => {
    expect(extrasRedirect('l', { selection: null, extras: [] }, null)).toBe('/balti/l/rezerva');
  });

  it('waits for the availability with a selection', () => {
    expect(extrasRedirect('l', { selection: NIGHT, extras: [] }, null)).toBeNull();
  });

  it('a stand the lake no longer has, or booking turned off → the bare grid', () => {
    expect(extrasRedirect('l', { selection: { ...NIGHT, stand: 'gone' }, extras: [] }, merged)).toBe('/balti/l/rezerva');
    expect(extrasRedirect('l', { selection: NIGHT, extras: [] }, mergePages([page({ bookingEnabled: false })]))).toBe('/balti/l/rezerva');
  });

  it('nothing to add to this tour → the grid with the selection kept, extras dropped', () => {
    expect(extrasRedirect('l', { selection: { ...NIGHT, stand: 's1' }, extras: ['cabana'] }, merged)).toBe(
      stepHref('l', 'grid', { selection: { ...NIGHT, stand: 's1' }, extras: [] })
    );
    // A day tour on a stand that only sells a per-night extra (fish offeredExtras).
    expect(extrasRedirect('l', { selection: DAY, extras: [] }, onlyNightly)).toBe(stepHref('l', 'grid', { selection: DAY, extras: [] }));
  });

  it('renders when the stand adds something', () => {
    expect(extrasRedirect('l', { selection: NIGHT, extras: [] }, merged)).toBeNull();
    expect(extrasRedirect('l', { selection: DAY, extras: [] }, merged)).toBeNull(); // the per-stay mat
  });

  it('walk-in (operator.calendar-extra.c1): the same rules, onto the operator calendar', () => {
    const w = walkInFlow('l');
    expect(extrasRedirect('l', { selection: null, extras: [] }, null, w)).toBe('/operator/l/calendar');
    expect(extrasRedirect('l', { selection: { ...NIGHT, stand: 'gone' }, extras: [] }, merged, w)).toBe('/operator/l/calendar');
    expect(extrasRedirect('l', { selection: DAY, extras: ['cabana'] }, onlyNightly, w)).toBe(
      `/operator/l/calendar?stand=s2&start=${encodeURIComponent(DAY.start)}&end=${encodeURIComponent(DAY.end)}`
    );
    expect(extrasRedirect('l', { selection: NIGHT, extras: [] }, merged, w)).toBeNull();
  });
});

describe('extra cards (c5)', () => {
  const [cabana, mat] = page().extras;

  it('per night: price × nights and the note, owner plural rule', () => {
    expect(extraLine(cabana, 1)).toEqual({ price: 150, note: '150 lei/noapte · 1 noapte' });
    expect(extraLine(cabana, 2)).toEqual({ price: 300, note: '150 lei/noapte · 2 nopți' });
    expect(extraLine(cabana, 20).note).toBe('150 lei/noapte · 20 de nopți');
  });

  it('per stay: the flat price, no note', () => {
    expect(extraLine(mat, 3)).toEqual({ price: 30, note: null });
  });

  it('nights are lake-local midnights crossed', () => {
    const merged = mergePages([page()]);
    expect(tourNights(merged, NIGHT)).toBe(1);
    expect(tourNights(merged, DAY)).toBe(0);
    expect(tourNights(merged, { ...NIGHT, end: '2026-10-13T06:00:00+03:00' })).toBe(3);
  });
});

describe('chosen extras (c6)', () => {
  it('toggles keep the list sorted and unique', () => {
    expect(toggleExtra(['mat'], 'cabana', true)).toEqual(['cabana', 'mat']);
    expect(toggleExtra(['cabana', 'mat'], 'cabana', true)).toEqual(['cabana', 'mat']);
    expect(toggleExtra(['cabana', 'mat'], 'mat', false)).toEqual(['cabana']);
  });

  it('drops URL keys this tour cannot have', () => {
    expect(keepOffered(['zzz', 'mat'], page().extras)).toEqual(['mat']);
  });
});

describe('quote view (c6, c7)', () => {
  const priced: BookingQuote = {
    total: 350,
    basis: { durationHours: 24, rowLabel: null, composedFrom: [24], tourPrice: 200, extras: [] },
    refusal: null,
  };
  const refused: BookingQuote = { total: null, basis: null, refusal: { code: 'X', message: 'Nu.' } };
  const q = (over: Partial<Parameters<typeof quoteView>[0]>) =>
    quoteView({ data: undefined, isPlaceholderData: false, isFetching: false, isError: false, ...over });

  it('priced: Continuă enabled; the same list re-read behind its answer: held', () => {
    expect(continueHeld(q({ data: priced }))).toBe(false);
    const again = q({ data: priced, isFetching: true });
    expect(again).toMatchObject({ kind: 'priced', total: 350, refreshing: true });
    expect(continueHeld(again)).toBe(true);
  });

  it("another list's answer (placeholder) is never this one's price", () => {
    expect(q({ data: priced, isPlaceholderData: true, isFetching: true })).toEqual({ kind: 'quoting' });
  });

  it('refused and failed hold the CTA', () => {
    expect(q({ data: refused })).toEqual({ kind: 'refused', message: 'Nu.' });
    expect(q({ isError: true })).toEqual({ kind: 'failed' });
    expect(continueHeld(q({ data: refused }))).toBe(true);
    expect(continueHeld(q({ isError: true }))).toBe(true);
  });
});
