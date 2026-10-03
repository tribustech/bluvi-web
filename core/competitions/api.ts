import qs from 'qs';
import { z } from 'zod';
import type { PaginationParams } from '../shared';
import { call, callVoid, isApiError, parseResponse, type Transport } from '../transport';
import type { CompetitionCardsScope, CompetitionFilterValues, CompetitionSort, CompetitionsCommittedSearch } from './domain/filters';
import {
  bestNRankingResponseSchema,
  catchThresholdCountsResponseSchema,
  competitionCardSchema,
  competitionCardsPageSchema,
  competitionCatchesResponseSchema,
  competitionDetailSchema,
  competitionListResponseSchema,
  competitionMyStatusSchema,
  competitionSuggestionGroupSchema,
  followedCompetitionSchema,
  legacyCompetitionSchema,
  liveCompetitionSchema,
  myCompetitionsResponseSchema,
  notificationPreferencesSchema,
  pastPollsPageSchema,
  personSchema,
  pollSchema,
  pulsePersonSchema,
  rankingResponseSchema,
  registrationSchema,
  registrationWriteResultSchema,
  sponsorDashboardSchema,
  sponsorDetailSchema,
  standStatsSchema,
  timelineSnapshotSchema,
  weighingStatisticsResponseSchema,
  type CompetitionCardStatus,
  type CompetitionCatchesSort,
  type CompetitionMyStatus,
  type CompetitionRegistrationInput,
  type CreateGuestRegistrationPayload,
  type LiveCompetition,
  type PollSuggestRequest,
  type PollVoteRequest,
  type TimelineSnapshot,
  type CompetitionStatus,
  type UpdateCompetitionRegistrationInput,
  type UpdateGuestRegistrationPayload,
} from './schemas';
import { fishSpeciesSchema } from '../lakes/schemas';

const enc = encodeURIComponent;

/* ------------------------------------------------------------------ */
/* fish services/api/competitions.ts                                  */
/* ------------------------------------------------------------------ */

/** fish `services/api/competitions.ts#getCompetitionsList` (default export). Legacy route. */
export async function getCompetitionsList(t: Transport, pagination?: PaginationParams) {
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/competitions',
      query: {
        sort: ['startDate'],
        populate: { lake: true },
        pagination: { page: pagination?.page || 1, pageSize: pagination?.pageSize || 100 },
      },
      auth: 'optional',
    },
    z.object({ data: z.array(legacyCompetitionSchema) })
  );
  return res.data;
}

/** fish `services/api/competitions.ts#getCompetitionsByStatus`. `/feed/competitions` takes flat params. */
export function getCompetitionsByStatus(
  t: Transport,
  status: CompetitionStatus,
  pagination?: PaginationParams,
  lakeId?: string
) {
  return call(
    t,
    {
      method: 'GET',
      path: '/feed/competitions',
      query: {
        status,
        ...(lakeId ? { lakeId } : {}),
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 20,
      },
      auth: 'none',
    },
    competitionListResponseSchema
  );
}

/** fish `services/api/competitions.ts#getFutureCompetitions` */
export const getFutureCompetitions = (
  t: Transport,
  { pagination, lakeId }: { pagination?: PaginationParams; lakeId?: string }
) => getCompetitionsByStatus(t, 'notStarted', pagination, lakeId);

/** fish `services/api/competitions.ts#getMyCompetitions` */
export function getMyCompetitions(t: Transport, pagination?: PaginationParams) {
  return call(
    t,
    {
      method: 'GET',
      path: '/competitions/me',
      query: { pagination: { page: pagination?.page || 1, pageSize: pagination?.pageSize || 10 } },
      auth: 'required',
    },
    myCompetitionsResponseSchema
  );
}

/** fish `services/api/competitions.ts#getCompetition` — the shared detail core. */
export async function getCompetition(t: Transport, competitionId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/competitions/${enc(competitionId)}`, auth: 'none' },
    z.object({ data: competitionDetailSchema })
  );
  return res.data;
}

/** What a signed-out (or dead-token) viewer's overlay is by definition. */
export const SIGNED_OUT_MY_STATUS: CompetitionMyStatus = { isFollowing: false, userRegistrationStatus: null };

/** fish `services/api/competitions.ts#getCompetitionMyStatus` */
export async function getCompetitionMyStatus(t: Transport, competitionId: string): Promise<CompetitionMyStatus> {
  try {
    const res = await call(
      t,
      { method: 'GET', path: `/feed/competitions/${enc(competitionId)}/my-status`, auth: 'required' },
      z.object({ data: competitionMyStatusSchema })
    );
    return res.data;
  } catch (error) {
    // Anonymous / non-participant context: the endpoint requires a bearer token.
    // If it 401s, default to the not-following / no-registration state
    // so consumers reading competition.isFollowing / userRegistrationStatus stay safe.
    if (isApiError(error) && error.status === 401) return SIGNED_OUT_MY_STATUS;
    throw error;
  }
}

/** fish `services/api/competitions.ts#getCompetitionRegistrations` */
export function getCompetitionRegistrations(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/competitions/${enc(competitionId)}/registrations`, auth: 'required' },
    z.array(registrationSchema)
  );
}

/** fish `services/api/competitions.ts#getFishSpecies` */
export async function getFishSpecies(t: Transport, competitionId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/competitions/${enc(competitionId)}/fish-species`, auth: 'none' },
    z.object({ data: z.object({ fishSpecies: z.array(fishSpeciesSchema) }) })
  );
  return res.data.fishSpecies;
}

/** fish `services/api/competitions.ts#getLiveCompetition` — null when nothing is live (or 404). */
export async function getLiveCompetition(t: Transport): Promise<LiveCompetition | null> {
  try {
    const data = await call(
      t,
      { method: 'GET', path: '/competitions/live', auth: 'required' },
      z.object({ competition: z.unknown().nullish() }).loose()
    );
    if (!data?.competition) return null;
    return parseResponse(liveCompetitionSchema, data, '/competitions/live');
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** fish `services/api/competitions.ts#followCompetition` */
export function followCompetition(t: Transport, competitionId: string, follow: boolean) {
  return call(
    t,
    { method: 'POST', path: `/competitions/${enc(competitionId)}/follow`, body: { follow }, auth: 'required' },
    z.object({ isFollowing: z.boolean() })
  );
}

/* ------------------------------------------------------------------ */
/* fish services/api/competitionCards.ts                              */
/* ------------------------------------------------------------------ */

export type CompetitionCardsParams = {
  scope: CompetitionCardsScope;
  status?: CompetitionCardStatus;
  search: CompetitionsCommittedSearch;
  filters: CompetitionFilterValues;
  sort: CompetitionSort;
  page?: number;
  pageSize?: number;
};

/**
 * fish `services/api/competitionCards.ts#buildCompetitionCardsQuery`.
 *
 * `'all'` values and nulls are dropped rather than sent, so a default query
 * always produces the SAME url — otherwise every client would mint its own edge
 * cache entry for an identical request.
 */
export function buildCompetitionCardsQuery(params: CompetitionCardsParams): string {
  const { search, filters } = params;

  return qs.stringify(
    {
      status: params.status,
      lakeId: search?.type === 'lake' ? search.value : undefined,
      organizerId: search?.type === 'organizer' ? search.value : undefined,
      q: search?.type === 'text' ? search.value : undefined,
      period: filters.period !== 'all' ? filters.period : undefined,
      format: filters.format !== 'all' ? filters.format : undefined,
      availableOnly: filters.availableOnly ? 'true' : undefined,
      countyId: filters.countyId ?? undefined,
      sort: params.sort !== 'date' ? params.sort : undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      scope: params.scope !== 'all' ? params.scope : undefined,
    },
    { skipNulls: true, encodeValuesOnly: true }
  );
}

/**
 * fish `services/api/competitionCards.ts#getCompetitionCards`.
 *
 * `/feed/competition-cards` is public and edge-cached; `/feed/my-competition-cards`
 * is per-user and never cached. They return the SAME body.
 */
export function getCompetitionCards(t: Transport, params: CompetitionCardsParams) {
  const isPublic = params.scope === 'all';
  const path = isPublic ? '/feed/competition-cards' : '/feed/my-competition-cards';
  return call(
    t,
    { method: 'GET', path: `${path}?${buildCompetitionCardsQuery(params)}`, auth: isPublic ? 'none' : 'required' },
    competitionCardsPageSchema
  );
}

/** fish `services/api/competitionCards.ts#getCompetitionSuggestions` */
export async function getCompetitionSuggestions(t: Transport, q: string) {
  const query = q.trim() ? `?${qs.stringify({ q: q.trim() }, { encodeValuesOnly: true })}` : '';
  const res = await call(
    t,
    { method: 'GET', path: `/feed/competition-suggestions${query}`, auth: 'none' },
    z.object({ data: z.object({ groups: z.array(competitionSuggestionGroupSchema) }).nullish() }).nullish()
  );
  return res?.data?.groups ?? [];
}

/* ------------------------------------------------------------------ */
/* fish services/api/featuredCompetition.ts + pulsePerson.ts           */
/* ------------------------------------------------------------------ */

/**
 * fish `services/api/featuredCompetition.ts#getFeaturedCompetition`.
 * `null` on an empty pool — the endpoint answers 200 with an explicit null rather than 404.
 * Public and edge-cached 1800s: must NOT be skipped when signed out.
 */
export async function getFeaturedCompetition(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/featured-competition', auth: 'none' },
    z.object({ data: competitionCardSchema.nullable() }).nullish()
  );
  return res?.data ?? null;
}

/**
 * fish `services/api/pulsePerson.ts#getPulsePerson`.
 * The server draws ONE of ten criteria per request and ships finished Romanian copy.
 * `null` on an empty database.
 */
export async function getPulsePerson(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/pulse-person', auth: 'none' },
    z.object({ data: pulsePersonSchema.nullable() }).nullish()
  );
  return res?.data ?? null;
}

/* ------------------------------------------------------------------ */
/* fish services/api/rankings.ts                                      */
/* ------------------------------------------------------------------ */

/** fish `services/api/rankings.ts#getRankings` (default export) */
export function getRankings(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/competitions/${enc(competitionId)}/ranking`, auth: 'none' },
    rankingResponseSchema
  );
}

/** fish `services/api/rankings.ts#getRankingBestN` */
export function getRankingBestN(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/competitions/${enc(competitionId)}/ranking/best-n`, auth: 'none' },
    bestNRankingResponseSchema
  );
}

/** Filter for competition catches: sector (by name) or stand (by display key e.g. "A2"). */
export type CompetitionCatchesFilter = { sectorName: string } | { standKey: string } | null;

/** fish `services/api/rankings.ts#getCompetitionCatches` */
export function getCompetitionCatches(
  t: Transport,
  competitionId: string,
  sort: CompetitionCatchesSort,
  page: number,
  pageSize: number = 20,
  filter: CompetitionCatchesFilter = null
) {
  const params: Record<string, string | number> = { sort, page, pageSize };
  if (filter) {
    if ('sectorName' in filter) params.sectorName = filter.sectorName;
    if ('standKey' in filter) params.standKey = filter.standKey;
  }
  return call(
    t,
    { method: 'GET', path: `/competitions/${enc(competitionId)}/catches`, query: params, auth: 'none' },
    competitionCatchesResponseSchema
  );
}

/** fish `services/api/rankings.ts#getCompetitionWeighingStatistics` */
export function getCompetitionWeighingStatistics(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/competitions/${enc(competitionId)}/weighing-statistics`, auth: 'none' },
    weighingStatisticsResponseSchema
  );
}

/** fish `services/api/rankings.ts#getCatchThresholdCounts` */
export function getCatchThresholdCounts(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/competitions/${enc(competitionId)}/catch-threshold-counts`, auth: 'none' },
    catchThresholdCountsResponseSchema
  );
}

/**
 * fish `services/api/rankings.ts#getCompetitionTimelineSnapshot` — null on 204 / no snapshot.
 * `optional`: the route has no `auth: false` and is not edge-cached, so fish's signed-in JWT is sent.
 */
export async function getCompetitionTimelineSnapshot(t: Transport, competitionId: string): Promise<TimelineSnapshot | null> {
  const res = await call(
    t,
    { method: 'GET', path: `/competitions/${enc(competitionId)}/timeline-snapshot`, auth: 'optional' },
    // A 204 reaches the schema as `null`.
    z.object({ data: timelineSnapshotSchema.nullish() }).nullish()
  );
  return res?.data ?? null;
}

/* ------------------------------------------------------------------ */
/* fish services/api/registrations.ts                                 */
/* ------------------------------------------------------------------ */

/** fish `services/api/registrations.ts#createCompetitionRegistration` */
export function createCompetitionRegistration(t: Transport, data: CompetitionRegistrationInput) {
  return call(t, { method: 'POST', path: '/registrations', body: { data }, auth: 'required' }, registrationWriteResultSchema);
}

/** fish `services/api/registrations.ts#updateCompetitionRegistration` */
export function updateCompetitionRegistration(t: Transport, data: UpdateCompetitionRegistrationInput) {
  return call(
    t,
    {
      method: 'PUT',
      path: `/registrations/${enc(data.registrationId)}`,
      body: { data: { competition: data.competition, participants: data.participants, teamName: data.teamName } },
      auth: 'required',
    },
    registrationWriteResultSchema
  );
}

/** fish `services/api/registrations.ts#removeRegistration` (leave a competition) */
export function removeRegistration(t: Transport, registrationId: string) {
  return callVoid(t, { method: 'PATCH', path: `/registrations/${enc(registrationId)}/leave`, auth: 'required' });
}

/** fish `services/api/registrations.ts#acceptRegistration` */
export function acceptRegistration(t: Transport, registrationId: string) {
  return callVoid(t, { method: 'PATCH', path: `/registrations/${enc(registrationId)}/accept`, auth: 'required' });
}

/** fish `services/api/registrations.ts#rejectRegistration` */
export function rejectRegistration(t: Transport, registrationId: string) {
  return callVoid(t, { method: 'PATCH', path: `/registrations/${enc(registrationId)}/reject`, auth: 'required' });
}

/** fish `services/api/registrations.ts#moveRegistrationToWaitingList` */
export function moveRegistrationToWaitingList(t: Transport, registrationId: string) {
  return callVoid(t, { method: 'PATCH', path: `/registrations/${enc(registrationId)}/pending`, auth: 'required' });
}

/** fish `services/api/registrations.ts#addGuestRegistration` */
export function addGuestRegistration(t: Transport, payload: CreateGuestRegistrationPayload) {
  return callVoid(t, { method: 'POST', path: '/registrations/guests', body: { data: payload }, auth: 'required' });
}

/** fish `services/api/registrations.ts#updateGuestRegistration` */
export function updateGuestRegistration(t: Transport, payload: UpdateGuestRegistrationPayload) {
  return callVoid(t, {
    method: 'PUT',
    path: `/registrations/guests/${enc(payload.registrationId)}`,
    body: { data: { guestName: payload.guestName, teamName: payload.teamName } },
    auth: 'required',
  });
}

/* ------------------------------------------------------------------ */
/* fish services/api/stands.ts                                        */
/* ------------------------------------------------------------------ */

/** fish `services/api/stands.ts#getStandStatsByLakeId` */
export function getStandStatsByLakeId(t: Transport, lakeId: string) {
  return call(t, { method: 'GET', path: `/lakes/${enc(lakeId)}/statistics`, auth: 'none' }, z.array(standStatsSchema));
}

/* ------------------------------------------------------------------ */
/* fish services/api/polls.ts                                         */
/* ------------------------------------------------------------------ */

/**
 * fish `services/api/polls.ts#getCurrentPoll`. Public on staging/prod (Public role grant; fish shows
 * the poll to guests) but personalised (`myVoteOptionId`) when signed in, so `'optional'`: never
 * served from the shared public cache. The local CMS lacks the Public grant (guest → 403).
 */
export async function getCurrentPoll(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/polls/current', auth: 'optional' },
    z.object({ data: pollSchema.nullable() })
  );
  return res.data;
}

/** fish `services/api/polls.ts#getPastPolls` */
export function getPastPolls(t: Transport, { page = 1, pageSize = 10 }: PaginationParams = {}) {
  return call(t, { method: 'GET', path: '/polls/past', query: { page, pageSize }, auth: 'required' }, pastPollsPageSchema);
}

/** fish `services/api/polls.ts#castPollVote` */
export function castPollVote(t: Transport, { pollId, optionId }: PollVoteRequest) {
  return callVoid(t, { method: 'PUT', path: `/polls/${enc(pollId)}/vote`, body: { optionId }, auth: 'required' });
}

/** fish `services/api/polls.ts#submitPollSuggestion` */
export function submitPollSuggestion(t: Transport, { pollId, text }: PollSuggestRequest) {
  return callVoid(t, { method: 'POST', path: `/polls/${enc(pollId)}/suggest`, body: { text }, auth: 'required' });
}

/* ------------------------------------------------------------------ */
/* fish services/api/sponsors.ts                                      */
/* ------------------------------------------------------------------ */

/** fish `services/api/sponsors.ts#getSponsors` (default export) */
export function getSponsors(t: Transport) {
  return call(
    t,
    { method: 'GET', path: '/feed/sponsors/dashboard', auth: 'none' },
    z.object({ data: z.array(sponsorDashboardSchema) })
  );
}

/** fish `services/api/sponsors.ts#getSponsorById` */
export function getSponsorById(t: Transport, id: string) {
  return call(t, { method: 'GET', path: `/feed/sponsors/${enc(id)}`, auth: 'none' }, z.object({ data: sponsorDetailSchema }));
}

/* ------------------------------------------------------------------ */
/* fish services/api/followers.ts                                     */
/* ------------------------------------------------------------------ */

/** fish `services/api/followers.ts#getFollowers` — competition followers + registered participants. */
export async function getFollowers(t: Transport, competitionId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/competitions/${enc(competitionId)}/followers`, auth: 'none' },
    z.object({ data: z.array(personSchema).nullish() }).nullish()
  );
  return res?.data ?? [];
}

/* ------------------------------------------------------------------ */
/* fish services/api/notification-preferences.ts                      */
/* ------------------------------------------------------------------ */

/** fish `services/api/notification-preferences.ts#getCompetitionNotificationPreferences` */
export function getCompetitionNotificationPreferences(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/feed/competitions/${enc(competitionId)}/notification-preferences`, auth: 'required' },
    notificationPreferencesSchema
  );
}

/** fish `services/api/notification-preferences.ts#updateCompetitionNotificationPreferences` */
export function updateCompetitionNotificationPreferences(t: Transport, competitionId: string, mutedTypes: string[]) {
  return call(
    t,
    {
      method: 'PUT',
      path: `/feed/competitions/${enc(competitionId)}/notification-preferences`,
      body: { mutedTypes },
      auth: 'required',
    },
    notificationPreferencesSchema
  );
}

/** fish `services/api/notification-preferences.ts#getFollowedCompetitions` */
export async function getFollowedCompetitions(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/followed-competitions', auth: 'required' },
    z.object({ data: z.array(followedCompetitionSchema).nullish() }).nullish()
  );
  return res?.data ?? [];
}
