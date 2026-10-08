import * as z from 'zod';
import { paginationMetaSchema } from '../shared';
import { call, callVoid, type Transport } from '../transport';
import { normalizePaginatedResponse } from './domain/organizer';
import { sumWeighingsTotal } from './domain/weighing';
import {
  allocatedParticipantsResponseSchema,
  cancelOrganizerCompetitionResponseSchema,
  competitionActiveWeighingSchema,
  createdCatchesSchema,
  deleteCantarResponseSchema,
  deleteCatchResponseSchema,
  extraScaleWriteResponseSchema,
  messageResponseSchema,
  organizerCompetitionSchema,
  organizerCompetitionSourceDetailSchema,
  organizerDashboardStatsSchema,
  organizerRecentLakeSchema,
  organizerStatDetailItemSchema,
  organizerUpdateCompetitionResponseSchema,
  startedWeighingSchema,
  weighingByStandSchema,
  weighingDetailSchema,
  weighingRevisionsResponseSchema,
  weighingsSummaryItemSchema,
  type AllocateStandsToSectorsRequest,
  type AllocateStandToRegistrationRequest,
  type CatchData,
  type CreateDraftPayload,
  type DraftCompetition,
  type OrganizerCompetitionSourceDetail,
  type OrganizerCompetitionSourceSummary,
  type OrganizerStatKey,
  type UpdateDraftPayload,
} from './schemas';
import { extraScaleSchema, penaltySchema, type PenaltyAction } from '../competitions/schemas';

const id = encodeURIComponent;

/* ================================================================== */
/* Organizer — fish services/api/organizer.ts                          */
/* ================================================================== */

const draftEnvelope = z.object({ data: organizerCompetitionSchema });

/** fish `services/api/organizer.ts#getDraft` */
export async function getDraft(t: Transport, draftId: string): Promise<DraftCompetition> {
  const res = await call(
    t,
    { method: 'GET', path: `/competitions/organizer/draft/${id(draftId)}`, auth: 'required' },
    draftEnvelope
  );
  return res.data;
}

/** fish `services/api/organizer.ts#createDraft` */
export async function createDraft(t: Transport, data: CreateDraftPayload | Record<string, unknown>) {
  const res = await call(
    t,
    { method: 'POST', path: '/competitions/organizer/draft', body: { data }, auth: 'required' },
    draftEnvelope
  );
  return res.data;
}

/** fish `services/api/organizer.ts#updateDraft` */
export async function updateDraft(t: Transport, draftId: string, data: UpdateDraftPayload | Record<string, unknown>) {
  const res = await call(
    t,
    { method: 'PUT', path: `/competitions/organizer/draft/${id(draftId)}`, body: { data }, auth: 'required' },
    draftEnvelope
  );
  return res.data;
}

/** fish `services/api/organizer.ts#deleteDraft` */
export async function deleteDraft(t: Transport, draftId: string): Promise<{ documentId: string }> {
  const res = await call(
    t,
    { method: 'DELETE', path: `/competitions/organizer/draft/${id(draftId)}`, auth: 'required' },
    z.object({ data: z.object({ documentId: z.string() }) })
  );
  return res.data;
}

/** fish `services/api/organizer.ts#updateOrganizerCompetition` — returns `{ data, meta }` (risk report). */
export function updateOrganizerCompetition(
  t: Transport,
  competitionId: string,
  data: Record<string, unknown>,
  confirmRiskChanges = false
) {
  return call(
    t,
    {
      method: 'PUT',
      path: `/competitions/organizer/${id(competitionId)}`,
      body: { data, confirmRiskChanges },
      auth: 'required',
    },
    organizerUpdateCompetitionResponseSchema
  );
}

/** fish `services/api/organizer.ts#publishDraft` */
export async function publishDraft(t: Transport, draftId: string) {
  const res = await call(
    t,
    { method: 'PUT', path: `/competitions/organizer/draft/${id(draftId)}/publish`, auth: 'required' },
    draftEnvelope
  );
  return res.data;
}

/** fish `services/api/organizer.ts#getOrganizerDashboard` */
export async function getOrganizerDashboard(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/competitions/organizer/dashboard', auth: 'required' },
    z.object({ data: organizerDashboardStatsSchema })
  );
  return res.data;
}

/** fish `withQuery`: drops undefined / null / '' params (URLSearchParams would send `status=`). */
function compactQuery(params: Record<string, string | number | undefined | null>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

/** Old CMS answered with a bare array; current one with `{ data, meta.pagination }`. */
function paginatedOrArray<T extends z.ZodType>(item: T) {
  return z.union([
    z.array(item),
    z.object({
      data: z.array(item),
      meta: z.object({ pagination: paginationMetaSchema.partial().optional() }).optional(),
    }),
  ]);
}

export type OrganizerCompetitionsParams = { status?: string; page?: number; pageSize?: number };

/** fish `services/api/organizer.ts#getOrganizerCompetitions` (accepts a bare status like fish). */
export async function getOrganizerCompetitions(t: Transport, paramsOrStatus: OrganizerCompetitionsParams | string = {}) {
  const params: OrganizerCompetitionsParams =
    typeof paramsOrStatus === 'string' ? { status: paramsOrStatus } : paramsOrStatus;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/competitions/organizer/my-competitions',
      query: compactQuery(params),
      auth: 'required',
    },
    paginatedOrArray(organizerCompetitionSchema)
  );
  return normalizePaginatedResponse<DraftCompetition>(res, { page, pageSize });
}

export type OrganizerStatDetailsParams = { statKey: OrganizerStatKey; page?: number; pageSize?: number };

/** fish `services/api/organizer.ts#getOrganizerStatDetails` */
export async function getOrganizerStatDetails(t: Transport, params: OrganizerStatDetailsParams) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 5;
  const res = await call(
    t,
    { method: 'GET', path: '/competitions/organizer/stat-details', query: compactQuery(params), auth: 'required' },
    paginatedOrArray(organizerStatDetailItemSchema)
  );
  return normalizePaginatedResponse(res, { page, pageSize });
}

/** fish `services/api/organizer.ts#getOrganizerRecentLakes` */
export async function getOrganizerRecentLakes(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/competitions/organizer/recent-lakes', auth: 'required' },
    z.object({ data: z.array(organizerRecentLakeSchema) })
  );
  return res.data;
}

/** fish `services/api/organizer.ts#getOrganizerCompetitionDetail` (non-draft source for "copy from"). */
export async function getOrganizerCompetitionDetail(t: Transport, competitionId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/competitions/organizer/${id(competitionId)}`, auth: 'required' },
    z.object({ data: organizerCompetitionSourceDetailSchema })
  );
  return res.data;
}

/** fish `services/api/organizer.ts#getOrganizerCompetitionSourceDetail` — drafts go through the draft endpoint. */
export async function getOrganizerCompetitionSourceDetail(
  t: Transport,
  source: OrganizerCompetitionSourceSummary
): Promise<OrganizerCompetitionSourceDetail | DraftCompetition> {
  if (source.competitionStatus === 'draft') {
    return getDraft(t, source.documentId);
  }
  return getOrganizerCompetitionDetail(t, source.documentId);
}

/** fish `services/api/organizer.ts#cancelOrganizerCompetition` */
export async function cancelOrganizerCompetition(t: Transport, competitionId: string, payload: { reason?: string } = {}) {
  const body = payload.reason ? { reason: payload.reason } : {};
  const res = await call(
    t,
    { method: 'PUT', path: `/competitions/organizer/${id(competitionId)}/cancel`, body, auth: 'required' },
    z.object({ data: cancelOrganizerCompetitionResponseSchema })
  );
  return res.data;
}

/* ================================================================== */
/* Competition management — fish services/api/competitions.ts          */
/* ================================================================== */

/** fish `services/api/competitions.ts#getCompetitionActiveWeighing` — per-user (referee), never cached. */
export function getCompetitionActiveWeighing(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/competitions/${id(competitionId)}/active-weighing`, auth: 'required' },
    z.array(competitionActiveWeighingSchema)
  );
}

/** fish `services/api/competitions.ts#startCompetition` — returns the updated competition document. */
export function startCompetition(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'PUT', path: `/competitions/${id(competitionId)}/start`, auth: 'required' },
    organizerCompetitionSchema
  );
}

/** fish `services/api/competitions.ts#endCompetition` */
export function endCompetition(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'PUT', path: `/competitions/${id(competitionId)}/end`, auth: 'required' },
    z.object({ data: organizerCompetitionSchema })
  );
}

/** fish `services/api/competitions.ts#allocateStandsToSectors` */
export function allocateStandsToSectors(
  t: Transport,
  { competitionId, body }: { competitionId: string; body: AllocateStandsToSectorsRequest }
) {
  return call(
    t,
    {
      method: 'POST',
      path: `/competitions/${id(competitionId)}/allocate-stands-to-sectors`,
      body: { allocations: body.allocations },
      auth: 'required',
    },
    z.object({ data: organizerCompetitionSchema })
  );
}

/** fish `services/api/competitions.ts#allocateStandToRegistration` */
export function allocateStandToRegistration(
  t: Transport,
  { competitionId, body }: { competitionId: string; body: AllocateStandToRegistrationRequest }
) {
  return call(
    t,
    {
      method: 'POST',
      path: `/competitions/${id(competitionId)}/allocate-stand-to-registration`,
      body: { allocations: body.allocations },
      auth: 'required',
    },
    z.object({ success: z.boolean() })
  );
}

/** fish `services/api/competitions.ts#getAllocatedParticipants` — shared, edge-cached sub-resource. */
export async function getAllocatedParticipants(t: Transport, competitionId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/competitions/${id(competitionId)}/allocated-participants`, auth: 'none' },
    z.object({ data: allocatedParticipantsResponseSchema })
  );
  return res.data;
}

/** fish `services/api/competitions.ts#addCompetitionReferee` — 201 with an empty body. */
export function addCompetitionReferee(t: Transport, competitionId: string, data: { documentId: string }) {
  return callVoid(t, {
    method: 'PATCH',
    path: `/competitions/${id(competitionId)}/referee`,
    body: { documentId: data.documentId },
    auth: 'required',
  });
}

/** fish `services/api/competitions.ts#removeCompetitionReferee` — 204. */
export function removeCompetitionReferee(t: Transport, competitionId: string, refereeId: string) {
  return callVoid(t, {
    method: 'DELETE',
    path: `/competitions/${id(competitionId)}/referee/${id(refereeId)}`,
    auth: 'required',
  });
}

/** fish `services/api/competitions.ts#getExtraScalesList` — shared, edge-cached sub-resource. */
export function getExtraScalesList(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'GET', path: `/competitions/${id(competitionId)}/extra-scale`, auth: 'none' },
    z.array(extraScaleSchema)
  );
}

/** fish `services/api/competitions.ts#requestExtraScale` */
export function requestExtraScale(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'POST', path: `/competitions/${id(competitionId)}/request-extra`, auth: 'required' },
    extraScaleWriteResponseSchema
  );
}

/** fish `services/api/competitions.ts#deleteExtraScaleRequest` — returns the cancelled request. */
export function deleteExtraScaleRequest(t: Transport, competitionId: string) {
  return call(
    t,
    { method: 'DELETE', path: `/competitions/${id(competitionId)}/request-extra`, auth: 'required' },
    extraScaleWriteResponseSchema
  );
}

/* ================================================================== */
/* Weighings — fish services/api/weighing.ts                           */
/* ================================================================== */

/**
 * fish `services/api/weighing.ts#getWeighingsSummary`. Cached as shared by the CMS, but the
 * Public role is not granted it (guest → 403), so it rides the session when there is one.
 */
export async function getWeighingsSummary(t: Transport, competitionId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/competitions/${id(competitionId)}/weighings-summary`, auth: 'optional' },
    z.object({ data: z.array(weighingsSummaryItemSchema).nullish() })
  );
  return res.data ?? [];
}

/**
 * fish `services/api/weighing.ts#getWeighings`. `round`: feeder-on-legs competitions only — a stand
 * holds a different entrant in every leg, so the stand's weighings are the current leg's. Omitted
 * everywhere else (the server then returns them all).
 */
export async function getWeighings(t: Transport, competitionId: string, standId: string, round?: number) {
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/feed/weighings/by-stand',
      query: { competitionId, standId, ...(round != null ? { round } : {}) },
      auth: 'none',
    },
    z.object({ data: z.array(weighingByStandSchema) })
  );
  return res.data;
}

/** fish `services/api/weighing.ts#getWeightingsTotal` — total kg on a stand, 3 decimals. */
export async function getWeightingsTotal(t: Transport, competitionId: string, standId: string, round?: number): Promise<string> {
  return sumWeighingsTotal(await getWeighings(t, competitionId, standId, round));
}

/** fish `services/api/weighing.ts#getWeighingById` — the DTO is NOT wrapped in `data`. */
export function getWeighingById(t: Transport, weighingId: string) {
  return call(t, { method: 'GET', path: `/feed/weighings/${id(weighingId)}`, auth: 'none' }, weighingDetailSchema);
}

/** fish `services/api/weighing.ts#startCantar` */
export function startCantar(
  t: Transport,
  data: { standId: string; competitionId: string; weighingType: 'normal' | 'extra' }
) {
  return call(
    t,
    {
      method: 'POST',
      path: '/weighings/start',
      body: { data: { stand: data.standId, competition: data.competitionId, weighingType: data.weighingType } },
      auth: 'required',
    },
    startedWeighingSchema
  );
}

/** fish `services/api/weighing.ts#deleteCantar` */
export function deleteCantar(t: Transport, weighingId: string) {
  return call(t, { method: 'DELETE', path: `/weighings/${id(weighingId)}`, auth: 'required' }, deleteCantarResponseSchema);
}

/** fish `services/api/weighing.ts#addCatchToWeighing` — body is the bare catches array. */
export function addCatchToWeighing(t: Transport, weighingId: string, data: CatchData) {
  return call(
    t,
    { method: 'POST', path: `/weighings/${id(weighingId)}/catch`, body: data, auth: 'required' },
    createdCatchesSchema
  );
}

/** fish `services/api/weighing.ts#endCantar` */
export function endCantar(t: Transport, weighingId: string) {
  return call(t, { method: 'POST', path: `/weighings/${id(weighingId)}/end`, auth: 'required' }, messageResponseSchema);
}

/** fish `services/api/weighing.ts#reopenWeighing` */
export function reopenWeighing(
  t: Transport,
  { weighingId, competitionId, reason }: { weighingId: string; competitionId: string; reason: string }
) {
  return call(
    t,
    {
      method: 'POST',
      path: `/weighings/${id(weighingId)}/reopen`,
      body: { data: { competitionId, reason } },
      auth: 'required',
    },
    messageResponseSchema
  );
}

/**
 * fish `services/api/weighing.ts#getWeighingRevisions` — legacy `/weighing-logs` (qs query).
 * Edge-cached 30 s as the spectator timeline, but the Public role is not granted it locally.
 */
export function getWeighingRevisions(t: Transport, weighingId: string, page = 1, pageSize = 100) {
  return call(
    t,
    {
      method: 'GET',
      path: '/weighing-logs',
      query: {
        filters: { weighing: { documentId: weighingId } },
        sort: ['createdAt:asc'],
        populate: { author: { fields: ['id', 'username'] }, weighing: { fields: ['id'] } },
        pagination: { pageSize, page },
      },
      auth: 'optional',
    },
    weighingRevisionsResponseSchema
  );
}

/* ================================================================== */
/* Penalties — fish services/api/penalties.ts                          */
/* ================================================================== */

export type CreatePenaltyParams = {
  competitionId: string;
  registrationId: string;
  action: PenaltyAction;
  value?: number;
  reason: string;
};

/** fish `services/api/penalties.ts#createPenalty` — 201 with the penalty document. */
export function createPenalty(t: Transport, { competitionId, registrationId, action, value, reason }: CreatePenaltyParams) {
  return call(
    t,
    {
      method: 'POST',
      path: `/competitions/${id(competitionId)}/registrations/${id(registrationId)}/penalties`,
      body: { action, value, reason },
      auth: 'required',
    },
    penaltySchema
  );
}

/** fish `services/api/penalties.ts#deletePenalty` */
export function deletePenalty(t: Transport, penaltyId: string) {
  return callVoid(t, { method: 'DELETE', path: `/penalties/${id(penaltyId)}`, auth: 'required' });
}

/* ================================================================== */
/* Catches — media uploads + requestOrganizerRole live in core/social  */
/* ================================================================== */

/** fish `services/api/catch.ts#deleteCatch` */
export function deleteCatch(t: Transport, catchId: string) {
  return call(t, { method: 'DELETE', path: `/catches/${id(catchId)}`, auth: 'required' }, deleteCatchResponseSchema);
}
