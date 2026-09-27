// Ported from fish `features/partide/helpers/format.ts` (pure).
// Small formatters for the session logger UI (Romanian).

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "6,4" — RON/RO decimal comma, one decimal */
/** Comma-decimal kg with 1–3 decimals: 6 → "6,0", 6.45 → "6,45", 3.125 → "3,125" */
export const fmtKg = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  const s = r.toFixed(3).replace(/0+$/, '');
  return (s.endsWith('.') ? `${s}0` : s).replace('.', ',');
};

/**
 * A weight sized for a stat cell, which is a quarter of the screen wide.
 *
 * `fmtKg` keeps every decimal because a single catch is read exactly — but a
 * season total is not, and it grows without a ceiling: a heavy year is four
 * digits before the comma, which no quarter-width cell can hold. Precision is
 * traded for magnitude as the number climbs, and past a tonne the unit changes
 * with it, so the string stays at most five characters ("99,99") however large
 * the weight gets — the width the cell was already built for.
 *
 *   8.4     → 8,4 kg      (a catch-sized number stays exact)
 *   204.33  → 204 kg      (hundreds don't need the grams)
 *   1204.33 → 1,2 t
 */
export const fmtKgStat = (n: number): { value: string; unit: string } => {
  const kg = Math.max(0, n);
  // Pick the band from the ROUNDED weight, not the raw one: 999,99 kg rounds to
  // "1000" and belongs in tonnes, but a raw `kg >= 1000` test leaves it in the
  // kg band and renders the four digits the band exists to avoid.
  const roundedKg = Math.round(kg);
  if (roundedKg >= 1000) {
    const t = Math.round(kg / 100) / 10;
    // Past a hundred tonnes the decimal is both meaningless and too wide.
    return t >= 100 ? { value: String(Math.round(t)), unit: 't' } : { value: fmtKg(t), unit: 't' };
  }
  if (roundedKg >= 100) return { value: String(roundedKg), unit: 'kg' };
  return { value: fmtKg(kg), unit: 'kg' };
};

/** "HH:MM:SS" countdown from ms */
export const fmtCountdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
};

/** Compact duration — "30:00" under an hour, "1:30:00" above (the card pill). */
export const fmtDurationCompact = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mmss = `${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
};

/** "14:23" wall-clock HH:MM from an epoch (ms) */
export const fmtClock = (epoch: number) => {
  const d = new Date(epoch);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** "04:12" elapsed (h:mm) from ms */
export const fmtElapsedShort = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

/** Duration, rounded: ≥1h → whole hours ("6h"), <1h → minutes ("45m"); clamped ≥0. */
export const fmtDurationShort = (ms: number): string => {
  const durationMs = Math.max(0, ms);
  return durationMs >= 3_600_000 ? `${Math.round(durationMs / 3_600_000)}h` : `${Math.round(durationMs / 60_000)}m`;
};

/**
 * Planned duration in RO words: under a day → "18h", otherwise days plus any
 * leftover hours ("2 zile", "3 zile 4h"). `fmtElapsedShort` would render a
 * week-long estimate as "168:00", which reads as a clock, not a duration.
 */
export const fmtPlannedDuration = (ms: number): string => {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  // Minutes only ever come from sessions planned with the old hours+minutes
  // wheel — the day wheel steps in whole hours — but those sessions still
  // render, and "1h30m" flooring to "1h" contradicts the estimated-end row.
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(days === 1 ? '1 zi' : `${days} zile`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) return '0m';
  return parts.join(' ');
};

/** Ended-partida subtitle: "17 sep · 6h" (RO start date + duration, same rule as fmtPastCardMeta). */
export const fmtEndedSubtitle = (startedAt: number, endedAt: number): string => {
  const date = new Date(startedAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  return `${date} · ${fmtDurationShort(endedAt - startedAt)}`;
};

/** Elapsed pill: ≥1h → "H:MM" (e.g. "3:38"), <1h → "MM:SS" (e.g. "12:05"); clamped ≥0. */
export const fmtElapsedPill = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total >= 3600) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}:${pad2(m)}`;
  }
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

/** "SEPTEMBRIE 2025" — ro-RO full month name (uppercased) + year, from an epoch (ms). */
export const fmtMonthHeader = (startedAt: number): string =>
  new Date(startedAt).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }).toUpperCase();

const MONTH_ABBR_RO = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Past-card meta line: "17 SEP · 6h · 4 capturi" — RO day + 3-letter month
 * (uppercase, no period), duration rounded to whole hours (≥1h) else minutes
 * (e.g. "45m"), and the capture count (same word regardless of count).
 */
/** "12 IUL" — RO day + 3-letter month abbreviation (uppercase), from an ISO timestamp. Used by the community stats record hero card. */
export function fmtRecordDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_ABBR_RO[d.getMonth()]}`;
}

export function fmtPastCardMeta(
  s: { startedAt: number; endedAt: number | null },
  captures: number,
  includeCaptures = true
): string {
  const d = new Date(s.startedAt);
  const dateLabel = `${d.getDate()} ${MONTH_ABBR_RO[d.getMonth()]}`;
  // A never-ended session has no duration to show — label its state instead.
  const durationLabel = s.endedAt == null ? 'în desfășurare' : fmtDurationShort(s.endedAt - s.startedAt);
  const base = `${dateLabel} · ${durationLabel}`;
  return includeCaptures ? `${base} · ${captures} capturi` : base;
}

/**
 * fish `helpers/roMonths.ts#MONTH_ABBR_RO` — the app-wide list, used by the partidă cards.
 * NOTE: fish carries two different November abbreviations: this list (and `monthlyStats`) say
 * "NOI", the local `MONTH_ABBR_RO` above (record date, past-card meta) says "NOV". Ported as-is.
 */
export const MONTH_ABBR_RO_ROMONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC'];
