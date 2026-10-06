// Ported from fish `features/partide/components/community/VenueLatestCatchesRail.tsx` (the pure
// selection + copy rules of the venue's «Ultimele capturi» rail).
import { fmtRecordDate } from './format';

/** How many tiles the rail shows (fish RAIL_SIZE): a glance, not a feed. */
export const VENUE_RAIL_SIZE = 3;

const DAY_MS = 86_400_000;

/**
 * "acum 8 min" while a catch is fresh (< 24h), "27 IUL" once it isn't — fish `caughtLabel`.
 * A catch from the future (clock skew) also reads as its date.
 */
export function caughtLabel(now: number, iso: string): string {
  const elapsed = now - new Date(iso).getTime();
  if (elapsed < 0 || elapsed >= DAY_MS) return fmtRecordDate(iso);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'acum';
  if (minutes < 60) return `acum ${minutes} min`;
  return `acum ${Math.floor(minutes / 60)} h`;
}

type RailCatch = { sessionDocumentId: string };

/**
 * Which catches the rail shows, and under which heading (fish VenueLatestCatchesRail):
 *  - ≥2 live sessions: their catches («Capturi în partidele active»), else the latest;
 *  - exactly 1 live session: the venue's OTHER catches (the live card already shows that one);
 *  - none: the latest («Ultimele capturi»).
 * At most VENUE_RAIL_SIZE rows; an empty `rows` means the rail is not drawn.
 */
export function venueRailCatches<T extends RailCatch>(all: T[], liveSessionIds: string[]): { rows: T[]; heading: string } {
  const live = new Set(liveSessionIds);
  const liveCount = liveSessionIds.length;
  let rows: T[];
  if (liveCount === 1) rows = all.filter(c => !live.has(c.sessionDocumentId)).slice(0, VENUE_RAIL_SIZE);
  else {
    const fromLive = liveCount > 1 ? all.filter(c => live.has(c.sessionDocumentId)) : [];
    rows = (fromLive.length > 0 ? fromLive : all).slice(0, VENUE_RAIL_SIZE);
  }
  const heading = liveCount > 1 && rows.some(c => live.has(c.sessionDocumentId)) ? 'Capturi în partidele active' : 'Ultimele capturi';
  return { rows, heading };
}

/** fish dedupeByKey for the venue history: first occurrence wins (pages can overlap as rows shift). */
export function dedupeByDocumentId<T extends { documentId: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(r => (seen.has(r.documentId) ? false : (seen.add(r.documentId), true)));
}
