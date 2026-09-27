// Ported from fish `features/partide/helpers/historyView.ts` (pure).
import type { LocalEvent, LocalSession } from './types';
import { eventPhotoUri } from './eventView';
import { groupSessionsByMonth } from './history';

export type AggregatePhoto = { uri: string; kg: number | null };

export type Aggregate = {
  captures: number;
  recordKg: number | null;
  totalKg: number;
  photoUri: string | null;
  photoUris: string[];
  /** Every capture photo paired with its weight, chronological — the card's photo strip. */
  photos: AggregatePhoto[];
};

export const EMPTY_AGGREGATE: Aggregate = {
  captures: 0,
  recordKg: null,
  totalKg: 0,
  photoUri: null,
  photoUris: [],
  photos: [],
};

/**
 * One pass over capture events → per-session aggregate. `photoUri` is the photo
 * of the latest capture that has one (a later photo-less capture can't clobber
 * it); `photoUris` is every capture photo in chronological (occurredAt) order,
 * used by the Extins carousel. `photos` pairs each of those photos with its
 * capture's weight (null if unweighed), same chronological order, for the
 * card's photo-strip labels.
 */
export function computeAggregates(events: LocalEvent[]): Record<string, Aggregate> {
  const ordered = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const map: Record<string, Aggregate> = {};
  const latestPhotoAt: Record<string, number> = {};
  for (const e of ordered) {
    if (e.outcome !== 'capture') continue;
    const agg =
      map[e.sessionClientId] ??
      { captures: 0, recordKg: null, totalKg: 0, photoUri: null, photoUris: [], photos: [] };
    agg.captures += 1;
    if (e.weightKg != null) {
      agg.recordKg = agg.recordKg == null ? e.weightKg : Math.max(agg.recordKg, e.weightKg);
      agg.totalKg += e.weightKg;
    }
    const uri = eventPhotoUri(e);
    if (uri != null) {
      agg.photoUris.push(uri);
      agg.photos.push({ uri, kg: e.weightKg ?? null });
      const prevAt = latestPhotoAt[e.sessionClientId];
      if (prevAt === undefined || e.occurredAt >= prevAt) {
        agg.photoUri = uri;
        latestPhotoAt[e.sessionClientId] = e.occurredAt;
      }
    }
    map[e.sessionClientId] = agg;
  }
  return map;
}

export function sessionVenueName(s: LocalSession): string {
  return s.lakeName ?? s.publicWaterName ?? s.manualVenueName ?? s.anchorName ?? 'Partidă';
}

export type HistoryEntry = { session: LocalSession; agg: Aggregate; isRecord: boolean };
export type HistoryViewOptions = { sortByWeight: boolean; venueFilter: string[]; onlyWithCaptures: boolean };
export type HistoryView =
  | { mode: 'grouped'; groups: { key: string; title: string; entries: HistoryEntry[] }[] }
  | { mode: 'flat'; entries: HistoryEntry[] };

/**
 * Aggregate to render for a session. A fully-hydrated session uses its computed
 * aggregate over local events (identical to the old `aggOf`). A summary-only
 * row (`detailsHydrated === false`) has no local events yet, so we synthesize an
 * aggregate from the list-DTO summary fields carried on the session — otherwise
 * its card would read 0 captures / no record and drop out of the
 * `onlyWithCaptures` filter and record highlight. Photos stay empty (we have no
 * local capture photos until details are pulled on open).
 */
export function aggForSession(session: LocalSession, aggregates: Record<string, Aggregate>): Aggregate {
  if (session.detailsHydrated) return aggregates[session.clientId] ?? EMPTY_AGGREGATE;
  return {
    captures: session.summaryCaptures ?? 0,
    recordKg: session.summaryRecordKg ?? null,
    totalKg: session.summaryTotalKg ?? 0,
    photoUri: null,
    photoUris: [],
    photos: [],
  };
}

/** Index (into `list`) of the strictly-heaviest session with recordKg > 0, else -1. Ties → earliest in list. */
function recordIndex(list: LocalSession[], aggregates: Record<string, Aggregate>): number {
  let best = -1;
  let bestKg = 0;
  list.forEach((s, i) => {
    const kg = aggForSession(s, aggregates).recordKg ?? 0;
    if (kg > bestKg) {
      bestKg = kg;
      best = i;
    }
  });
  return best;
}

function passesFilters(s: LocalSession, aggregates: Record<string, Aggregate>, opts: HistoryViewOptions): boolean {
  if (opts.venueFilter.length > 0 && !opts.venueFilter.includes(sessionVenueName(s))) return false;
  if (opts.onlyWithCaptures && aggForSession(s, aggregates).captures <= 0) return false;
  return true;
}

export function applyHistoryView(
  sessions: LocalSession[],
  aggregates: Record<string, Aggregate>,
  opts: HistoryViewOptions
): HistoryView {
  const ended = sessions.filter(s => s.endedAt != null && passesFilters(s, aggregates, opts));

  if (opts.sortByWeight) {
    const sorted = [...ended].sort(
      (a, b) => (aggForSession(b, aggregates).recordKg ?? 0) - (aggForSession(a, aggregates).recordKg ?? 0)
    );
    const rec = recordIndex(sorted, aggregates);
    return {
      mode: 'flat',
      entries: sorted.map((s, i) => ({ session: s, agg: aggForSession(s, aggregates), isRecord: i === rec })),
    };
  }

  const groups = groupSessionsByMonth(ended).map(g => {
    const rec = recordIndex(g.sessions, aggregates);
    return {
      key: g.key,
      title: g.title,
      entries: g.sessions.map((s, i) => ({ session: s, agg: aggForSession(s, aggregates), isRecord: i === rec })),
    };
  });
  return { mode: 'grouped', groups };
}

/**
 * Never-ended sessions (endedAt == null) that are NOT the locally-active one —
 * `usePartideHistory` already excludes that. Rendered as an «În desfășurare»
 * section above the ended history so stuck-open sessions stay reachable (and
 * endable from their detail screen) instead of silently dropping out of the
 * list. Deliberately ignores filters/sort — it is a status section, not
 * history — and never claims the record highlight.
 */
export function openHistoryEntries(
  sessions: LocalSession[],
  aggregates: Record<string, Aggregate>
): HistoryEntry[] {
  return sessions
    .filter(s => s.endedAt == null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(s => ({ session: s, agg: aggForSession(s, aggregates), isRecord: false }));
}

export function computeHistoryStats(
  sessions: LocalSession[],
  aggregates: Record<string, Aggregate>
): { partide: number; capturi: number; recordKg: number | null; totalKg: number } {
  let capturi = 0;
  let recordKg: number | null = null;
  let totalKg = 0;
  for (const s of sessions) {
    const agg = aggForSession(s, aggregates);
    capturi += agg.captures;
    totalKg += agg.totalKg;
    if (agg.recordKg != null) recordKg = recordKg == null ? agg.recordKg : Math.max(recordKg, agg.recordKg);
  }
  return { partide: sessions.length, capturi, recordKg, totalKg };
}

export function distinctVenues(sessions: LocalSession[]): string[] {
  return Array.from(new Set(sessions.map(sessionVenueName))).sort((a, b) => a.localeCompare(b, 'ro'));
}
