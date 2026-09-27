/**
 * fish `features/partide/domain/firestore/mappers.ts` — ported verbatim.
 *
 * Pure mappers between the mobile in-memory model (LocalSession / LocalEvent /
 * LocalMarker / LocalRod — epoch-ms timestamps) and the Firestore live co-op
 * session PROJECTION document (ISO-string timestamps).
 *
 * Framework-free and side-effect-free: no firestore, no Date.now(), no I/O — so
 * they are fully unit-testable. The sessionRepo layer owns the actual reads and
 * the HTTP writes.
 *
 * ── What Firestore holds now (spec 2026-07-25) ───────────────────────────────
 * Postgres is the single source of truth. Firestore holds ONE document per live
 * session — `sessions/{id}` — which the CMS REBUILDS from Postgres on every
 * write (`enqueueProjection` → `services/projection/build.ts` → `tx.set`, a full
 * replace). The client never writes it: catches, session meta and rods all go
 * over HTTP. There are no `catches` / `markers` SUBcollections any more; the
 * projection carries `catches` as an ARRAY at the document root, and `markers`
 * as an empty array (markers are parked and deliberately out of the projection
 * — sessionRepo still writes those straight to Firestore).
 *
 * ── The projection document ──────────────────────────────────────────────────
 * Session meta                    — FLAT at the doc root, field-for-field the
 *                                   CMS `SessionDTO` (minus `documentId`, which
 *                                   is deliberately withheld), plus `memberUids`,
 *                                   `hostUid`, `firestoreId`, `rev` and
 *                                   `serverNow` (the CMS's clock at rebuild
 *                                   time — NOT a clock sample, see below).
 * `catches: []`                   — the CMS `EventDTO`, sorted by occurredAt.
 * `rods: []`                      — rod CONFIG **and** rod TIMER runtime
 *                                   (`runtimePhase` / `runtimeEndsAt`, spec
 *                                   2026-07-22) in one array. 'firing' is
 *                                   DERIVED client-side, never stored. The
 *                                   SERVER owns `runtimeEndsAt`: it stamps it on
 *                                   the transition into `fishing` and preserves
 *                                   a live deadline otherwise (CMS
 *                                   `services/rods.ts`), so a client-sent value
 *                                   is always discarded.
 * `markers: []`                   — always empty; see above.
 *
 * ── The correctness contract ─────────────────────────────────────────────────
 * These field names are the interface between the two repos. Their producer is
 * `fir-intins-cms/src/api/fishing-session/services/projection/build.ts` (via
 * `services/dto/session.ts` + `services/dto/event.ts`); their consumer is
 * `firestoreSessionToLocal` below. Renaming on either side silently blanks the
 * live screen — keep them in lockstep. (The old contract was with a CMS
 * `archiveSession` reader that no longer exists.)
 *
 * The WRITE-side mappers that remain here serve the HTTP path, not Firestore:
 * `localSessionMetaPatchToFirestore` shapes the session PATCH body and
 * `localRodToFirestore` shapes the per-rod merge body — the names are historical
 * and the wire field names are identical either way.
 *
 * Note the venue-coordinate rename: LocalSession/LocalMarker use `anchorLng`,
 * the wire/Firestore/Strapi schema uses `anchorLong`.
 */
import type {
  Lane,
  LocalEvent,
  LocalMarker,
  LocalRod,
  LocalSession,
  MapMarkerType,
  Outcome,
  RodRuntime,
  SyncStatus,
  TargetSpecies,
} from './types';

// ── Firestore doc shapes (read side is tolerant: optional / nullable) ─────────

export interface FirestoreTargetSpecies {
  documentId: string | null;
  name: string;
}

export interface FirestoreMember {
  uid: string;
  name: string | null;
  avatar: string | null;
  joinedAt: string;
}

/** `sessions/{id}` document data (the fields this client reads/writes). */
export interface FirestoreSessionMeta {
  clientUpdatedAt?: string | null;
  /** Projection revision — see LocalSession.projectionRev. */
  rev?: number | null;
  venueType?: 'lake' | 'publicWater' | 'pin';
  lakeId?: string | null;
  lakeName?: string | null;
  lakeImageUrl?: string | null;
  publicWaterCode?: string | null;
  publicWaterName?: string | null;
  manualVenueName?: string | null;
  standId?: string | null;
  standName?: string | null;
  locality?: string | null;
  anchorLat?: number | null;
  anchorLong?: number | null;
  anchorName?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  /** CMS sweeper watermarks (spec 2026-08-09 auto-close) — server-owned, READ-ONLY
   *  on mobile; never emitted by the meta writers (see EDITABLE_META_KEYS below). */
  warnedAt?: string | null;
  autoCloseAt?: string | null;
  plannedDurationMs?: number | null;
  notes?: string | null;
  visibleOnProfile?: boolean | null;
  targetSpecies?: FirestoreTargetSpecies[] | null;
  rods?: FirestoreRodDoc[] | null;
  // Server-owned (never written by the client); present when reading:
  hostUid?: string | null;
  joinCode?: string | null;
  firestoreId?: string | null;
  status?: 'active' | 'finished' | 'abandoned' | null;
  members?: FirestoreMember[] | null;
  memberUids?: string[] | null;
  /**
   * The CMS's clock at REBUILD time (spec 2026-07-25). Read-only diagnostic —
   * it must never be fed to `serverClock`. The field ages with the document,
   * and Firestore re-delivers an unchanged document on every resubscribe, so
   * using it as a clock sample rewound every countdown by the projection's age.
   */
  serverNow?: string | null;
}

export interface FirestoreCatchDoc {
  clientId: string;
  clientUpdatedAt?: string | null;
  outcome: Outcome;
  rodIndex?: number | null;
  rodLabel?: string | null;
  rodColor?: string | null;
  bait?: string | null;
  baitType?: string | null;
  baitSize?: number | null;
  baitFlavor?: string | null;
  lane?: Lane | null;
  distance?: number | null;
  lat?: number | null;
  lng?: number | null;
  weightKg?: number | null;
  weightEstimated?: boolean | null;
  species?: string | null;
  speciesId?: string | null;
  notes?: string | null;
  occurredAt: string;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
  photoFileId?: number | null;
  /** Who's IN the photo (Task 6/7). Undefined, null, `[]`, and an explicit
   *  full-roster array all mean "everyone" — see `firestoreCatchToLocal` /
   *  `collapseFullRosterTags`, which collapses every shape to `null`. */
  photoTagUids?: string[] | null;
}

export interface FirestoreRodDoc {
  clientId: string;
  clientUpdatedAt?: string | null;
  index: number;
  label?: string | null;
  color?: string | null;
  bait?: string | null;
  baitType?: string | null;
  baitSize?: number | null;
  baitFlavor?: string | null;
  lane?: Lane | null;
  distance?: number | null;
  castLat?: number | null;
  castLng?: number | null;
  durationMs?: number | null;
  alarmSound?: string | null;
  /** Shared timer runtime (spec 2026-07-22). 'firing' is DERIVED, never stored. */
  runtimePhase?: 'idle' | 'fishing' | 'ready' | null;
  runtimeEndsAt?: string | null;
}

export interface FirestoreMarkerDoc {
  clientId: string;
  clientUpdatedAt?: string | null;
  type: MapMarkerType;
  lat: number;
  lng: number;
  label?: string | null;
  scope: 'anchor' | 'session';
  venueType?: 'lake' | 'publicWater' | 'pin' | null;
  publicWaterCode?: string | null;
}

export interface AssembledSession {
  session: LocalSession;
  events: LocalEvent[];
  markers: LocalMarker[];
}

// Online-assembled sessions have no Strapi documentId in the Firestore snapshot
// and are already up to date with the server, so these are the constant values.
const ONLINE_SERVER_ID = null;
const ONLINE_SYNC_STATUS: SyncStatus = 'synced';
const ONLINE_DETAILS_HYDRATED = true;

// ── time helpers (ms ↔ ISO) ──────────────────────────────────────────────────

/** epoch-ms → ISO string (null-preserving). */
export const toIso = (ms: number | null | undefined): string | null =>
  ms === null || ms === undefined ? null : new Date(ms).toISOString();

/** ISO string → epoch-ms (null/invalid → null). */
export const fromIso = (s: string | null | undefined): number | null => {
  if (s === null || s === undefined) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
};

// ── local → Firestore (write side) ────────────────────────────────────────────

/**
 * The member-editable session META object (excludes the server-owned fields
 * `memberUids/joinCode/status/hostUid/firestoreId/members` the client may never
 * set). ISO timestamps.
 *
 * NOTE: no production caller left — every session write goes through
 * `localSessionMetaPatchToFirestore` (the PATCH body) since the Postgres-truth
 * rewrite. Kept as the canonical full-meta shape the patch mapper is a subset
 * of; delete it if that stops being useful.
 */
export function localSessionMetaToFirestore(s: LocalSession): Record<string, unknown> {
  return {
    venueType: s.venueType,
    lakeId: s.lakeId,
    lakeName: s.lakeName,
    lakeImageUrl: s.lakeImageUrl ?? null,
    publicWaterCode: s.publicWaterCode,
    publicWaterName: s.publicWaterName,
    manualVenueName: s.manualVenueName,
    standId: s.standId,
    standName: s.standName,
    locality: s.locality,
    anchorLat: s.anchorLat,
    anchorLong: s.anchorLng, // local anchorLng ↔ wire anchorLong
    anchorName: s.anchorName,
    startedAt: toIso(s.startedAt),
    endedAt: toIso(s.endedAt),
    plannedDurationMs: s.plannedDurationMs,
    notes: s.notes,
    visibleOnProfile: s.visibleOnProfile,
    targetSpecies: s.targetSpecies.map(t => ({ documentId: t.id, name: t.name })),
    rods: s.rods.map((r, i) => localRodToFirestore(r, r.index, s.rodRuntimes[i])),
    clientUpdatedAt: toIso(s.clientUpdatedAt),
  };
}

/** Fields a member is allowed to patch onto the session meta doc. */
const EDITABLE_META_KEYS = [
  'venueType',
  'lakeId',
  'lakeName',
  'lakeImageUrl',
  'publicWaterCode',
  'publicWaterName',
  'manualVenueName',
  'standId',
  'standName',
  'locality',
  'anchorLat',
  'anchorName',
  'endedAt',
  'plannedDurationMs',
  'notes',
  'visibleOnProfile',
  'targetSpecies',
  'rods',
] as const;

/**
 * Map a PARTIAL LocalSession into the Firestore meta patch, mapping ONLY the keys
 * present in `partial` — so a caller editing just `notes` writes just `notes`.
 * Applies the ms→ISO + anchorLng→anchorLong + targetSpecies/rods conversions.
 * Never emits the server-owned protected fields. `clientUpdatedAt` is stamped by
 * the repo at write time, not here.
 */
export function localSessionMetaPatchToFirestore(partial: Partial<LocalSession>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_META_KEYS) {
    if (!(key in partial)) continue;
    const v = (partial as Record<string, unknown>)[key];
    switch (key) {
      case 'endedAt':
        out.endedAt = toIso(v as number | null);
        break;
      case 'targetSpecies':
        out.targetSpecies = (v as TargetSpecies[]).map(t => ({ documentId: t.id, name: t.name }));
        break;
      case 'rods':
        // Zip with the patch's runtimes — updateMeta's SessionMetaPatch type
        // guarantees they ride along whenever rods are written.
        out.rods = (v as LocalRod[]).map((r, i) => localRodToFirestore(r, r.index, partial.rodRuntimes?.[i]));
        break;
      default:
        out[key] = v;
    }
  }
  // The local field is `anchorLng`; the wire field is `anchorLong`.
  if ('anchorLng' in partial) out.anchorLong = partial.anchorLng;
  return out;
}

/**
 * A single `meta.rods[]` element. `clientId` is derived deterministically from
 * the rod `index` (`rod-<index>`) for stable identity. Used inside the meta
 * mapper — there is no standalone rod-subcollection write.
 */
export function localRodToFirestore(
  r: LocalRod,
  index: number,
  runtime?: RodRuntime,
  opts?: { includeRuntime?: boolean }
): Record<string, unknown> {
  const phase = runtime?.phase ?? 'idle';
  // A CONFIG-ONLY write omits the runtime keys entirely. Correct against BOTH the
  // old and the new server: mergeRods gates its whole runtime block on
  // `runtimePhase !== undefined`, so a runtime-free patch is a pure config merge
  // either way. Omitting them is what leaves a running teammate's timer alone —
  // the opposite of what this file used to claim.
  const runtimeFields =
    opts?.includeRuntime === false
      ? {}
      : {
          // 'firing' is derived state and never stored: it serializes as fishing
          // with its (now past) endsAt — the read side maps that combo back to
          // firing, and keeps the epoch so the card can count up from expiry. The
          // SERVER also reads that epoch: an echo of the stored value marks a
          // config save, a different one marks a recast.
          runtimePhase: phase === 'firing' ? 'fishing' : phase,
          runtimeEndsAt: runtime?.endEpoch != null ? toIso(runtime.endEpoch) : null,
        };
  return {
    clientId: `rod-${index}`,
    index,
    label: r.label,
    color: r.color,
    bait: r.bait,
    baitType: r.baitType,
    baitSize: r.baitSize,
    baitFlavor: r.baitFlavor,
    lane: r.lane,
    distance: r.distance,
    castLat: r.castLat,
    castLng: r.castLng,
    durationMs: r.durationMs,
    alarmSound: r.alarmSound,
    ...runtimeFields,
  };
}

/**
 * Stored runtime → local RodRuntime. 'firing' is derived, never stored: stored
 * fishing that is past due — or has no endsAt (a serialized local firing) —
 * comes back as firing (expirat, awaiting an outcome). A past-due epoch is kept
 * on the firing runtime: it is what the card counts up from.
 */
export function firestoreRodRuntimeToLocal(d: FirestoreRodDoc, nowMs: number): RodRuntime {
  const phase = d.runtimePhase ?? 'idle';
  if (phase !== 'fishing') return { phase, endEpoch: null };
  const endEpoch = fromIso(d.runtimeEndsAt ?? null);
  if (endEpoch == null) return { phase: 'firing', endEpoch: null };
  if (endEpoch <= nowMs) return { phase: 'firing', endEpoch };
  return { phase: 'fishing', endEpoch };
}

/**
 * A marker subcollection doc — markers are the ONE thing still written straight
 * to Firestore (parked, deliberately outside the projection). Field names match
 * the CMS `MARKER_FIELDS` allowlist (api/map-marker/controllers/map-marker.ts).
 * `venueType`/`publicWaterCode` are flattened out of the LocalMarker `venue` ref.
 */
export function localMarkerToFirestore(m: LocalMarker): Record<string, unknown> {
  return {
    clientId: m.clientId,
    clientUpdatedAt: toIso(m.clientUpdatedAt),
    type: m.type,
    lat: m.lat,
    lng: m.lng,
    label: m.label,
    scope: m.scope,
    venueType: m.venue.venueType,
    publicWaterCode: m.venue.venueType === 'publicWater' ? m.venue.publicWaterCode : null,
  };
}

// ── Firestore → local (read side) ─────────────────────────────────────────────

export function firestoreRodToLocal(d: FirestoreRodDoc): LocalRod {
  return {
    index: d.index,
    label: d.label ?? '',
    color: d.color ?? '',
    bait: d.bait ?? '',
    baitType: d.baitType ?? null,
    baitSize: d.baitSize ?? null,
    baitFlavor: d.baitFlavor ?? null,
    lane: (d.lane ?? 'center') as Lane,
    distance: d.distance ?? 0,
    castLat: d.castLat ?? null,
    castLng: d.castLng ?? null,
    durationMs: d.durationMs ?? null,
    alarmSound: (d.alarmSound ?? null) as LocalRod['alarmSound'],
  };
}

/**
 * Collapse a server-resolved tag array back to the client's null/"Toți"
 * contract. Two distinct server-side shapes both mean "everyone" but arrive
 * as a real array over the wire, never as an omitted field:
 *  - `[]` — legacy rows written before photo-tagging existed; the projection
 *    always emits an array for `photoTagUids`, never omits it (M1).
 *  - the full current roster — `resolvePhotoTags` (CMS) stamps the WHOLE
 *    roster onto an untagged catch at create time; round-tripping that
 *    verbatim would preselect every member individually instead of "Toți"
 *    on reopen (M2).
 * A genuine partial selection (a strict, non-full subset of the roster)
 * passes through unchanged — that IS a specific tag, not "everyone".
 *
 * Exported so `historyMappers.ts` (`dtoToLocalEvent`, the REST/archived-session
 * path) can apply the identical collapse to `EventDTO.photoTagUids` — the CMS
 * emits the same array-never-omitted shape there (`toEventDTO`), so both paths
 * must agree on what counts as "everyone" or a picker reopened on an archived
 * capture would prefill differently than the same capture read live.
 */
export function collapseFullRosterTags(tagUids: string[] | null | undefined, roster: string[]): string[] | null {
  if (!tagUids || tagUids.length === 0) return null;
  if (roster.length > 0 && tagUids.length === roster.length) {
    const rosterSet = new Set(roster);
    if (tagUids.every(uid => rosterSet.has(uid))) return null;
  }
  return tagUids;
}

function firestoreCatchToLocal(d: FirestoreCatchDoc, sessionId: string, roster: string[]): LocalEvent {
  const occurredAt = fromIso(d.occurredAt) ?? 0;
  return {
    clientId: d.clientId,
    serverId: ONLINE_SERVER_ID,
    serverNumericId: null,
    syncStatus: ONLINE_SYNC_STATUS,
    clientUpdatedAt: fromIso(d.clientUpdatedAt) ?? occurredAt,
    sessionClientId: sessionId,
    outcome: d.outcome,
    rodIndex: d.rodIndex ?? null,
    rodLabel: d.rodLabel ?? null,
    rodColor: d.rodColor ?? null,
    bait: d.bait ?? '',
    baitType: d.baitType ?? null,
    baitSize: d.baitSize ?? null,
    baitFlavor: d.baitFlavor ?? null,
    lane: d.lane ?? null,
    distance: d.distance ?? 0,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    weightKg: d.weightKg ?? null,
    weightEstimated: d.weightEstimated === true,
    species: d.species ?? null,
    speciesId: d.speciesId ?? null,
    photoLocalUri: null,
    photoUploadStatus: d.photoUrl ? 'done' : 'none',
    photoUrl: d.photoUrl ?? null,
    photoThumbUrl: d.photoThumbUrl ?? null,
    photoFileId: d.photoFileId ?? null,
    // undefined (field omitted), null, `[]` (M1) and an explicit full-roster
    // array (M2) all mean "everyone" — collapse every shape to null so callers
    // never have to special-case any of them.
    photoTagUids: collapseFullRosterTags(d.photoTagUids, roster),
    notes: d.notes ?? null,
    occurredAt,
  };
}

function firestoreMarkerToLocal(d: FirestoreMarkerDoc, sessionId: string, meta: FirestoreSessionMeta): LocalMarker {
  const venue: LocalMarker['venue'] =
    d.venueType === 'lake'
      ? { venueType: 'lake', lakeId: meta.lakeId ?? '' }
      : d.venueType === 'publicWater'
        ? { venueType: 'publicWater', publicWaterCode: d.publicWaterCode ?? meta.publicWaterCode ?? '' }
        : { venueType: 'pin', anchor: { lat: meta.anchorLat ?? d.lat, lng: meta.anchorLong ?? d.lng } };
  return {
    clientId: d.clientId,
    serverId: ONLINE_SERVER_ID,
    syncStatus: ONLINE_SYNC_STATUS,
    clientUpdatedAt: fromIso(d.clientUpdatedAt) ?? 0,
    type: d.type,
    lat: d.lat,
    lng: d.lng,
    label: d.label ?? null,
    scope: d.scope,
    venue,
    sessionClientId: d.scope === 'session' ? sessionId : null,
  };
}

/**
 * Assemble a live LocalSession (+ its events and markers) from the CMS-rebuilt
 * projection document: session meta FLAT at the root, `catches` and `markers` as
 * root-level ARRAYS (sessionRepo unpacks them and passes them in). No
 * subcollection reads are involved.
 *
 * Rods are a SINGLE source: the `rods` array, carrying config AND timer runtime
 * together. `serverId`/`syncStatus`/`detailsHydrated` take the
 * online-appropriate constants.
 */
export function firestoreSessionToLocal(
  sessionId: string,
  meta: FirestoreSessionMeta,
  catches: FirestoreCatchDoc[],
  markers: FirestoreMarkerDoc[],
  nowMs: number = Date.now()
): AssembledSession {
  const sortedRods = [...(meta.rods ?? [])].sort((a, b) => a.index - b.index);
  const localRods = sortedRods.map(firestoreRodToLocal);
  const rodRuntimes: RodRuntime[] = sortedRods.map(d => firestoreRodRuntimeToLocal(d, nowMs));
  const startedAt = fromIso(meta.startedAt) ?? 0;

  const session: LocalSession = {
    clientId: sessionId,
    serverId: ONLINE_SERVER_ID,
    syncStatus: ONLINE_SYNC_STATUS,
    clientUpdatedAt: fromIso(meta.clientUpdatedAt) ?? startedAt,
    venueType: meta.venueType ?? 'pin',
    lakeId: meta.lakeId ?? null,
    lakeName: meta.lakeName ?? null,
    lakeImageUrl: meta.lakeImageUrl ?? null,
    publicWaterCode: meta.publicWaterCode ?? null,
    publicWaterName: meta.publicWaterName ?? null,
    manualVenueName: meta.manualVenueName ?? null,
    standId: meta.standId ?? null,
    standName: meta.standName ?? null,
    locality: meta.locality ?? null,
    anchorLat: meta.anchorLat ?? 0,
    anchorLng: meta.anchorLong ?? 0, // wire anchorLong ↔ local anchorLng
    anchorName: meta.anchorName ?? null,
    startedAt,
    endedAt: fromIso(meta.endedAt),
    warnedAt: fromIso(meta.warnedAt),
    autoCloseAt: fromIso(meta.autoCloseAt),
    plannedDurationMs: meta.plannedDurationMs ?? 0,
    notes: meta.notes ?? null,
    visibleOnProfile: meta.visibleOnProfile ?? true,
    targetSpecies: (meta.targetSpecies ?? []).map(t => ({ id: t.documentId, name: t.name })),
    rods: localRods,
    rodRuntimes,
    detailsHydrated: ONLINE_DETAILS_HYDRATED,
    // Co-op display fields — READ-ONLY (never written back; the meta writers omit
    // them). Surfaced here so the invite code + member roster UI can render.
    hostUid: meta.hostUid ?? null,
    joinCode: meta.joinCode ?? null,
    status: meta.status ?? null,
    members: (meta.members ?? []).map(m => ({
      uid: m.uid,
      name: m.name ?? null,
      avatar: m.avatar ?? null,
      joinedAt: m.joinedAt,
    })),
    memberUids: meta.memberUids ?? [],
    projectionRev: meta.rev ?? 0,
  };

  const roster = meta.memberUids ?? (meta.members ?? []).map(m => m.uid);
  const events = catches.map(c => firestoreCatchToLocal(c, sessionId, roster));
  const localMarkers = markers.map(m => firestoreMarkerToLocal(m, sessionId, meta));

  return { session, events, markers: localMarkers };
}
