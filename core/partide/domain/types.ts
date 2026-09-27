/**
 * UI-agnostic Partide domain shapes.
 * fish `features/partide/types.ts` + `features/partide/domain/types.ts` + `features/timer/types.ts#AlarmSound`.
 * These are the LOCAL models the scenes render (epoch-ms times, sync flags), not the wire DTOs —
 * those are the zod schemas in `../schemas.ts`; `historyMappers.ts` turns one into the other.
 */

/** fish `features/timer/types.ts#AlarmSound` */
export type AlarmSound = 'tone-1' | 'tone-2' | 'tone-3' | 'tone-4' | 'tone-5' | 'tone-6' | 'tone-7' | 'senzor';

export type Lane = 'left' | 'center' | 'right';
export type Outcome = 'capture' | 'lost' | 'blank';
export type RodColorHex = string;

export const LANE_LABEL: Record<Lane, string> = {
  left: 'Stânga',
  center: 'Centru',
  right: 'Dreapta',
};

/** A fish the user targets/caught — CMS Fish documentId + Name snapshot (id null = «Altele» / unmatched). */
export type TargetSpecies = { id: string | null; name: string };

/** Still used by the stats helpers (computeLeaderboard/computeHourHeatmap). */
export type SessionEvent = {
  id: string;
  outcome: Outcome;
  rodIndex: number;
  rodLabel: string;
  rodColor: RodColorHex;
  // denormalized snapshot — the truth of this cast
  bait: string;
  lane: Lane;
  distance: number;
  // capture-only
  weightKg?: number;
  species?: string;
  photoUri?: string;
  notes?: string;
  occurredAt: number; // epoch ms
  lat?: number;
  lng?: number;
};

export type MapMarkerType = 'hardSpot' | 'baited' | 'snag';

export const MAP_MARKER_LABEL: Record<MapMarkerType, string> = {
  hardSpot: 'Zonă tare',
  baited: 'Pat nadă',
  snag: 'Agățătură',
};

/** Persistence: snag + hardSpot describe permanent water → 'anchor' (carry across
 *  trips at the same spot); baited area is re-done each trip → 'session'. */
export const MARKER_SCOPE: Record<MapMarkerType, 'anchor' | 'session'> = {
  hardSpot: 'anchor',
  snag: 'anchor',
  baited: 'session',
};

/** One row of the bait × distance-band leaderboard. */
export type PatternLeaderboardRow = {
  bait: string;
  distanceBand: string;
  count: number; // captures in this group
  avg: number; // average kg
  max: number; // max kg
};

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
  /** CMS sweeper watermarks (auto-close). READ-ONLY on the client. */
  warnedAt: number | null;
  autoCloseAt: number | null;
  plannedDurationMs: number;
  notes: string | null;
  visibleOnProfile: boolean;
  targetSpecies: TargetSpecies[];
  rods: LocalRod[];
  rodRuntimes: RodRuntime[]; // runtimes are device-local, never synced
  detailsHydrated: boolean; // false = summary-only row (rods/events not yet pulled)
  // ── Co-op display fields (READ-ONLY, server-owned) ──
  joinCode?: string | null;
  status?: SessionStatus | null;
  members?: SessionMember[];
  memberUids?: string[];
  /** Authoritative session owner from the server; optional for legacy local fixtures. */
  hostUid?: string | null;
  /** The projection document's `rev` (CMS `projectionRev`). 0 for history/local-built sessions. */
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
  /** Weight entered by eye rather than read off a scale. Always false when `weightKg` is null. */
  weightEstimated: boolean;
  species: string | null;
  speciesId: string | null;
  photoLocalUri: string | null;
  photoUploadStatus: 'none' | 'pending' | 'uploading' | 'done' | 'failed';
  photoUrl: string | null;
  photoThumbUrl?: string | null;
  photoFileId?: number | null; // numeric Strapi upload id → CMS archive `photo` relation
  /** Who's IN the photo — null/omitted = "Toți" (everyone). Governs ONLY whose gallery it shows in. */
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
