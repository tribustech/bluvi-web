import { z } from 'zod';
import { paginatedSchema } from '../shared';

/*
 * Wire DTOs for Partide (fishing sessions), the community dashboard, session follows,
 * the legacy catch model and the AI text formatter.
 * fish `services/api/partide.ts`, `community.ts`, `sessionFollows.ts`, `ai.ts`, `models/catch.type.ts`.
 * CMS: `fir-intins-cms/src/api/fishing-session/services/dto/*` (toSessionDTO, toEventDTO,
 * toMarkerDTO, community.ts, community-stats.ts).
 */

const venueTypeSchema = z.enum(['lake', 'publicWater', 'pin']);
const laneSchema = z.enum(['left', 'center', 'right']);
const sessionStatusSchema = z.enum(['active', 'finished', 'abandoned']);

// ── /feed/sessions/* ────────────────────────────────────────────────────────

export const sessionRodDTOSchema = z.object({
  index: z.number(),
  label: z.string().nullable(),
  color: z.string().nullable(),
  bait: z.string().nullable(),
  baitType: z.string().nullable(),
  baitSize: z.number().nullable(),
  baitFlavor: z.string().nullable(),
  lane: laneSchema.nullable(),
  distance: z.number().nullable(),
  castLat: z.number().nullable(),
  castLng: z.number().nullable(),
  durationMs: z.number().nullable(),
  alarmSound: z.string().nullable(),
  // The CMS derives these from the rod deadline (toSessionDTO); fish's type omits them.
  runtimePhase: z.enum(['idle', 'fishing', 'ready']).optional(),
  runtimeEndsAt: z.string().nullable().optional(),
});
export type SessionRodDTO = z.infer<typeof sessionRodDTOSchema>;

export const sessionTargetSpeciesDTOSchema = z.object({ documentId: z.string().nullable(), name: z.string() });
export type SessionTargetSpeciesDTO = z.infer<typeof sessionTargetSpeciesDTOSchema>;

/** A co-op session member as returned on the session doc / create+join responses. */
export const sessionMemberDTOSchema = z.object({
  uid: z.string(),
  name: z.string().nullable(),
  avatar: z.string().nullable(),
  joinedAt: z.string(),
});
export type SessionMemberDTO = z.infer<typeof sessionMemberDTOSchema>;

const sessionBaseShape = {
  documentId: z.string(),
  clientId: z.string(),
  clientUpdatedAt: z.string().nullable(),
  venueType: venueTypeSchema,
  lakeId: z.string().nullable(),
  lakeName: z.string().nullable(),
  lakeImageUrl: z.string().nullable(),
  publicWaterCode: z.string().nullable(),
  publicWaterName: z.string().nullable(),
  manualVenueName: z.string().nullable(),
  standId: z.string().nullable(),
  standName: z.string().nullable(),
  locality: z.string().nullable(),
  anchorLat: z.number().nullable(),
  anchorLong: z.number().nullable(),
  anchorName: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  plannedDurationMs: z.number().nullable(),
  notes: z.string().nullable(),
  visibleOnProfile: z.boolean(),
  status: sessionStatusSchema,
  targetSpecies: z.array(sessionTargetSpeciesDTOSchema),
  hostUid: z.string().nullish(),
};

export const sessionDTOSchema = z.object({
  ...sessionBaseShape,
  joinCode: z.string().nullable(),
  rods: z.array(sessionRodDTOSchema),
  // toSessionDTO always includes the co-op roster; the `mine` list omits it.
  members: z.array(sessionMemberDTOSchema),
});
export type SessionDTO = z.infer<typeof sessionDTOSchema>;

export const sessionListItemDTOSchema = z.object({
  ...sessionBaseShape,
  captures: z.number(),
  recordKg: z.number().nullable(),
  totalKg: z.number().nullable(),
});
export type SessionListItemDTO = z.infer<typeof sessionListItemDTOSchema>;

/** `/feed/sessions/mine` — NOT the standard `meta.pagination` envelope. */
export const mySessionsPageSchema = z.object({
  data: z.array(sessionListItemDTOSchema),
  meta: z.object({ page: z.number(), pageSize: z.number(), total: z.number() }),
});
export type MySessionsPage = z.infer<typeof mySessionsPageSchema>;

export const eventDTOSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  clientId: z.string(),
  clientUpdatedAt: z.string().nullable(),
  outcome: z.enum(['capture', 'lost', 'blank']),
  rodIndex: z.number().nullable(),
  rodLabel: z.string().nullable(),
  rodColor: z.string().nullable(),
  bait: z.string().nullable(),
  baitType: z.string().nullable(),
  baitSize: z.number().nullable(),
  baitFlavor: z.string().nullable(),
  lane: laneSchema.nullable(),
  distance: z.number().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  weightKg: z.number().nullable(),
  // Older payloads may omit it; fish coerces absence to false (historyMappers#dtoToLocalEvent).
  weightEstimated: z.boolean().default(false),
  species: z.string().nullable(),
  speciesId: z.string().nullable(),
  photoUrl: z.string().nullable(),
  photoThumbUrl: z.string().nullable(),
  notes: z.string().nullable(),
  occurredAt: z.string(),
  // Always a real array on current CMS (toEventDTO); `[]` = no explicit tags stored.
  photoTagUids: z.array(z.string()).default([]),
});
export type EventDTO = z.infer<typeof eventDTOSchema>;

export const sessionDetailDTOSchema = sessionDTOSchema.extend({ events: z.array(eventDTOSchema) });
export type SessionDetailDTO = z.infer<typeof sessionDetailDTOSchema>;

export const markerDTOSchema = z.object({
  documentId: z.string(),
  clientId: z.string(),
  clientUpdatedAt: z.string().nullable(),
  type: z.enum(['hardSpot', 'baited', 'snag']),
  lat: z.number(),
  lng: z.number(),
  label: z.string().nullable(),
  scope: z.enum(['anchor', 'session']),
  venueType: venueTypeSchema.nullable(),
  lakeId: z.string().nullable(),
  publicWaterCode: z.string().nullable(),
  sessionId: z.string().nullable(),
});
export type MarkerDTO = z.infer<typeof markerDTOSchema>;

/** Create (`POST /feed/sessions`) and join responses: SessionDTO + `firestoreId` (=== clientId). */
export const sessionCreateJoinDTOSchema = sessionDTOSchema.extend({ firestoreId: z.string() });
export type SessionCreateJoinDTO = z.infer<typeof sessionCreateJoinDTOSchema>;

/** The live-session probe's payload — pointer ids only, no session data. */
export const activeSessionDTOSchema = z.object({
  documentId: z.string(),
  clientId: z.string().nullable(),
  firestoreId: z.string().nullable(),
});
export type ActiveSessionDTO = z.infer<typeof activeSessionDTOSchema>;

export const leaveSessionDTOSchema = z.object({ removed: z.literal(true) });
export type LeaveSessionDTO = z.infer<typeof leaveSessionDTOSchema>;

export const membershipMutationDTOSchema = z.object({
  removed: z.boolean(),
  joinCode: z.string(),
  members: z.array(sessionMemberDTOSchema),
  hostUid: z.string(),
  projectionRev: z.number(),
});
export type MembershipMutationDTO = z.infer<typeof membershipMutationDTOSchema>;

export const joinCodeRotationDTOSchema = z.object({ joinCode: z.string(), projectionRev: z.number() });
export type JoinCodeRotationDTO = z.infer<typeof joinCodeRotationDTOSchema>;

/** `POST /feed/sessions/photo` — bare object (ctx.send), NOT the `{ data }` envelope. */
export const sessionPhotoUploadSchema = z.object({
  fileId: z.number(),
  url: z.string(),
  thumbUrl: z.string().nullish(),
});

export const patchRodsResultSchema = z.object({ rods: z.array(z.unknown()), serverNow: z.string() });
export type PatchRodsResult = z.infer<typeof patchRodsResultSchema>;

/**
 * A rod-runtime command's reply: the ONE rod addressed, the server clock, and whether the
 * compare-and-swap applied. `applied: false` is a SUCCESS — a teammate moved that rod first
 * and `rod` carries the state that won, which the caller adopts rather than overwriting.
 */
export const rodCommandResultSchema = z.object({
  rod: z.record(z.string(), z.unknown()).nullable(),
  serverNow: z.string(),
  applied: z.boolean(),
});
export type RodCommandResult = z.infer<typeof rodCommandResultSchema>;

/**
 * fish `models/angler.type.ts#AnglerCatchDTO` — owned by the anglers domain; minimal local copy
 * for `/feed/sessions/mine/catches` (same DTO and cursor as the profile grid).
 */
export const myCatchDTOSchema = z.object({
  key: z.string(),
  source: z.union([z.enum(['partida', 'competition']), z.string()]),
  photoUrl: z.string(),
  photoGridUrl: z.string().optional(),
  blurhash: z.string().nullish(),
  photoWidth: z.number().nullish(),
  photoHeight: z.number().nullish(),
  weightKg: z.number().nullable(),
  species: z.string().nullable(),
  venueName: z.string().nullable(),
  date: z.string(),
  competitionName: z.string().nullable(),
  competitionDocumentId: z.string().nullable(),
});
export type MyCatchDTO = z.infer<typeof myCatchDTOSchema>;

/** Cursor-paginated page: no `page`/`pageCount`; `nextCursor === null` means the end. */
export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({
      pagination: z.object({ pageSize: z.number(), total: z.number() }),
      nextCursor: z.string().nullable(),
    }),
  });
}

export const myCatchesPageSchema = cursorPageSchema(myCatchDTOSchema);
export type MyCatchesPage = z.infer<typeof myCatchesPageSchema>;

// ── /feed/session-follows ───────────────────────────────────────────────────

export const mySessionFollowsSchema = z.object({ data: z.object({ sessionDocumentIds: z.array(z.string()) }) });

// ── /feed/community/* ───────────────────────────────────────────────────────

export const communityMemberDTOSchema = z.object({
  uid: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type CommunityMemberDTO = z.infer<typeof communityMemberDTOSchema>;

export const communitySessionPhotoDTOSchema = z.object({
  url: z.string(),
  thumbUrl: z.string().nullish(),
  weightKg: z.number().nullable(),
});
export type CommunitySessionPhotoDTO = z.infer<typeof communitySessionPhotoDTOSchema>;

/**
 * Community `/feed/community/*` responses are edge-cached (up to 30 days for finished
 * sessions), so fields added after the first rollout stay optional (`nullish`) exactly as fish
 * types them: an old-shaped body must still parse.
 */
export const communityActiveSessionDTOSchema = z.object({
  documentId: z.string(),
  startedAt: z.string(),
  members: z.array(communityMemberDTOSchema),
  catchCount: z.number().nullable(),
  maxKg: z.number().nullable(),
  totalKg: z.number().nullish(),
  standName: z.string().nullish(),
  lastCatchAt: z.string().nullish(),
  photos: z.array(communitySessionPhotoDTOSchema).optional(),
  photoCount: z.number().optional(),
});
export type CommunityActiveSessionDTO = z.infer<typeof communityActiveSessionDTOSchema>;

export const communityVenueDTOSchema = z.object({
  key: z.string(),
  venueType: venueTypeSchema,
  lakeId: z.string().nullable(),
  name: z.string(),
  locality: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sessions: z.array(communityActiveSessionDTOSchema), // sorted totalKg desc, nulls last
});
export type CommunityVenueDTO = z.infer<typeof communityVenueDTOSchema>;

const photoVariantsShape = {
  photoGridUrl: z.string().nullish(),
  photoThumbUrl: z.string().nullish(),
};

export const communityCatchDTOSchema = z.object({
  clientId: z.string(),
  sessionDocumentId: z.string(),
  species: z.string().nullable(),
  weightKg: z.number().nullable(),
  photoUrl: z.string().nullable(),
  ...photoVariantsShape,
  width: z.number().nullish(),
  height: z.number().nullish(),
  occurredAt: z.string(),
  angler: communityMemberDTOSchema,
  extraMembers: z.number(),
  venueName: z.string(),
});
export type CommunityCatchDTO = z.infer<typeof communityCatchDTOSchema>;

export const communityRecordDTOSchema = z.object({
  window: z.enum(['today', 'week', 'month']),
  weightKg: z.number(),
  species: z.string().nullable(),
  venueName: z.string(),
  photoUrl: z.string().nullable(),
  ...photoVariantsShape,
  width: z.number().nullish(),
  height: z.number().nullish(),
  sessionDocumentId: z.string().nullable(),
  angler: communityMemberDTOSchema.nullable(),
  extraMembers: z.number(),
});
export type CommunityRecordDTO = z.infer<typeof communityRecordDTOSchema>;

export const communityPopularVenueDTOSchema = z.object({
  key: z.string(),
  lakeId: z.string().nullable(),
  name: z.string(),
  locality: z.string().nullable(),
  imageUrl: z.string().nullable(),
  liveCount: z.number(),
  sessionsLast30d: z.number(),
});
export type CommunityPopularVenueDTO = z.infer<typeof communityPopularVenueDTOSchema>;

export const communityOverviewDTOSchema = z.object({
  latestCatches: z.array(communityCatchDTOSchema),
  activeVenues: z.array(communityVenueDTOSchema),
  records: z.array(communityRecordDTOSchema),
  popularVenues: z.array(communityPopularVenueDTOSchema),
});
export type CommunityOverviewDTO = z.infer<typeof communityOverviewDTOSchema>;

/** A single catch surfaced on the community session detail screen. */
export const communitySessionDetailCatchDTOSchema = z.object({
  clientId: z.string(),
  species: z.string().nullable(),
  weightKg: z.number().nullable(),
  photoUrl: z.string().nullable(),
  ...photoVariantsShape,
  occurredAt: z.string(),
  width: z.number().nullish(),
  height: z.number().nullish(),
});
export type CommunitySessionDetailCatchDTO = z.infer<typeof communitySessionDetailCatchDTOSchema>;

/** A single weighed catch point on the session-detail evolution timeline. */
export const communityWeighedCatchDTOSchema = z.object({ t: z.string(), kg: z.number(), species: z.string().nullable() });
export type CommunityWeighedCatchDTO = z.infer<typeof communityWeighedCatchDTOSchema>;

/** `GET /feed/community/sessions/:documentId`. */
export const communitySessionDetailDTOSchema = z.object({
  documentId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  venueName: z.string(),
  locality: z.string().nullable(),
  lakeId: z.string().nullable(),
  imageUrl: z.string().nullable(),
  /** Venue image only (never a catch photo). Absent on older CMS deploys; fall back to `imageUrl`. */
  venueImageUrl: z.string().nullish(),
  members: z.array(communityMemberDTOSchema),
  catchCount: z.number(),
  maxKg: z.number().nullable(),
  durationMs: z.number().nullable(),
  /** Most recent catches, capped at 10. */
  catches: z.array(communitySessionDetailCatchDTOSchema),
  /** Photo-bearing catches only, capped at 12. */
  photos: z.array(communitySessionDetailCatchDTOSchema),
  /** Every weighed catch, ascending by time — feeds the evolution chart. */
  weighedCatches: z.array(communityWeighedCatchDTOSchema),
  maxCatch: communitySessionDetailCatchDTOSchema.nullable(),
  photoCount: z.number(),
  hasMoreCatches: z.boolean(),
  anglerStats: z.object({ partide: z.number(), followers: z.number() }).nullable(),
  venueType: venueTypeSchema.optional(),
  publicWaterCode: z.string().nullish(),
});
export type CommunitySessionDetailDTO = z.infer<typeof communitySessionDetailDTOSchema>;

/** `GET /feed/community/{lakes|waters}/:identifier`. */
export const communityLakeSectionDTOSchema = z.object({
  stats: z.object({ activeNow: z.number(), catchesThisMonth: z.number(), recordKg: z.number().nullable() }),
  activeSessions: z.array(communityActiveSessionDTOSchema),
  monthlyActivity: z.array(z.object({ month: z.string(), count: z.number() })),
  /** Public waters only — absent for lakes, and from backends older than 2026-08-04. */
  speciesCounts: z.array(z.object({ species: z.string(), count: z.number() })).optional(),
});
export type CommunityLakeSectionDTO = z.infer<typeof communityLakeSectionDTOSchema>;

/** `GET /feed/community/history` per-session item — a finished, public partidă. */
export const communityHistorySessionDTOSchema = z.object({
  documentId: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  members: z.array(communityMemberDTOSchema),
  venue: z.object({
    key: z.string(),
    venueType: venueTypeSchema,
    lakeId: z.string().nullable(),
    name: z.string(),
    locality: z.string().nullable(),
    imageUrl: z.string().nullable(),
  }),
  catchCount: z.number(),
  maxKg: z.number().nullable(),
  totalKg: z.number().nullable(),
  photoUrl: z.string().nullable(),
  standName: z.string().nullish(),
  photos: z.array(communitySessionPhotoDTOSchema).optional(),
  photoCount: z.number().optional(),
});
export type CommunityHistorySessionDTO = z.infer<typeof communityHistorySessionDTOSchema>;

export const communityHistoryPageSchema = paginatedSchema(communityHistorySessionDTOSchema);
export type CommunityHistoryPage = z.infer<typeof communityHistoryPageSchema>;

/**
 * `GET /feed/community/active` — CURSOR-paginated, unlike its `history` sibling (live rows
 * churn by the second; offset pagination over a shifting set duplicates and skips).
 * `meta` is optional: a body served from an edge-cache entry written before the cursor
 * envelope shipped predates it, and consumers degrade rather than throw (fish optional-chains).
 */
export const communityActivePageSchema = z.object({
  data: z.array(communityVenueDTOSchema),
  meta: z
    .object({
      pagination: z.object({ pageSize: z.number(), total: z.number() }),
      nextCursor: z.string().nullable(),
    })
    .optional(),
});
export type CommunityActivePage = z.infer<typeof communityActivePageSchema>;

/** `GET /feed/community/sessions/:documentId/catches` — CURSOR-paginated. */
export const sessionCatchesPageSchema = cursorPageSchema(communitySessionDetailCatchDTOSchema);
export type SessionCatchesPage = z.infer<typeof sessionCatchesPageSchema>;

/** One photo catch at a community venue. */
export const lakeCatchDTOSchema = z.object({
  clientId: z.string(),
  sessionDocumentId: z.string(),
  species: z.string().nullable(),
  weightKg: z.number().nullable(),
  photoUrl: z.string().nullable(),
  ...photoVariantsShape,
  photoWidth: z.number().nullable(),
  photoHeight: z.number().nullable(),
  occurredAt: z.string(),
  angler: communityMemberDTOSchema,
});
export type LakeCatchDTO = z.infer<typeof lakeCatchDTOSchema>;

export const lakeCatchesPageSchema = paginatedSchema(lakeCatchDTOSchema);
export type LakeCatchesPage = z.infer<typeof lakeCatchesPageSchema>;

// ── /feed/community/stats ───────────────────────────────────────────────────

export const statsPeriodSchema = z.enum(['week', 'month', 'year']);
export type StatsPeriod = z.infer<typeof statsPeriodSchema>;

export const statsTotalsSchema = z.object({
  partide: z.number(),
  anglers: z.number(),
  catches: z.number(),
  totalKg: z.number(),
});
export type StatsTotals = z.infer<typeof statsTotalsSchema>;

export const seriesPointSchema = z.object({ label: z.string(), count: z.number() });
export type SeriesPoint = z.infer<typeof seriesPointSchema>;

export const topAnglerSchema = z.object({
  uid: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  partide: z.number(),
  catches: z.number(),
  totalKg: z.number(),
});
export type TopAngler = z.infer<typeof topAnglerSchema>;

export const topVenueSchema = z.object({
  key: z.string(),
  name: z.string(),
  locality: z.string().nullable(),
  lakeId: z.string().nullable(),
  imageUrl: z.string().nullable(),
  partide: z.number(),
  catches: z.number(),
  liveCount: z.number(),
});
export type TopVenue = z.infer<typeof topVenueSchema>;

export const statsRecordSchema = z.object({
  weightKg: z.number(),
  species: z.string().nullable(),
  venueName: z.string(),
  sessionDocumentId: z.string().nullable(),
  angler: communityMemberDTOSchema.nullable(),
  occurredAt: z.string(),
  photoUrl: z.string().nullable(),
  photoWidth: z.number().nullable(),
  photoHeight: z.number().nullable(),
});
export type StatsRecord = z.infer<typeof statsRecordSchema>;

export const speciesShareSchema = z.object({ name: z.string(), count: z.number(), pct: z.number() });
export type SpeciesShare = z.infer<typeof speciesShareSchema>;

/** One stand's ranking row. CMS `StandStat`. */
export const standStatSchema = z.object({
  standId: z.string(),
  name: z.string(),
  partide: z.number(),
  catches: z.number(),
  totalKg: z.number(),
  recordKg: z.number().nullable(),
});
export type StandStat = z.infer<typeof standStatSchema>;

export const communityStatsDTOSchema = z.object({
  period: statsPeriodSchema,
  totals: statsTotalsSchema,
  weeklySeries: z.array(seriesPointSchema),
  topAnglers: z.array(topAnglerSchema),
  topVenues: z.array(topVenueSchema),
  record: statsRecordSchema.nullable(),
  species: z.array(speciesShareSchema),
  /** Absent on edge-cached responses predating the venue-scoped rollout. */
  stands: z.array(standStatSchema).optional(),
});
export type CommunityStatsDTO = z.infer<typeof communityStatsDTOSchema>;

// ── anglers following (minimal local copy; the anglers domain owns the full shape) ──

export const followingPageSchema = paginatedSchema(z.object({ documentId: z.string() }));

// ── legacy catch (fish `models/catch.type.ts`) ──────────────────────────────

/** fish `Catch` — a legacy Strapi document. The `fishType` relation is kept loose. */
export const catchSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  publishedAt: z.string().nullish(),
  weight: z.number(),
  fishType: z.looseObject({ documentId: z.string().optional(), Name: z.string().optional() }).nullish(),
});
export type Catch = z.infer<typeof catchSchema>;

// ── /ai/format-text ─────────────────────────────────────────────────────────

export const formatTextResponseSchema = z.object({ data: z.object({ formatted: z.string() }) });
