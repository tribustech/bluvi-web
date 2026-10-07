import * as z from 'zod';
import { paginatedSchema, paginationMetaSchema, richTextSchema, strapiImageSchema } from '../shared';

/* ------------------------------------------------------------------------------------------------
 * Shared lake building blocks
 * ---------------------------------------------------------------------------------------------- */

/**
 * fish `features/reviews/types.ts#ReviewMetaType` — a JSON column on the lake, passed through
 * verbatim by every endpoint. `null` on a lake without reviews (the CMS DTO says so; fish types it
 * non-null). `overall` is absent on metas written before it was computed.
 */
export const reviewMetaSchema = z.object({
  quality: z.number(),
  facilities: z.number(),
  atmosphere: z.number(),
  count: z.number(),
  overall: z.number().optional(),
});
export type ReviewMeta = z.infer<typeof reviewMetaSchema>;

/**
 * The lake's `reviewsMeta` field as the endpoints send it. A lake whose reviews were all deleted
 * keeps the aggregate of none — `{ count: 0, quality: null, facilities: null, atmosphere: null,
 * overall: null }` (seen on the local CMS after a review delete, 2026-10-07) — which is read as
 * «no reviews» (null), exactly like a lake that never had one; fish only reads it behind
 * `count > 0`. Without this the whole lake read failed to parse.
 */
const emptyReviewMeta = (v: unknown) =>
  v !== null && typeof v === 'object' && ((v as { count?: unknown }).count === 0 || (v as { quality?: unknown }).quality == null) ? null : v;
export const reviewsMetaFieldSchema = z.preprocess(emptyReviewMeta, reviewMetaSchema.nullable());

/** `countyRef` / `cityRef`. The legacy map payloads omit `id`. */
export const locationRefSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  name: z.string().nullable(),
});
export type LocationRef = z.infer<typeof locationRefSchema>;

/** fish `models/lake.type.ts#Coordinates` — strings, legacy component shape. */
export const coordinatesSchema = z.object({ lat: z.string(), long: z.string() });
export type Coordinates = z.infer<typeof coordinatesSchema>;

/** fish `FeedLakeImage` — flattened image of the `/feed/lakes/*` DTOs. */
export const feedLakeImageSchema = z.object({
  url: z.string(),
  mediumUrl: z.string().nullable(),
  smallUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable().optional(),
  blurhash: z.string().nullish(),
});
export type FeedLakeImage = z.infer<typeof feedLakeImageSchema>;

/** fish `LakeCardFacility`. */
export const lakeCardFacilitySchema = z.object({ id: z.number(), name: z.string() });
export type LakeCardFacility = z.infer<typeof lakeCardFacilitySchema>;

/** fish `LakeCardFishSpecies`. */
export const lakeCardFishSpeciesSchema = z.object({
  id: z.number(),
  fish: z.object({ documentId: z.string(), Name: z.string() }),
});
export type LakeCardFishSpecies = z.infer<typeof lakeCardFishSpeciesSchema>;

/* ------------------------------------------------------------------------------------------------
 * /feed/lakes/* DTOs (CMS `src/api/feed/services/dto/lake.ts`)
 * ---------------------------------------------------------------------------------------------- */

/** fish `LakeCardDTO` — /feed/lakes/search, /filtered, /by-ids. */
export const lakeCardSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  name: z.string(),
  county: z.string().nullable(),
  countyRef: locationRefSchema.nullish(),
  cityRef: locationRefSchema.nullish(),
  regime: z.string().nullable(),
  reviewsMeta: reviewsMetaFieldSchema,
  images: z.array(feedLakeImageSchema),
  facility: z.array(lakeCardFacilitySchema),
  fishSpecies: z.array(lakeCardFishSpeciesSchema),
});
export type LakeCard = z.infer<typeof lakeCardSchema>;

export const lakeCardListResponseSchema = paginatedSchema(lakeCardSchema);
export type LakeCardListResponse = z.infer<typeof lakeCardListResponseSchema>;

/** fish `LakeDetailStand` (+ the stats fields the DTO also carries). */
export const lakeDetailStandSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  name: z.string(),
  performanceScore: z.number().nullish(),
  competitionsCount: z.number().nullish(),
  coordinates: coordinatesSchema.nullable(),
});
export type LakeDetailStand = z.infer<typeof lakeDetailStandSchema>;

/**
 * Lake booking config — fish `models/lake-booking.type.ts`, the CMS `toLakeDetailDTO` output (A15).
 * Modes are kept as text: the CMS may add one, and a new value must not break the lake page.
 */
export const paymentModeSchema = z.union([z.enum(['offline', 'deposit', 'full']), z.string()]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;
export const confirmationModeSchema = z.union([z.enum(['manual', 'instant']), z.string()]);
export type ConfirmationMode = z.infer<typeof confirmationModeSchema>;
export const cancellationPolicySchema = z.object({
  type: z.string().nullable(),
  refundWindowHours: z.number().nullable(),
  notes: z.string().nullable(),
  /**
   * Hours of notice the angler must give to cancel from the app. Distinct from
   * refundWindowHours, which governs money — this governs permission. 0 or null
   * means no restriction. Inside the window the angler must call the operator.
   */
  minCancelNoticeHours: z.number().nullish(),
});
export type CancellationPolicy = z.infer<typeof cancellationPolicySchema>;

/** fish `LakeDetailDTO` — /feed/lakes/:id. */
export const lakeDetailSchema = lakeCardSchema.extend({
  images: z.array(feedLakeImageSchema.omit({ thumbnailUrl: true })),
  description: richTextSchema.nullable(),
  address: z.string().nullable(),
  directions: z.string().nullable(),
  website: z.string().nullable(),
  surface: z.number().nullable(),
  depth: z.object({ min: z.number().nullable(), max: z.number().nullable() }).nullable(),
  numberOfSeats: z.number().nullable(),
  fishingType: z.string().nullable(),
  fishingSpotTypes: z.string().nullable(),
  acceptsReservations: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  price: z.array(
    z.object({
      id: z.number(),
      header: z.string().nullable(),
      description: z.string().nullable(),
      price: z.number().nullable(),
    })
  ),
  contact: z.array(
    z.object({ id: z.number(), header: z.string().nullable(), name: z.string().nullable(), phone: z.string().nullable() })
  ),
  coordinates: coordinatesSchema.nullable(),
  stands: z.array(lakeDetailStandSchema),
  bookingEnabled: z.boolean(),
  incrementHours: z.number().nullable(),
  minDurationHours: z.number().nullable(),
  checkoutBufferMinutes: z.number().nullable(),
  slotStartTimes: z.array(z.string()),
  paymentMode: paymentModeSchema.nullable(),
  depositPercent: z.number().nullable(),
  confirmationMode: confirmationModeSchema.nullable(),
  cancellationPolicy: cancellationPolicySchema.nullable(),
  regulationUrl: z.string().nullable(),
  /** Whether any operator administers this lake — gates the take-over-lake link. */
  hasOwner: z.boolean().optional(),
  /** First operator's public username — shown on the Administrator card. */
  ownerName: z.string().nullish(),
  /**
   * First operator's documentId — links the Administrator card to /anglers/:documentId. Absent on
   * any `/feed/lakes/:id` response cached before this field shipped, so the card must stay
   * non-interactive whenever it is missing.
   */
  ownerDocumentId: z.string().nullish(),
});
export type LakeDetail = z.infer<typeof lakeDetailSchema>;

/** fish `LakeIndexEntryDTO` — one row of /feed/lakes/index. */
export const lakeIndexEntrySchema = z.object({
  documentId: z.string(),
  name: z.string(),
  locality: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  /** Thumbnail-format URL of the lake's first image; null when it has none. */
  thumb: z.string().nullable(),
});
export type LakeIndexEntry = z.infer<typeof lakeIndexEntrySchema>;

/* ------------------------------------------------------------------------------------------------
 * Legacy raw Strapi lake (`/lakes/home`, `/lakes/in-bbox`) — fish `models/lake.type.ts#Lake`
 * ---------------------------------------------------------------------------------------------- */

const legacyFishSpeciesSchema = z.object({
  id: z.number(),
  quality: z.string().nullish(),
  fish: z
    .object({
      id: z.number().optional(),
      documentId: z.string(),
      Name: z.string(),
      Image: strapiImageSchema.nullish(),
    })
    .nullable(),
});

/**
 * The raw lake document the legacy map/home endpoints return. Only `documentId` and `name` are
 * guaranteed: `/lakes/home` selects a handful of fields, `/lakes/in-bbox` returns the whole row.
 */
export const legacyLakeSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  name: z.string(),
  description: richTextSchema.nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  publishedAt: z.string().nullish(),
  address: z.string().nullish(),
  website: z.string().nullish(),
  isVerified: z.boolean().nullish(),
  facilities: z.array(z.string()).nullish(),
  facility: z.array(z.object({ id: z.number(), documentId: z.string().optional(), name: z.string() })).nullish(),
  directions: z.string().nullish(),
  fishingType: z.string().nullish(),
  surface: z.number().nullish(),
  fishingSpotTypes: z.string().nullish(),
  numberOfSeats: z.number().nullish(),
  regime: z.string().nullish(),
  county: z.string().nullish(),
  countyRef: locationRefSchema.nullish(),
  cityRef: locationRefSchema.nullish(),
  images: z.array(strapiImageSchema).nullish(),
  coordinates: coordinatesSchema.nullish(),
  fishSpecies: z.array(legacyFishSpeciesSchema).nullish(),
  reviewsMeta: z.preprocess(emptyReviewMeta, reviewMetaSchema.nullish()),
  acceptsReservations: z.boolean().nullish(),
  bookingEnabled: z.boolean().nullish(),
  incrementHours: z.number().nullish(),
  minDurationHours: z.number().nullish(),
  paymentMode: paymentModeSchema.nullish(),
  depositPercent: z.number().nullish(),
  confirmationMode: confirmationModeSchema.nullish(),
  /** Only on `/lakes/home` nearby rows. */
  distanceKm: z.number().optional(),
});
export type LegacyLake = z.infer<typeof legacyLakeSchema>;

/* ------------------------------------------------------------------------------------------------
 * Map viewport (`/lakes/map-clusters`, `/leaves`, `/in-bbox`, `/focus-bbox`)
 * ---------------------------------------------------------------------------------------------- */

export const bboxSchema = z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() });
export type Bbox = z.infer<typeof bboxSchema>;

export const lakeMapCoordinateSchema = z.object({ latitude: z.number(), longitude: z.number() });
export type LakeMapCoordinate = z.infer<typeof lakeMapCoordinateSchema>;

/** fish `LakePinImage`. */
export const lakePinImageSchema = z.object({
  documentId: z.string(),
  url: z.string(),
  formats: z.object({ medium: z.object({ url: z.string() }).optional() }).nullish(),
});
export type LakePinImage = z.infer<typeof lakePinImageSchema>;

/** fish `LakeMapLeaf`. */
export const lakeMapLeafSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  county: z.string().nullable(),
  regime: z.string().nullable(),
  address: z.string().nullish(),
  surface: z.number().nullish(),
  numberOfSeats: z.number().nullish(),
  fishingType: z.string().nullish(),
  countyRef: locationRefSchema.nullish(),
  cityRef: locationRefSchema.nullish(),
  images: z.array(lakePinImageSchema),
  reviewsMeta: reviewsMetaFieldSchema,
  coordinate: lakeMapCoordinateSchema,
  priceMin: z.number().nullish(),
  priceMax: z.number().nullish(),
});
export type LakeMapLeaf = z.infer<typeof lakeMapLeafSchema>;

/** fish `LakeMapClusterNode`. */
export const lakeMapClusterNodeSchema = z.object({
  type: z.literal('cluster'),
  clusterId: z.string(),
  count: z.number(),
  coordinate: lakeMapCoordinateSchema,
  bbox: bboxSchema,
});
export type LakeMapClusterNode = z.infer<typeof lakeMapClusterNodeSchema>;

/** fish `LakeMapLakeNode`. */
export const lakeMapLakeNodeSchema = lakeMapLeafSchema.extend({ type: z.literal('lake') });
export type LakeMapLakeNode = z.infer<typeof lakeMapLakeNodeSchema>;

export const lakeMapNodeSchema = z.discriminatedUnion('type', [lakeMapClusterNodeSchema, lakeMapLakeNodeSchema]);
export type LakeMapNode = z.infer<typeof lakeMapNodeSchema>;

/** fish `lakes.ts#LakeMapClustersResponse`. */
export const lakeMapClustersResponseSchema = z.object({
  data: z.array(lakeMapNodeSchema),
  meta: z.object({ totalLakes: z.number(), totalNodes: z.number(), zoom: z.number() }),
});
export type LakeMapClustersResponse = z.infer<typeof lakeMapClustersResponseSchema>;

/** fish `lakes.ts#LakeMapLeavesResponse`. */
export const lakeMapLeavesResponseSchema = z.object({ data: z.array(lakeMapLeafSchema) });
export type LakeMapLeavesResponse = z.infer<typeof lakeMapLeavesResponseSchema>;

/** fish `lakes.ts#LakesInBboxResponse`. */
export const lakesInBboxResponseSchema = z.object({
  data: z.array(legacyLakeSchema),
  meta: z.object({ total: z.number(), page: z.number(), pageSize: z.number(), hasMore: z.boolean() }),
});
export type LakesInBboxResponse = z.infer<typeof lakesInBboxResponseSchema>;

/** fish `lakes.ts#LakesFocusBboxResponse`. */
export const lakesFocusBboxResponseSchema = z.object({ bbox: bboxSchema.nullable(), count: z.number() });
export type LakesFocusBboxResponse = z.infer<typeof lakesFocusBboxResponseSchema>;

/* ------------------------------------------------------------------------------------------------
 * Explore (`/lakes/explore/*`) and home (`/lakes/home`)
 * ---------------------------------------------------------------------------------------------- */

export const lakesSuggestionTypeSchema = z.enum(['nearby', 'county', 'city', 'lake']);
export type LakesSuggestionType = z.infer<typeof lakesSuggestionTypeSchema>;
export const lakesSuggestionIconSchema = z.enum(['location', 'county', 'city', 'lake']);
export type LakesSuggestionIcon = z.infer<typeof lakesSuggestionIconSchema>;

/** fish `lakesExplore.ts#ApiExploreSuggestion` (= `LakesSearchSuggestion`). */
export const lakesSearchSuggestionSchema = z.object({
  id: z.string(),
  type: lakesSuggestionTypeSchema,
  title: z.string(),
  subtitle: z.string(),
  icon: lakesSuggestionIconSchema,
  color: z.string(),
  county: z.string().optional(),
  countyId: z.string().optional(),
  cityId: z.string().optional(),
  lakeId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type LakesSearchSuggestion = z.infer<typeof lakesSearchSuggestionSchema>;

export const exploreSuggestionsMetaSchema = z.object({
  query: z.string(),
  normalizedTokens: z.array(z.string()),
  countsByType: z.object({ nearby: z.number(), county: z.number(), city: z.number(), lake: z.number() }),
  pagination: paginationMetaSchema,
});

/** fish `lakesExplore.ts#ExploreSuggestionsResponse`. */
export const exploreSuggestionsResponseSchema = z.object({
  data: z.object({ suggestions: z.array(lakesSearchSuggestionSchema).optional() }).optional(),
  meta: exploreSuggestionsMetaSchema,
});

/** fish `LakesExploreSuggestionsPage` — what `getLakesExploreSuggestions` resolves to. */
export type LakesExploreSuggestionsPage = {
  suggestions: LakesSearchSuggestion[];
  meta: z.infer<typeof exploreSuggestionsMetaSchema>;
};

/** fish `lakesExplore.ts#ExploreCountResponse`. */
export const exploreCountResponseSchema = z.object({
  data: z.object({ total: z.number().optional() }).nullish(),
});

export const lakeHomeSectionKeySchema = z.enum([
  'recent_viewed',
  'nearby',
  'all_lakes',
  'bookable',
  'top_rated',
  'with_retention',
  'with_cabins',
  'competition_lakes',
  'recently_added',
]);
export type LakeHomeSectionKey = z.infer<typeof lakeHomeSectionKeySchema>;
export type LakesNearbyPermissionPlaceholderMode = 'never_asked' | 'denied' | 'services_off';

/** A home row's lake: a legacy `Lake` from `/lakes/home`, or a `LakeCard` (recent-viewed via by-ids). */
export type LakeHomeSectionLake = LegacyLake | LakeCard;

/** fish `LakeHomeSection`. Unknown section keys from a newer CMS are kept as text. */
export const lakeHomeSectionSchema = z.object({
  key: z.union([lakeHomeSectionKeySchema, z.string()]),
  title: z.string(),
  lakes: z.array(legacyLakeSchema),
  nearbyPermissionPlaceholderMode: z.enum(['never_asked', 'denied', 'services_off']).optional(),
});
export type LakeHomeSection = {
  key: LakeHomeSectionKey | (string & {});
  title: string;
  lakes: LakeHomeSectionLake[];
  nearbyPermissionPlaceholderMode?: LakesNearbyPermissionPlaceholderMode;
};
export type NearbyLakeHomeSection = Omit<LakeHomeSection, 'key' | 'lakes'> & {
  key: 'nearby';
  lakes: (LegacyLake & { distanceKm: number })[];
};

/** fish `lakesHome.ts#HomeResponse`. */
export const lakesHomeResponseSchema = z.object({
  data: z.object({ sections: z.array(lakeHomeSectionSchema).optional() }).nullish(),
  meta: z.object({ generatedAt: z.string().optional() }).optional(),
});

/* ------------------------------------------------------------------------------------------------
 * Catalogs: facilities, fishes (legacy /api/*)
 * ---------------------------------------------------------------------------------------------- */

/** fish `models/facility.type.ts`. */
export const facilitySchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  publishedAt: z.string().nullish(),
});
export type Facility = z.infer<typeof facilitySchema>;

/** fish `models/fishSpecies.type.ts`. */
export const fishSpeciesSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  Name: z.string(),
  competitionPriority: z.number().nullish(),
  partidaDefaultRank: z.number().nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  publishedAt: z.string().nullish(),
});
export type FishSpecies = z.infer<typeof fishSpeciesSchema>;

/* ------------------------------------------------------------------------------------------------
 * Public waters, claims, suggestions, booking interest
 * ---------------------------------------------------------------------------------------------- */

/** fish `publicWaters.ts#ClaimedPublicWater` — ANAR link_code → Lake documentId. */
export const claimedPublicWaterSchema = z.object({ linkCode: z.string(), lakeDocumentId: z.string() });
export type ClaimedPublicWater = z.infer<typeof claimedPublicWaterSchema>;

export const lakeClaimResultSchema = z.object({ documentId: z.string(), claimStatus: z.string() });
export type LakeClaimResult = z.infer<typeof lakeClaimResultSchema>;
export type LakeClaimInput = { lakeId: string; name: string; phone: string; message?: string };

export type LakeSuggestionRequest = {
  lakeName: string;
  message?: string;
  isAdmin: boolean;
  matchedLake?: string | null;
};
/** Strapi core `create` envelope — fish returns it untouched and nothing reads it. */
export const lakeSuggestionResponseSchema = z.object({
  data: z.looseObject({ documentId: z.string() }).nullish(),
  meta: z.unknown().optional(),
});

export type LakeBookingInterestSource = 'quick_action' | 'hero_cta';
export const lakeBookingInterestResultSchema = z.object({
  documentId: z.string().optional(),
  /** The user had already asked for this lake — the sheet shows the same confirmed state. */
  alreadyRegistered: z.boolean(),
});
export type LakeBookingInterestResult = z.infer<typeof lakeBookingInterestResultSchema>;

/* ------------------------------------------------------------------------------------------------
 * Lake reviews (fish `features/reviews/types.ts`) — angler reviews / reputation live in core/social
 * ---------------------------------------------------------------------------------------------- */

/** fish `ReviewReqBodyType`. */
export type ReviewReqBody = {
  quality: number;
  facilities: number;
  atmosphere: number;
  recommendToOthers: boolean;
  comment: string;
  /** Optional booking documentId — links a lake review to a completed booking (→ `verified`). */
  booking?: string;
};

/** fish `Review` = CMS `ReviewDTO`. */
export const reviewSchema = z.object({
  id: z.number().optional(),
  documentId: z.string(),
  quality: z.number(),
  facilities: z.number(),
  atmosphere: z.number(),
  recommendToOthers: z.boolean(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  /** Derived on the backend: true when the review is linked to a completed booking. */
  verified: z.boolean().optional(),
  /** The linked booking documentId, when the review was created from a booking. */
  booking: z.string().optional(),
  author: z
    .object({
      id: z.number().optional(),
      documentId: z.string(),
      username: z.string().nullable(),
      avatar: z.object({ url: z.string(), thumbnailUrl: z.string().nullable() }).nullable(),
    })
    .nullable(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewsForLakeResponseSchema = paginatedSchema(reviewSchema);
export type GetReviewsForLakeResponse = z.infer<typeof reviewsForLakeResponseSchema>;

/** Legacy `/lakes/:id/review` writes answer with the raw review document (or a message on delete). */
export const reviewWriteResponseSchema = z.looseObject({});

/* ------------------------------------------------------------------------------------------------
 * Operator stats (fish `models/operatorStats.type.ts`)
 * ---------------------------------------------------------------------------------------------- */

/** The trend chart's window — a WHOLE calendar week, month or year. */
export const operatorStatsWindowNameSchema = z.enum(['week', 'month', 'year']);
export type OperatorStatsWindowName = z.infer<typeof operatorStatsWindowNameSchema>;

const occupancySchema = z.object({ booked: z.number(), total: z.number() });

export const ownedLakesStatsSchema = z.object({
  pending: z.number(),
  active: z.number(),
  cashToCollect: z.number(),
  /** First owned lake's cover photo (card background); null when none has an image. */
  coverImageUrl: z.string().nullable(),
  /** Reservations per local day for the week ahead (today + next 6), oldest→newest. */
  reservationsByDay: z.array(z.object({ date: z.string(), count: z.number() })),
  reservationsThisWeek: z.number(),
  reservationsPrevWeek: z.number(),
  occupancy: occupancySchema,
  oldestPending: z
    .object({
      anglerName: z.string().nullable(),
      standName: z.string().nullable(),
      lakeName: z.string().nullable(),
      waitingMinutes: z.number().nullable(),
    })
    .nullable(),
  cancelledLast24h: z.number(),
  /** Absent on a CMS that predates the line, which then simply does not render. */
  pendingFeedback: z.number().optional(),
});
export type OwnedLakesStats = z.infer<typeof ownedLakesStatsSchema>;

export const operatorUpcomingBookingSchema = z.object({
  standName: z.string().nullable(),
  anglerName: z.string().nullable(),
  anglerAvatar: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  bookingStatus: z.string(),
  priceTotal: z.number(),
  /** A no-show stays `confirmed`, so bookingStatus alone cannot say who actually turned up. */
  noShow: z.boolean(),
  code: z.string().nullable(),
  documentId: z.string().nullish(),
  balanceDue: z.number().nullish(),
  contactPhone: z.string().nullish(),
  anglerDocumentId: z.string().nullish(),
  reviewedByOperator: z.boolean().optional(),
  extraLabels: z.array(z.string()).optional(),
});
export type OperatorUpcomingBooking = z.infer<typeof operatorUpcomingBookingSchema>;

export const operatorTrendPointSchema = z.object({
  /** `YYYY-MM-DD`, or `YYYY-MM` when the window is a year. */
  date: z.string(),
  booked: z.number(),
  total: z.number(),
  cash: z.number(),
  bookings: z.number(),
});
export type OperatorTrendPoint = z.infer<typeof operatorTrendPointSchema>;

export const operatorWindowTotalsSchema = z.object({ cash: z.number(), bookings: z.number(), occupancyAvgPct: z.number() });
export type OperatorWindowTotals = z.infer<typeof operatorWindowTotalsSchema>;

export const lakeOperatorStatsSchema = z.object({
  occupancyByDay: z.array(z.object({ date: z.string(), booked: z.number(), total: z.number() })),
  /** Absent on a CMS that predates the field → client falls back to today's day count. */
  occupancyNow: occupancySchema.optional(),
  pending: z.number(),
  today: z.array(operatorUpcomingBookingSchema),
  cancelledLast24h: z.number(),
  deIncasatAzi: z.number().optional(),
  deIncasat7z: z.number().optional(),
  oldestPending: z
    .object({ anglerName: z.string().nullable(), standName: z.string().nullable(), waitingMinutes: z.number().nullable() })
    .nullish(),
  pendingFeedback: z.number().optional(),
  todayCompetition: z
    .object({ documentId: z.string(), name: z.string(), startDate: z.string(), endDate: z.string() })
    .nullish(),
  days: z.array(operatorTrendPointSchema).optional(),
  windowTotals: operatorWindowTotalsSchema.nullish(),
});
export type LakeOperatorStats = z.infer<typeof lakeOperatorStatsSchema>;
