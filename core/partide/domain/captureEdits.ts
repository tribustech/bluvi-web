/**
 * Pure builders behind the Partide write hooks in fish `features/partide/domain/hooks.ts`:
 * `sessionFromInput` (useStartPartida), the event built by `useLogCapture`, and the patch logic of
 * `useUpdateCaptureEvent`. The hooks' atom reads/writes, uuid minting and clocks are the caller's;
 * everything here takes them as arguments.
 */
import type { Lane, LocalEvent, LocalRod, LocalSession, TargetSpecies, VenueRef } from './types';

const ov = <T>(value: T | undefined, fallback: T): T => (value !== undefined ? value : fallback);

/** Set-equality for a photoTagUids selection — order-independent; `null` ("Toți") is its own
 *  state and only equals another `null`. The server must be PATCHed only on a genuine change. */
export function sameTagSelection(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every(uid => bSet.has(uid));
}

export type StartPartidaInput = {
  venue: VenueRef;
  venueName?: string;
  standId?: string | null;
  standName?: string | null;
  locality?: string | null;
  anchor: { lat: number; lng: number };
  anchorName?: string | null;
  plannedDurationMs: number;
  rods: LocalRod[];
  targetSpecies?: TargetSpecies[];
  /** Public-profile visibility at creation (the "Partidă publică" toggle). Defaults to true. */
  visibleOnProfile?: boolean;
};

/** fish `hooks.ts#sessionFromInput` — the LocalSession a start POSTs (via `sessionToUpsertBody`). */
export function sessionFromInput(clientId: string, input: StartPartidaInput, now: number): LocalSession {
  const v = input.venue;
  return {
    clientId,
    serverId: null,
    syncStatus: 'pending',
    clientUpdatedAt: now,
    venueType: v.venueType,
    lakeId: v.venueType === 'lake' ? v.lakeId : null,
    lakeName: v.venueType === 'lake' ? (input.venueName ?? null) : null,
    publicWaterCode: v.venueType === 'publicWater' ? v.publicWaterCode : null,
    publicWaterName: v.venueType === 'publicWater' ? (input.venueName ?? null) : null,
    manualVenueName: v.venueType === 'pin' ? (input.venueName ?? null) : null,
    standId: input.standId ?? null,
    standName: input.standName ?? null,
    locality: input.locality ?? null,
    anchorLat: input.anchor.lat,
    anchorLng: input.anchor.lng,
    anchorName: input.anchorName ?? null,
    startedAt: now,
    endedAt: null,
    warnedAt: null,
    autoCloseAt: null,
    plannedDurationMs: input.plannedDurationMs,
    notes: null,
    visibleOnProfile: input.visibleOnProfile ?? true,
    targetSpecies: input.targetSpecies ?? [],
    rods: input.rods,
    rodRuntimes: input.rods.map(() => ({ phase: 'idle', endEpoch: null })),
    detailsHydrated: true, // created on-device — its full detail lives here
    projectionRev: 0,
  };
}

/** Quick-capture payload (no cycle transition): attach to a rod WITHOUT touching its runtime. */
export type LogCaptureDetail = {
  weightKg: number | null;
  weightEstimated: boolean;
  species: string;
  speciesId?: string | null;
  photoLocalUri?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  // explicit bait fields — OVERRIDE the rod snapshot when present (rod-independent momeală).
  bait?: string;
  baitType?: string | null;
  baitSize?: number | null;
  baitFlavor?: string | null;
  /** Explicit capture time (ms epoch) — defaults to now. */
  occurredAt?: number;
  /** Explicit distance (m) — e.g. derived anchor→catch-pin; wins over the rod snapshot. */
  distance?: number;
  rod?: {
    index: number;
    label: string;
    color: string;
    bait: string;
    baitType: string | null;
    baitSize: number | null;
    baitFlavor: string | null;
    lane: Lane | null;
    distance: number;
  } | null;
  /** Who's IN the photo — undefined/null both mean "everyone". */
  photoTagUids?: string[] | null;
};

/**
 * fish `hooks.ts#useLogCapture` event builder. `clientId` is minted by the caller — reuse the
 * failed attempt's id on a manual retry: `upsertEvent` upserts by clientId, so a replay can never
 * produce a second catch when a failed attempt actually committed server-side.
 */
export function buildLogCaptureEvent(sessionClientId: string, detail: LogCaptureDetail, clientId: string, now: number): LocalEvent {
  const rod = detail.rod;
  return {
    clientId,
    serverId: null,
    serverNumericId: null,
    syncStatus: 'pending',
    clientUpdatedAt: now,
    sessionClientId,
    outcome: 'capture',
    rodIndex: rod?.index ?? null,
    rodLabel: rod?.label ?? null,
    rodColor: rod?.color ?? null,
    bait: detail.bait ?? rod?.bait ?? '',
    baitType: detail.baitType ?? rod?.baitType ?? null,
    baitSize: detail.baitSize ?? rod?.baitSize ?? null,
    baitFlavor: detail.baitFlavor ?? rod?.baitFlavor ?? null,
    lane: rod?.lane ?? null,
    distance: detail.distance ?? rod?.distance ?? 0,
    lat: detail.lat ?? null,
    lng: detail.lng ?? null,
    weightKg: detail.weightKg,
    weightEstimated: detail.weightEstimated,
    species: detail.species,
    speciesId: detail.speciesId ?? null,
    photoLocalUri: detail.photoLocalUri ?? null,
    photoUploadStatus: detail.photoLocalUri ? 'pending' : 'none',
    photoUrl: null,
    photoTagUids: detail.photoTagUids ?? null,
    notes: detail.notes ?? null,
    occurredAt: detail.occurredAt ?? now,
  };
}

/** Editable fields of a logged capture. `photo`: undefined = untouched; `{ localUri: string }` =
 *  new local photo; `{ localUri: null }` = detached. `rod`: undefined = untouched, null = detach. */
export type UpdateCaptureDetail = {
  weightKg?: number | null;
  weightEstimated?: boolean;
  species?: string;
  speciesId?: string | null;
  bait?: string;
  baitType?: string | null;
  baitSize?: number | null;
  baitFlavor?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  occurredAt?: number;
  distance?: number;
  photo?: { localUri: string | null };
  rod?: LogCaptureDetail['rod'];
  /** Who's IN the photo — undefined = untouched, null/array = explicit set. */
  photoTagUids?: string[] | null;
};

/**
 * fish `hooks.ts#useUpdateCaptureEvent` patch logic. Returns the next event plus the tags PATCH to
 * send, if any (`commitCatchWithPhoto`'s `photoTagUidsPatch`).
 *
 * The PATCH route never re-resolves photoTags on its own — only an explicit array does — so the
 * edit path fires its OWN tags PATCH, and only when the selection genuinely changed. Resetting to
 * "Toți" sends `rosterUids` (the list the picker was showing), never a bare `[]`: the server
 * resolves `[]` against whoever is on the roster AT PATCH TIME, which would retroactively tag a
 * member who joined after the catch.
 */
export function applyCaptureUpdate(
  e: LocalEvent,
  patch: UpdateCaptureDetail,
  rosterUids: string[],
  now: number
): { next: LocalEvent; photoTagUidsPatch?: string[] } {
  const prevTags = e.photoTagUids ?? null;
  const nextTags = ov(patch.photoTagUids, prevTags);
  const tagsChanged = patch.photoTagUids !== undefined && !sameTagSelection(prevTags, nextTags);
  // "weightKg null ⇒ weightEstimated false": resolve the weight first, then force the flag.
  const nextWeightKg = ov(patch.weightKg, e.weightKg);
  const next: LocalEvent = {
    ...e,
    weightKg: nextWeightKg,
    weightEstimated: nextWeightKg == null ? false : ov(patch.weightEstimated, e.weightEstimated),
    species: ov(patch.species, e.species),
    speciesId: ov(patch.speciesId, e.speciesId),
    bait: ov(patch.bait, e.bait),
    baitType: ov(patch.baitType, e.baitType),
    baitSize: ov(patch.baitSize, e.baitSize),
    baitFlavor: ov(patch.baitFlavor, e.baitFlavor),
    lat: ov(patch.lat, e.lat),
    lng: ov(patch.lng, e.lng),
    notes: ov(patch.notes, e.notes),
    occurredAt: ov(patch.occurredAt, e.occurredAt),
    photoTagUids: nextTags,
    clientUpdatedAt: now,
    syncStatus: 'pending',
  };
  if (patch.rod !== undefined) {
    const rod = patch.rod;
    next.rodIndex = rod?.index ?? null;
    next.rodLabel = rod?.label ?? null;
    next.rodColor = rod?.color ?? null;
    next.lane = rod?.lane ?? null;
    next.distance = rod?.distance ?? 0;
  }
  // After the rod block: an explicit derived distance wins over the snapshot.
  if (patch.distance !== undefined) next.distance = patch.distance;
  if (patch.photo !== undefined) {
    next.photoLocalUri = patch.photo.localUri;
    next.photoUrl = null;
    next.photoThumbUrl = null;
    next.photoFileId = null;
    next.photoUploadStatus = patch.photo.localUri ? 'pending' : 'none';
  }
  return tagsChanged ? { next, photoTagUidsPatch: nextTags ?? rosterUids } : { next };
}

