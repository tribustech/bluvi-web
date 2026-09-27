// Ported from fish `features/partide/components/card/cardModel.ts` (pure).
/**
 * Pure selectors and copy rules shared by every partidă card (spec
 * 2026-07-27). Framework-free so the shape and wording rules can be tested
 * without rendering anything.
 */
import { MONTH_ABBR_RO_ROMONTHS as MONTH_ABBR_RO } from './format';
import { standLabel } from './standLabel';

const pad2 = (n: number) => String(n).padStart(2, '0');

export type LiveCardShape = 'solo' | 'duel' | 'leaderboard';

/** Which live card a venue gets, decided ONLY by how many live sessions share it. */
export function liveCardShape(sessionCount: number): LiveCardShape {
  if (sessionCount <= 1) return 'solo';
  if (sessionCount === 2) return 'duel';
  return 'leaderboard';
}

/**
 * The venue header's count line. We only say "standuri" when EVERY session in
 * the venue actually sits on a stand — a public water or a dropped pin has no
 * stands, and claiming otherwise would be wrong.
 */
export function venueCountLabel(sessions: { standName: string | null }[], isDuel: boolean): string {
  const noun = sessions.length > 0 && sessions.every(s => !!s.standName) ? 'standuri' : 'partide';
  return `${sessions.length} ${noun} ${isDuel ? 'în duel' : 'în întrecere'}`;
}

// The stand copy rule lives in helpers/ so `sessionSubtitle` can share it
// without a component-layer import; re-exported here for the card barrel.
export { standLabel, standSuffix } from './standLabel';

/** "Ilfov · Stand 3" for a venue-titled card; either half may be absent. */
export function venueSubtitle(locality: string | null, standName: string | null): string {
  return [locality, standLabel(standName)].filter(Boolean).join(' · ');
}

/** 0..1 of the leader's total, clamped. 0 whenever the ratio is undefined. */
export function barFraction(totalKg: number | null, leaderKg: number | null): number {
  if (totalKg == null || leaderKg == null || leaderKg <= 0) return 0;
  return Math.max(0, Math.min(1, totalKg / leaderKg));
}

/** "1 captură" / "9 capturi"; null when the count is unknown. */
export function catchesLabel(n: number | null): string | null {
  if (n == null) return null;
  return `${n} ${n === 1 ? 'captură' : 'capturi'}`;
}

/**
 * "6h 40m" / "1h 05m" / "40 min" — the single shared duration formatter for
 * every card's "de pescuit"/"durată" stat AND the "acum …" footer caption
 * (`agoRo` below). Minutes are always zero-padded once there is an hour part
 * ("1h 05m", never "1h 5m") — this used to drift between cards (some dropped
 * the minutes entirely at :00, some left them unpadded); this is now the only
 * copy.
 */
export function fmtSpan(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${pad2(m)}m` : `${m} min`;
}

/** "26 iul · 06:40 – 18:10" — the finished/history card's date-range footer
 *  caption, shared by every card that shows a start/end pair. */
export function fmtRange(startedAt: string | number, endedAt: string | number): string {
  const s = new Date(startedAt);
  const e = new Date(endedAt);
  return `${s.getDate()} ${MONTH_ABBR_RO[s.getMonth()]} · ${pad2(s.getHours())}:${pad2(s.getMinutes())} – ${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
}

/** "acum 18 min" / "acum 1h 05m" from an ISO timestamp — a live card's
 *  relative-time caption. Built on the shared `fmtSpan` so its hour/minute
 *  padding can never drift from the "de pescuit" stat next to it; the CMS
 *  never sends a formatted relative string, so this arithmetic is always
 *  current even on a cached body. `null` when there is no timestamp to
 *  measure from. */
export function agoRo(now: number, iso: string | null | undefined): string | null {
  if (!iso) return null;
  return `acum ${fmtSpan(now - new Date(iso).getTime())}`;
}

/**
 * Exactly one side of a duel leads on a real numeric gap; a genuine tie
 * highlights neither (task-12 review contract 1). `totalKg` is only ever
 * `null` on the wire for "no weighed catches recorded yet", which the CMS
 * itself already treats as the worst rank (`sessions` sorted `totalKg` desc,
 * nulls last) — so a null side never outranks a real one, and two nulls tie
 * exactly like two equal numbers do: neither is the leader. Call this
 * symmetrically as `isDuelLeader(a, b)` / `isDuelLeader(b, a)` so exactly one
 * or neither side is ever `true` — never both.
 */
export function isDuelLeader(mineKg: number | null, otherKg: number | null): boolean {
  if (mineKg == null) return false;
  if (otherKg == null) return true;
  if (mineKg === otherKg) return false;
  return mineKg > otherKg;
}
