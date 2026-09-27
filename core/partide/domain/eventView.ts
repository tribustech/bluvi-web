// Ported from fish `features/partide/helpers/eventView.ts` (pure).
// Pure view helpers over LocalEvent — no store/React dependency.
import type { LocalEvent } from './types';
import { fmtClock, fmtKg } from './format';
import { LANE_LABEL } from './types';

/** Prefer the remote (uploaded) photo, falling back to the local capture, else null. */
export function eventPhotoUri(e: Pick<LocalEvent, 'photoUrl' | 'photoLocalUri'>): string | null {
  return e.photoUrl ?? e.photoLocalUri ?? null;
}

/**
 * The jurnal row's secondary line — where the fish came from and what it took:
 * "Centru · 50 m · Boilies 20mm", dropping whichever leg is missing.
 *
 * The rod is deliberately absent: the row shows it as a coloured pill on the
 * line above, so repeating it here would spend the only line the meta gets.
 * A free capture may have none of the three, in which case the note is all
 * there is to say; everything missing returns "" and the caller drops the line
 * rather than reserving space for it.
 */
export function eventMeta(e: Pick<LocalEvent, 'lane' | 'distance' | 'bait' | 'notes'>): string {
  const position = [e.lane ? LANE_LABEL[e.lane] : null, e.distance ? `${e.distance} m` : null, e.bait || null]
    .filter(Boolean)
    .join(' · ');
  return position || e.notes || '';
}

/** Fallback for a rod whose colour never made it into the event (older writes). */
const ROD_FALLBACK = '#6366F1';
/** A capture with no rod gets a neutral accent — indigo would imply a rod it doesn't have. */
const NO_ROD_ACCENT = '#E1E5EC';

/** What occupies the row's fixed-width lead slot. */
export type JurnalLeadKind = 'weight' | 'lost' | 'blank' | 'glyph';

export type JurnalRowModel = {
  lead: JurnalLeadKind;
  /** Formatted kg, only when `lead === 'weight'`. */
  weight: string | null;
  estimated: boolean;
  species: string | null;
  /** "" means the row has no second line. */
  meta: string;
  rodIndex: number | null;
  rodColor: string;
  accent: string;
  background: string;
  time: string;
  hasPhoto: boolean;
};

/**
 * Everything the jurnal row renders, resolved off a single event.
 *
 * The row's alignment comes from a lead slot of fixed width that holds one of
 * four things — so which one it is has to be decided once, here, rather than
 * re-derived from `outcome`/`weightKg`/photo at three points in the JSX. The
 * outcome wins over a weight on purpose: a lost fish carries no weight today,
 * but if one ever did, its badge is what the row is about.
 */
export function jurnalRowModel(
  e: Pick<
    LocalEvent,
    | 'outcome'
    | 'weightKg'
    | 'weightEstimated'
    | 'species'
    | 'lane'
    | 'distance'
    | 'bait'
    | 'notes'
    | 'rodIndex'
    | 'rodColor'
    | 'occurredAt'
    | 'photoUrl'
    | 'photoLocalUri'
  >
): JurnalRowModel {
  const lead: JurnalLeadKind =
    e.outcome === 'lost' ? 'lost' : e.outcome === 'blank' ? 'blank' : e.weightKg != null ? 'weight' : 'glyph';
  const rodColor = e.rodColor ?? ROD_FALLBACK;

  return {
    lead,
    weight: lead === 'weight' && e.weightKg != null ? fmtKg(e.weightKg) : null,
    estimated: lead === 'weight' && e.weightEstimated,
    species: e.species,
    meta: eventMeta(e),
    rodIndex: e.rodIndex,
    rodColor,
    accent:
      lead === 'lost' ? '#EAB308' : lead === 'blank' ? '#A3A3A3' : e.rodIndex !== null ? rodColor : NO_ROD_ACCENT,
    background: lead === 'lost' ? '#FEFCE9' : lead === 'blank' ? '#F6F7F9' : '#FFFFFF',
    time: fmtClock(e.occurredAt),
    hasPhoto: eventPhotoUri(e) !== null,
  };
}

export type OutcomeFilter = 'capture' | 'lost' | 'blank';

export type JurnalFilter = {
  outcomes: OutcomeFilter[];
  rodIndexes: number[];
}; // empty array = no restriction on that axis

export const EMPTY_JURNAL_FILTER: JurnalFilter = { outcomes: [], rodIndexes: [] };

/** outcome ∧ rod; a rod-less event matches only when `rodIndexes` is empty (no rod restriction). */
export function filterEvents(events: LocalEvent[], f: JurnalFilter): LocalEvent[] {
  return events.filter(e => {
    if (f.outcomes.length && !f.outcomes.includes(e.outcome)) return false;
    if (f.rodIndexes.length && (e.rodIndex === null || !f.rodIndexes.includes(e.rodIndex))) return false;
    return true;
  });
}
