import {
  aggForSession,
  computeHistoryStats,
  listItemToSummaryLocalSession,
  monthlyStats,
  openHistoryEntries,
  type Aggregate,
  type HistoryEntry,
  type LocalSession,
  type MonthlyStats,
  type SessionListItemDTO,
} from '@/core/partide';

/** fish AleMeleScene HISTORY_PREVIEW_COUNT. */
export const HISTORY_PREVIEW_COUNT = 3;

export type AleMeleView = {
  /** c5 — counted over EVERY row, the live partidă included (c17). */
  stats: { partide: number; capturi: number; recordKg: number | null; totalKg: number };
  /** c11–c13 — over the rendered list (fish passes the render list). */
  monthly: MonthlyStats;
  /** c14 — open partide other than the live one (fish openHistoryEntries). */
  open: HistoryEntry[];
  /** c15 — the 3 most recent finished partide, newest start first. */
  preview: { session: LocalSession; agg: Aggregate }[];
  /** c6 — no partidă at all and none live. */
  isEmpty: boolean;
};

/** fish usePartideHistory ships history rows summary-only with an empty aggregates map. */
const NO_AGGREGATES: Record<string, Aggregate> = {};

/**
 * fish app/(app)/(tabs)/partide.tsx + usePartideHistory + AleMeleScene, as one pure derivation of
 * the own-sessions list (/feed/sessions/mine, every page) and the viewer's live partidă:
 *  - `all` (the COUNT list): every row, newest start first — the stat card reads it, so a running
 *    partidă keeps moving the figures (fish field bug 2026-08-08, parity c17);
 *  - `sessions` (the RENDER list): without the live partidă, which the dock (and from 1280 its card)
 *    already shows — a history row would double it.
 * The web knows the live partidă from the CMS probe (`liveDocumentId`), not a device pointer.
 */
export function aleMeleView(rows: SessionListItemDTO[], liveDocumentId: string | null, now: Date): AleMeleView {
  const all = rows.map(listItemToSummaryLocalSession).sort((a, b) => b.startedAt - a.startedAt);
  const sessions = liveDocumentId ? all.filter(s => s.serverId !== liveDocumentId) : all;
  const stats = computeHistoryStats(all, NO_AGGREGATES);
  const preview = sessions
    .filter(s => s.endedAt != null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, HISTORY_PREVIEW_COUNT)
    .map(s => ({ session: s, agg: aggForSession(s, NO_AGGREGATES) }));
  return {
    stats,
    monthly: monthlyStats(sessions, NO_AGGREGATES, now),
    open: openHistoryEntries(sessions, NO_AGGREGATES),
    preview,
    isEmpty: liveDocumentId == null && stats.partide === 0,
  };
}
