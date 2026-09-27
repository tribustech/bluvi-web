// Ported from fish `features/partide/helpers/history.ts` (pure).
// Groups ended sessions by calendar month for the Partidele mele history list.
import type { LocalSession } from './types';
import { fmtMonthHeader } from './format';

export type HistoryGroup = { key: string; title: string; sessions: LocalSession[] };

/** Ended sessions only (the active one is excluded); newest month first, newest session first within a month. */
export function groupSessionsByMonth(sessions: LocalSession[]): HistoryGroup[] {
  const byKey = new Map<string, LocalSession[]>();
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const arr = byKey.get(key);
    if (arr) arr.push(s);
    else byKey.set(key, [s]);
  }

  return Array.from(byKey.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, list]) => ({
      key,
      title: fmtMonthHeader(list[0].startedAt),
      sessions: list.slice().sort((a, b) => b.startedAt - a.startedAt),
    }));
}
