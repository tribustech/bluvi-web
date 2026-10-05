import { z } from 'zod';
import { paginatedSchema, paginationMetaSchema, richTextSchema, strapiImageSchema } from '../shared';
import { fishSpeciesSchema } from '../lakes/schemas';

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

/** fish `models/competition.type.ts#CompetitionStatus` — drives logic, stays strict. */
export const competitionStatusSchema = z.enum(['draft', 'notStarted', 'started', 'completed', 'cancelled']);
export type CompetitionStatus = z.infer<typeof competitionStatusSchema>;

/** fish `CompetitionType` enum (`single` | `team`). */
export const competitionTypeSchema = z.enum(['single', 'team']);
export type CompetitionType = z.infer<typeof competitionTypeSchema>;

/** fish `models/ranking.type.ts#RankingType`. Drives the table builders, so it stays strict. */
export const RankingType = {
  QUANTITY: 'quantity',
  QUALITY: 'quality',
  QUANTITY_QUALITY: 'quantityQuality',
  QUALITY_QUALITY: 'qualityQuantity',
  BEST_OF: 'bestOf',
  NATIONAL_CHAMPIONSHIP: 'nationalChampionship',
  FIPSED: 'fipsed',
  CALITATE_CALITATE: 'calitateCalitate',
  CALITATE_CANTITATE_CMMC: 'calitateCantitateCMMC',
  BEST_OF_TIERS: 'bestOfTiers',
  FEEDER_ROUNDS: 'feederRounds',
} as const;
export const rankingTypeSchema = z.enum([
  'quantity',
  'quality',
  'quantityQuality',
  'qualityQuantity',
  'bestOf',
  'nationalChampionship',
  'fipsed',
  'calitateCalitate',
  'calitateCantitateCMMC',
  'bestOfTiers',
  // fish models/ranking.type.ts FEEDER_ROUNDS. Feeder legs have their own ranking (not built on web
  // yet); without this value one feeder competition failed validation of every competition list.
  'feederRounds',
]);
export type RankingType = z.infer<typeof rankingTypeSchema>;

/** Registration status. Shown as text and extended over time by the CMS → tolerant. */
export const registrationStatusSchema = z.union([z.enum(['rejected', 'pending', 'registered', 'cancelled']), z.string()]);
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;

/* ------------------------------------------------------------------ */
/* Small shared shapes                                                */
/* ------------------------------------------------------------------ */

const idDoc = { id: z.number(), documentId: z.string() };
const avatarUrlSchema = z.object({ url: z.string() }).nullable();

/** `{ lat, long }` as strings — what the CMS stores (fish types it as `Coordinates`). */
export const latLongSchema = z.object({ lat: z.string().nullish(), long: z.string().nullish() });

/* ------------------------------------------------------------------ */
/* /feed/competitions (list card) — fish CompetitionListItemDTO        */
/* ------------------------------------------------------------------ */

const feedCardMediaSchema = z.object({
  url: z.string(),
  smallUrl: z.string().nullable(),
  blurhash: z.string().nullish(),
});

export const competitionListItemSchema = z.object({
  ...idDoc,
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  competitionStatus: competitionStatusSchema,
  competitionType: competitionTypeSchema,
  rankingType: rankingTypeSchema,
  bestOfFishCount: z.number().nullish(),
  bestOfTierSizes: z.array(z.number()).nullish(),
  // DTO types it `string`, but the column is nullable and most local rows are null.
  registerFee: z.string().nullable(),
  participantsLimit: z.number().nullable(),
  teamParticipants: z.number().nullable(),
  registrationDeadline: z.string().nullable(),
  banner: feedCardMediaSchema.nullable(),
  lake: z
    .object({
      ...idDoc,
      name: z.string(),
      coordinates: latLongSchema.nullable(),
      images: z.array(feedCardMediaSchema),
    })
    .nullable(),
  viewers: z.number(),
  registrations: z.array(
    z.object({
      registrationStatus: registrationStatusSchema,
      participants: z.array(z.object({ ...idDoc, username: z.string(), avatar: avatarUrlSchema })),
    })
  ),
});
export type CompetitionListItem = z.infer<typeof competitionListItemSchema>;
export const competitionListResponseSchema = paginatedSchema(competitionListItemSchema);
export type CompetitionListResponse = z.infer<typeof competitionListResponseSchema>;

/* ------------------------------------------------------------------ */
/* /feed/competitions/:id — fish CompetitionDetailDTO                  */
/* ------------------------------------------------------------------ */

const standRefSchema = z.object({ ...idDoc, name: z.string() });

export const sectorSchema = z.object({
  ...idDoc,
  name: z.string(),
  minFishNumber: z.number().nullable(),
  stands: z.array(standRefSchema),
});
export type Sector = z.infer<typeof sectorSchema>;

export const competitionSponsorSchema = z.object({
  ...idDoc,
  name: z.string(),
  url: z.string().nullable(),
  description: richTextSchema.nullable(),
  image: avatarUrlSchema,
});
export type CompetitionSponsor = z.infer<typeof competitionSponsorSchema>;

export const detailRegistrationSchema = z.object({
  ...idDoc,
  registrationStatus: registrationStatusSchema,
  teamName: z.string().nullable(),
  guestName: z.string().nullable(),
  stand: standRefSchema.nullable(),
  club: z.object({ name: z.string() }).nullable(),
  author: z.object({ ...idDoc, username: z.string() }).nullable(),
  participants: z.array(z.object({ ...idDoc, username: z.string(), avatar: avatarUrlSchema })),
});
export type DetailRegistration = z.infer<typeof detailRegistrationSchema>;

const bannerFormatUrl = z.object({ url: z.string() }).nullable();

export const competitionDetailSchema = z.object({
  ...idDoc,
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  competitionStatus: competitionStatusSchema,
  competitionType: competitionTypeSchema,
  rankingType: rankingTypeSchema,
  bestOfFishCount: z.number().nullable(),
  minFishWeight: z.number().nullable(),
  excludeBiggestCatch: z.boolean().nullable(),
  generalRankingWinnerMode: z.string().nullable(),
  gridRule: z.string().nullable(),
  bestOfTierSizes: z.array(z.number()).nullable(),
  numberOfWinners: z.number().nullable(),
  registerFee: z.string().nullable(),
  participantsLimit: z.number().nullable(),
  teamParticipants: z.number().nullable(),
  registrationDeadline: z.string().nullable(),
  description: richTextSchema.nullable(),
  reward: richTextSchema.nullable(),
  regulation: richTextSchema.nullable(),
  banner: z
    .object({
      id: z.number().nullable(),
      url: z.string(),
      blurhash: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      formats: z.object({ large: bannerFormatUrl, medium: bannerFormatUrl, small: bannerFormatUrl }),
    })
    .nullable(),
  lake: z
    .object({
      ...idDoc,
      name: z.string(),
      contact: z.array(
        z.object({ id: z.number(), header: z.string().nullish(), name: z.string().nullish(), phone: z.string().nullish() })
      ),
      stands: z.array(standRefSchema),
    })
    .nullable(),
  author: z.object({ ...idDoc, username: z.string(), phone: z.string().nullable() }).nullable(),
  referees: z.array(z.object({ ...idDoc, username: z.string(), phone: z.string().nullable() })),
  sponsors: z.array(competitionSponsorSchema),
  fishType: z.array(fishSpeciesSchema),
  sectors: z.array(sectorSchema),
  followers: z.array(z.string()),
  registrations: z.array(detailRegistrationSchema),
  viewers: z.number(),
});
export type CompetitionDetail = z.infer<typeof competitionDetailSchema>;

export const competitionUserRegistrationStatusSchema = z
  .enum(['pending', 'registered', 'rejected', 'cancelled'])
  .nullable();

/** Per-user overlay from `/feed/competitions/:id/my-status`. */
export const competitionMyStatusSchema = z.object({
  isFollowing: z.boolean(),
  userRegistrationStatus: competitionUserRegistrationStatusSchema,
});
export type CompetitionMyStatus = z.infer<typeof competitionMyStatusSchema>;

/** fish `useCompetition` merges the detail and the overlay under one key. */
export type CompetitionWithMyStatus = CompetitionDetail & CompetitionMyStatus;

/* ------------------------------------------------------------------ */
/* Legacy /competitions (raw Strapi docs) — fish `Competition`        */
/* ------------------------------------------------------------------ */

const legacyUserSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  username: z.string().nullish(),
  avatar: strapiImageSchema.nullish(),
});

/** fish `Registration` (legacy `/competitions/:id/registrations`). */
export const registrationSchema = z.object({
  ...idDoc,
  registrationStatus: registrationStatusSchema,
  teamName: z.string().nullable(),
  guestName: z.string().nullish(),
  sectorDrawPosition: z.number().nullish(),
  finalPlacement: z.number().nullish(),
  participants: z.array(legacyUserSchema).optional(),
  stand: standRefSchema.nullish(),
  author: z.object({ id: z.number(), documentId: z.string(), username: z.string().nullish(), phone: z.string().nullish() }).nullish(),
  club: z.object({ name: z.string() }).nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Registration = z.infer<typeof registrationSchema>;

/**
 * fish `Competition`, as the legacy `/competitions?populate[lake]` and `/competitions/me` return it.
 * Only what those two populates can contain; everything is nullish because the legacy rows are raw.
 */
export const legacyCompetitionSchema = z.object({
  ...idDoc,
  name: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  competitionType: competitionTypeSchema,
  competitionStatus: competitionStatusSchema,
  rankingType: rankingTypeSchema,
  registerFee: z.string().nullish(),
  participantsLimit: z.number().nullish(),
  teamParticipants: z.number().nullish(),
  registrationDeadline: z.string().nullish(),
  bestOfFishCount: z.number().nullish(),
  bestOfTierSizes: z.array(z.number()).nullish(),
  lake: z
    .object({
      ...idDoc,
      name: z.string(),
      coordinates: latLongSchema.nullish(),
      images: z.array(strapiImageSchema).nullish(),
    })
    .nullish(),
  banner: strapiImageSchema.nullish(),
  registrations: z.array(registrationSchema).optional(),
  followers: z.array(z.object({ id: z.number() })).optional(),
  viewers: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type LegacyCompetition = z.infer<typeof legacyCompetitionSchema>;
export const myCompetitionsResponseSchema = paginatedSchema(legacyCompetitionSchema);
export type MyCompetitionsResponse = z.infer<typeof myCompetitionsResponseSchema>;

/* ------------------------------------------------------------------ */
/* /competitions/live — fish `LiveCompetition` (queries/useLiveCompetition) */
/* ------------------------------------------------------------------ */

/** fish `queries/useLiveCompetition.ts#ExtraScale` — also the organizer's extra-scales list item. */
export const extraScaleSchema = z.object({
  ...idDoc,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // Null when the requesting account is gone.
  author: z.object({ ...idDoc, username: z.string() }).nullable(),
  // CMS enumeration is new | cancelled | done (fish types only new | cancelled).
  extraStatus: z.union([z.enum(['new', 'cancelled', 'done']), z.string()]),
  stand: z.object({
    ...idDoc,
    name: z.string(),
    sectors: z.array(z.object({ ...idDoc, name: z.string() })),
    sectorDrawPosition: z.number().nullish(),
  }),
});
export type ExtraScale = z.infer<typeof extraScaleSchema>;

export const liveCompetitionSchema = z.object({
  competition: z.object({ documentId: z.string(), name: z.string(), rankingType: z.string().nullish() }),
  'extra-scales': z.array(extraScaleSchema),
});
export type LiveCompetition = z.infer<typeof liveCompetitionSchema>;

/* ------------------------------------------------------------------ */
/* Competition cards — fish models/competition-card.type.ts          */
/* ------------------------------------------------------------------ */

export const cardMediaSchema = z.object({
  url: z.string(),
  smallUrl: z.string().nullable(),
  mediumUrl: z.string().nullable(),
  blurhash: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});
export type CardMedia = z.infer<typeof cardMediaSchema>;

export const competitionCardStatusSchema = z.enum(['notStarted', 'started', 'completed']);
export type CompetitionCardStatus = z.infer<typeof competitionCardStatusSchema>;
export const COMPETITION_CARD_STATUSES: CompetitionCardStatus[] = ['notStarted', 'started', 'completed'];

export const cardPodiumRowSchema = z.object({
  position: z.number(),
  tied: z.boolean(),
  displayName: z.string(),
  standName: z.string().nullable(),
  clubName: z.string().nullable(),
  avatarUrls: z.array(z.string()),
});
export type CardPodiumRow = z.infer<typeof cardPodiumRowSchema>;

export const cardFormatSchema = z.object({
  kind: z.enum(['single', 'team']),
  teamSize: z.number().nullable(),
  unit: z.enum(['pescari', 'echipe']),
});
export type CardFormat = z.infer<typeof cardFormatSchema>;

export const competitionCardSchema = z.object({
  ...idDoc,
  name: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  /** Rendered on the server, in Bucharest. Never format this in the app. */
  dateLabel: z.string(),
  /**
   * `08:00–16:00` for a one-day competition, null otherwise (Bucharest, rendered on the server).
   * Optional as in fish (models/competition-card.type.ts): a CMS older than the field omits it.
   */
  hoursLabel: z.string().nullish(),
  status: competitionCardStatusSchema,
  format: cardFormatSchema,
  rankingType: z.string(),
  rankingLabel: z.string(),
  banner: cardMediaSchema.nullable(),
  lake: z
    .object({
      documentId: z.string(),
      name: z.string(),
      county: z.object({ documentId: z.string(), name: z.string() }).nullable(),
      image: cardMediaSchema.nullable(),
    })
    .nullable(),
  organizer: z.object({ documentId: z.string(), username: z.string(), avatarUrl: z.string().nullable() }).nullable(),
  joinedCount: z.number(),
  pendingCount: z.number(),
  /** null when the organiser never set a limit — never render "Complet". */
  capacity: z.number().nullable(),
  placesLeft: z.number().nullable(),
  viewers: z.number(),
  participantFaces: z.array(z.string()),
  results: z
    .object({
      capturedAt: z.string(),
      hasCatches: z.boolean(),
      catchCount: z.number(),
      totalKg: z.number().nullable(),
      biggestFishKg: z.number().nullable(),
      podium: z.array(cardPodiumRowSchema),
    })
    .nullable(),
});
export type CompetitionCard = z.infer<typeof competitionCardSchema>;

export const competitionCardCountsSchema = z.object({
  notStarted: z.number(),
  started: z.number(),
  completed: z.number(),
});
export type CompetitionCardCounts = z.infer<typeof competitionCardCountsSchema>;

export const competitionCardsPageSchema = z.object({
  data: z.array(competitionCardSchema),
  meta: z.object({ pagination: paginationMetaSchema, counts: competitionCardCountsSchema }),
});
export type CompetitionCardsPage = z.infer<typeof competitionCardsPageSchema>;

export const competitionSuggestionSchema = z.object({
  id: z.string(),
  type: z.enum(['lake', 'organizer', 'competition']),
  value: z.string(),
  title: z.string(),
  subtitle: z.string(),
});
export type CompetitionSuggestion = z.infer<typeof competitionSuggestionSchema>;
export const competitionSuggestionGroupSchema = z.object({
  title: z.string(),
  items: z.array(competitionSuggestionSchema),
});
export type CompetitionSuggestionGroup = z.infer<typeof competitionSuggestionGroupSchema>;

/* ------------------------------------------------------------------ */
/* /feed/pulse-person — fish services/api/pulsePerson.ts              */
/* ------------------------------------------------------------------ */

export const pulseCriterionSchema = z.union([
  z.enum([
    'winner',
    'mostPodiums',
    'mostPopular',
    'mostCompetitions',
    'biggestCatchYear',
    'biggestCatchMonth',
    'biggestCatchWeek',
    'mostActive',
    'debutant',
    'podiumStreak',
  ]),
  z.string(),
]);
export type PulseCriterion = z.infer<typeof pulseCriterionSchema>;

export const pulseDestinationSchema = z.object({
  type: z.enum(['competition', 'angler']),
  documentId: z.string(),
});
export type PulseDestination = z.infer<typeof pulseDestinationSchema>;

export const pulsePersonSchema = z.object({
  criterion: pulseCriterionSchema,
  kicker: z.string(),
  displayName: z.string(),
  line: z.string(),
  meta: z.string(),
  avatarUrls: z.array(z.string()),
  destination: pulseDestinationSchema,
  rank: z.number().optional(),
});
export type PulsePerson = z.infer<typeof pulsePersonSchema>;

/* ------------------------------------------------------------------ */
/* Rankings — fish models/ranking.type.ts                             */
/* ------------------------------------------------------------------ */

/** fish `models/penalty.type.ts#PenaltyAction` — what the organizer can write. */
export const penaltyActionSchema = z.enum(['WARNING', 'DEDUCT_TOTAL_WEIGHT', 'ELIMINATE']);
export type PenaltyAction = z.infer<typeof penaltyActionSchema>;

export const penaltySchema = z.object({
  documentId: z.string(),
  // Read side stays open: a newer CMS action must not break the whole ranking.
  action: z.union([penaltyActionSchema, z.string()]),
  value: z.number().nullable(),
  reason: z.string(),
  createdAt: z.string(),
  author: z.object({ id: z.number(), username: z.string().optional() }).optional(),
});
export type Penalty = z.infer<typeof penaltySchema>;

/**
 * The CMS sends `standId` as a number while fish types it `string`. Kept as sent: the table
 * builders compare it both with and without `String()` and their behaviour must not change.
 */
const standIdSchema = z.union([z.number(), z.string()]);

const baseStandRankingShape = {
  sectorId: z.string(),
  sectorName: z.string(),
  standId: standIdSchema,
  standName: z.string(),
  // All three are absent on a stand row with no registration behind it.
  teamName: z.string().nullish(),
  guestName: z.string().nullish(),
  // Not always an object: bestOfTiers sends `[]` for a guest row and bestOf sends `["Stand 2"]`
  // for an unregistered stand. fish reads `participant.username` off either, gets undefined and
  // falls through to guestName / '-', so an array is read as "no participant" — same rendering.
  participant: z.preprocess(
    v => (Array.isArray(v) ? null : v),
    z.object({ id: z.number().optional(), documentId: z.string().optional(), username: z.string() }).nullish()
  ),
  registrationId: z.string().nullish(),
  biggestFish: z.number(),
  catchCount: z.number(),
  sectorPosition: z.number(),
  generalPosition: z.number(),
  // Absent on several ranking types; fish reads it with `?? []`.
  penalties: z.array(penaltySchema).optional(),
  isEliminated: z.boolean().optional(),
};
export const baseStandRankingSchema = z.object(baseStandRankingShape);
export type BaseStandRanking = z.infer<typeof baseStandRankingSchema>;

export const quantityStandRankingSchema = z.object({
  ...baseStandRankingShape,
  quantity: z.number(),
  quantityPoints: z.number(),
});
export type QuantityStandRanking = z.infer<typeof quantityStandRankingSchema>;

export const qualityStandRankingSchema = z.object({
  ...baseStandRankingShape,
  sectorMinNumberOfFish: z.number(),
  quality: z.number(),
  qualityPoints: z.number(),
  catches: z.array(z.number()),
  hasGrid: z.boolean().optional(),
});
export type QualityStandRanking = z.infer<typeof qualityStandRankingSchema>;

export const qualityQuantityStandRankingSchema = z.object({
  ...baseStandRankingShape,
  sectorMinNumberOfFish: z.number(),
  quality: z.number(),
  quantity: z.number(),
  qualityPoints: z.number(),
  quantityPoints: z.number(),
  catches: z.array(z.number()),
  hasGrid: z.boolean().optional(),
});
export type QualityQuantityStandRanking = z.infer<typeof qualityQuantityStandRankingSchema>;

export const bestOfStandRankingSchema = z.object({
  ...baseStandRankingShape,
  bestOfCount: z.number(),
  topNCatchesAvarage: z.number(),
  catches: z.array(z.object({ weight: z.number(), isSplit: z.boolean().optional() })),
});
export type BestOfStandRanking = z.infer<typeof bestOfStandRankingSchema>;

export const bestOfTiersStandRankingSchema = z.object({
  ...baseStandRankingShape,
  catches: z.array(z.object({ weight: z.number() })),
  totalQuantity: z.number(),
  // JSON object keys are strings; fish indexes it with the numeric tier size.
  topNByTier: z.record(z.string(), z.number().nullable()),
  tierWonAt: z.number().nullable(),
});
export type BestOfTiersStandRanking = z.infer<typeof bestOfTiersStandRankingSchema>;

export const calitateCalitateStandRankingSchema = z.object({
  ...baseStandRankingShape,
  sectorMinNumberOfFish: z.number(),
  quality1: z.number(),
  quality1Points: z.number(),
  quality2: z.number(),
  quality2Points: z.number(),
  totalPoints: z.number(),
  catches: z.array(z.number()),
  hasGrid: z.boolean(),
});
export type CalitateCalitateStandRanking = z.infer<typeof calitateCalitateStandRankingSchema>;

export const qualityQuantityCMMCStandRankingSchema = z.object({
  ...baseStandRankingShape,
  sectorMinNumberOfFish: z.number(),
  quality1: z.number(),
  calitatePoints: z.number(),
  cmmcPoints: z.number(),
  quantity: z.number(),
  cantitatePoints: z.number(),
  totalPoints: z.number(),
  catches: z.array(z.number()),
});
export type QualityQuantityCMMCStandRanking = z.infer<typeof qualityQuantityCMMCStandRankingSchema>;

/** nationalChampionship / fipsed — one row per club, teams nested. */
export const nationalChampionshipStandRankingSchema = z.object({
  clubId: z.string(),
  clubName: z.string(),
  clubPoints: z.number(),
  clubPosition: z.number().optional(),
  clubAverageWeight: z.number(),
  clubTotalQuantity: z.number(),
  clubTotalCatchCount: z.number(),
  clubBiggestCatch: z.number(),
  clubHeaviestPairWeight: z.number().optional(),
  clubTeamQuantitiesSorted: z.array(z.number()).optional(),
  teams: z.array(
    z.object({
      ...baseStandRankingShape,
      participant: baseStandRankingShape.participant.optional(),
      participants: z.array(z.object({ username: z.string() }).loose()).nullable(),
      quantity: z.number(),
      // The CMS sends `averageWeight`; fish types a misspelt `avarageWeight` that never arrives.
      averageWeight: z.number().optional(),
      avarageWeight: z.number().optional(),
      sectorPoints: z.number(),
      sectorDrawPosition: z.number().nullish(),
    })
  ),
});
export type NationalChampionshipStandRanking = z.infer<typeof nationalChampionshipStandRankingSchema>;

const biggestCatchSchema = z
  .object({
    participants: z.array(z.object({ ...idDoc, username: z.string() })),
    sectorName: z.string(),
    sectorDrawPosition: z.number().nullish(),
    standId: standIdSchema,
    standName: z.string(),
    teamName: z.string().nullish(),
    guestName: z.string().nullish(),
    weight: z.number(),
    totalFishCount: z.number().optional(),
  })
  // Null before the first weighing (fish types it non-null).
  .nullable();

const baseMetadataShape = {
  totalQuantity: z.number(),
  totalCatchesCount: z.number(),
  biggestFish: z.number(),
  numberOfSectors: z.number(),
  biggestCatch: biggestCatchSchema,
};

export const rankingMetadataSchema = z.discriminatedUnion('rankingType', [
  z.object({
    ...baseMetadataShape,
    rankingType: z.literal('bestOf'),
    bestOfFishCount: z.number(),
    numberOfWinners: z.number(),
    maxBestOfFishCount: z.number(),
    bestOfPerSector: z.number().optional(),
  }),
  z.object({ ...baseMetadataShape, rankingType: z.enum(['quantity', 'quality', 'quantityQuality', 'qualityQuantity']) }),
  z.object({ ...baseMetadataShape, rankingType: z.literal('nationalChampionship') }),
  z.object({ ...baseMetadataShape, rankingType: z.literal('fipsed') }),
  z.object({ ...baseMetadataShape, rankingType: z.literal('calitateCalitate') }),
  z.object({ ...baseMetadataShape, rankingType: z.literal('calitateCantitateCMMC') }),
  z.object({
    ...baseMetadataShape,
    rankingType: z.literal('bestOfTiers'),
    bestOfTierSizes: z.array(z.number()),
    tierWinners: z.array(z.object({ standId: standIdSchema, position: z.number() }).nullable()),
  }),
]);
export type RankingMetadata = z.infer<typeof rankingMetadataSchema>;

/**
 * fish `RankingResponse`. The row shape depends on `metadata.rankingType`, so the response is a
 * union keyed on it: a row missing a field its ranking type needs fails loudly instead of printing NaN.
 */
function rankingResponse<R extends z.ZodType, T extends readonly [string, ...string[]]>(row: R, types: T) {
  return z.object({
    rankings: z.array(row),
    metadata: rankingMetadataSchema.and(z.object({ rankingType: z.enum(types) })),
  });
}
export const rankingResponseSchema = z.union([
  rankingResponse(quantityStandRankingSchema, ['quantity']),
  rankingResponse(qualityStandRankingSchema, ['quality']),
  rankingResponse(qualityQuantityStandRankingSchema, ['quantityQuality', 'qualityQuantity']),
  rankingResponse(bestOfStandRankingSchema, ['bestOf']),
  rankingResponse(bestOfTiersStandRankingSchema, ['bestOfTiers']),
  rankingResponse(calitateCalitateStandRankingSchema, ['calitateCalitate']),
  rankingResponse(qualityQuantityCMMCStandRankingSchema, ['calitateCantitateCMMC']),
  rankingResponse(nationalChampionshipStandRankingSchema, ['nationalChampionship', 'fipsed']),
]);
export type RankingResponse = z.infer<typeof rankingResponseSchema>;

export const bestNStandRankingSchema = z.object({
  sectorId: z.string(),
  sectorName: z.string(),
  standId: standIdSchema,
  standName: z.string(),
  participant: z.object({ username: z.string() }).nullable(),
  teamName: z.string().nullable(),
  guestName: z.string().nullable(),
  registrationId: z.string().nullable(),
  averageBestN: z.number(),
  biggestFish: z.number(),
  catchCount: z.number(),
  catchesUsed: z.array(z.number()),
  position: z.number(),
});
export type BestNStandRanking = z.infer<typeof bestNStandRankingSchema>;

export const bestNRankingResponseSchema = z.object({
  best3: z.array(bestNStandRankingSchema),
  best5: z.array(bestNStandRankingSchema),
  best7: z.array(bestNStandRankingSchema),
});
export type BestNRankingResponse = z.infer<typeof bestNRankingResponseSchema>;

export const competitionCatchesSortSchema = z.enum(['weight_asc', 'weight_desc', 'stand', 'sector']);
export type CompetitionCatchesSort = z.infer<typeof competitionCatchesSortSchema>;

export const competitionCatchSchema = z.object({
  id: z.union([z.string(), z.number()]),
  weight: z.number(),
  standId: standIdSchema.nullable(),
  standName: z.string(),
  sectorId: z.string().nullable(),
  sectorName: z.string().nullable(),
  teamName: z.string().nullable(),
  guestName: z.string().nullable(),
  participantUsername: z.string().nullable(),
  fishName: z.string().nullable(),
});
export type CompetitionCatch = z.infer<typeof competitionCatchSchema>;

export const competitionCatchesResponseSchema = z.object({
  data: z.array(competitionCatchSchema),
  pagination: paginationMetaSchema,
});
export type CompetitionCatchesResponse = z.infer<typeof competitionCatchesResponseSchema>;

export const weighingStatisticsItemSchema = z.object({
  weighingDocumentId: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  weighingType: z.union([z.enum(['normal', 'extra']), z.string()]),
  sequenceIndex: z.number(),
  totalWeightKg: z.number(),
  catchCount: z.number(),
  sectorName: z.string().optional(),
  standName: z.string().optional(),
});
export type WeighingStatisticsItem = z.infer<typeof weighingStatisticsItemSchema>;
export const weighingStatisticsResponseSchema = z.object({ data: z.array(weighingStatisticsItemSchema) });
export type WeighingStatisticsResponse = z.infer<typeof weighingStatisticsResponseSchema>;

const thresholdCounts = {
  count10Plus: z.number(),
  count15Plus: z.number(),
  count20Plus: z.number(),
  count25Plus: z.number(),
  count30Plus: z.number(),
};
export const catchThresholdCountsResponseSchema = z.object({
  bySector: z.array(z.object({ sectorName: z.string(), ...thresholdCounts })),
  general: z.object(thresholdCounts),
});
export type CatchThresholdCountsResponse = z.infer<typeof catchThresholdCountsResponseSchema>;

/* ------------------------------------------------------------------ */
/* Timeline snapshot — fish models/timeline-snapshot.type.ts          */
/* ------------------------------------------------------------------ */

export const timelineMetricKeySchema = z.enum([
  'quantity',
  'catchCount',
  'biggestFish',
  'quality',
  'quality1',
  'quality2',
  'bestOfCount',
  'topNCatchesAvarage',
]);
export type TimelineMetricKey = z.infer<typeof timelineMetricKeySchema>;

export const timelineEventSchema = z.object({
  weighingId: z.union([z.number(), z.string()]),
  t: z.string(),
  quantity: z.number(),
  catchCount: z.number(),
  biggestFish: z.number(),
  quality: z.number().optional(),
  quality1: z.number().optional(),
  quality2: z.number().optional(),
  bestOfCount: z.number().optional(),
  topNCatchesAvarage: z.number().optional(),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const timelineStandSchema = z.object({
  standId: z.number(),
  standName: z.string(),
  sectorId: z.string(),
  sectorName: z.string(),
  teamName: z.string().nullable(),
  guestName: z.string().nullable(),
  events: z.array(timelineEventSchema),
});

export const timelineSnapshotSchema = z.object({
  competitionStart: z.string(),
  competitionEnd: z.string(),
  rankingType: z.string(),
  defaultMetric: timelineMetricKeySchema,
  availableMetrics: z.array(timelineMetricKeySchema),
  generatedAt: z.string(),
  stands: z.array(timelineStandSchema),
  weighingFingerprints: z.record(z.string(), z.object({ initialEndDate: z.string() })),
});
export type TimelineSnapshot = z.infer<typeof timelineSnapshotSchema>;

/* ------------------------------------------------------------------ */
/* Registrations — fish models/competition-registration.type.ts       */
/* ------------------------------------------------------------------ */

export type CompetitionRegistrationInput = {
  competition: string;
  participants: string[];
  teamName: string;
  phone: string | null;
  registrationStatus: string;
};

export type UpdateCompetitionRegistrationInput = {
  competition: string;
  registrationId: string;
  participants: string[];
  teamName: string;
};

export type CreateGuestRegistrationPayload = {
  competitionId: string;
  guestName: string;
  teamName?: string;
};

export type UpdateGuestRegistrationPayload = {
  registrationId: string;
  guestName?: string;
  teamName?: string;
};

/** Strapi `create`/`update` envelope. fish never reads it; only the identity is guaranteed here. */
export const registrationWriteResultSchema = z.object({
  data: z.object({ id: z.number(), documentId: z.string() }),
});
export type RegistrationWriteResult = z.infer<typeof registrationWriteResultSchema>;

/* ------------------------------------------------------------------ */
/* Stands — fish models/stand.type.ts#StandStats                      */
/* ------------------------------------------------------------------ */

export const standStatsSchema = z.object({
  standId: z.string(),
  name: z.string(),
  // Both null for stands never placed on the map (fish types them as numbers).
  coordinates: z.object({ latitude: z.number().nullable(), longitude: z.number().nullable() }),
  biggestFish: z.number(),
  totalCatchesCount: z.number(),
  // Null for a stand with no catches (fish types it as number).
  quality: z.number().nullable(),
});
export type StandStats = z.infer<typeof standStatsSchema>;

/* ------------------------------------------------------------------ */
/* Polls — fish models/poll.type.ts                                   */
/* ------------------------------------------------------------------ */

export const pollOptionSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  order: z.number(),
  votesCount: z.number(),
  suggestedBy: z.object({ id: z.number(), name: z.string() }).nullable(),
});
export type PollOption = z.infer<typeof pollOptionSchema>;

export const pollSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  // Null on past polls closed by hand (fish types it as string).
  closesAt: z.string().nullable(),
  closedAt: z.string().nullish(),
  votingClosed: z.boolean(),
  totalVotes: z.number(),
  myVoteOptionId: z.number().nullable(),
  options: z.array(pollOptionSchema),
});
export type Poll = z.infer<typeof pollSchema>;

export const pastPollsPageSchema = paginatedSchema(pollSchema);
export type PastPollsPage = z.infer<typeof pastPollsPageSchema>;

export type PollVoteRequest = { pollId: string; optionId: number };
export type PollSuggestRequest = { pollId: string; text: string };

/* ------------------------------------------------------------------ */
/* Sponsors — fish models/sponsor.type.ts                             */
/* ------------------------------------------------------------------ */

export const sponsorDashboardSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  name: z.string(),
  // Null when the sponsor has no website (fish types it as string).
  url: z.string().nullable(),
  image: z.object({ url: z.string(), smallUrl: z.string().nullable(), blurhash: z.string().nullable() }).nullable(),
});
export type SponsorDashboard = z.infer<typeof sponsorDashboardSchema>;

export const sponsorDetailSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  name: z.string(),
  url: z.string().nullable(),
  description: richTextSchema.nullable(),
  image: z.object({ url: z.string(), largeUrl: z.string().nullable(), blurhash: z.string().nullable() }).nullable(),
});
export type SponsorDetail = z.infer<typeof sponsorDetailSchema>;

/* ------------------------------------------------------------------ */
/* Followers — fish services/api/followers.ts#PersonDTO                */
/* ------------------------------------------------------------------ */

export const personSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  username: z.string(),
  avatar: avatarUrlSchema,
});
export type Person = z.infer<typeof personSchema>;

/* ------------------------------------------------------------------ */
/* Notification preferences — fish models/notification-preferences.type.ts */
/* ------------------------------------------------------------------ */

export const notificationPreferenceTypeSchema = z.object({ key: z.string(), label: z.string(), muted: z.boolean() });
export const notificationPreferenceGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  types: z.array(notificationPreferenceTypeSchema),
});
export type NotificationPreferenceGroup = z.infer<typeof notificationPreferenceGroupSchema>;
export const notificationPreferencesSchema = z.object({
  groups: z.array(notificationPreferenceGroupSchema),
  extraMuted: z.array(z.string()).optional(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const followedCompetitionSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  bannerThumbUrl: z.string().nullable(),
  competitionStatus: z.enum(['notStarted', 'started']),
  mutedCount: z.number(),
});
export type FollowedCompetition = z.infer<typeof followedCompetitionSchema>;
