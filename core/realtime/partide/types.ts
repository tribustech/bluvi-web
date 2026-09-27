/**
 * fish `features/partide/domain/types.ts` (UI-agnostic synced shapes: clientId/syncStatus) plus
 * the few leaf types it imports from `features/partide/types.ts` and `features/timer/types.ts`.
 */
export type AlarmSound = 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'senzor';
export type Lane = 'left' | 'center' | 'right';
export type Outcome = 'capture' | 'lost' | 'blank';
export type TargetSpecies = { id: string | null; name: string };
export type MapMarkerType = 'hardSpot' | 'baited' | 'snag';

export type SyncStatus = 'pending' | 'synced';

export type VenueRef =
  | { venueType: 'lake'; lakeId: string }
  | { venueType: 'publicWater'; publicWaterCode: string }
  | { venueType: 'pin'; anchor: { lat: number; lng: number } };

export type LocalRod = {
  index: number;
  label: string;
  color: string;
  bait: string;
  baitType: string | null;
  baitSize: number | null;
  baitFlavor: string | null;
  lane: Lane;
  distance: number;
  /** Real-map bait position (rod cast pin). Null = never placed on the map. */
  castLat: number | null;
  castLng: number | null;
  /** Countdown duration; null = no timer configured on this rod (timer-free). */
  durationMs: number | null;
  alarmSound: AlarmSound | null;
};

export type RodRuntime = {
  phase: 'idle' | 'fishing' | 'firing' | 'ready';
  endEpoch: number | null;
};

/** A co-op session member — server-owned; surfaced READ-ONLY on LocalSession. */
export type SessionMember = {
  uid: string;
  name: string | null;
  avatar: string | null;
  joinedAt: string;
};

export type SessionStatus = 'active' | 'finished' | 'abandoned';

export type LocalSession = {
  clientId: string;
  serverId: string | null;
  syncStatus: SyncStatus;
  clientUpdatedAt: number; // epoch ms — LWW key
  venueType: 'lake' | 'publicWater' | 'pin';
  lakeId: string | null;
  lakeName: string | null;
  lakeImageUrl?: string | null;
  publicWaterCode: string | null;
  publicWaterName: string | null;
  manualVenueName: string | null;
  standId: string | null;
  standName: string | null;
  locality: string | null;
  anchorLat: number;
  anchorLng: number;
  anchorName: string | null;
  startedAt: number;
  endedAt: number | null;
  /** CMS sweeper watermarks (spec 2026-08-09 auto-close). READ-ONLY on mobile —
   *  the meta writers never emit them; cleared server-side on activity/extend. */
  warnedAt: number | null;
  autoCloseAt: number | null;
  plannedDurationMs: number;
  notes: string | null;
  visibleOnProfile: boolean;
  targetSpecies: TargetSpecies[];
  rods: LocalRod[];
  rodRuntimes: RodRuntime[]; // runtimes are device-local, never synced
  detailsHydrated: boolean; // false = summary-only row (rods/events not yet pulled)
  // ── Co-op display fields (READ-ONLY) ──────────────────────────────────────
  // Server-owned: the mapper surfaces them for the invite/roster UI, but the
  // meta writers deliberately EXCLUDE them (Firestore rules forbid the client
  // from patching them). Optional so the local-first / history builders that
  // omit them keep type-checking.
  joinCode?: string | null;
  status?: SessionStatus | null;
  members?: SessionMember[];
  memberUids?: string[];
  /** Authoritative session owner from the server; optional for legacy local fixtures. */
  hostUid?: string | null;
  /** The projection document's `rev` (CMS `projectionRev`). Bumped by the server
   *  BEFORE it enqueues the rebuild, and read from the same Postgres row as the
   *  rods — so a higher rev provably contains our write. This is how an EDIT
   *  (where presence-checking can't work) knows the snapshot caught up.
   *  0 for history/local-built sessions, which have no projection. */
  projectionRev: number;
  // List-DTO aggregates, shown on the card while details are unhydrated:
  summaryCaptures?: number;
  summaryRecordKg?: number | null;
  summaryTotalKg?: number | null;
};

export type LocalEvent = {
  clientId: string;
  serverId: string | null;
  serverNumericId: number | null;
  syncStatus: SyncStatus;
  clientUpdatedAt: number;
  sessionClientId: string;
  outcome: Outcome;
  rodIndex: number | null;
  rodLabel: string | null;
  rodColor: string | null;
  bait: string;
  baitType: string | null;
  baitSize: number | null;
  baitFlavor: string | null;
  lane: Lane | null;
  distance: number;
  lat: number | null;
  lng: number | null;
  weightKg: number | null;
  /** Weight entered by eye rather than read off a scale. Always false when
   *  `weightKg` is null — the flag is meaningless without a number. */
  weightEstimated: boolean;
  species: string | null;
  speciesId: string | null;
  photoLocalUri: string | null;
  photoUploadStatus: 'none' | 'pending' | 'uploading' | 'done' | 'failed';
  photoUrl: string | null;
  // Online co-op catch fields (populated by the Task 2.5 photo flow). Optional so
  // the local-first paths that build LocalEvent without them keep type-checking.
  photoThumbUrl?: string | null;
  photoFileId?: number | null; // numeric Strapi upload id → CMS archive `photo` relation
  // Who's IN the photo (Task 6's PhotoTagPicker) — null/omitted = "Toți"
  // (everyone). Governs ONLY which member's photo gallery this catch's photo
  // appears in; the catch itself is always team-owned regardless of tagging.
  // Wired all the way through eventToUpsertBody, the Firestore projection
  // mapper, and the edit-mode tags PATCH (Task 7).
  photoTagUids?: string[] | null;
  notes: string | null;
  occurredAt: number;
};

export type LocalMarker = {
  clientId: string;
  serverId: string | null;
  syncStatus: SyncStatus;
  clientUpdatedAt: number;
  type: MapMarkerType;
  lat: number;
  lng: number;
  label: string | null;
  scope: 'anchor' | 'session';
  venue: VenueRef;
  sessionClientId: string | null;
};
