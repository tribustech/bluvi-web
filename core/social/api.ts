import * as z from 'zod';
import { call, isApiError, type Transport } from '../transport';
import {
  anglerCatchPageSchema,
  anglerListPageSchema,
  anglerProfileSchema,
  anglerPublicProfileSchema,
  anglerReviewSchema,
  competitionHistoryPageSchema,
  feedbackCreatedSchema,
  firebaseTokenResponseSchema,
  followResultSchema,
  messageDataSchema,
  myWidgetNotificationSchema,
  notificationsPageSchema,
  organizerRoleRequestResponseSchema,
  profileSchema,
  publicSessionPageSchema,
  registerWidgetNotificationResponseSchema,
  reputationSchema,
  successSchema,
  suggestedAnglerPageSchema,
  suggestedAnglersPageSchema,
  unreadCountSchema,
  uploadResponseSchema,
  userPageSchema,
  userStatisticsSchema,
  userStatuteForCompetitionSchema,
  type CompetitionsHistoryFilter,
  type CreateAnglerReviewInput,
  type FeatureKey,
  type Feedback,
  type MyWidgetNotification,
  type ParticipantStats,
  type UpdateProfileRequest,
} from './schemas';

/*
 * fish wraps most of these in `try { … } catch (e) { throw new Error(e.message) }`. The transport
 * already throws an `ApiError` carrying the same message (and keeps `bluCode`/`status`, which the
 * wrap threw away), so the wraps are not ported.
 */

export type PageParams = { page: number; pageSize: number };

const enc = encodeURIComponent;

// ── services/api/anglers.ts ─────────────────────────────────────────────────────────────────────────
// Header + follow graph + discovery are per-viewer (isFollowedByMe) and users-permissions gated →
// `required`. The three tab lists (sessions/competitions/catches) are `auth: false`, shared and
// edge-cached 60s → `none`.

/**
 * Web-only (no fish counterpart): the PUBLIC header of /pescari/[id] — the server renders it for
 * guests and crawlers (name, counts, JSON-LD, OG card). `none`: viewer-independent, cached under the
 * CMS's headers. A CMS without the route answers a bare 404 (no bluCode); an unknown or blocked
 * angler answers 404 `ANGLER:NOT_FOUND` — see `isAnglerNotFound`.
 */
export async function getAnglerPublicProfile(t: Transport, documentId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/anglers/${enc(documentId)}/public`, auth: 'none' },
    z.object({ data: anglerPublicProfileSchema })
  );
  return res.data;
}

/** The CMS's «this angler does not exist» (unknown / blocked id) — never a missing route. */
export function isAnglerNotFound(e: unknown): boolean {
  return isApiError(e) && e.status === 404 && e.bluCode === 'ANGLER:NOT_FOUND';
}

/** fish `services/api/anglers.ts#getAnglerProfile` */
export async function getAnglerProfile(t: Transport, documentId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/anglers/${enc(documentId)}`, auth: 'required' },
    z.object({ data: anglerProfileSchema })
  );
  return res.data;
}

/** fish `services/api/anglers.ts#getAnglerFollowers` */
export function getAnglerFollowers(t: Transport, documentId: string, { page, pageSize }: PageParams) {
  return call(
    t,
    { method: 'GET', path: `/feed/anglers/${enc(documentId)}/followers`, query: { page, pageSize }, auth: 'required' },
    anglerListPageSchema
  );
}

/** fish `services/api/anglers.ts#getAnglerFollowing` */
export function getAnglerFollowing(t: Transport, documentId: string, { page, pageSize }: PageParams) {
  return call(
    t,
    { method: 'GET', path: `/feed/anglers/${enc(documentId)}/following`, query: { page, pageSize }, auth: 'required' },
    anglerListPageSchema
  );
}

/** fish `services/api/anglers.ts#getAnglerSessions` */
export function getAnglerSessions(t: Transport, documentId: string, { page, pageSize }: PageParams) {
  return call(
    t,
    { method: 'GET', path: `/feed/anglers/${enc(documentId)}/sessions`, query: { page, pageSize }, auth: 'none' },
    publicSessionPageSchema
  );
}

/**
 * fish `services/api/anglers.ts#getAnglerCatches`. Cursor-paginated: `cursor` is opaque — pass back
 * the previous page's `meta.nextCursor`; null/undefined asks for the first page, and then the param
 * is OMITTED (sending `cursor: null` would serialise as an empty param).
 */
export function getAnglerCatches(
  t: Transport,
  documentId: string,
  { cursor, pageSize }: { cursor?: string | null; pageSize: number }
) {
  return call(
    t,
    {
      method: 'GET',
      path: `/feed/anglers/${enc(documentId)}/catches`,
      query: { pageSize, ...(cursor ? { cursor } : {}) },
      auth: 'none',
    },
    anglerCatchPageSchema
  );
}

/** fish `services/api/anglers.ts#getAnglerCompetitions` — empty filter/year are dropped. */
export function getAnglerCompetitions(
  t: Transport,
  documentId: string,
  { page, pageSize, filter, year }: PageParams & { filter?: CompetitionsHistoryFilter; year?: number }
) {
  const query: Record<string, unknown> = { page, pageSize };
  if (filter) query.filter = filter;
  if (year) query.year = year;
  return call(
    t,
    { method: 'GET', path: `/feed/anglers/${enc(documentId)}/competitions`, query, auth: 'none' },
    competitionHistoryPageSchema
  );
}

/** fish `services/api/anglers.ts#searchAnglers` — min 2 chars, enforced by the query and the server. */
export function searchAnglers(t: Transport, q: string, { page, pageSize }: PageParams) {
  return call(
    t,
    { method: 'GET', path: '/feed/anglers/search', query: { q, page, pageSize }, auth: 'required' },
    anglerListPageSchema
  );
}

/**
 * fish `services/api/anglers.ts#getSuggestedAnglers`. `friendsOfFollows` is only populated by the
 * server on page 1 (weighted-random sample of up to 10, stable per visit).
 */
export async function getSuggestedAnglers(t: Transport, { page, pageSize }: PageParams) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/anglers/suggested', query: { page, pageSize }, auth: 'required' },
    z.object({ data: suggestedAnglersPageSchema })
  );
  return res.data;
}

/** fish `services/api/anglers.ts#followAngler` */
export function followAngler(t: Transport, documentId: string) {
  return call(t, { method: 'POST', path: `/feed/anglers/${enc(documentId)}/follow`, auth: 'required' }, followResultSchema);
}

/** fish `services/api/anglers.ts#unfollowAngler` */
export function unfollowAngler(t: Transport, documentId: string) {
  return call(t, { method: 'POST', path: `/feed/anglers/${enc(documentId)}/unfollow`, auth: 'required' }, followResultSchema);
}

/** fish `services/api/anglers.ts#getSuggestedHome` */
export function getSuggestedHome(t: Transport, { page, pageSize }: PageParams) {
  return call(
    t,
    { method: 'GET', path: '/feed/anglers/suggested-home', query: { page, pageSize }, auth: 'required' },
    suggestedAnglerPageSchema
  );
}

// ── services/api/profile.ts ─────────────────────────────────────────────────────────────────────────

/** fish `services/api/profile.ts#getProfile` */
export function getProfile(t: Transport) {
  return call(t, { method: 'GET', path: '/user/profile', auth: 'required' }, profileSchema);
}

/**
 * fish `services/api/profile.ts#updateProfile`. fish types the answer as `Profile`, but the CMS
 * answers 204 with no body — callers only ever relied on the `my-profile` invalidation.
 */
export async function updateProfile(t: Transport, profile: UpdateProfileRequest): Promise<void> {
  await call(t, { method: 'PATCH', path: '/user/profile', body: profile, auth: 'required' }, z.unknown());
}

/** fish `services/api/profile.ts#deleteProfile` — anonymises the account server-side. */
export function deleteProfile(t: Transport) {
  return call(t, { method: 'DELETE', path: '/user/profile', auth: 'required' }, z.unknown());
}

/** fish `services/api/profile.ts#requestOrganizerRole` */
export function requestOrganizerRole(t: Transport, message: string) {
  return call(
    t,
    { method: 'POST', path: '/user/organizer-request', body: { message }, auth: 'required' },
    organizerRoleRequestResponseSchema
  );
}

/** fish `services/api/profile.ts#getStatistics` — the path typo (`statitics`) is the real CMS route. */
export async function getStatistics(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/user/statitics', auth: 'required' },
    z.object({ data: userStatisticsSchema })
  );
  return res.data;
}

const statsMapSchema = z.record(z.string(), userStatisticsSchema);

/**
 * fish `services/api/profile.ts#postUserStatisticsBatch`. Strapi may return `{ data: Record }` or
 * the record at top level; anything else degrades to `{}`.
 */
export async function postUserStatisticsBatch(
  t: Transport,
  documentIds: string[]
): Promise<Record<string, ParticipantStats>> {
  const body = await call(
    t,
    { method: 'POST', path: '/user/statistics/batch', body: { documentIds }, auth: 'required' },
    z.unknown()
  );
  if (!body || typeof body !== 'object') return {};
  const map = (body as { data?: unknown }).data ?? body;
  const parsed = statsMapSchema.safeParse(map);
  return parsed.success ? parsed.data : {};
}

/** fish `services/api/profile.ts#getUSerStatuteForCompetition` */
export function getUSerStatuteForCompetition(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/user/profile/competition/${enc(competitionId)}/statute`, auth: 'required' },
    userStatuteForCompetitionSchema
  );
}

// ── services/api/users.ts ───────────────────────────────────────────────────────────────────────────

/**
 * fish `services/api/users.ts#getPaginatedUsers`. Hand-built query like fish; `search` is encoded
 * here (fish sends it raw, which breaks on `&`/`#`). The CMS strips non-word chars anyway.
 */
export function getPaginatedUsers(
  t: Transport,
  { page = 1, pageSize = 10, search = '' }: { page?: number; pageSize?: number; search?: string }
) {
  return call(
    t,
    { method: 'GET', path: `/user/all?page=${page}&pageSize=${pageSize}&search=${enc(search)}`, auth: 'required' },
    userPageSchema
  );
}

// ── services/api/notifications.ts ───────────────────────────────────────────────────────────────────

/**
 * fish `services/api/notifications.ts#getUnreadNotificationsForLoggedInUser`. fish also sets the
 * app-icon badge from the count (and to 0 on failure) — a native concern, left to the UI.
 */
export function getUnreadNotificationsForLoggedInUser(t: Transport) {
  return call(t, { method: 'GET', path: '/notification-users/unread', auth: 'required' }, unreadCountSchema);
}

/** fish `services/api/notifications.ts#getNotificationsForLoggedUser` */
export function getNotificationsForLoggedUser(t: Transport, pagination: { page?: number; pageSize?: number }) {
  return call(
    t,
    {
      method: 'GET',
      path: '/notification-users',
      query: { pagination: { page: pagination.page || 1, pageSize: pagination.pageSize || 20 } },
      auth: 'required',
    },
    notificationsPageSchema
  );
}

/** fish `services/api/notifications.ts#enableDisableNotifications` */
export function enableDisableNotifications(t: Transport, enabled: boolean) {
  return call(t, { method: 'PATCH', path: '/notifications/enable-disable-pns', body: { enabled }, auth: 'required' }, successSchema);
}

/** fish `services/api/notifications.ts#markNotificationAsRead` — takes the NOTIFICATION documentId
 * (`notification.notification.documentId`), not the notification-user row's. */
export function markNotificationAsRead(t: Transport, notificationId: string) {
  return call(
    t,
    { method: 'POST', path: `/notification-users/${enc(notificationId)}/mark-as-read`, auth: 'required' },
    successSchema
  );
}

/** fish `services/api/notifications.ts#markAllNotificationsAsRead` */
export function markAllNotificationsAsRead(t: Transport) {
  return call(t, { method: 'POST', path: '/notification-users/mark-all-as-read', auth: 'required' }, messageDataSchema);
}

// ── services/api/feedback.ts ────────────────────────────────────────────────────────────────────────

/** fish `services/api/feedback.ts#sendFeedback` */
export function sendFeedback(t: Transport, feedbackReqBody: Feedback) {
  return call(t, { method: 'POST', path: '/feedbacks', body: { data: feedbackReqBody }, auth: 'required' }, feedbackCreatedSchema);
}

// ── services/api/media.ts ───────────────────────────────────────────────────────────────────────────

/** fish `MediaFile`, web shape: the already-compressed bytes instead of an RN file URI. Without a
 *  `filename` the upload falls back to `image.jpg` (fish's default). */
export type MediaFile = { blob: Blob; filename?: string };

export type UploadMediaProps = {
  files: MediaFile[];
  /** The numeric ID of the entity to attach to (e.g. catch.id, profile.id), NOT the documentId. */
  id: number;
  /** The entity reference (e.g. "api::catch.catch"). */
  ref: string;
  /** The field to assign the media to (e.g. "media", "avatar"). */
  field: string;
};

function mediaFormData(files: MediaFile[]): FormData {
  const formData = new FormData();
  // fish falls back to `image.jpg` and always sends JPEG (the pickers re-encode to JPEG).
  for (const file of files) formData.append('files', file.blob, file.filename || 'image.jpg');
  return formData;
}

/** fish `services/api/media.ts#uploadMediaAndAttachToEntity` */
export function uploadMediaAndAttachToEntity(t: Transport, { files, id, ref, field }: UploadMediaProps) {
  const formData = mediaFormData(files);
  formData.append('ref', ref);
  formData.append('refId', id.toString());
  formData.append('field', field);
  formData.append('status', 'published');
  return call(t, { method: 'POST', path: '/upload', body: formData, auth: 'required' }, uploadResponseSchema);
}

/** fish `services/api/media.ts#uploadMedia` */
export function uploadMedia(t: Transport, { files }: { files: MediaFile[] }) {
  const formData = mediaFormData(files);
  formData.append('status', 'published');
  return call(t, { method: 'POST', path: '/upload', body: formData, auth: 'required' }, uploadResponseSchema);
}

// ── services/api/firebase-token.ts ──────────────────────────────────────────────────────────────────

/**
 * fish `services/api/firebase-token.ts#getFirebaseToken`. Re-mints a Firebase custom token for the
 * signed-in user (Strapi session but no live Firebase session). Null when the backend has none.
 */
export async function getFirebaseToken(t: Transport): Promise<string | null> {
  const res = await call(t, { method: 'GET', path: '/feed/firebase-token', auth: 'required' }, firebaseTokenResponseSchema);
  return res?.firebaseToken ?? null;
}

// ── services/api/reviews.ts (angler side) ───────────────────────────────────────────────────────────

/** fish `services/api/reviews.ts#createAnglerReview` — operator rates an angler for a completed booking. */
export async function createAnglerReview(t: Transport, input: CreateAnglerReviewInput) {
  const res = await call(
    t,
    { method: 'POST', path: '/feed/angler-reviews', body: { data: input }, auth: 'required' },
    z.object({ data: anglerReviewSchema })
  );
  return res.data;
}

/** fish `services/api/reviews.ts#getUserReputation` — public; `userId` is the user's documentId. */
export async function getUserReputation(t: Transport, userId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/users/${enc(userId)}/reputation`, auth: 'none' },
    z.object({ data: reputationSchema })
  );
  return res.data;
}

// ── services/api/widgetNotification.ts ─────────────────────────────────────────────────────────────

/**
 * fish `services/api/widgetNotification.ts#getMyWidgetNotification` — has the caller signed up for
 * this coming-soon widget? The route is `auth: false` with a manual JWT check, so a guest gets a 401,
 * which fish maps to «not registered».
 */
export async function getMyWidgetNotification(t: Transport, feature: FeatureKey): Promise<MyWidgetNotification> {
  try {
    const res = await call(
      t,
      { method: 'GET', path: '/feed/widget-notifications/mine', query: { feature }, auth: 'required' },
      z.object({ data: myWidgetNotificationSchema })
    );
    return res.data;
  } catch (error) {
    if (isApiError(error) && error.status === 401) return { feature, registered: false, registeredAt: null };
    throw error;
  }
}

/** fish `services/api/widgetNotification.ts#registerWidgetNotification` — idempotent server-side (one row per user + feature). */
export async function registerWidgetNotification(t: Transport, feature: FeatureKey) {
  const res = await call(
    t,
    { method: 'POST', path: '/feed/widget-notifications', body: { data: { feature } }, auth: 'required' },
    z.object({ data: registerWidgetNotificationResponseSchema })
  );
  return res.data;
}
