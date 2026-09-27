/**
 * Pure local → wire mappers for the session/event upsert bodies.
 * fish `services/api/partide.ts#sessionToUpsertBody` / `#eventToUpsertBody`.
 */
import type { LocalEvent, LocalSession } from './types';

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

export type SessionUpsertBody = ReturnType<typeof sessionToUpsertBody>;
export type EventUpsertBody = ReturnType<typeof eventToUpsertBody>;

export function sessionToUpsertBody(s: LocalSession) {
  return {
    clientId: s.clientId,
    clientUpdatedAt: iso(s.clientUpdatedAt),
    venueType: s.venueType,
    lakeId: s.lakeId,
    publicWaterCode: s.publicWaterCode,
    publicWaterName: s.publicWaterName,
    manualVenueName: s.manualVenueName,
    standId: s.standId,
    locality: s.locality,
    anchorLat: s.anchorLat,
    anchorLong: s.anchorLng,
    anchorName: s.anchorName,
    startedAt: iso(s.startedAt)!,
    endedAt: iso(s.endedAt),
    plannedDurationMs: s.plannedDurationMs,
    notes: s.notes,
    visibleOnProfile: s.visibleOnProfile,
    rods: s.rods.map(r => ({ ...r })),
    targetSpecies: s.targetSpecies.map(t => ({ documentId: t.id, name: t.name })),
  };
}

/**
 * Local catch → the upsert wire body.
 *
 * The `photo` key is DELIBERATELY conditional. Omitting it leaves the CMS relation untouched
 * (`pickEventData` copies a field only when it is `!== undefined`, so an explicit `null` DOES
 * pass through and clears it) — which is what an untouched or freshly-uploaded photo wants. But
 * a DETACH has to say so out loud: when the local event carries no photo reference of any kind
 * (no local uri, no url, no file id) the client is asserting "this catch has no photo", so we
 * send `photo: null`. Without it, removing a photo looked removed locally and came straight back
 * on the next projection snapshot. On a fresh photo-less capture the same `photo: null` is a
 * harmless no-op.
 *
 * `photoTagUids` is INDEPENDENT of the photo-detach logic: detaching a photo must not clear who
 * was tagged in it. The key is included ONLY when non-null and non-empty — an OMITTED field is
 * how the client says "everyone" on create. An empty array is omitted too (the server treats `[]`
 * and an omitted field identically on create).
 *
 * `patchEventTags` is different on purpose: its PATCH route treats an omitted `photoTagUids` as
 * "leave existing tags untouched", and resolves `[]` against the roster AT PATCH TIME — so an
 * edit that resets to "Toți" must send the roster's explicit uid list (see `captureEdits.ts`).
 */
export function eventToUpsertBody(e: LocalEvent) {
  const hasPhoto = e.photoLocalUri != null || e.photoUrl != null || e.photoFileId != null;
  return {
    clientId: e.clientId,
    clientUpdatedAt: iso(e.clientUpdatedAt),
    outcome: e.outcome,
    rodIndex: e.rodIndex,
    rodLabel: e.rodLabel,
    rodColor: e.rodColor,
    bait: e.bait,
    baitType: e.baitType,
    baitSize: e.baitSize,
    baitFlavor: e.baitFlavor,
    lane: e.lane,
    distance: e.distance,
    lat: e.lat,
    lng: e.lng,
    weightKg: e.weightKg,
    weightEstimated: e.weightEstimated,
    species: e.species,
    speciesId: e.speciesId,
    notes: e.notes,
    occurredAt: iso(e.occurredAt)!,
    ...(hasPhoto ? {} : { photo: null as number | null }),
    ...(e.photoTagUids != null && e.photoTagUids.length ? { photoTagUids: e.photoTagUids } : {}),
  };
}
