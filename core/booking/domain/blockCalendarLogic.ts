/** fish `features/operator/blockCalendarLogic.ts` (verbatim). */
/**
 * Pure selection + coloring logic for the block mini-calendar.
 * Dates are 'yyyy-MM-dd' strings (lake-local calendar days).
 */

export type DayRange = { startDate?: string; endDate?: string };

/**
 * Range selection: first tap sets the start, second tap (same or later day)
 * sets the end; tapping before the current start restarts the selection.
 */
export function nextRange(current: DayRange, day: string): DayRange {
  if (!current.startDate || (current.startDate && current.endDate)) {
    return { startDate: day, endDate: undefined };
  }
  if (day < current.startDate) return { startDate: day, endDate: undefined };
  return { startDate: current.startDate, endDate: day };
}

export function isInRange(day: string, range: DayRange): boolean {
  if (!range.startDate) return false;
  if (!range.endDate) return day === range.startDate;
  return day >= range.startDate && day <= range.endDate;
}

/** Local (device-zone) 'yyyy-MM-dd' key — NOT toISOString(), which is UTC and would
 *  file a Friday-00:00 Romanian block under Thursday. */
export function localDayKey(t: number | Date): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Days touched by any interval — used to paint "busy" (red) days. */
export function busyDaySet(intervals: Array<{ start: string; end: string }>): Set<string> {
  const days = new Set<string>();
  const DAY = 24 * 60 * 60 * 1000;
  for (const { start, end } of intervals) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) continue;
    // Half-open [start, end): an interval ending at midnight does not touch that day.
    for (let t = s; t < e; t += DAY) {
      days.add(localDayKey(t));
    }
    // Cover the end day when the interval ends mid-day.
    days.add(localDayKey(e - 1));
  }
  return days;
}

/** Selectable block boundaries: midnight, the lake's slot starts, end of day.
 *  '24:00' means "end of the end day" (= next day 00:00). */
export function blockTimeOptions(slotStartTimes: string[]): string[] {
  const slots = slotStartTimes
    .map(t => t.slice(0, 5))
    .filter(t => /^\d{2}:\d{2}$/.test(t) && t !== '00:00' && t !== '24:00');
  return ['00:00', ...Array.from(new Set(slots)).sort(), '24:00'];
}

/** Local datetime from a day key + 'HH:mm' ('24:00' → next day 00:00). */
function localDateTime(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** The block's ISO interval for a picked day range + boundary times, or null while
 *  the range is incomplete. End time applies on the END day (Fri 18:00 → Sun 06:00). */
export function buildBlockInterval(
  range: DayRange,
  startTime: string,
  endTime: string
): { start: string; end: string } | null {
  if (!range.startDate || !range.endDate) return null;
  return {
    start: localDateTime(range.startDate, startTime).toISOString(),
    end: localDateTime(range.endDate, endTime).toISOString(),
  };
}
