import { z } from 'zod';
import { imageFormatsSchema, paginatedSchema, paginationMetaSchema, strapiImageSchema } from '../shared';

// ── Anglers (fish `models/angler.type.ts`, CMS `api/follow/services/dto/*`) ───────────────────────

export const anglerCountsSchema = z.object({
  followers: z.number(),
  following: z.number(),
  catches: z.number(),
  sessions: z.number(),
  competitions: z.number(),
});
export type AnglerCounts = z.infer<typeof anglerCountsSchema>;

export const biggestCatchSchema = z
  .object({ kg: z.number(), source: z.union([z.enum(['competition', 'partida']), z.string()]) })
  .nullable();
export type BiggestCatch = z.infer<typeof biggestCatchSchema>;

export const podiumSchema = z.object({ first: z.number(), second: z.number(), third: z.number() });

/** `GET /feed/anglers/:documentId` → `toAnglerProfileDTO`. */
export const anglerProfileSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  memberSince: z.string(),
  counts: anglerCountsSchema,
  biggestCatch: biggestCatchSchema,
  podium: podiumSchema,
  isFollowedByMe: z.boolean(),
  isSelf: z.boolean(),
});
export type AnglerProfile = z.infer<typeof anglerProfileSchema>;

/** `toAnglerListItemDTO` — followers/following/search/suggested rows. */
export const anglerListItemSchema = z.object({
  documentId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  isFollowedByMe: z.boolean(),
  /** Server-composed RO display copy (e.g. "N urmăritori", "Urmărit de X și încă N"). Render verbatim. */
  subline: z.string().nullish(),
});
export type AnglerListItem = z.infer<typeof anglerListItemSchema>;

export const publicSessionPhotoSchema = z.object({
  url: z.string(),
  thumbUrl: z.string().nullish(),
  weightKg: z.number().nullable(),
});
export type PublicSessionPhoto = z.infer<typeof publicSessionPhotoSchema>;

/** `toPublicSessionDTO`. */
export const publicSessionSchema = z.object({
  documentId: z.string(),
  venueName: z.string().nullable(),
  photoUrl: z.string().nullable(),
  startedAt: z.string(),
  durationMs: z.number(),
  isActive: z.boolean(),
  catches: z.number(),
  totalKg: z.number().nullable(),
  maxKg: z.number().nullable(),
  isPersonalRecord: z.boolean(),
  /** Optional: absent on edge-cached responses predating the 2026-07-27 card redesign. */
  locality: z.string().nullish(),
  standName: z.string().nullish(),
  endedAt: z.string().nullish(),
  photos: z.array(publicSessionPhotoSchema).optional(),
  photoCount: z.number().optional(),
});
export type PublicSession = z.infer<typeof publicSessionSchema>;

/** `toCompetitionHistoryDTO`. */
export const competitionHistoryItemSchema = z.object({
  competition: z.object({
    documentId: z.string(),
    name: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    imageUrl: z.string().nullable(),
    lakeName: z.string().nullable(),
    competitionType: z.union([z.enum(['single', 'team']), z.string()]),
    rankingType: z.string(),
  }),
  placement: z.number().nullable(),
});
export type CompetitionHistoryItem = z.infer<typeof competitionHistoryItemSchema>;

export const competitionsHistoryFilterSchema = z.enum(['podium', 'individual', 'team']);
export type CompetitionsHistoryFilter = z.infer<typeof competitionsHistoryFilterSchema> | undefined;

/** `toPartidaCatchDTO` / `toCompetitionCatchDTO`. */
export const anglerCatchSchema = z.object({
  key: z.string(),
  source: z.union([z.enum(['partida', 'competition']), z.string()]),
  /** Full-size (xlarge) — lightbox and share only, never the grid tile. */
  photoUrl: z.string(),
  /** Grid derivative (medium). Optional: an older backend predates it — fall back to `photoUrl`. */
  photoGridUrl: z.string().optional(),
  /** Placeholder. Null for photos the blurhash sweeper hasn't reached. */
  blurhash: z.string().nullish(),
  /** Original pixel dimensions (masonry sizing). Optional on an older backend (tiles fall back to 4:3). */
  photoWidth: z.number().nullish(),
  photoHeight: z.number().nullish(),
  weightKg: z.number().nullable(),
  species: z.string().nullable(),
  venueName: z.string().nullable(),
  date: z.string(),
  competitionName: z.string().nullable(),
  competitionDocumentId: z.string().nullable(),
});
export type AnglerCatch = z.infer<typeof anglerCatchSchema>;
/** fish name. */
export type AnglerCatchDTO = AnglerCatch;

/** Offset page: `{ data, meta: { pagination } }`. fish `AnglersPage<T>`. */
export type AnglersPage<T> = { data: T[]; meta: { pagination: z.infer<typeof paginationMetaSchema> } };

/**
 * Cursor-paginated page — the profile catches grid merges two independently-sorted sources
 * (partidă captures and competition catches). Offset pagination made the server re-read
 * `page × pageSize` rows from BOTH sources on every request; a cursor keeps the cost constant.
 * There is no `page`/`pageCount` — `nextCursor === null` means the end.
 */
export function anglersCursorPageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({
      pagination: z.object({ pageSize: z.number(), total: z.number() }),
      nextCursor: z.string().nullable(),
    }),
  });
}
export type AnglersCursorPage<T> = {
  data: T[];
  meta: { pagination: { pageSize: number; total: number }; nextCursor: string | null };
};

export const anglerListPageSchema = paginatedSchema(anglerListItemSchema);
export const publicSessionPageSchema = paginatedSchema(publicSessionSchema);
export const competitionHistoryPageSchema = paginatedSchema(competitionHistoryItemSchema);
export const anglerCatchPageSchema = anglersCursorPageSchema(anglerCatchSchema);

/** `GET /feed/anglers/suggested` → `data`. `friendsOfFollows` is only populated on page 1. */
export const suggestedAnglersPageSchema = z.object({
  friendsOfFollows: z.array(anglerListItemSchema),
  recentlyActive: anglerListPageSchema,
});
export type SuggestedAnglersPage = z.infer<typeof suggestedAnglersPageSchema>;

export const suggestedAnglerStatsSchema = z.object({
  competitions: z.number(),
  podiums: z.number(),
  sessions: z.number(),
  catches: z.number(),
  recordKg: z.number().nullable(),
  /** Angler-follow followers of this person. */
  followers: z.number(),
});
export type SuggestedAnglerStats = z.infer<typeof suggestedAnglerStatsSchema>;

/** One card of the Home "Pescari pe care îi poți urmări" rail (`/feed/anglers/suggested-home`). */
export const suggestedAnglerSchema = z.object({
  documentId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  isFollowedByMe: z.boolean(),
  stats: suggestedAnglerStatsSchema,
});
export type SuggestedAngler = z.infer<typeof suggestedAnglerSchema>;
export const suggestedAnglerPageSchema = paginatedSchema(suggestedAnglerSchema);

/** `POST /feed/anglers/:documentId/(un)follow`. */
export const followResultSchema = z.object({ following: z.boolean(), followersCount: z.number() });
export type FollowResult = z.infer<typeof followResultSchema>;

// ── Profile (fish `models/profile.type.ts`, CMS `profile.getMyProfile`) ─────────────────────────────

/**
 * Booleans are nullable: Strapi only applies attribute defaults on create, so rows older than the
 * default can hold null (fish `User` already types them `boolean | null`).
 */
export const profileSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  createdAt: z.string().optional(),
  email: z.string(),
  username: z.string(),
  phone: z.string().nullable(),
  bio: z.string().nullish(),
  provider: z.string().nullish(),
  isProfileComplete: z.boolean().nullable(),
  hasRequestedOrganizerRole: z.boolean().nullable(),
  notificationsEnabled: z.boolean().nullable(),
  avatar: z
    .object({
      id: z.number(),
      documentId: z.string(),
      url: z.string(),
      formats: imageFormatsSchema.nullish(),
    })
    .nullable(),
  role: z.object({
    id: z.number(),
    documentId: z.string(),
    name: z.union([z.enum(['Authenticated', 'Organizer']), z.string()]),
  }),
});
export type Profile = z.infer<typeof profileSchema>;

/** fish `services/api/profile.ts#UpdateProfileRequest`. */
export type UpdateProfileRequest = {
  username?: string;
  phone?: string | null;
  avatar?: number;
  bio?: string | null;
};

/** fish `models/user-statistics.type.ts`. */
export const userStatisticsSchema = z.object({
  catches: z.number(),
  biggestCatchKg: z.number().nullable(),
  competitions: z.number(),
});
export type UserStatistics = z.infer<typeof userStatisticsSchema>;
export type ParticipantStats = UserStatistics;

export const userStatuteForCompetitionSchema = z.object({
  /** null = has no role in the competition. */
  userRole: z.enum(['author', 'referee', 'participant']).nullable(),
  /** Additive flags (CMS 2026-09-20): `userRole` keeps its author > referee > participant
   * precedence, so a referee who is also on a registered team is only visible through these. */
  isParticipant: z.boolean().optional(),
  isReferee: z.boolean().optional(),
});
export type UserStatuteForCompetition = z.infer<typeof userStatuteForCompetitionSchema>;

// ── Users (fish `models/user.type.ts`, CMS `profile.getAllUsers`) ───────────────────────────────────

export const userSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  username: z.string(),
  email: z.string(),
  provider: z.string().nullish(),
  isProfileComplete: z.boolean().nullable(),
  phone: z.string().nullable(),
  hasRequestedOrganizerRole: z.boolean().nullable(),
  avatar: z.object({ url: z.string(), formats: imageFormatsSchema.nullish() }).nullish(),
});
export type User = z.infer<typeof userSchema>;
export const userPageSchema = paginatedSchema(userSchema);

// ── Notifications (fish `models/notification.type.ts`) ──────────────────────────────────────────────

export const NotificationTypes = {
  /** Sent to the competition organizer when a new participant registers for their competition. */
  COMPETITION_NEW_REGISTRATION_ORGANIZER: 'competition:new-registration-organizer',
  COMPETITION_NEW_REGISTRATION_USER: 'competition:new-registration-user',
  /** Sent to a user when someone joined the competition and added that user as a team member. */
  COMPETITION_NEW_REGISTRATION_TEAM: 'competition:new-registration-team',
  /** Sent to the organizer when an accepted user modifies their registration. */
  COMPETITION_REGISTRATION_MODIFIED_ORGANIZER: 'competition:registration-modified-organizer',
  /** Sent to all participants on a registration when the organizer modifies it. */
  COMPETITION_REGISTRATION_MODIFIED_PARTICIPANT: 'competition:registration-modified-participant',
  COMPETITION_START: 'competition:start',
  COMPETITION_END: 'competition:end',
  COMPETITION_PARTICIPANTS_ALLOCATION: 'competition:participants-allocation',
  /** Sent to all registered participants when a weighing (cântar) ends. */
  COMPETITION_WEIGHING_END: 'competition:weighing-end',
  /** Sent when a closed weighing is reopened and modified. */
  COMPETITION_WEIGHING_MODIFIED: 'competition:weighing-modified',
  COMPETITION_EXTRA_WEIGHT_REQUEST: 'competition:extra-request',
  NEWS: 'news',
  POLL_OPENED: 'poll-opened',
  POLL_CLOSED: 'poll-closed',
  /** Sent only to the suggester when an admin approves their pending poll suggestion. */
  POLL_SUGGESTION_APPROVED: 'poll-suggestion-approved',
  COMPETITION_NEW_REJECTION_USER: 'competition:new-rejection-user',
  COMPETITION_NEW_REJECTION_TEAM: 'competition:new-rejection-team',
  COMPETITION_NEW_CANCELLATION_ORGANIZER: 'competition:new-cancellation-organizer',
  /** Sent to all registered participants when the organizer cancels a competition. */
  COMPETITION_CANCELLED_USER: 'competition:cancelled-user',
  COMPETITION_AUTO_CANCELLED_ORGANIZER: 'competition:auto-cancelled-organizer',
  COMPETITION_PENDING_USER: 'competition:pending-user',
  NEW_LAKES: 'lake:new-lakes',
  NEW_FOLLOWER: 'user:new-follower',
  /** Scheduled push from CMS; tap only opens the app (no deep link). */
  SCHEDULED_NOTIFICATION: 'scheduled-notification',
  /** New message in a competition chat room (Firestore); tap opens the chat on that tab. */
  CHAT_MESSAGE: 'chat:message',
  /** Sent to a registration's participants when an organizer/referee applies a penalty. */
  PENALTY: 'PENALTY',
  BOOKING_NEW_REQUEST_OPERATOR: 'booking:new-request-operator',
  BOOKING_REQUEST_RECEIVED_ANGLER: 'booking:request-received-angler',
  BOOKING_CONFIRMED_ANGLER: 'booking:confirmed-angler',
  BOOKING_REJECTED_ANGLER: 'booking:rejected-angler',
  BOOKING_CANCELLED_OPERATOR: 'booking:cancelled-operator',
  BOOKING_CANCELLED_ANGLER: 'booking:cancelled-angler',
  BOOKING_REMINDER_ANGLER: 'booking:reminder-angler',
  BOOKING_NO_SHOW_ANGLER: 'booking:no-show-angler',
  BOOKING_WALK_IN_ANGLER: 'booking:walk-in-angler',
  BOOKING_PENDING_NUDGE_OPERATOR: 'booking:pending-nudge-operator',
  BOOKING_AUTO_REJECTED_OPERATOR: 'booking:auto-rejected-operator',
  /** Co-op invite; payload carries the join code (`partidaCode`). */
  PARTIDA_INVITE: 'partida:invite',
  /** Co-op finished; payload carries the session CLIENT id (`sessionId`). */
  PARTIDA_FINISHED: 'partida:finished',
  /** A followed angler landed a catch during a live Partidă; carries `sessionDocumentId`. */
  PARTIDA_CATCH: 'partida:catch',
  /** A live Partidă the user follows has finished; carries `sessionDocumentId`. */
  PARTIDA_FINISHED_FOLLOWED: 'partida:finished-followed',
  /** Co-op auto-close warning (5 min left); carries the session client id (`sessionId`). */
  PARTIDA_AUTO_CLOSE_WARN: 'partida:auto-close-warn',
  /** Daily digest, single new competition (push-only). Carries competitionId. */
  NEW_COMPETITIONS: 'new-competitions',
  /** Daily digest with ≥2 items (push-only). No competitionId → Concursuri tab. */
  COMPETITIONS_DIGEST: 'competitions-digest',
  /** Angler-follow fan-out: competition ones carry `competitionId`, partidă/record ones
   * `sessionDocumentId`, the review one `lakeId`. */
  FOLLOW_COMPETITION_REGISTERED: 'follow:competition-registered',
  FOLLOW_COMPETITION_DIGEST: 'follow:competition-digest',
  FOLLOW_COMPETITION_START: 'follow:competition-start',
  FOLLOW_COMPETITION_END: 'follow:competition-end',
  FOLLOW_COMPETITION_PODIUM: 'follow:competition-podium',
  FOLLOW_PARTIDA_START: 'follow:partida-start',
  FOLLOW_PARTIDA_FIRST_CATCH: 'follow:partida-first-catch',
  FOLLOW_RECORD_PERSONAL: 'follow:record-personal',
  FOLLOW_RECORD_LAKE: 'follow:record-lake',
  FOLLOW_LAKE_REVIEW: 'follow:lake-review',
} as const;

export type KnownNotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];
const knownNotificationTypes = Object.values(NotificationTypes) as [KnownNotificationType, ...KnownNotificationType[]];
export const notificationTypeSchema = z.union([z.enum(knownNotificationTypes), z.string()]);
/** Known types plus any string: a type added by a newer CMS must not break the inbox (it just routes nowhere). */
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  title: z.string(),
  body: z.string(),
  sentAt: z.string(),
  /** The push payload. Values are strings on the wire (FCM); kept `unknown` so a stray number can't break the list. */
  data: z.record(z.string(), z.unknown()),
  type: notificationTypeSchema,
});
export type Notification = z.infer<typeof notificationSchema>;

/** A `notification-user` row: the per-user read state around a notification. */
export const notificationResponseSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  read: z.boolean(),
  readAt: z.string().nullable(),
  notification: notificationSchema,
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
export const notificationsPageSchema = paginatedSchema(notificationResponseSchema);
export type GetNotificationsForLoggedUserResponse = z.infer<typeof notificationsPageSchema>;

export const unreadCountSchema = z.object({ count: z.number() });
export const successSchema = z.object({ success: z.boolean() });
export const messageDataSchema = z.object({ data: z.object({ message: z.string() }) });

// ── Reputation + angler reviews (fish `models/reputation.type.ts`, `anglerReview.type.ts`) ──────────

/** CMS `toAnglerReviewDTO` — a review an operator leaves about an angler. */
export const anglerReviewSchema = z.object({
  stars: z.number(),
  comment: z.string().nullable(),
  authorName: z.string().nullable(),
  lakeName: z.string().nullable(),
  createdAt: z.string(),
  /** RETIRED per-area sub-scores: only reviews written before 2026-08-18 carry them. Kept because
   * an old review's true score is the mean of these, not the rounded `stars`. */
  rulesScore: z.number().nullable(),
  cleanlinessScore: z.number().nullable(),
  behaviorScore: z.number().nullable(),
  /** Praise or problems the operator tagged. Absent on a CMS that predates it. */
  tags: z.array(z.string()).optional(),
});
export type AnglerReview = z.infer<typeof anglerReviewSchema>;

/** CMS `toReputationDTO` — an angler's aggregate standing. */
export const reputationSchema = z.object({
  avgStars: z.number().nullable(),
  ratingCount: z.number(),
  noShowCount: z.number(),
  /** Per-area averages over the retired sub-scores. Still served for historic rows. */
  areas: z.object({
    rules: z.number().nullable(),
    cleanliness: z.number().nullable(),
    behavior: z.number().nullable(),
  }),
  reviews: z.array(anglerReviewSchema),
});
export type Reputation = z.infer<typeof reputationSchema>;

export type CreateAnglerReviewInput = {
  booking: string;
  stars: number;
  comment?: string;
  /** Praise or problems, from the closed set in `domain/reviewTags.ts`. Replaced the three
   * per-area sub-scores, which the server still accepts for older builds but nothing sends. */
  tags?: string[];
};

// ── Feedback (fish `services/api/feedback.ts`) ──────────────────────────────────────────────────────

export const feedbackCategorySchema = z.enum(['feature', 'technical', 'content', 'account', 'ui', 'other']);
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;
export type Feedback = {
  rating: number;
  feedback: string;
  category: FeedbackCategory;
  metadata: Record<string, unknown>;
};
/** Strapi core `create` answer; nothing reads it, so only the envelope is checked. */
export const feedbackCreatedSchema = z.object({ data: z.looseObject({ documentId: z.string() }) });

// ── Media upload (Strapi upload plugin) ─────────────────────────────────────────────────────────────

/** A Strapi upload-plugin file. The upload answer always carries the numeric `id` (it is what
 *  `uploadMediaAndAttachToEntity` / a profile avatar attaches by), so it is required here. */
export const uploadedFileSchema = strapiImageSchema.extend({ id: z.number() });
export type UploadedFile = z.infer<typeof uploadedFileSchema>;
export const uploadResponseSchema = z.array(uploadedFileSchema);

// ── Firebase token ──────────────────────────────────────────────────────────────────────────────────

export const firebaseTokenResponseSchema = z.object({ firebaseToken: z.string().nullish() }).nullable();

/** `POST /user/organizer-request` → the updated user (only identity kept). */
export const organizerRoleRequestResponseSchema = z.object({ id: z.number(), documentId: z.string() });
