import * as z from 'zod';
import { paginatedSchema, richTextSchema, strapiImageSchema } from '../shared';
import {
  competitionStatusSchema,
  competitionTypeSchema,
  rankingTypeSchema,
  type CompetitionType,
} from '../competitions/schemas';

/* ------------------------------------------------------------------ */
/* Enums (competition status/type/ranking type live in core/competitions) */
/* ------------------------------------------------------------------ */

export const weighingTypeSchema = z.enum(['normal', 'extra']);
export type WeighingType = z.infer<typeof weighingTypeSchema>;
export const weighingStatusSchema = z.enum(['started', 'finished']);
export type WeighingStatus = z.infer<typeof weighingStatusSchema>;

/* ------------------------------------------------------------------ */
/* Organizer — fish models/organizer.type.ts                          */
/* ------------------------------------------------------------------ */

/** fish `DraftMeta` — the wizard state the CMS keeps on a draft. */
export const draftMetaSchema = z.object({
  sectors: z.array(z.object({ name: z.string(), minFishNumber: z.number() })),
  standAllocations: z.record(z.string(), z.array(z.string())),
  sponsorIds: z.array(z.string()),
  fishSpeciesIds: z.array(z.string()),
  completedSteps: z.array(z.number()),
});
export type DraftMeta = z.infer<typeof draftMetaSchema>;

/** fish `OrganizerDashboardStats` */
export const organizerDashboardStatsSchema = z.object({
  totalOrganized: z.number(),
  pendingRegistrations: z.number(),
  activeCompetitions: z.number(),
  emptySpots: z.number(),
  fillRate: z.number(),
  draftsCount: z.number(),
  byStatus: z.record(z.string(), z.number()),
});
export type OrganizerDashboardStats = z.infer<typeof organizerDashboardStatsSchema>;

/** fish `OrganizerRecentLake` */
export const organizerRecentLakeSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  lastUsedAt: z.string(),
});
export type OrganizerRecentLake = z.infer<typeof organizerRecentLakeSchema>;

export const organizerStatKeySchema = z.enum(['pending', 'empty', 'fill', 'total']);
export type OrganizerStatKey = z.infer<typeof organizerStatKeySchema>;

const participantSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  username: z.string().nullish(),
  avatar: strapiImageSchema.nullish(),
});

const registrationSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  registrationStatus: z.union([z.enum(['rejected', 'pending', 'registered', 'cancelled']), z.string()]),
  teamName: z.string().nullish(),
  guestName: z.string().nullish(),
  participants: z.array(participantSchema).optional(),
  stand: z.object({ id: z.number(), documentId: z.string(), name: z.string().nullish() }).nullish(),
});

const standSchema = z.object({ id: z.number(), documentId: z.string(), name: z.string() });

/**
 * The raw competition document the `/competitions/organizer/*` routes return (fish
 * `DraftCompetition = Competition & { draftMeta }`). Legacy route → Strapi document with
 * whatever the controller selects/populates, so every non-core field is `nullish`:
 * `my-competitions` selects a subset, `draft/:id` returns every column (null when unset).
 */
export const organizerCompetitionSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  competitionStatus: competitionStatusSchema,
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  registrationDeadline: z.string().nullish(),
  // biginteger → Strapi serialises it as a string.
  registerFee: z.union([z.string(), z.number()]).nullish(),
  competitionType: competitionTypeSchema.nullish(),
  rankingType: rankingTypeSchema.nullish(),
  participantsLimit: z.number().nullish(),
  teamParticipants: z.number().nullish(),
  bestOfFishCount: z.number().nullish(),
  bestOfTierSizes: z.array(z.number()).nullish(),
  // Feeder on legs (manșe): 1–3; null for every other ranking type.
  roundsCount: z.number().nullish(),
  numberOfWinners: z.number().nullish(),
  minFishWeight: z.union([z.number(), z.string()]).nullish(),
  excludeBiggestCatch: z.boolean().nullish(),
  generalRankingWinnerMode: z.string().nullish(),
  gridRule: z.string().nullish(),
  description: richTextSchema.nullish(),
  reward: richTextSchema.nullish(),
  regulation: richTextSchema.nullish(),
  draftMeta: draftMetaSchema.nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // Relations (populated per route)
  lake: z
    .object({
      id: z.number().optional(),
      documentId: z.string(),
      name: z.string(),
      images: z.array(strapiImageSchema).nullish(),
    })
    .nullish(),
  banner: strapiImageSchema.nullish(),
  author: z.object({ id: z.number(), documentId: z.string().optional(), username: z.string().nullish() }).nullish(),
  registrations: z.array(registrationSchema).optional(),
  sectors: z
    .array(
      z.object({
        id: z.number(),
        documentId: z.string(),
        name: z.string(),
        minFishNumber: z.number().nullish(),
        stands: z.array(standSchema).optional(),
      })
    )
    .optional(),
  sponsors: z.array(z.object({ id: z.number(), documentId: z.string(), name: z.string().nullish() })).optional(),
  fishSpecies: z.array(z.object({ id: z.number(), documentId: z.string(), Name: z.string() })).optional(),
  followers: z.array(z.object({ id: z.number() })).optional(),
  /** Computed by `my-competitions`: followers + registered participants. */
  viewers: z.number().optional(),
});
export type DraftCompetition = z.infer<typeof organizerCompetitionSchema>;

/** fish `OrganizerPaginatedResponse<T>` — `{ data, meta.pagination }`. */
export const organizerCompetitionsResponseSchema = paginatedSchema(organizerCompetitionSchema);
export type OrganizerCompetitionsResponse = z.infer<typeof organizerCompetitionsResponseSchema>;

/** fish `OrganizerStatDetailItem` */
export const organizerStatDetailItemSchema = z.object({
  documentId: z.string(),
  competition: z.object({
    documentId: z.string(),
    name: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    participantsLimit: z.number().nullable(),
    participantsRegistered: z.number(),
    competitionStatus: competitionStatusSchema,
  }),
  pendingRegistrationsCount: z.number(),
  emptySpotsCount: z.number(),
  fillRate: z.number(),
});
export type OrganizerStatDetailItem = z.infer<typeof organizerStatDetailItemSchema>;
export const organizerStatDetailsResponseSchema = paginatedSchema(organizerStatDetailItemSchema);
export type OrganizerStatDetailsResponse = z.infer<typeof organizerStatDetailsResponseSchema>;

/** fish `api/organizer.ts#OrganizerCompetitionSourceDetail` (CMS `buildOrganizerSourceDetail`). */
export const organizerCompetitionSourceDetailSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  competitionStatus: z.string(),
  startDate: z.string().nullish(),
  description: richTextSchema.nullish(),
  regulation: richTextSchema.nullish(),
});
export type OrganizerCompetitionSourceDetail = z.infer<typeof organizerCompetitionSourceDetailSchema>;

export type OrganizerCompetitionSourceSummary = Pick<
  DraftCompetition,
  'documentId' | 'name' | 'competitionStatus' | 'startDate' | 'banner'
>;

/** fish `api/organizer.ts#CancelOrganizerCompetitionResponse` */
export const cancelOrganizerCompetitionResponseSchema = z.object({
  documentId: z.string(),
  notifiedUsers: z.number(),
  failedNotifications: z.number(),
});
export type CancelOrganizerCompetitionResponse = z.infer<typeof cancelOrganizerCompetitionResponseSchema>;

/** fish `CreateDraftPayload` — request body, not validated against the CMS. */
export type CreateDraftPayload = {
  name: string;
  description?: unknown;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  registerFee?: string;
  competitionType?: CompetitionType;
  teamParticipants?: number;
  participantsLimit?: number;
  rankingType?: string;
  bestOfFishCount?: number;
  numberOfWinners?: number;
  minFishWeight?: string;
  excludeBiggestCatch?: boolean;
  generalRankingWinnerMode?: string;
  gridRule?: string;
  reward?: unknown;
  regulation?: unknown;
  lake?: string;
  draftMeta?: DraftMeta;
};
export type UpdateDraftPayload = Partial<CreateDraftPayload>;

/* ------------------------------------------------------------------ */
/* Edit risk — fish models/competition-edit-risk.type.ts              */
/* ------------------------------------------------------------------ */

export const organizerEditRiskCodeSchema = z.enum([
  'LAKE_CHANGED_WITH_ALLOCATIONS',
  'PARTICIPANTS_LIMIT_BELOW_REGISTERED',
  'PARTICIPANTS_LIMIT_BELOW_ALLOCATED',
  'STAND_ALLOCATIONS_INVALID_FOR_NEW_LAKE',
  'SECTORS_CHANGED_WITH_ALLOCATIONS',
]);
export type OrganizerEditRiskCode = z.infer<typeof organizerEditRiskCodeSchema>;

export const organizerEditRiskItemSchema = z.object({
  riskCode: z.union([organizerEditRiskCodeSchema, z.string()]),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type OrganizerEditRiskItem = z.infer<typeof organizerEditRiskItemSchema>;

export const organizerEditRiskImpactSchema = z.object({
  registeredCount: z.number(),
  pendingCount: z.number(),
  allocatedRegistrationsCount: z.number(),
  allocatedStandsCount: z.number(),
});
export type OrganizerEditRiskImpact = z.infer<typeof organizerEditRiskImpactSchema>;

export type OrganizerEditRiskDetails = { risks: OrganizerEditRiskItem[]; impact: OrganizerEditRiskImpact };

export const organizerUpdateCompetitionMetaSchema = z.object({
  allocationsReset: z.boolean(),
  affectedAllocationsCount: z.number(),
  risks: z.array(organizerEditRiskItemSchema),
  impact: organizerEditRiskImpactSchema,
});
export type OrganizerUpdateCompetitionMeta = z.infer<typeof organizerUpdateCompetitionMetaSchema>;

/** fish `OrganizerUpdateCompetitionResponse<Competition>` */
export const organizerUpdateCompetitionResponseSchema = z.object({
  data: organizerCompetitionSchema,
  meta: organizerUpdateCompetitionMetaSchema.optional(),
});
export type OrganizerUpdateCompetitionResponse = z.infer<typeof organizerUpdateCompetitionResponseSchema>;

/* ------------------------------------------------------------------ */
/* Competition management — fish services/api/competitions.ts         */
/* ------------------------------------------------------------------ */

/** fish `AllocateStandsToSectorsRequest` — sector name → stand documentIds. */
export type AllocateStandsToSectorsRequest = { allocations: Record<string, string[]> };
/** fish `AllocateStandToRegistrationRequest` — key is the registration id, value is the stand id. */
export type AllocateStandToRegistrationRequest = { allocations: Record<string, string> };

/** fish `CompetitionActiveWeighing` */
export const competitionActiveWeighingSchema = z.object({
  weighingDocumentId: z.string(),
  weighingType: weighingTypeSchema,
  stand: z.object({
    id: z.number(),
    documentId: z.string(),
    name: z.string(),
    sectors: z.array(z.object({ id: z.number(), documentId: z.string(), name: z.string() })),
    sectorDrawPosition: z.number().nullish(),
  }),
  competition: z.object({ rankingType: z.string().nullish() }).optional(),
});
export type CompetitionActiveWeighing = z.infer<typeof competitionActiveWeighingSchema>;

/** fish `AllocatedParticipantsResponse` — keyed by stand documentId; null = free stand. */
export const allocatedParticipantSchema = z.object({
  participants: z.array(z.object({ id: z.number(), documentId: z.string(), name: z.string() })),
  registrationId: z.string(),
  teamName: z.string(),
  guestName: z.string(),
  /** Registration's club — shown in the scale UI on nationalChampionship (may be absent on older CMS). */
  clubName: z.string().optional(),
  sectorName: z.string(),
  sectorDrawPosition: z.number().nullable(),
});
export const allocatedParticipantsResponseSchema = z.record(z.string(), allocatedParticipantSchema.nullable());
export type AllocatedParticipantsResponse = z.infer<typeof allocatedParticipantsResponseSchema>;

/** Response of the extra-scale request/cancel writes (fish ignores the body). */
export const extraScaleWriteResponseSchema = z.object({
  data: z.object({ message: z.string() }).optional(),
  documentId: z.string().optional(),
  extraStatus: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Weighings — fish models/weighing.type.ts (+ CMS feed DTOs)          */
/* ------------------------------------------------------------------ */

/** fish `api/weighing.ts#WeighingsSummaryItem` */
export const weighingsSummaryItemSchema = z.object({
  standId: z.string(),
  totalKg: z.number(),
  regularCount: z.number(),
  extraCount: z.number(),
});
export type WeighingsSummaryItem = z.infer<typeof weighingsSummaryItemSchema>;

/** `GET /feed/weighings/by-stand` item (CMS `toWeighingByStandDTO`). */
export const weighingByStandSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  weighingType: weighingTypeSchema,
  weighingStatus: weighingStatusSchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  catches: z.array(z.object({ weight: z.number() })),
});
export type WeighingByStand = z.infer<typeof weighingByStandSchema>;

const signatureSchema = z.object({ url: z.string() }).nullable();

export const weighingDetailCatchSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  weight: z.number(),
  fishType: z.object({ Name: z.string() }).nullable(),
  media: z.array(z.object({ url: z.string() })),
});
export type WeighingDetailCatch = z.infer<typeof weighingDetailCatchSchema>;

/** `GET /feed/weighings/:id` (CMS `toWeighingDetailDTO`) — fish `Weighing`. */
export const weighingDetailSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  weighingType: weighingTypeSchema,
  weighingStatus: weighingStatusSchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  numberOfRevisions: z.number(),
  catches: z.array(weighingDetailCatchSchema),
  refereeSignature: signatureSchema,
  witnessSignature: signatureSchema,
  competition: z.object({ rankingType: z.string().nullable() }),
  stand: z.object({
    id: z.number().optional(),
    documentId: z.string().optional(),
    sectorDrawPosition: z.number().nullable(),
  }),
});
export type WeighingDetail = z.infer<typeof weighingDetailSchema>;

const revisionCatchSchema = z.object({ type: z.string(), weight: z.number(), catchId: z.string() });

/** fish `WeighingRevision` — a `weighing-log` row. `state` differs per action. */
export const weighingRevisionSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sessionId: z.number(),
  action: z.enum(['closed', 'reopen']),
  author: z.object({ id: z.number(), documentId: z.string(), username: z.string() }).nullable(),
  state: z.object({
    reason: z.string().optional(),
    // `closed` logs carry the diff…
    added: z.array(revisionCatchSchema).optional(),
    removed: z.array(revisionCatchSchema).optional(),
    unmodified: z.array(revisionCatchSchema).optional(),
    // …`reopen` logs the catches present when it was reopened.
    catches: z.array(revisionCatchSchema).optional(),
  }),
  weighing: z.object({ id: z.number(), documentId: z.string() }).nullable(),
});
export type WeighingRevision = z.infer<typeof weighingRevisionSchema>;
export const weighingRevisionsResponseSchema = paginatedSchema(weighingRevisionSchema);
export type WeighingRevisionsResponse = z.infer<typeof weighingRevisionsResponseSchema>;

/** fish `api/weighing.ts#CatchData` */
export type CatchData = { weight: number; fishType: string }[];

/** `POST /weighings/start` → the created weighing document. */
export const startedWeighingSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  weighingStatus: weighingStatusSchema,
  weighingType: weighingTypeSchema,
  startDate: z.string().nullish(),
});
export type StartedWeighing = z.infer<typeof startedWeighingSchema>;

/** `POST /weighings/:id/catch` → the created catch documents. */
export const createdCatchesSchema = z.array(z.object({ id: z.number(), documentId: z.string(), weight: z.number() }));

export const messageResponseSchema = z.object({ message: z.string() });

export const deleteCantarResponseSchema = z.object({
  data: z.object({ documentId: z.string(), deletedCatches: z.number() }),
});

export const deleteCatchResponseSchema = z.object({
  data: z.object({ statusCode: z.number(), message: z.string() }),
});

/* ------------------------------------------------------------------ */
/* Media upload — fish services/api/media.ts                          */
/* ------------------------------------------------------------------ */
