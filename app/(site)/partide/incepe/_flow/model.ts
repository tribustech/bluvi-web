import {
  anchorCoord,
  type StartPartidaInput,
  type TargetSpecies,
  type VenueRef,
  type VenueSelection,
} from '@/core/partide';
import { isApiError } from '@/core/transport';

/*
 * The start screen's pure model (fish app/(app)/partide/start.tsx): the duration presets, the lake
 * coordinates parser, the venue's locality line, the create payload and the error mapping. Unit
 * tested in ./model.test.ts.
 */

export type Coord = { lat: number; lng: number };

export const HOUR_MS = 3_600_000;

/** fish DURATION_PRESETS — read in the same units as «Alta» (days + hours). */
export const DURATION_PRESETS: { label: string; ms: number }[] = [
  { label: '12h', ms: 12 * HOUR_MS },
  { label: '1 zi', ms: 24 * HOUR_MS },
  { label: '2 zile', ms: 48 * HOUR_MS },
  { label: '3 zile', ms: 72 * HOUR_MS },
  { label: '7 zile', ms: 168 * HOUR_MS },
];
export const DEFAULT_DURATION_MS = 24 * HOUR_MS;
/** Ceiling of the «Alta» days column (fish MAX_DURATION_DAYS). */
export const MAX_DURATION_DAYS = 7;

/** fish TimerWheelPicker granularity «dh»: whole days + hours, at least one hour, at most 7 days. */
export function durationParts(ms: number): { days: number; hours: number } {
  const totalHours = Math.max(1, Math.min(MAX_DURATION_DAYS * 24, Math.round(ms / HOUR_MS)));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}

export function durationFromParts(days: number, hours: number): number {
  const d = Math.max(0, Math.min(MAX_DURATION_DAYS, Math.floor(days)));
  const h = d >= MAX_DURATION_DAYS ? 0 : Math.max(0, Math.min(23, Math.floor(hours)));
  return Math.max(1, d * 24 + h) * HOUR_MS;
}

/** «2 zile și 5 ore», «1 zi», «12 ore» — the custom duration read back. */
export function durationLabel(ms: number): string {
  const { days, hours } = durationParts(ms);
  const d = days === 0 ? null : days === 1 ? '1 zi' : `${days} zile`;
  const h = hours === 0 ? null : hours === 1 ? '1 oră' : `${hours} ore`;
  return [d, h].filter(Boolean).join(' și ');
}

/**
 * A lake DTO's stringy coordinates as a numeric anchor, or null (fish parseCoordinates — routed
 * through anchorCoord so junk 0/0 rows are rejected too).
 */
export function parseCoordinates(c: { lat: string; long: string } | null | undefined): Coord | null {
  if (!c) return null;
  return anchorCoord(Number(c.lat), Number(c.long));
}

/** The venue card's second line (fish `venueLocality`). */
export function venueLocalityLine(sel: VenueSelection, pinCounty: string | null): string | null {
  if (sel.kind === 'lake') return sel.locality;
  if (sel.kind === 'publicWater') return sel.typeLabel || null;
  return pinCounty ? `Jud. ${pinCounty}` : 'Loc pe hartă';
}

/** What the session stores as `locality` (fish handleStart): a pin without a county stores none. */
export function sessionLocality(sel: VenueSelection, pinCounty: string | null): string | null {
  if (sel.kind === 'lake') return sel.locality;
  if (sel.kind === 'publicWater') return sel.typeLabel;
  return pinCounty ? `Jud. ${pinCounty}` : null;
}

export function venueRefOf(sel: VenueSelection): VenueRef {
  if (sel.kind === 'lake') return { venueType: 'lake', lakeId: sel.lakeId };
  if (sel.kind === 'publicWater') return { venueType: 'publicWater', publicWaterCode: sel.linkCode };
  return { venueType: 'pin', anchor: sel.coord };
}

export type StartForm = {
  sel: VenueSelection;
  anchor: Coord;
  anchorName: string;
  stand: { documentId: string; name: string } | null;
  pinCounty: string | null;
  plannedDurationMs: number;
  targetSpecies: TargetSpecies[];
  visibleOnProfile: boolean;
};

/** fish handleStart's StartPartidaInput: a picked stand replaces the free-text spot name; no rods. */
export function startInput(f: StartForm): StartPartidaInput {
  return {
    venue: venueRefOf(f.sel),
    venueName: f.sel.name,
    locality: sessionLocality(f.sel, f.pinCounty),
    anchor: f.anchor,
    anchorName: f.stand ? null : f.anchorName.trim() || null,
    standId: f.stand?.documentId ?? null,
    standName: f.stand?.name ?? null,
    plannedDurationMs: f.plannedDurationMs,
    // Rods are configured in-session on the Lansete tab, never pre-start.
    rods: [],
    targetSpecies: f.targetSpecies,
    visibleOnProfile: f.visibleOnProfile,
  };
}

export const START_ERROR = 'Ceva n-a mers. Încearcă din nou.';
export const ALREADY_ACTIVE = 'Ai deja o partidă activă';

export type StartFailure =
  | { kind: 'auth' }
  | { kind: 'already-active'; pointer: { sessionId: string; documentId: string } | null }
  | { kind: 'other' };

/**
 * fish's catch block: AUTH_REQUIRED → sign-in; PARTIDA:ALREADY_ACTIVE (the CMS's one-live-partidă
 * guard, carrying the running partidă's ids so the pointer can be rebuilt) → «Ai deja o partidă
 * activă» + open it; anything else → «Ceva n-a mers. Încearcă din nou.»
 */
export function startFailureOf(error: unknown): StartFailure {
  if (!isApiError(error)) return { kind: 'other' };
  if (error.bluCode === 'PARTIDA:ALREADY_ACTIVE') {
    const documentId = error.details?.activeSessionDocumentId;
    const sessionId = error.details?.activeSessionClientId;
    return {
      kind: 'already-active',
      pointer: typeof documentId === 'string' && typeof sessionId === 'string' ? { sessionId, documentId } : null,
    };
  }
  if (error.status === 401 || error.code === 'SESSION_DEAD') return { kind: 'auth' };
  return { kind: 'other' };
}
