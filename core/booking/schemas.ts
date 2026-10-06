import * as z from 'zod';

/**
 * fish `models/lake-booking.type.ts` + `models/lake-reservation.type.ts` + the inline types of
 * `services/api/booking.ts`. Response shapes follow the CMS DTOs:
 * `fir-intins-cms/src/api/booking/services/dto/booking.ts` (toBookingDTO),
 * `src/api/feed/services/dto/availability.ts` (toAvailabilityDTO),
 * `src/api/availability-block/services/dto/availability-block.ts` (toBlockDTO),
 * `src/api/lake/services/dto/owned-lake.ts` and `src/api/booking/services/to-review.ts`.
 */

export const bookingStatusSchema = z.enum(['pending', 'confirmed', 'rejected', 'cancelled', 'completed']);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const cancelledBySchema = z.enum(['angler', 'operator', 'system']);
export type CancelledBy = z.infer<typeof cancelledBySchema>;

export const paymentStatusSchema = z.enum(['none', 'depositPaid', 'paidInFull', 'refunded']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export type CellStatus = 'available' | 'booked' | 'blocked';

// Lake booking config (payment/confirmation modes, cancellation policy) lives in core/lakes.

const extraUnitSchema = z.enum(['perStay', 'perNight']);

// ---------------------------------------------------------------------------
// Availability — GET /feed/lakes/:id/availability
// ---------------------------------------------------------------------------

/**
 * Strapi `blocks.coordinates` component. The CMS sends lat/long as DECIMAL STRINGS
 * (`{ id, lat: '44.08', long: '25.66' }`) although fish types them as numbers.
 */
const standCoordinatesSchema = z.object({
  lat: z.union([z.number(), z.string()]),
  long: z.union([z.number(), z.string()]),
});

export const availabilityStandSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  coordinates: standCoordinatesSchema.nullable(),
  /** Keys of the lake extras this stand can provide. Not every stand has a cabin. */
  extras: z.array(z.string()),
});
export type AvailabilityStand = z.infer<typeof availabilityStandSchema>;

/** Something the lake sells beside the tour. Priced by the server, shown here. */
export const availabilityExtraSchema = z.object({
  key: z.string(),
  label: z.string(),
  price: z.number(),
  unit: extraUnitSchema,
});
export type AvailabilityExtra = z.infer<typeof availabilityExtraSchema>;

export const occupiedIntervalSchema = z.object({
  standDocumentId: z.string(),
  start: z.string(),
  end: z.string(),
  /** Booker's initials (never the full name). Optional: older backends omit it. */
  initials: z.string().optional(),
});
export type OccupiedInterval = z.infer<typeof occupiedIntervalSchema>;

export const blockedIntervalSchema = z.object({
  standDocumentId: z.string().nullable(),
  start: z.string(),
  end: z.string(),
  // Kept as string: the CMS also synthesizes 'unavailable' for non-bookable stands.
  reason: z.string(),
  /** Competition name, or the operator's note on a manual block. Older backends omit it. */
  label: z.string().nullish(),
  /** Set only for real competition windows — enables the deep-link to it. */
  competitionId: z.string().nullish(),
});
export type BlockedInterval = z.infer<typeof blockedIntervalSchema>;

export const lakeAvailabilitySchema = z.object({
  lakeId: z.string(),
  bookingEnabled: z.boolean(),
  incrementHours: z.number(),
  /** Minutes before the cycle end the stand must be cleared. Display only. */
  checkoutBufferMinutes: z.number(),
  /** Per-lake minimum booking lead in hours. Optional: older backends omit it (→ 24). */
  leadHours: z.number().optional(),
  slotStartTimes: z.array(z.string()),
  /** Lake-local times ("HH:mm") a tour may NOT end at — some lakes refuse a dawn
   *  checkout. Optional: a backend older than the rule omits it (→ no restriction). */
  forbiddenEndTimes: z.array(z.string()).optional(),
  /** Shortest tour the lake sells. Optional for the same reason (→ incrementHours). */
  minDurationHours: z.number().optional(),
  /** Longest tour the lake sells; absent when it has no ceiling. (CMS DTO; not in the fish model.) */
  maxDurationHours: z.number().nullish(),
  /** How far ahead a tour may start; absent when the lake has no horizon. (CMS DTO; not in the fish model.) */
  bookingHorizonDays: z.number().nullish(),
  timezone: z.string(),
  stands: z.array(availabilityStandSchema),
  /** What the lake sells beside the tour. Empty when it sells nothing. */
  extras: z.array(availabilityExtraSchema),
  bookings: z.array(occupiedIntervalSchema),
  blocks: z.array(blockedIntervalSchema),
  window: z.object({ from: z.string(), to: z.string() }),
});
export type LakeAvailability = z.infer<typeof lakeAvailabilitySchema>;

// ---------------------------------------------------------------------------
// Quote — POST /feed/lakes/:id/quote
// ---------------------------------------------------------------------------

/** One line of a quote: what an extra cost, and why that much. */
export const quoteExtraLineSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: extraUnitSchema,
  unitPrice: z.number(),
  quantity: z.number(),
  total: z.number(),
});
export type QuoteExtraLine = z.infer<typeof quoteExtraLineSchema>;

export const bookingQuoteBasisSchema = z.object({
  durationHours: z.number(),
  rowLabel: z.string().nullable(),
  composedFrom: z.array(z.number()),
  tourPrice: z.number(),
  extras: z.array(quoteExtraLineSchema),
});
export type BookingQuoteBasis = z.infer<typeof bookingQuoteBasisSchema>;

/**
 * The breakdown stored on a booking, as the server snapshotted it at creation.
 * Same shape as the quote's basis, but frozen — the lake's rates may have moved.
 */
export const bookingBasisSchema = bookingQuoteBasisSchema;
export type BookingBasis = BookingQuoteBasis;

/**
 * What the server says about a tour: a price, or why it will not sell it.
 *
 * The refusal carries its own sentence. The app deliberately does not know the
 * lake's rules — a rule added to the backend next month must explain itself on
 * a build shipped today, which it cannot do if the copy lives here.
 *
 * A union, not one object with nullable halves: a refusal has no basis, and
 * reading one crashed the sheet before TypeScript was asked to care. Narrowing
 * on `total` now gives you the breakdown or the reason, never a half of each.
 */
export const bookingQuoteSchema = z.union([
  z.object({ total: z.number(), basis: bookingQuoteBasisSchema, refusal: z.null() }),
  z.object({ total: z.null(), basis: z.null(), refusal: z.object({ code: z.string(), message: z.string() }) }),
]);
export type BookingQuote = z.infer<typeof bookingQuoteSchema>;

export type BookingQuoteInput = {
  lakeId: string;
  standId: string;
  startISO: string;
  endISO: string;
  extras: string[];
  /** Operator screen: the server skips the end-time rule for a walk-in, so the
   *  quote must skip it too or the sheet refuses what the submit accepts. */
  walkIn?: boolean;
};

// ---------------------------------------------------------------------------
// Bookings — /feed/bookings*
// ---------------------------------------------------------------------------

export const bookingLakeRefSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  /** First lake contact phone; null when none is on file. */
  contactPhone: z.string().nullable(),
  /** Hours of notice required to cancel in-app. 0/null = no restriction. */
  minCancelNoticeHours: z.number().nullable(),
  /** Minutes before the cycle end the stand must be cleared. Display only; defaults to 0. */
  checkoutBufferMinutes: z.number(),
  /** First lake photo (thumbnail format). Absent on a CMS that predates it,
   *  null when the lake has no images — both fall back to a placeholder tile. */
  thumbUrl: z.string().nullish(),
  /** "City, County" — the line under the lake's name on a booking card. */
  locality: z.string().nullish(),
});

export const bookingSchema = z.object({
  documentId: z.string(),
  code: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  // Text-only in the UI and the CMS may add one: unknown values fall back to "pending" there.
  bookingStatus: z.union([bookingStatusSchema, z.string()]),
  priceTotal: z.number(),
  depositAmount: z.number(),
  amountPaid: z.number().optional(),
  paymentStatus: z.union([paymentStatusSchema, z.string()]),
  contactFullname: z.string().optional(),
  contactPhone: z.string(),
  notes: z.string().optional(),
  noShow: z.boolean().optional(),
  noShowComment: z.string().optional(),
  /**
   * True once the operator has rated this stay. Absent on an unrated one AND on
   * a CMS that predates the field, which is why the rate button falls back to
   * showing: the two cases are indistinguishable here, and the endpoint refuses
   * a second review anyway (ALREADY_REVIEWED).
   */
  reviewedByOperator: z.boolean().optional(),
  /** When the booking was cancelled — lets a cancelled list sort newest-first. */
  cancelledAt: z.string().nullish(),
  /**
   * Who ended it: the angler dropped out, the operator cancelled on them, or the
   * sweeper expired it. Absent on bookings cancelled before the CMS started
   * sending this, so every reader must tolerate undefined.
   */
  cancelledBy: cancelledBySchema.optional(),
  /** Reason captured at cancellation time; mandatory on both cancel paths. */
  cancelReason: z.string().optional(),
  /** When the request was made — what the operator inbox ages each row off. */
  createdAt: z.string().optional(),
  paymentMode: z.string().optional(),
  /** How the total was reached, at the time it was reached. Absent on bookings
   *  made before the server started sending it — the card simply does not render. */
  basis: bookingBasisSchema.optional(),
  lake: bookingLakeRefSchema.optional(),
  stand: z.object({ documentId: z.string(), name: z.string() }).optional(),
  angler: z.object({ documentId: z.string(), username: z.string(), avatar: z.string().nullable() }).optional(),
});
export type BookingDTO = z.infer<typeof bookingSchema>;

export const createBookingResultSchema = z.object({
  data: bookingSchema,
  payment: z.object({ clientSecret: z.string() }).optional(),
});
export type CreateBookingResult = z.infer<typeof createBookingResultSchema>;

export const createBookingInputSchema = z.object({
  lake: z.string(),
  stand: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  /** Keys of the extras the angler picked. */
  extras: z.array(z.string()),
  notes: z.string().optional(),
  contactFullname: z.string().optional(),
  contactPhone: z.string().optional(),
  expectedTotal: z.number().optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

// Operator walk-in (gate) booking. Either the operator types name + phone (and
// may link an account whose phone matches), or picks the account by username and
// sends only `angler` — the server snapshots that account's name/phone instead.
export const walkInBookingInputSchema = z.object({
  lake: z.string(),
  stand: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  extras: z.array(z.string()),
  /** Optional ONLY when `angler` is set — the server then snapshots the
   * account's own name/phone onto the booking. */
  contactFullname: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  /** documentId of the account to link: matched by phone, or picked by username. */
  angler: z.string().optional(),
});
export type WalkInBookingInput = z.infer<typeof walkInBookingInputSchema>;

// Result of GET /feed/bookings/lookup-angler — the phone → account match preview.
export const anglerLookupResultSchema = z.object({
  matched: z.boolean(),
  user: z
    .object({ documentId: z.string(), username: z.string().nullable(), avatar: z.string().nullable() })
    .nullable(),
});
export type AnglerLookupResult = z.infer<typeof anglerLookupResultSchema>;

/**
 * `/feed/bookings/mine` and `/feed/bookings/lake/:id` answer `{ data, meta }`. `meta` is absent on
 * a CMS that predates the bucket contract (and page/pageSize are absent from the lake inbox when
 * no page was asked for) — the API functions below apply fish's fallbacks.
 */
export const bookingsPageResponseSchema = z.object({
  data: z.array(bookingSchema),
  meta: z
    .object({
      pendingCount: z.number().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    })
    .optional(),
});

export type MyBookingsPage = {
  data: BookingDTO[];
  /** The angler's own pending requests — the count on the "În așteptare" tab. */
  pendingCount: number;
  page: number;
  pageSize: number;
};

export type LakeBookingsPage = {
  data: BookingDTO[];
  pendingCount: number;
  page: number;
  pageSize: number;
};

export const lakeToReviewSchema = z.object({
  lakeId: z.string(),
  lakeName: z.string(),
  /** Most recent stay at that lake — what the review is filed against. */
  bookingId: z.string(),
  endDate: z.string(),
});
export type LakeToReview = z.infer<typeof lakeToReviewSchema>;

export const ownedLakeSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  /** Cover photo for the lake card (first lake image); null when none. */
  coverImageUrl: z.string().nullish(),
  /** Per-lake booking headline stats for the "Administrare lacuri" cards. */
  pending: z.number().optional(),
  active: z.number().optional(),
  cashToCollect: z.number().optional(),
});
export type OwnedLake = z.infer<typeof ownedLakeSchema>;

// ---------------------------------------------------------------------------
// Availability blocks — /feed/availability-blocks*
// ---------------------------------------------------------------------------

export const blockReasonSchema = z.enum(['competition', 'closure', 'maintenance', 'offlineReservation', 'other']);
export type BlockReason = z.infer<typeof blockReasonSchema>;

export const availabilityBlockInputSchema = z.object({
  lake: z.string(),
  stand: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  reason: blockReasonSchema,
  note: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});
export type AvailabilityBlockInput = z.infer<typeof availabilityBlockInputSchema>;

export const availabilityBlockSchema = z.object({
  documentId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string(),
  note: z.string().optional(),
  standKey: z.string().nullable(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  stand: z.object({ documentId: z.string(), name: z.string() }).optional(),
});
export type AvailabilityBlockDTO = z.infer<typeof availabilityBlockSchema>;

/**
 * DELETE /feed/availability-blocks/:id answers `{ data: { documentId } }` only
 * (`availability-block.ts#remove`), although fish types it as a full block.
 */
export const deletedBlockSchema = z.object({ documentId: z.string() });
export type DeletedBlock = z.infer<typeof deletedBlockSchema>;

// ---------------------------------------------------------------------------
// Legacy reservation — POST /reservations (fish models/lake-reservation.type.ts)
// ---------------------------------------------------------------------------

export const lakeReservationSchema = z.object({
  fullname: z.string(),
  email: z.string(),
  phone: z.string(),
  details: z.string(),
  isTermsAgreed: z.boolean(),
  lake: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});
export type LakeReservation = z.infer<typeof lakeReservationSchema>;
