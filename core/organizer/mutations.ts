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
  deleteRaffleReceipt,
  endCantar,
  endCompetition,
  joinRaffleSession,
  publishDraft,
  removeCompetitionReferee,
  reopenWeighing,
  requestExtraScale,
  requestOrganizerRole,
  startCantar,
  startCompetition,
  updateDraft,
  updateOrganizerCompetition,
  uploadMediaAndAttachToEntity,
  uploadRaffleReceipt,
  type CreatePenaltyParams,
  type MediaOriginOption,
} from './api';
import { applyOptimisticCatches, applyReopenToWeighings } from './domain/weighing';
import { externalKeys, organizerKeys, raffleKeys, weighingKeys } from './queries';
import type {
  AllocateStandsToSectorsRequest,
  AllocateStandToRegistrationRequest,
  CatchData,
  CreateDraftPayload,
  MediaFile,
  UpdateDraftPayload,
  WeighingByStand,
  WeighingDetail,
} from './schemas';

/**
 * fish `mutations/invalidateOrganizerDashboardQueries.ts` — everything the organizer
 * dashboard shows, plus the Concursuri tab which lists the same competitions
 * (status, places, Organizate).
 */
export async function invalidateOrganizerDashboardQueries(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: organizerKeys.dashboard }),
    qc.invalidateQueries({ queryKey: organizerKeys.competitionsRoot }),
    qc.invalidateQueries({ queryKey: organizerKeys.statDetailsRoot }),
    qc.invalidateQueries({ queryKey: externalKeys.competitionCardsRoot }),
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
        qc.invalidateQueries({ queryKey: externalKeys.competitionsById(variables.id) }),
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
        qc.invalidateQueries({ queryKey: externalKeys.competitionsById(variables.id) }),
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
      void qc.invalidateQueries({ queryKey: externalKeys.competitionLive });
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
      void qc.invalidateQueries({ queryKey: externalKeys.competitionLive });
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
      void qc.invalidateQueries({ queryKey: externalKeys.competitionLive });
    },
  });
}

/** fish `useDeleteExtraScaleRequest` */
export function deleteExtraScaleRequestMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (competitionId: string) => deleteExtraScaleRequest(t, competitionId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: externalKeys.competitionLive });
    },
  });
}

/** fish `useRequestOrganizerRole`. fish also toasted success/error here (UI concern, dropped). */
export function requestOrganizerRoleMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (message: string) => requestOrganizerRole(t, message),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: externalKeys.profileMy });
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
      void qc.invalidateQueries({ queryKey: externalKeys.rankingsByCompetitionId(competitionId) });
      void qc.invalidateQueries({ queryKey: externalKeys.rankingBestN(competitionId) });
    },
  });
}

/** fish `useDeletePenalty` */
export function deletePenaltyMutation(t: Transport, qc: QueryClient, competitionId: string) {
  return mutationOptions({
    mutationFn: (penaltyId: string) => deletePenalty(t, penaltyId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: externalKeys.rankingsByCompetitionId(competitionId) });
      void qc.invalidateQueries({ queryKey: externalKeys.rankingBestN(competitionId) });
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
/* Raffle                                                              */
/* ------------------------------------------------------------------ */

/** What every raffle write refreshes: the session, my participation, and competition lists. */
function invalidateRaffle(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: raffleKeys.active });
  void qc.invalidateQueries({ queryKey: raffleKeys.participation });
  void qc.invalidateQueries({ queryKey: externalKeys.competitionsAll });
}

/** fish `useJoinRaffleSession` */
export function joinRaffleSessionMutation(t: Transport, qc: QueryClient, options: MediaOriginOption = {}) {
  return mutationOptions({
    mutationFn: ({ sessionDocumentId, typeKey }: { sessionDocumentId: string; typeKey: string }) =>
      joinRaffleSession(t, sessionDocumentId, typeKey, options),
    onSettled: () => invalidateRaffle(qc),
  });
}

/** fish `useUploadRaffleReceipt` */
export function uploadRaffleReceiptMutation(t: Transport, qc: QueryClient, options: MediaOriginOption = {}) {
  return mutationOptions({
    mutationFn: ({ raffleId, file }: { raffleId: string; file: MediaFile }) =>
      uploadRaffleReceipt(t, raffleId, file, options),
    onSettled: () => invalidateRaffle(qc),
  });
}

/** fish `useDeleteRaffleReceipt` */
export function deleteRaffleReceiptMutation(t: Transport, qc: QueryClient, options: MediaOriginOption = {}) {
  return mutationOptions({
    mutationFn: (sessionDocumentId: string) => deleteRaffleReceipt(t, sessionDocumentId, options),
    onSettled: () => invalidateRaffle(qc),
  });
}
