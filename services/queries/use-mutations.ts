"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCompetitionRegistration,
  cancelCompetitionRegistration,
} from "@/services/api/registrations";
import { followCompetition } from "@/services/api/competitions";
import { updateProfile } from "@/services/api/profile";
import {
  deleteRaffleReceipt,
  joinRaffleSession,
  uploadRaffleReceipt,
} from "@/services/api/raffle";
import { createWeighing, addCatch } from "@/services/api/weighing";
import { createDraft, publishDraft, updateDraft } from "@/services/api/organizer";
import { queryKeys } from "./query-keys";

export function useCreateCompetitionRegistration(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      createCompetitionRegistration(competitionId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitions.byId(competitionId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.competitions.registrations(competitionId),
      });
    },
  });
}

export function useCancelCompetitionRegistration(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (registrationId: string) => cancelCompetitionRegistration(registrationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitions.byId(competitionId) });
    },
  });
}

export function useFollowCompetition(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (follow: boolean) => followCompetition(competitionId, follow),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitions.byId(competitionId) });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.my });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.statistics });
    },
  });
}

export function useJoinRaffle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionDocumentId, typeKey }: { sessionDocumentId: string; typeKey: string }) =>
      joinRaffleSession(sessionDocumentId, typeKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.raffle.active });
      void queryClient.invalidateQueries({ queryKey: queryKeys.raffle.participation });
    },
  });
}

export function useUploadRaffleReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ raffleId, file }: { raffleId: string; file: File }) =>
      uploadRaffleReceipt(raffleId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.raffle.participation });
    },
  });
}

export function useDeleteRaffleReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionDocumentId: string) => deleteRaffleReceipt(sessionDocumentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.raffle.participation });
    },
  });
}

export function useCreateWeighing(competitionId: string, standId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createWeighing(competitionId, { standId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weighings.byStand(competitionId, standId) });
    },
  });
}

export function useAddCatch(competitionId: string, standId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ weighingId, weight }: { weighingId: string; weight: number }) =>
      addCatch(weighingId, { weight }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weighings.byStand(competitionId, standId) });
    },
  });
}

export function useOrganizerDrafts() {
  const queryClient = useQueryClient();

  return {
    create: useMutation({
      mutationFn: createDraft,
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.organizer.dashboard });
      },
    }),
    update: useMutation({
      mutationFn: ({ draftId, payload }: { draftId: string; payload: Parameters<typeof updateDraft>[1] }) =>
        updateDraft(draftId, payload),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.organizer.competitions });
      },
    }),
    publish: useMutation({
      mutationFn: publishDraft,
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.organizer.dashboard });
        void queryClient.invalidateQueries({ queryKey: queryKeys.organizer.competitions });
      },
    }),
  };
}
