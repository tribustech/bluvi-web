import {
  computeTripStats,
  computeVenuePatterns,
  fmtKg,
  scopeEvents,
  sessionVenueRef,
  type LocalEvent,
  type LocalSession,
  type TripStats,
} from '@/core/partide';

/*
 * The pure side of the «Statistici» tab (fish features/partide/scenes/StatisticiScene.tsx +
 * domain/hooks.ts usePatterns). Unit-tested in model.test.ts.
 */

export type StatsScope = 'partida' | 'balta';

/** fish SCOPE_SEGS. */
export const SCOPE_SEGS: { key: StatsScope; label: string }[] = [
  { key: 'partida', label: 'Această partidă' },
  { key: 'balta', label: 'Toate partidele' },
];

/**
 * How many other partide of the venue the «Toate partidele» scope reads in full (one detail read
 * each, in parallel): the most recent ones. fish reads its live store — the web reads the viewer's
 * own history (c7), and an angler who fished one lake a hundred times must not fire a hundred
 * requests to open a tab.
 */
export const VENUE_DETAIL_CAP = 20;

/** fish: `{ lat: session.anchorLat, lng: session.anchorLng }`, the anchor usePatterns gets. */
export const anchorOf = (s: Pick<LocalSession, 'anchorLat' | 'anchorLng'>) => ({ lat: s.anchorLat, lng: s.anchorLng });

/**
 * The viewer's other partide at the same venue as `current` (fish scopeEvents' venue rule: the same
 * lake; the same public water within 40 m of the anchor; a pin within 40 m), newest first — and the
 * ones whose events are read (the first VENUE_DETAIL_CAP − 1, the current one being the other).
 * A list row without a documentId cannot be read and is left out of both.
 */
export function venueSiblings(
  list: LocalSession[],
  current: LocalSession,
  documentId: string,
  cap = VENUE_DETAIL_CAP,
): { all: LocalSession[]; toRead: LocalSession[] } {
  const venue = sessionVenueRef(current);
  const anchor = anchorOf(current);
  const all = list
    .filter(s => s.clientId !== current.clientId && s.serverId !== documentId && !!s.serverId)
    .filter(s => scopeEvents([s], [], venue, anchor).sessionCount === 1)
    .sort((a, b) => b.startedAt - a.startedAt);
  return { all, toRead: all.slice(0, Math.max(0, cap - 1)) };
}

/** The venue scope (fish usePatterns): this partidă + the siblings, their events as read. */
export function venueScope(current: LocalSession, currentEvents: LocalEvent[], siblings: LocalSession[], siblingEvents: LocalEvent[], now: number) {
  const venue = sessionVenueRef(current);
  return computeVenuePatterns([current, ...siblings], [...currentEvents, ...siblingEvents], venue, anchorOf(current), now);
}

/** fish StatisticiScene `tripStats` — elapsed = (end ?? now) − start, never negative. */
export function tripStatsOf(session: Pick<LocalSession, 'startedAt' | 'endedAt'>, events: LocalEvent[], now: number): TripStats {
  return computeTripStats(events, Math.max(0, (session.endedAt ?? now) - session.startedAt));
}

/**
 * A weight for a tile: fish's comma kg. A partidă with no weighed capture shows «—» (rule 4) where
 * fish printed «0 kg» — nothing was weighed, it did not weigh nothing.
 */
export function kgTile(kg: number | null, weighed: boolean): { value: string; unit?: string } {
  return kg == null || !weighed ? { value: '—' } : { value: fmtKg(kg), unit: 'kg' };
}

/** Whether any capture carries a weight (the «Greutate totală» tile is «—» otherwise). */
export const anyWeighed = (events: LocalEvent[]) => events.some(e => e.outcome === 'capture' && e.weightKg != null);

/** «60–65 m» → the figure and its unit apart (owner rule 10); «—» when unknown. */
export function bandTile(band: string | null): { value: string; unit?: string } {
  if (!band) return { value: '—' };
  const m = /^(.*\S)\s+m$/.exec(band);
  return m ? { value: m[1], unit: 'm' } : { value: band };
}
