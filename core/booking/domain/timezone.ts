/**
 * fish `features/lakes/booking/timezone.ts` (verbatim).
 *
 * Pure timezone math for the booking grid — built-in `Intl` only, NO dependency
 * (`date-fns-tz` is not installed). Slot start times are configured as LOCAL
 * clock times in the LAKE's timezone; on a device whose timezone differs from the
 * lake's, generating slot instants against the device clock yields the wrong UTC
 * instant (and the backend, which validates in the lake's zone, would reject it).
 *
 * This mirrors the technique used by the backend `booking/services/timezone.ts`
 * (`zoneOffsetMinutes` / `localSlotToUtc`), reimplemented here because the two
 * repos can't share code.
 */

// One formatter per zone, built once. A formatter is immutable, and constructing one
// is the most expensive thing in this file by far: the grid's mount called this once
// per slot per offset lookup — ~300 constructions, ~250ms of the mount on Hermes.
const partsFmtByZone = new Map<string, Intl.DateTimeFormat>();
const partsFmt = (timeZone: string): Intl.DateTimeFormat => {
  let fmt = partsFmtByZone.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFmtByZone.set(timeZone, fmt);
  }
  return fmt;
};

function wallParts(instant: Date, timeZone: string) {
  const p = partsFmt(timeZone)
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, x) => {
      if (x.type !== 'literal') acc[x.type] = x.value;
      return acc;
    }, {});
  return {
    y: +p.year,
    m: +p.month,
    d: +p.day,
    hour: +p.hour % 24, // h23 emits 24 for midnight in some engines; normalise
    minute: +p.minute,
    second: +p.second,
  };
}

/** UTC offset (minutes; local = UTC + offset) of `timeZone` at `instant`. */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const w = wallParts(instant, timeZone);
  const asUTC = Date.UTC(w.y, w.m - 1, w.d, w.hour, w.minute, w.second);
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/**
 * The UTC instant whose wall-clock reading in `timeZone` is the given calendar
 * date at `minuteOfDay` (minutes since local midnight). DST-correct: settles the
 * offset once across a DST boundary (mirrors the backend's `localSlotToUtc`).
 */
export function zonedWallTimeToUtc(
  year: number,
  month1: number, // 1-based month (1 = January), matching wall-clock intuition
  day: number,
  minuteOfDay: number,
  timeZone: string
): Date {
  const h = Math.floor(minuteOfDay / 60);
  const mi = minuteOfDay % 60;
  const naiveUTC = Date.UTC(year, month1 - 1, day, h, mi);
  const off1 = zoneOffsetMinutes(new Date(naiveUTC), timeZone);
  let utc = naiveUTC - off1 * 60000;
  const off2 = zoneOffsetMinutes(new Date(utc), timeZone);
  if (off2 !== off1) utc = naiveUTC - off2 * 60000; // settle DST boundary once
  return new Date(utc);
}

/** `+03:00` / `-05:30` style offset suffix for a UTC offset given in minutes. */
export function offsetSuffix(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * ISO 8601 string for a wall-clock time in `timeZone`. The literal date/time
 * fields are the lake's wall clock (so the grid still reads "06:00"), and the
 * offset suffix is the lake-zone offset at that instant — so `new Date(str)`
 * resolves to the CORRECT UTC instant and the backend (which validates in the
 * lake zone) accepts it. On a device already in the lake's zone this is
 * byte-identical to the previous device-local `format(..., ISO_FMT)` output.
 */
export function zonedWallTimeIso(
  year: number,
  month1: number,
  day: number,
  minuteOfDay: number,
  timeZone: string
): string {
  const instant = zonedWallTimeToUtc(year, month1, day, minuteOfDay, timeZone);
  const off = zoneOffsetMinutes(instant, timeZone);
  const h = Math.floor(minuteOfDay / 60);
  const mi = minuteOfDay % 60;
  return `${year}-${pad2(month1)}-${pad2(day)}T${pad2(h)}:${pad2(mi)}:00${offsetSuffix(off)}`;
}
