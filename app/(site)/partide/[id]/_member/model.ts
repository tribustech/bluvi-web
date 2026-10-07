import {
  fmtEndedSubtitle,
  sessionSubtitle,
  type CommunitySessionDetailCatchDTO,
  type CommunitySessionDetailDTO,
  type LocalEvent,
  type LocalSession,
} from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * Shell-local view helpers of the member view (fish app/(app)/partide/[id].tsx:69-79 — the venue
 * name is not a synced field on LocalSession).
 */

/** Lake → public water → manual name → anchor name → «Partidă» (c1). */
export const venueName = (s: LocalSession): string => s.lakeName ?? s.publicWaterName ?? s.manualVenueName ?? s.anchorName ?? 'Partidă';

/** «1 lansetă», «2 lansete», «20 de lansete» (owner rule: formatCount plurals, over fish's «20 lansete»). */
export const rodsLabel = (n: number): string => formatCount(n, 'lansetă', 'lansete');

/** Live: «{sessionSubtitle} · {n lansete}» (the rod part only with rods); ended: fmtEndedSubtitle. */
export function buildSubtitle(s: LocalSession, rodCount: number): string {
  if (s.endedAt !== null) return fmtEndedSubtitle(s.startedAt, s.endedAt);
  const rodsPart = rodCount > 0 ? rodsLabel(rodCount) : null;
  return [sessionSubtitle(s), rodsPart].filter(Boolean).join(' · ');
}

/** fish: `status` when the server sent one, else the end stamp. */
export const isEndedSession = (s: LocalSession): boolean => (s.status ? s.status !== 'active' : s.endedAt !== null);

const iso = (ms: number): string => new Date(ms).toISOString();

const catchOf = (e: LocalEvent): CommunitySessionDetailCatchDTO => ({
  clientId: e.clientId,
  species: e.species,
  weightKg: e.weightKg,
  // Only an uploaded photo: a device-local URI (another device's capture) cannot show here.
  photoUrl: e.photoUrl,
  photoThumbUrl: e.photoUrl ? (e.photoThumbUrl ?? null) : null,
  occurredAt: iso(e.occurredAt),
});

/**
 * The member's own partidă in the spectator page's shape (CommunitySessionDetailDTO), so the
 * recap shown while no member tab has shipped (MemberRecap) reuses the spectator's cards — total,
 * evolution, biggest catch, catches, photos — over the member's data (also a private partidă,
 * which has no public read). Every capture is listed (it is the viewer's own: no 10-row cap).
 */
export function recapDetail(documentId: string, s: LocalSession, events: LocalEvent[]): CommunitySessionDetailDTO {
  const captures = events.filter(e => e.outcome === 'capture').sort((a, b) => b.occurredAt - a.occurredAt);
  const catches = captures.map(catchOf);
  const weighed = captures.filter(e => e.weightKg != null && e.weightKg > 0).sort((a, b) => a.occurredAt - b.occurredAt);
  const max = weighed.reduce<LocalEvent | null>((best, e) => (best == null || (e.weightKg ?? 0) > (best.weightKg ?? 0) ? e : best), null);
  const photos = catches.filter(c => !!c.photoUrl);
  return {
    documentId,
    startedAt: iso(s.startedAt),
    endedAt: s.endedAt != null ? iso(s.endedAt) : null,
    venueName: venueName(s),
    locality: s.locality,
    lakeId: s.lakeId,
    imageUrl: s.lakeImageUrl ?? null,
    venueImageUrl: s.lakeImageUrl ?? null,
    members: [],
    catchCount: captures.length,
    maxKg: max?.weightKg ?? null,
    durationMs: s.endedAt != null ? s.endedAt - s.startedAt : null,
    catches,
    photos,
    weighedCatches: weighed.map(e => ({ t: iso(e.occurredAt), kg: e.weightKg as number, species: e.species })),
    maxCatch: max ? catchOf(max) : null,
    photoCount: photos.length,
    hasMoreCatches: false,
    anglerStats: null,
    venueType: s.venueType,
    publicWaterCode: s.publicWaterCode,
  };
}
