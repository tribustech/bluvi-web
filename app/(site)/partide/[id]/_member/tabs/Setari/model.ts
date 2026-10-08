import type { LakeDetailStand } from '@/core/lakes';
import { anchorCoord, fmtClock, fmtElapsedShort, fmtPlannedDuration, type LocalSession } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * Pure view model of the Setări tab (fish features/partide/scenes/InfoScene.tsx). No React.
 */

export type DetailRow = { label: string; value: string };

/** fish InfoScene dateShort: «7 oct.» (ro-RO, the viewer's time zone). */
const dateShort = (ms: number) => new Date(ms).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
/** fish InfoScene dateTime: «7 oct. · 14:23». */
export const dateTime = (ms: number) => `${dateShort(ms)} · ${fmtClock(ms)}`;

/** «44.43210, 26.12340» — fish's 5 decimals. */
export const positionLabel = (s: Pick<LocalSession, 'anchorLat' | 'anchorLng'>) => `${s.anchorLat.toFixed(5)}, ${s.anchorLng.toFixed(5)}`;

/** The target species, comma-joined, or null when none. */
export const speciesLabel = (s: Pick<LocalSession, 'targetSpecies'>): string | null =>
  s.targetSpecies.length ? s.targetSpecies.map(t => t.name).join(', ') : null;

/**
 * fish InfoScene readRows (c4) — the facts under «Detalii», after the «Baltă» row: Început, then
 * Sfârșit + Durată (ended) or Sfârșit estimat + Durată estimată (live), Reper when set, and for an
 * ended (read-only) partidă also Poziție, Specii vizate (when any) and Stand (when set).
 *
 * `readOnly` is fish's `isEnded` for the extra rows: the web also shows a partidă that is still
 * open but not followed live here (another device) read-only, so its settings are listed, not edited.
 */
export function detailRows(s: LocalSession, isEnded: boolean, readOnly: boolean = isEnded): DetailRow[] {
  const rows: DetailRow[] = [{ label: 'Început', value: dateTime(s.startedAt) }];
  if (isEnded && s.endedAt != null) {
    rows.push({ label: 'Sfârșit', value: dateTime(s.endedAt) });
    rows.push({ label: 'Durată', value: fmtElapsedShort(s.endedAt - s.startedAt) });
  } else {
    rows.push({ label: 'Sfârșit estimat', value: dateTime(s.startedAt + s.plannedDurationMs) });
    rows.push({ label: 'Durată estimată', value: fmtPlannedDuration(s.plannedDurationMs) });
  }
  if (s.anchorName) rows.push({ label: 'Reper', value: s.anchorName });
  if (readOnly) {
    rows.push({ label: 'Poziție', value: positionLabel(s) });
    const species = speciesLabel(s);
    if (species) rows.push({ label: 'Specii vizate', value: species });
    if (s.standName) rows.push({ label: 'Stand', value: s.standName });
  }
  return rows;
}

/** «1 membru» / «2 membri» / «20 de membri» (fish CoopCard, with the owner's plural rule). */
export const membersLabel = (n: number) => formatCount(n, 'membru', 'membri');

/** fish InfoScene parseStandCoordinates: the DTO's stringy coordinates, junk 0/0 rejected. */
export function standCoordinates(stand: Pick<LakeDetailStand, 'coordinates'>): { lat: number; lng: number } | null {
  const c = stand.coordinates;
  return c ? anchorCoord(Number(c.lat), Number(c.long)) : null;
}

export type StandAnchorPatch = { anchorLat: number; anchorLng: number; standId: string | null; standName: string | null };

/**
 * fish InfoScene handleStandSelect (c6): re-anchor to the stand's coordinates when valid (else keep
 * the current anchor) and set / clear the stand.
 */
export function standAnchorPatch(s: Pick<LocalSession, 'anchorLat' | 'anchorLng'>, stand: LakeDetailStand | null): StandAnchorPatch {
  const c = stand ? standCoordinates(stand) : null;
  return {
    anchorLat: c?.lat ?? s.anchorLat,
    anchorLng: c?.lng ?? s.anchorLng,
    standId: stand?.documentId ?? null,
    standName: stand?.name ?? null,
  };
}
