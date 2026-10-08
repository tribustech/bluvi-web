import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '../shared';
import type { Transport } from '../transport';
import {
  addCatchToWeighing,
  addCompetitionReferee,
  allocateStandsToSectors,
  allocateStandToRegistration,
  cancelOrganizerCompetition,
  createDraft,
  createPenalty,
  deleteCantar,
  deleteCatch,
  deleteDraft,
  deleteExtraScaleRequest,
  deletePenalty,
  endCantar,
  endCompetition,
  publishDraft,
  removeCompetitionReferee,
  reopenWeighing,
  requestExtraScale,
  startCantar,
  startCompetition,
  updateDraft,
  updateOrganizerCompetition,
  type CreatePenaltyParams,
} from './api';
import { applyOptimisticCatches, applyReopenToWeighings } from './domain/weighing';
import { competitionManagementKeys, organizerKeys, weighingKeys } from './queries';
import type {
  AllocateStandsToSectorsRequest,
  AllocateStandToRegistrationRequest,
  CatchData,
  CreateDraftPayload,
  UpdateDraftPayload,
  WeighingByStand,
  WeighingDetail,
} from './schemas';
import {
  acceptRegistration,
  allocateFeederRound,
  closeFeederRound,
  moveRegistrationToWaitingList,
  rejectRegistration,
  startNextFeederRound,
  type AllocateFeederRoundParams,
} from '../competitions/api';
import { competitionCardsKeys, competitionKeys, competitionsKeys, rankingsKeys } from '../competitions/queries';
import type { Registration } from '../competitions/schemas';
import { requestOrganizerRole, uploadMediaAndAttachToEntity, type MediaFile } from '../social/api';
import { profileKeys } from '../social/queries';

/**
 * fish `mutations/invalidateOrganizerDashboardQueries.ts` — everything the organizer
 * dashboard shows, plus the Competiții tab which lists the same competitions
 * (status, places, Organizate).
 */
export async function invalidateOrganizerDashboardQueries(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: organizerKeys.dashboard }),
    qc.invalidateQueries({ queryKey: organizerKeys.competitionsRoot }),
    qc.invalidateQueries({ queryKey: organizerKeys.statDetailsRoot }),
    qc.invalidateQueries({ queryKey: competitionCardsKeys.root }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Drafts / organizer competition                                      */
/* ------------------------------------------------------------------ */

/** fish `useCreateDraft` */
export function createDraftMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (data: CreateDraftPayload | Record<string, unknown>) => createDraft(t, data),
    onSuccess: async () => {
      await invalidateOrganizerDashboardQueries(qc);
    },
  });
}

/** fish `useUpdateDraft` */
export function updateDraftMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ id, data }: { id: string; data: UpdateDraftPayload | Record<string, unknown> }) =>
      updateDraft(t, id, data),
  });
}

/** fish `useDeleteDraft` */
export function deleteDraftMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (id: string) => deleteDraft(t, id),
    onSuccess: async () => {
      await invalidateOrganizerDashboardQueries(qc);
    },
  });
}

/** fish `usePublishDraft` */
export function publishDraftMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (id: string) => publishDraft(t, id),
    onSuccess: async () => {
      await invalidateOrganizerDashboardQueries(qc);
    },
  });
}

/** fish `useUpdateOrganizerCompetition` */
export function updateOrganizerCompetitionMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      id,
      data,
      confirmRiskChanges,
    }: {
      id: string;
      data: Record<string, unknown>;
      confirmRiskChanges?: boolean;
    }) => updateOrganizerCompetition(t, id, data, confirmRiskChanges),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateOrganizerDashboardQueries(qc),
        qc.invalidateQueries({ queryKey: competitionsKeys.byId(variables.id) }),
      ]);
    },
  });
}

/** fish `useCancelOrganizerCompetition` */
export function cancelOrganizerCompetitionMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelOrganizerCompetition(t, id, { reason }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateOrganizerDashboardQueries(qc),
        qc.invalidateQueries({ queryKey: competitionsKeys.byId(variables.id) }),
      ]);
    },
  });
}

/** fish `useStartCompetition` */
export function startCompetitionMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (competitionId: string) => startCompetition(t, competitionId),
    onSuccess: async () => {
      await invalidateOrganizerDashboardQueries(qc);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: competitionKeys.live });
    },
  });
}

/** fish `useEndCompetition` */
export function endCompetitionMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (competitionId: string) => endCompetition(t, competitionId),
    onSuccess: async () => {
      await invalidateOrganizerDashboardQueries(qc);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: competitionKeys.live });
    },
  });
}

/** fish `useAddCompetitionReferee` */
export function addCompetitionRefereeMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ competitionId, documentId }: { competitionId: string; documentId: string }) =>
      addCompetitionReferee(t, competitionId, { documentId }),
  });
}

/** fish `useDeleteCompetitionReferee` */
export function deleteCompetitionRefereeMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ competitionId, refereeId }: { competitionId: string; refereeId: string }) =>
      removeCompetitionReferee(t, competitionId, refereeId),
  });
}

/** fish `useAllocateStandsToSectors` */
export function allocateStandsToSectorsMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (variables: { competitionId: string; body: AllocateStandsToSectorsRequest }) =>
      allocateStandsToSectors(t, variables),
  });
}

/** fish `useAllocateStandToRegistration` */
export function allocateStandToRegistrationMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (variables: { competitionId: string; body: AllocateStandToRegistrationRequest }) =>
      allocateStandToRegistration(t, variables),
  });
}

/** fish `useRequestExtraScale` */
export function requestExtraScaleMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (competitionId: string) => requestExtraScale(t, competitionId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: competitionKeys.live });
    },
  });
}

/** fish `useDeleteExtraScaleRequest` */
export function deleteExtraScaleRequestMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (competitionId: string) => deleteExtraScaleRequest(t, competitionId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: competitionKeys.live });
    },
  });
}

/** fish `useRequestOrganizerRole`. fish also toasted success/error here (UI concern, dropped). */
export function requestOrganizerRoleMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (message: string) => requestOrganizerRole(t, message),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.my });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Penalties                                                           */
/* ------------------------------------------------------------------ */

/** fish `useCreatePenalty` — the ranking changes, not the penalty list's own cache. */
export function createPenaltyMutation(t: Transport, qc: QueryClient, competitionId: string) {
  return mutationOptions({
    mutationFn: (params: CreatePenaltyParams) => createPenalty(t, params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(competitionId) });
      void qc.invalidateQueries({ queryKey: competitionKeys.rankingBestN(competitionId) });
    },
  });
}

/** fish `useDeletePenalty` */
export function deletePenaltyMutation(t: Transport, qc: QueryClient, competitionId: string) {
  return mutationOptions({
    mutationFn: (penaltyId: string) => deletePenalty(t, penaltyId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(competitionId) });
      void qc.invalidateQueries({ queryKey: competitionKeys.rankingBestN(competitionId) });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Cântar (weighing)                                                   */
/* ------------------------------------------------------------------ */

/** fish `useStartCantar` */
export function startCantarMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (data: { standId: string; competitionId: string; weighingType: 'normal' | 'extra' }) =>
      startCantar(t, data),
  });
}

/** fish `useEndCantar` */
export function endCantarMutation(
  t: Transport,
  qc: QueryClient,
  { weighingId, competitionId }: { weighingId: string; competitionId: string }
) {
  return mutationOptions({
    mutationFn: () => endCantar(t, weighingId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: weighingKeys.byId(weighingId) });
      void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(competitionId) });
    },
  });
}

/** fish `useReopenCantar` — optimistic `started` status on the stand's weighing list. */
export function reopenCantarMutation(
  t: Transport,
  qc: QueryClient,
  { weighingId, standId }: { weighingId: string; standId: string }
) {
  return mutationOptions({
    mutationFn: (variables: { weighingId: string; competitionId: string; reason: string }) =>
      reopenWeighing(t, variables),
    onMutate: async variables => {
      const queryKey = weighingKeys.byCompetitionIdAndStandId(variables.competitionId, standId);
      await qc.cancelQueries({ queryKey });
      const weighings = qc.getQueryData<WeighingByStand[]>(queryKey);
      qc.setQueryData(queryKey, applyReopenToWeighings(weighings, variables.weighingId));
      return { previousWeighings: weighings };
    },
    onError: (_error, variables, context) => {
      qc.setQueryData(
        weighingKeys.byCompetitionIdAndStandId(variables.competitionId, standId),
        context?.previousWeighings
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: weighingKeys.byId(weighingId) });
    },
  });
}

/** fish `useDeleteCantar` */
export function deleteCantarMutation(t: Transport) {
  return mutationOptions({ mutationFn: (weighingId: string) => deleteCantar(t, weighingId) });
}

/** fish `addCatchMutationKey` — lets the scale screen observe pending add-catch writes. */
export const addCatchMutationKey = (weighingId: string) => ['add-catch', weighingId] as const;

export type AddCatchVariables = {
  weighingId: string;
  data: CatchData;
  /** Display name of the selected species, for the optimistic list entry. */
  fishTypeName?: string;
};

/** fish `useAddCatchToWeighing` */
export function addCatchToWeighingMutation(t: Transport, qc: QueryClient, weighingId?: string) {
  const options = mutationOptions({
    mutationFn: ({ weighingId: id, data }: AddCatchVariables) => addCatchToWeighing(t, id, data),
    // Show the submitted catches immediately — the operator knows what they
    // just weighed; don't make them wait a network round-trip to see it.
    onMutate: async ({ weighingId: id, data, fishTypeName }) => {
      const queryKey = weighingKeys.byId(id);
      await qc.cancelQueries({ queryKey });
      const previousWeighing = qc.getQueryData<WeighingDetail>(queryKey);
      if (previousWeighing) {
        qc.setQueryData(queryKey, applyOptimisticCatches(previousWeighing, data, fishTypeName));
      }
      return { previousWeighing };
    },
    // The phantom rows must disappear the moment the write fails — the referee
    // must never sign a weighing showing catches the server never stored.
    onError: (_error, { weighingId: id }, context) => {
      if (context?.previousWeighing) {
        qc.setQueryData(weighingKeys.byId(id), context.previousWeighing);
      }
    },
  });
  // fish sets no key when there is no weighing yet.
  return weighingId ? { ...options, mutationKey: addCatchMutationKey(weighingId) } : options;
}

/** fish `useDeleteCatch` */
export function deleteCatchMutation(t: Transport) {
  return mutationOptions({ mutationFn: (catchId: string) => deleteCatch(t, catchId) });
}

export type UploadMediaReq = {
  files: MediaFile[];
  /** The ID of the entity we want to assign the media to (e.g. catch.id), NOT the documentId */
  id: number;
};

/** fish `useUploadMediaToCatch` */
export function uploadMediaToCatchMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ files, id }: UploadMediaReq) =>
      uploadMediaAndAttachToEntity(t, { files, id, ref: 'api::catch.catch', field: 'media' }),
  });
}

/** fish `useUploadSignatures#useUploadRefereeSignature` */
export function uploadRefereeSignatureMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ files, id }: UploadMediaReq) =>
      uploadMediaAndAttachToEntity(t, { files, id, ref: 'api::weighing.weighing', field: 'refereeSignature' }),
  });
}

/** fish `useUploadSignatures#useUploadWitnessSignature` */
export function uploadWitnessSignatureMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ files, id }: UploadMediaReq) =>
      uploadMediaAndAttachToEntity(t, { files, id, ref: 'api::weighing.weighing', field: 'witnessSignature' }),
  });
}

/* ------------------------------------------------------------------ */
/* Registration moderation — fish mutations/useRegistrationsList.tsx   */
/* (organizer-side: every settle refreshes the organizer dashboard)    */
/* ------------------------------------------------------------------ */

/** fish `useRegistrationListMutations` optimistic status flip for one registration. */
export function applyRegistrationStatus(
  previous: Registration[] | undefined,
  registrationId: string,
  registrationStatus: 'registered' | 'rejected' | 'pending'
) {
  return previous?.map(registration =>
    registration.documentId === registrationId ? { ...registration, registrationStatus } : registration
  );
}

/**
 * One of fish `useRegistrationListMutations`' three mutations: optimistic status flip, rollback
 * on error, and on settle the list is marked stale WITHOUT an instant refetch — the refetch would
 * race the CDN tag purge (~0.65s) and a stale edge body would clobber the optimistic update.
 */
function registrationListMutation(
  qc: QueryClient,
  competitionId: string,
  mutationFn: (registrationId: string) => Promise<void>,
  status: 'registered' | 'rejected' | 'pending'
) {
  const QUERY_KEY = competitionsKeys.registrationsListById(competitionId);
  return mutationOptions({
    mutationFn,
    onMutate: async (registrationId: string) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previousData = qc.getQueryData<Registration[]>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, applyRegistrationStatus(previousData, registrationId, status));
      return { previousData };
    },
    // fish onSuccess: success toast (UI).
    onError: (_err, _variables, context) => {
      qc.setQueryData(QUERY_KEY, context?.previousData);
      // fish: error toast with err.message (UI).
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: QUERY_KEY, refetchType: 'none' }),
        qc.invalidateQueries({ queryKey: competitionsKeys.byId(competitionId), exact: true }),
        invalidateOrganizerDashboardQueries(qc),
      ]);
    },
  });
}

/** fish `useRegistrationListMutations#acceptRegistrationMutation` */
export function acceptRegistrationMutation(t: Transport, qc: QueryClient, competitionId: string) {
  return registrationListMutation(qc, competitionId, id => acceptRegistration(t, id), 'registered');
}

/** fish `useRegistrationListMutations#rejectRegistrationMutation` */
export function rejectRegistrationMutation(t: Transport, qc: QueryClient, competitionId: string) {
  return registrationListMutation(qc, competitionId, id => rejectRegistration(t, id), 'rejected');
}

/** fish `useRegistrationListMutations#moveRegistrationToWaitingListMutation` */
export function moveRegistrationToWaitingListMutation(t: Transport, qc: QueryClient, competitionId: string) {
  return registrationListMutation(qc, competitionId, id => moveRegistrationToWaitingList(t, id), 'pending');
}

/* ------------------------------------------------------------------ */
/* Feeder on legs («manșe») — fish mutations/useFeederRounds.ts        */
/* ------------------------------------------------------------------ */

/** fish `invalidateLegState`: every leg action changes the competition's leg state, its seating and its ranking. */
export function invalidateLegState(qc: QueryClient, competitionId: string) {
  void qc.invalidateQueries({ queryKey: competitionsKeys.byId(competitionId) });
  void qc.invalidateQueries({ queryKey: competitionManagementKeys.allocatedParticipants(competitionId) });
  void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(competitionId) });
  // Scale screens and the Cântare summary are scoped to the current leg (prefix covers stand + summary keys).
  void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(competitionId) });
  void qc.invalidateQueries({ queryKey: competitionManagementKeys.activeWeighingById(competitionId) });
}

/** fish `useCloseFeederRound` (the «Manșa N a fost închisă» toast is the UI's). */
export function closeFeederRoundMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (competitionId: string) => closeFeederRound(t, competitionId),
    onSettled: (_data, _error, competitionId) => invalidateLegState(qc, competitionId),
  });
}

/** fish `useAllocateFeederRound` */
export function allocateFeederRoundMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (params: AllocateFeederRoundParams) => allocateFeederRound(t, params),
    onSettled: (_data, _error, { competitionId }) => invalidateLegState(qc, competitionId),
  });
}

/** fish `useStartNextFeederRound` (the «Manșa N a început» toast is the UI's). */
export function startNextFeederRoundMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (competitionId: string) => startNextFeederRound(t, competitionId),
    onSettled: (_data, _error, competitionId) => invalidateLegState(qc, competitionId),
  });
}
