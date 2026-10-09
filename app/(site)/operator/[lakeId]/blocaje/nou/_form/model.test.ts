import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDayKey } from '@/core/booking';
import { ApiError } from '@/core/transport';
import {
  buildInputs,
  calendarError,
  COPY,
  dayLabel,
  dayName,
  dayStatus,
  defaultFocus,
  endHours,
  failureMessage,
  monthGrid,
  monthOffsetOf,
  pageIndexOf,
  remainingStands,
  moveKey,
  rejectedSave,
  saveHint,
  savedMessage,
  scopeText,
  selectionLine,
  startHours,
  validateBlock,
  validatePeriod,
} from './model';

// Device-local like fish (date-fns); the unit project runs in the machine's zone, so every instant
// here is built from local fields.
const iso = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).toISOString();
const NOW = new Date(2026, 9, 9, 10).getTime(); // Vineri 9 oct 2026, 10:00

describe('hours (c9)', () => {
  const opts = ['00:00', '06:00', '18:00', '24:00'];
  it('start: 00:00 + tour starts, never 24:00; end: tour starts + 24:00, never 00:00', () => {
    expect(startHours(opts)).toEqual(['00:00', '06:00', '18:00']);
    expect(endHours(opts)).toEqual(['06:00', '18:00', '24:00']);
  });
});

describe('selectionLine (c8)', () => {
  it('nothing → start → range, «zi» / «zile» through formatCount', () => {
    expect(selectionLine({})).toEqual({ text: 'Apasă ziua de început, apoi ziua de sfârșit.', complete: false });
    expect(selectionLine({ startDate: '2026-09-05' }).text).toBe('Sâmbătă, 5 sep → apasă ziua de sfârșit (aceeași zi = o singură zi)');
    expect(selectionLine({ startDate: '2026-10-09', endDate: '2026-10-09' })).toEqual({ text: 'Vineri, 9 oct → Vineri, 9 oct · 1 zi', complete: true });
    expect(selectionLine({ startDate: '2026-10-09', endDate: '2026-10-11' }).text).toBe('Vineri, 9 oct → Duminică, 11 oct · 3 zile');
    expect(selectionLine({ startDate: '2026-10-01', endDate: '2026-10-25' }).text).toMatch(/· 25 de zile$/);
  });
  it('dayLabel crosses DST without slipping a day (local keys)', () => {
    expect(dayLabel('2026-10-25')).toBe('Duminică, 25 oct');
    expect(dayLabel('2026-03-29')).toBe('Duminică, 29 mar');
  });
});

describe('validation (c12 c13)', () => {
  it('fish messages, field by field', () => {
    expect(validatePeriod({ startDate: '', endDate: '' }, NOW)).toEqual({ startDate: COPY.startRequired, endDate: COPY.endRequired });
    expect(validatePeriod({ startDate: iso(2026, 10, 10, 18), endDate: iso(2026, 10, 10, 6) }, NOW)).toEqual({ endDate: COPY.endAfterStart });
    expect(validatePeriod({ startDate: iso(2026, 10, 10, 18), endDate: iso(2026, 10, 10, 18) }, NOW)).toEqual({ endDate: COPY.endAfterStart });
    expect(validatePeriod({ startDate: iso(2026, 10, 9), endDate: iso(2026, 10, 9, 6) }, NOW)).toEqual({ endDate: COPY.inPast });
    expect(validatePeriod({ startDate: iso(2026, 10, 9), endDate: iso(2026, 10, 10) }, NOW)).toEqual({});
    expect(validateBlock({ startDate: iso(2026, 10, 9), endDate: iso(2026, 10, 10), note: 'x'.repeat(501) }, NOW)).toEqual({ note: COPY.noteTooLong });
    expect(validateBlock({ startDate: iso(2026, 10, 9), endDate: iso(2026, 10, 10), note: 'x'.repeat(500) }, NOW)).toEqual({});
  });
  it('the line under the calendar', () => {
    const empty = { startDate: COPY.startRequired, endDate: COPY.endRequired };
    expect(calendarError(empty, {})).toBe(COPY.startRequired);
    expect(calendarError(empty, { startDate: '2026-10-10' })).toBe(COPY.tapEnd);
    expect(calendarError({ endDate: COPY.inPast }, { startDate: '2026-10-09', endDate: '2026-10-09' })).toBe(COPY.inPast);
    expect(calendarError({}, { startDate: '2026-10-09', endDate: '2026-10-09' })).toBeUndefined();
    expect(calendarError({ note: COPY.noteTooLong }, {})).toBeUndefined();
  });
});

describe('rejectedSave (c14)', () => {
  it('the first invalid field; «apasă și ziua de sfârșit» for a lone start; date errors scroll', () => {
    const empty = { startDate: COPY.startRequired, endDate: COPY.endRequired };
    expect(rejectedSave(empty, {})).toEqual({ message: COPY.startRequired, dateField: true });
    expect(rejectedSave(empty, { startDate: '2026-10-10' })).toEqual({ message: COPY.tapEnd, dateField: true });
    expect(rejectedSave({ endDate: COPY.inPast, note: COPY.noteTooLong }, { startDate: 'a', endDate: 'a' })).toEqual({ message: COPY.inPast, dateField: true });
    expect(rejectedSave({ note: COPY.noteTooLong }, {})).toEqual({ message: COPY.noteTooLong, dateField: false });
    expect(rejectedSave({}, {})).toEqual({ message: COPY.checkData, dateField: false });
  });
});

describe('save (c16 c17 c18)', () => {
  const v = { startDate: 's', endDate: 'e', reason: 'closure' as const, note: '  hi  ' };
  it('one input per stand in pick order, or one whole-lake input; the note trimmed or left out', () => {
    expect(buildInputs('L', [], v)).toEqual([{ lake: 'L', startDate: 's', endDate: 'e', reason: 'closure', note: 'hi' }]);
    expect(buildInputs('L', ['b', 'a'], { ...v, note: '   ' })).toEqual([
      { lake: 'L', startDate: 's', endDate: 'e', reason: 'closure', stand: 'b' },
      { lake: 'L', startDate: 's', endDate: 'e', reason: 'closure', stand: 'a' },
    ]);
  });
  it('messages', () => {
    expect(savedMessage(1)).toBe('Blocaj adăugat');
    expect(savedMessage(3)).toBe('3 blocaje adăugate');
    expect(savedMessage(20)).toBe('20 de blocaje adăugate');
    expect(savedMessage(21)).toBe('21 de blocaje adăugate');
    const coded = new ApiError({ message: 'Perioada e în trecut.', status: 400, code: 'HTTP', bluCode: 'BLOCK_IN_PAST' });
    const bare = new ApiError({ message: 'A apărut o eroare necunoscută.', status: 500, code: 'HTTP' });
    expect(failureMessage(0, 1, coded)).toBe('Perioada e în trecut.');
    expect(failureMessage(1, 2, coded)).toBe('1 din 2 blocaje adăugate. Perioada e în trecut. Am păstrat doar standurile rămase.');
    expect(failureMessage(20, 21, bare)).toBe(`20 din 21 de blocaje adăugate. ${COPY.saveFailed} ${COPY.keptRemaining}`);
    expect(failureMessage(0, 2, bare)).toBe(COPY.saveFailed);
    expect(saveHint(1)).toBeUndefined();
    expect(saveHint(2)).toBe('Se adaugă 2 blocaje, câte unul pe stand.');
    expect(saveHint(21)).toBe('Se adaugă 21 de blocaje, câte unul pe stand.');
  });
  it('a partial failure keeps only the stands that did not save (a retry never duplicates)', () => {
    const inputs = buildInputs('L', ['b', 'a', 'c'], v);
    expect(remainingStands(['b', 'a', 'c'], inputs.slice(0, 1))).toEqual(['a', 'c']);
    expect(remainingStands(['b', 'a', 'c'], inputs.slice(0, 2))).toEqual(['c']);
    expect(remainingStands([], buildInputs('L', [], v))).toEqual([]);
  });
  it('scope text in pick order', () => {
    const stands = [
      { documentId: 'a', name: '1' },
      { documentId: 'b', name: '2' },
    ];
    expect(scopeText([], stands)).toBe('Tot lacul');
    expect(scopeText(['b'], stands)).toBe('Standul 2');
    expect(scopeText(['b', 'a'], stands)).toBe('Standurile 2, 1');
  });
});

describe('calendar (c4 c5) + keyboard', () => {
  it('Monday-first month grid and its title', () => {
    const oct = monthGrid('2026-10-09', 0);
    expect(oct.title).toBe('Octombrie 2026');
    expect(oct.lead).toBe(3); // 1 oct 2026 is a Thursday
    expect(oct.days).toHaveLength(31);
    expect(oct.days[0]).toBe('2026-10-01');
    expect(monthGrid('2026-10-09', 3).title).toBe('Ianuarie 2027');
    expect(monthGrid('2026-10-31', 1).days).toHaveLength(30); // no 31-day overflow into December
    expect(monthOffsetOf('2026-10-09', '2027-01-15')).toBe(3);
  });
  describe('page of the month on screen across a month boundary (fake timers)', () => {
    afterEach(() => vi.useRealTimers());
    it('maps the calendar month to the page counted from the pinned mount day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 31, 23, 59)); // mounted on 31 Oct, 23:59 local
      const nowKey = localDayKey(new Date()); // pinned at mount (useBlockAvailability's `now`)
      expect(pageIndexOf(nowKey, localDayKey(Date.now()), 0)).toBe(0);
      expect(pageIndexOf(nowKey, localDayKey(Date.now()), 2)).toBe(2);
      vi.advanceTimersByTime(2 * 60_000); // past midnight: useTodayKey now reads 1 Nov
      const todayKey = localDayKey(Date.now());
      expect(todayKey).toBe('2026-11-01');
      // The calendar now opens on November (offset 0): that is page 1, never page 0 (October).
      expect(monthGrid(todayKey, 0).title).toBe('Noiembrie 2026');
      expect(pageIndexOf(nowKey, todayKey, 0)).toBe(1);
      expect(pageIndexOf(nowKey, todayKey, 2)).toBe(3);
    });
  });
  it('day colours: range, past, busy, free; unknown while the month is not loaded', () => {
    const busy = new Set(['2026-10-12']);
    expect(dayStatus('2026-10-08', '2026-10-09', {}, busy)).toBe('past');
    expect(dayStatus('2026-10-12', '2026-10-09', {}, busy)).toBe('busy');
    expect(dayStatus('2026-10-13', '2026-10-09', {}, busy)).toBe('free');
    expect(dayStatus('2026-10-13', '2026-10-09', {}, null)).toBe('unknown');
    expect(dayStatus('2026-10-12', '2026-10-09', { startDate: '2026-10-10', endDate: '2026-10-12' }, busy)).toBe('selected');
    expect(dayName('2026-10-09', 'free')).toBe('vineri, 9 octombrie 2026, liber');
    expect(dayName('2026-10-09', 'unknown')).toBe('vineri, 9 octombrie 2026');
  });
  it('arrows, Home/End, PageUp/PageDown; never before this month', () => {
    const today = '2026-10-09';
    expect(moveKey('2026-10-09', 'ArrowRight', today)).toBe('2026-10-10');
    expect(moveKey('2026-10-31', 'ArrowRight', today)).toBe('2026-11-01');
    expect(moveKey('2026-10-09', 'ArrowDown', today)).toBe('2026-10-16');
    expect(moveKey('2026-10-09', 'Home', today)).toBe('2026-10-05');
    expect(moveKey('2026-10-09', 'End', today)).toBe('2026-10-11');
    expect(moveKey('2027-01-31', 'PageDown', today)).toBe('2027-02-28');
    expect(moveKey('2026-10-09', 'PageUp', today)).toBe('2026-10-01');
    expect(moveKey('2026-10-02', 'ArrowUp', today)).toBe('2026-10-01');
    expect(moveKey('2026-10-09', 'a', today)).toBeNull();
    expect(defaultFocus(monthGrid(today, 0).days, today, {})).toBe(today);
    expect(defaultFocus(monthGrid(today, 1).days, today, {})).toBe('2026-11-01');
    expect(defaultFocus(monthGrid(today, 0).days, today, { startDate: '2026-10-20' })).toBe('2026-10-20');
  });
});
