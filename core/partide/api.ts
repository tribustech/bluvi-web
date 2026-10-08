import * as z from 'zod';
import { getAnglerFollowing } from '../social/api';
import { call, callVoid, type Transport } from '../transport';
import type { EventUpsertBody, SessionUpsertBody } from './domain/upsertBodies';
import { communityVenueKey, communityVenuePath, venueParamsSerializer, type CommunityVenueRef } from './domain/venueKeys';
import {
  activeSessionDTOSchema,
  communityActivePageSchema,
  communityHistoryPageSchema,
  communityLakeSectionDTOSchema,
  communityOverviewDTOSchema,
  communitySessionDetailDTOSchema,
  communityStatsDTOSchema,
  eventDTOSchema,
  formatTextResponseSchema,
  joinCodeRotationDTOSchema,
  lakeCatchesPageSchema,
  leaveSessionDTOSchema,
  markerDTOSchema,
  membershipMutationDTOSchema,
  myCatchesPageSchema,
  mySessionFollowsSchema,
  mySessionsPageSchema,
  patchRodsResultSchema,
  sessionCatchesPageSchema,
  sessionCreateJoinDTOSchema,
  sessionDetailDTOSchema,
  sessionPhotoUploadSchema,
  type SessionListItemDTO,
  type StatsPeriod,
} from './schemas';

const seg = encodeURIComponent;

// ── /feed/sessions/* (per-user, membership-gated) ───────────────────────────

/**
 * fish `services/api/partide.ts#getMySessions`
 * fish guarded against `{ data: null }` (a backend lacking the route matching `:documentId`);
 * the zod schema rejects that shape the same way, as a failed query.
 */
export function getMySessions(t: Transport, page = 1, pageSize = 50) {
  return call(t, { method: 'GET', path: '/feed/sessions/mine', query: { page, pageSize }, auth: 'required' }, mySessionsPageSchema);
}

/**
 * fish `services/api/partide.ts#getAllMySessions`
 * Pulls the FULL lean list by looping getMySessions from page 1, concatenating `data` until a
 * page returns fewer than `pageSize` rows (robust to a session added mid-pull). Returns the last
 * page's `meta.total`.
 */
export async function getAllMySessions(t: Transport, pageSize = 100): Promise<{ data: SessionListItemDTO[]; total: number }> {
  const all: SessionListItemDTO[] = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const body = await getMySessions(t, page, pageSize);
    all.push(...body.data);
    total = body.meta.total;
    // Primary terminator: a short final page reliably ends the loop.
    if (body.data.length < pageSize) break;
    // Secondary guard: a buggy server that always returns full pages can't loop forever.
    if (all.length >= total) break;
    page += 1;
  }
  return { data: all, total };
}

/** fish `services/api/partide.ts#getSession` — the full detail with events. */
export async function getSession(t: Transport, documentId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/sessions/${seg(documentId)}`, auth: 'required' },
    z.object({ data: sessionDetailDTOSchema })
  );
  return res.data;
}

/** fish `services/api/partide.ts#upsertEvent` */
export async function upsertEvent(t: Transport, sessionDocumentId: string, body: EventUpsertBody) {
  const res = await call(
    t,
    { method: 'POST', path: `/feed/sessions/${seg(sessionDocumentId)}/events`, body: { data: body }, auth: 'required' },
    z.object({ data: eventDTOSchema })
  );
  return res.data;
}

/** fish `services/api/partide.ts#deleteEvent` */
export function deleteEvent(t: Transport, sessionDocumentId: string, eventDocumentId: string) {
  return callVoid(t, {
    method: 'DELETE',
    path: `/feed/sessions/${seg(sessionDocumentId)}/events/${seg(eventDocumentId)}`,
    auth: 'required',
  });
}

/** fish `services/api/partide.ts#upsertMarker` */
export async function upsertMarker(t: Transport, body: Record<string, unknown>) {
  const res = await call(t, { method: 'POST', path: '/feed/map-markers', body: { data: body }, auth: 'required' }, z.object({ data: markerDTOSchema }));
  return res.data;
}

/** fish `services/api/partide.ts#getMarkers` */
export async function getMarkers(t: Transport, venue: { lakeId?: string; publicWaterCode?: string; bbox?: string }) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/map-markers', query: venue, auth: 'required' },
    z.object({ data: z.array(markerDTOSchema) })
  );
  return res.data;
}

/** fish `services/api/partide.ts#deleteMarker` */
export function deleteMarker(t: Transport, documentId: string) {
  return callVoid(t, { method: 'DELETE', path: `/feed/map-markers/${seg(documentId)}`, auth: 'required' });
}

// --- Partide co-op live-session control plane ---
// Postgres is truth: the CMS owns every write and rebuilds a Firestore PROJECTION per live
// session. The client writes NOTHING to Firestore for sessions/catches.

/** fish `services/api/partide.ts#createSession` — carries `firestoreId`, `joinCode`, `status`, `members`. */
export async function createSession(t: Transport, body: SessionUpsertBody) {
  const res = await call(t, { method: 'POST', path: '/feed/sessions', body: { data: body }, auth: 'required' }, z.object({ data: sessionCreateJoinDTOSchema }));
  return res.data;
}

/**
 * fish `services/api/partide.ts#getActiveSession` — the ids of the caller's live partidă, or null.
 * fish took an explicit `jwt` to beat an AsyncStorage race at sign-in; here the transport owns
 * the session, so the parameter is gone.
 */
export async function getActiveSession(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/sessions/active', auth: 'required' },
    z.object({ data: activeSessionDTOSchema.nullable() })
  );
  return res.data ?? null;
}

/**
 * fish `services/api/partide.ts#joinSession` — on an invalid / ended / full code the CMS replies
 * with a `PARTIDA:*` bluCode error; it propagates as `ApiError.bluCode` for the UI to map
 * (`domain/partidaJoinError.ts`).
 */
export async function joinSession(t: Transport, code: string) {
  const res = await call(t, { method: 'POST', path: '/feed/sessions/join', body: { data: { code } }, auth: 'required' }, z.object({ data: sessionCreateJoinDTOSchema }));
  return res.data;
}

/**
 * fish `services/api/partide.ts#finishSession` — finish + archive. `documentId` is the Strapi
 * documentId (NOT the firestoreId). Only the session owner may finish.
 */
export async function finishSession(t: Transport, documentId: string) {
  const res = await call(t, { method: 'POST', path: `/feed/sessions/${seg(documentId)}/finish`, auth: 'required' }, z.object({ data: sessionDetailDTOSchema }));
  return res.data;
}

/** fish `services/api/partide.ts#extendSession` — "Da, continui" on the auto-close sheet. */
export function extendSession(t: Transport, documentId: string) {
  return callVoid(t, { method: 'POST', path: `/feed/sessions/${seg(documentId)}/extend`, auth: 'required' });
}

/** fish `services/api/partide.ts#deleteSession` — owner-only permanent delete (live or finished). */
export function deleteSession(t: Transport, documentId: string) {
  return callVoid(t, { method: 'DELETE', path: `/feed/sessions/${seg(documentId)}`, auth: 'required' });
}

/** fish `services/api/partide.ts#leaveSession` */
export async function leaveSession(t: Transport, documentId: string) {
  const res = await call(t, { method: 'POST', path: `/feed/sessions/${seg(documentId)}/leave`, auth: 'required' }, z.object({ data: leaveSessionDTOSchema }));
  return res.data;
}

/** fish `services/api/partide.ts#kickSessionMember` — owner removes a member. */
export async function kickSessionMember(t: Transport, documentId: string, userDocumentId: string) {
  const res = await call(
    t,
    { method: 'DELETE', path: `/feed/sessions/${seg(documentId)}/members/${seg(userDocumentId)}`, auth: 'required' },
    z.object({ data: membershipMutationDTOSchema })
  );
  return res.data;
}

/** fish `services/api/partide.ts#rotateSessionJoinCode` */
export async function rotateSessionJoinCode(t: Transport, documentId: string) {
  const res = await call(
    t,
    { method: 'POST', path: `/feed/sessions/${seg(documentId)}/join-code/rotate`, auth: 'required' },
    z.object({ data: joinCodeRotationDTOSchema })
  );
  return res.data;
}

/**
 * fish `services/api/partide.ts#uploadSessionPhoto` — detached multipart upload of one co-op catch
 * photo; the returned numeric file id is attached to the catch with `patchEventPhoto`.
 * fish built the part from a local file uri; the web passes the `Blob`/`File` itself.
 * The handler answers with the bare object (NOT the `{ data }` envelope).
 */
export async function uploadSessionPhoto(t: Transport, file: Blob, fileName = `partida-${Date.now()}.jpg`) {
  const formData = new FormData();
  formData.append('files', file, fileName);
  const d = await call(t, { method: 'POST', path: '/feed/sessions/photo', body: formData, auth: 'required' }, sessionPhotoUploadSchema);
  return { fileId: d.fileId, url: d.url, thumbUrl: d.thumbUrl ?? null };
}

/**
 * fish `services/api/partide.ts#patchRods` — per-rod merge by `index`; returns the merged rods plus
 * the server's clock (`serverNow`, feed it to `ServerClock.noteServerNow`).
 */
export async function patchRods(t: Transport, sessionDocumentId: string, rods: Record<string, unknown>[]) {
  const res = await call(
    t,
    { method: 'PATCH', path: `/feed/sessions/${seg(sessionDocumentId)}/rods`, body: { data: { rods } }, auth: 'required' },
    z.object({ data: patchRodsResultSchema })
  );
  return res.data;
}

/** fish `services/api/partide.ts#patchSession` — session meta corrections (notes, venue, endedAt, …). */
export function patchSession(t: Transport, sessionDocumentId: string, data: Record<string, unknown>) {
  return callVoid(t, { method: 'PATCH', path: `/feed/sessions/${seg(sessionDocumentId)}`, body: { data }, auth: 'required' });
}

/** fish `services/api/partide.ts#deleteEventByClientId` — the only id the live client holds. */
export function deleteEventByClientId(t: Transport, sessionDocumentId: string, clientId: string) {
  return callVoid(t, {
    method: 'DELETE',
    path: `/feed/sessions/${seg(sessionDocumentId)}/events/by-client/${seg(clientId)}`,
    auth: 'required',
  });
}

/**
 * fish `services/api/partide.ts#patchEventPhoto` — sends ONLY the photo field, so a teammate's
 * concurrent weight/species edit is never overwritten.
 */
export function patchEventPhoto(t: Transport, sessionDocumentId: string, eventDocumentId: string, fileId: number) {
  return callVoid(t, {
    method: 'PATCH',
    path: `/feed/sessions/${seg(sessionDocumentId)}/events/${seg(eventDocumentId)}`,
    body: { data: { photo: fileId } },
    auth: 'required',
  });
}

/**
 * fish `services/api/partide.ts#patchEventTags` — re-resolve who's tagged in an ALREADY-SAVED
 * catch. The PATCH route only re-resolves when given a real array, and resolves `[]` against the
 * roster AT PATCH TIME (retroactively tagging later joiners) — never send a bare `[]`; reset
 * "Toți" with the roster's explicit uid list (`domain/captureEdits.ts#applyCaptureUpdate`).
 */
export function patchEventTags(t: Transport, sessionDocumentId: string, eventDocumentId: string, photoTagUids: string[]) {
  return callVoid(t, {
    method: 'PATCH',
    path: `/feed/sessions/${seg(sessionDocumentId)}/events/${seg(eventDocumentId)}`,
    body: { data: { photoTagUids } },
    auth: 'required',
  });
}

/**
 * fish `services/api/partide.ts#getMyCatches` — every catch of MINE with a photo, including ones
 * from partide hidden from my public profile. Deliberately NOT `getAnglerCatches(me)`, which
 * filters on `visibleOnProfile`. Same DTO and opaque cursor as the profile grid.
 */
export function getMyCatches(t: Transport, { cursor, pageSize }: { cursor?: string | null; pageSize: number }) {
  return call(
    t,
    { method: 'GET', path: '/feed/sessions/mine/catches', query: { pageSize, ...(cursor ? { cursor } : {}) }, auth: 'required' },
    myCatchesPageSchema
  );
}

// ── session follows ─────────────────────────────────────────────────────────

/** fish `services/api/sessionFollows.ts#getMySessionFollows` */
export async function getMySessionFollows(t: Transport): Promise<string[]> {
  const res = await call(t, { method: 'GET', path: '/feed/session-follows/mine', auth: 'required' }, mySessionFollowsSchema);
  return res.data.sessionDocumentIds;
}

/** fish `services/api/sessionFollows.ts#followSession` */
export function followSession(t: Transport, documentId: string) {
  return callVoid(t, { method: 'POST', path: `/feed/sessions/${seg(documentId)}/follow`, auth: 'required' });
}

/** fish `services/api/sessionFollows.ts#unfollowSession` */
export function unfollowSession(t: Transport, documentId: string) {
  return callVoid(t, { method: 'POST', path: `/feed/sessions/${seg(documentId)}/unfollow`, auth: 'required' });
}

// ── /feed/community/* — public (`auth: false`), edge-cached ────────────────

/** fish `services/api/community.ts#getCommunityOverview` */
export async function getCommunityOverview(t: Transport) {
  const res = await call(t, { method: 'GET', path: '/feed/community/overview', auth: 'none' }, z.object({ data: communityOverviewDTOSchema }));
  return res.data;
}

/**
 * fish `services/api/community.ts#getCommunityActive` — cursor-paginated live venues.
 * `cursor` is opaque; `venues` narrows server-side on MANY keys (repeated `?venue=`), so the
 * query string is hand-built with the repeated-param serializer instead of qs brackets.
 */
export function getCommunityActive(
  t: Transport,
  { cursor, pageSize, venues }: { cursor?: string | null; pageSize: number; venues?: string[] }
) {
  const qs = venueParamsSerializer({
    pageSize,
    ...(cursor ? { cursor } : {}),
    ...(venues?.length ? { venue: venues } : {}),
  });
  return call(t, { method: 'GET', path: `/feed/community/active?${qs}`, auth: 'none' }, communityActivePageSchema);
}

/** fish `services/api/community.ts#getCommunityVenueSection` */
export async function getCommunityVenueSection(t: Transport, ref: CommunityVenueRef) {
  const res = await call(t, { method: 'GET', path: communityVenuePath(ref), auth: 'none' }, z.object({ data: communityLakeSectionDTOSchema }));
  return res.data;
}

/** fish `services/api/community.ts#getCommunitySession` */
export async function getCommunitySession(t: Transport, documentId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/community/sessions/${seg(documentId)}`, auth: 'none' },
    z.object({ data: communitySessionDetailDTOSchema })
  );
  return res.data;
}

/**
 * fish `services/api/community.ts#getSessionCatches` — the full, cursor-paginated catch list
 * behind the detail screen's "Vezi toate" row. `photosOnly` maps to `photos=1`.
 */
export function getSessionCatches(
  t: Transport,
  documentId: string,
  opts: { cursor?: string | null; pageSize?: number; photosOnly?: boolean }
) {
  return call(
    t,
    {
      method: 'GET',
      path: `/feed/community/sessions/${seg(documentId)}/catches`,
      query: {
        pageSize: opts.pageSize ?? 20,
        ...(opts.cursor ? { cursor: opts.cursor } : {}),
        ...(opts.photosOnly ? { photos: 1 } : {}),
      },
      auth: 'none',
    },
    sessionCatchesPageSchema
  );
}

/** fish `services/api/community.ts#getCommunityStats` — "Statistici comunitate" + "Clasamente". */
export async function getCommunityStats(t: Transport, period: StatsPeriod, venue?: CommunityVenueRef | null) {
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/feed/community/stats',
      query: { period, ...(venue ? { venue: communityVenueKey(venue) } : {}) },
      auth: 'none',
    },
    z.object({ data: communityStatsDTOSchema })
  );
  return res.data;
}

/**
 * fish `services/api/community.ts#getCommunityHistory` — paginated feed of ALL finished, public
 * partide. `venues` narrows server-side on MANY keys (repeated `?venue=`).
 */
export function getCommunityHistory(
  t: Transport,
  { page, pageSize, venues }: { page: number; pageSize: number; venues?: string[] }
) {
  const qs = venueParamsSerializer({ page, pageSize, ...(venues?.length ? { venue: venues } : {}) });
  return call(t, { method: 'GET', path: `/feed/community/history?${qs}`, auth: 'none' }, communityHistoryPageSchema);
}

/** fish `services/api/community.ts#getCommunityVenueCatches` — paginated photo catches at a venue. */
export function getCommunityVenueCatches(t: Transport, ref: CommunityVenueRef, params: { page: number; pageSize: number }) {
  return call(t, { method: 'GET', path: `${communityVenuePath(ref)}/catches`, query: params, auth: 'none' }, lakeCatchesPageSchema);
}

// ── following set for the community "prieteni" chip ────────────────────────

/**
 * fish `features/partide/community/hooks.ts#fetchAllFollowingUids` (via `services/api/anglers.ts#getAnglerFollowing`,
 * core/social's `getAnglerFollowing`). The "prieteni" filter needs the whole following set, so every
 * page is walked up front; only `documentId` is read here.
 */
export async function fetchAllFollowingUids(t: Transport, myDocumentId: string, pageSize = 100): Promise<Set<string>> {
  const uids = new Set<string>();
  let page = 1;
  for (;;) {
    const result = await getAnglerFollowing(t, myDocumentId, { page, pageSize });
    result.data.forEach(item => uids.add(item.documentId));
    if (page >= result.meta.pagination.pageCount) break;
    page += 1;
  }
  return uids;
}

// ── AI (fish `services/api/catch.ts#deleteCatch` is core/organizer's `deleteCatch`) ──

/** fish `services/api/ai.ts#formatText` — note the body is NOT wrapped in `{ data }`. */
export async function formatText(t: Transport, text: string): Promise<string> {
  const res = await call(t, { method: 'POST', path: '/ai/format-text', body: { text }, auth: 'required' }, formatTextResponseSchema);
  return res.data.formatted;
}
