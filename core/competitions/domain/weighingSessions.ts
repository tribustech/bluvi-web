/*
 * «Sesiuni de cântărire» — the pure grouping of fish components/competition/WeighingSessionTimeline.tsx
 * (`buildSessions` / `toSessionGroup`): normal weighings sorted by start, split into a new session
 * when the gap after the previous one exceeds 4 hours; extra weighings between sessions grouped as
 * «Extra-cântar». Times are the reader's local clock, as fish uses the device's.
 */
import type { WeighingStatisticsItem } from '../schemas';

/** fish GAP_MS. (fish's comment says 2 h; the constant — what it does — is 4 h.) */
const GAP_MS = 4 * 60 * 60 * 1000;

/** fish COLLAPSED_MAX: sessions shown before «Vezi toate cântarele». */
export const SESSIONS_COLLAPSED_MAX = 4;

const DAYS_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

export type WeighingSession = {
  type: 'normal' | 'extra';
  /** «Cântar 2 – Seară» / «Extra-cântar». */
  label: string;
  /** fish's glyph: ☀️ (before 14:00), 🌙, ⚡ for extras. */
  icon: '☀️' | '🌙' | '⚡';
  /** Before 14:00 (normal sessions): the morning one. */
  morning: boolean;
  /** «Sâmbătă, 07:00 – 09:30». */
  timeRange: string;
  totalKg: number;
  catchCount: number;
  standCount: number;
  weighingCount: number;
};

const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const endTs = (w: WeighingStatisticsItem) => new Date(w.endDate || w.startDate).getTime();
const startTs = (w: WeighingStatisticsItem) => new Date(w.startDate).getTime();

function toSession(items: WeighingStatisticsItem[], isExtra: boolean, normalIndex: number): WeighingSession {
  const firstStart = items[0].startDate;
  const last = items[items.length - 1];
  const lastEnd = last.endDate || last.startDate;
  const morning = new Date(firstStart).getHours() < 14;
  let totalKg = 0;
  let catchCount = 0;
  // fish counts stands by name (a sector's «1» and another's «1» count once) — kept.
  const stands = new Set<string>();
  for (const w of items) {
    totalKg += w.totalWeightKg;
    catchCount += w.catchCount;
    if (w.standName) stands.add(w.standName);
  }
  return {
    type: isExtra ? 'extra' : 'normal',
    label: isExtra ? 'Extra-cântar' : `Cântar ${normalIndex} – ${morning ? 'Dimineață' : 'Seară'}`,
    icon: isExtra ? '⚡' : morning ? '☀️' : '🌙',
    morning: !isExtra && morning,
    timeRange: `${DAYS_RO[new Date(firstStart).getDay()]}, ${formatTime(firstStart)} – ${formatTime(lastEnd)}`,
    totalKg,
    catchCount,
    standCount: stands.size,
    weighingCount: items.length,
  };
}

/** fish `buildSessions`. */
export function buildWeighingSessions(items: readonly WeighingStatisticsItem[]): WeighingSession[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => startTs(a) - startTs(b));
  const normals = sorted.filter(w => w.weighingType !== 'extra');
  const extras = sorted.filter(w => w.weighingType === 'extra');

  const normalSessions: WeighingStatisticsItem[][] = [];
  if (normals.length > 0) {
    let cur: WeighingStatisticsItem[] = [normals[0]];
    for (let i = 1; i < normals.length; i++) {
      if (startTs(normals[i]) - endTs(normals[i - 1]) > GAP_MS) {
        normalSessions.push(cur);
        cur = [normals[i]];
      } else {
        cur.push(normals[i]);
      }
    }
    normalSessions.push(cur);
  }

  if (normalSessions.length === 0) return [toSession(extras, true, 0)];

  const result: WeighingSession[] = [];
  const firstNormalStart = startTs(normalSessions[0][0]);
  const before = extras.filter(e => startTs(e) < firstNormalStart);
  if (before.length > 0) result.push(toSession(before, true, 0));

  normalSessions.forEach((session, i) => {
    result.push(toSession(session, false, i + 1));
    const thisEnd = endTs(session[session.length - 1]);
    const nextStart = i < normalSessions.length - 1 ? startTs(normalSessions[i + 1][0]) : Infinity;
    const between = extras.filter(e => {
      const t = startTs(e);
      return t >= thisEnd && t < nextStart;
    });
    if (between.length > 0) result.push(toSession(between, true, 0));
  });
  return result;
}

/** The footer: «Total: n capturi» and the kg of every session. */
export function weighingSessionsTotals(sessions: readonly WeighingSession[]): { kg: number; catches: number } {
  return sessions.reduce((acc, s) => ({ kg: acc.kg + s.totalKg, catches: acc.catches + s.catchCount }), { kg: 0, catches: 0 });
}
