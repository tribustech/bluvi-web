import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '../shared';
import type { Transport } from '../transport';
import {
  addGuestRegistration,
  castPollVote,
  createCompetitionRegistration,
  followCompetition,
  removeRegistration,
  submitPollSuggestion,
  updateCompetitionNotificationPreferences,
  updateCompetitionRegistration,
  updateGuestRegistration,
} from './api';
import { applyMutedTypes } from './domain/notificationPreferences';
import {
  competitionCardsKeys,
  competitionNotificationKeys,
  competitionsKeys,
  pollKeys,
} from './queries';
import { profileKeys } from '../social/queries';
import type {
  CompetitionRegistrationInput,
  CompetitionWithMyStatus,
  CreateGuestRegistrationPayload,
  NotificationPreferences,
  Poll,
  PollVoteRequest,
  UpdateCompetitionRegistrationInput,
  UpdateGuestRegistrationPayload,
} from './schemas';

/* ------------------------------------------------------------------ */
/* Pure cache helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * fish `useFollowCompetition#onMutate` optimistic write, verbatim: viewers ±1 (or 1 when the
 * competition is not cached yet) and the new `isFollowing`.
 */
export function applyFollowToCompetition(previous: CompetitionWithMyStatus | undefined, follow: boolean) {
  return {
    ...previous,
    viewers: previous?.viewers !== undefined ? previous.viewers + (follow ? 1 : -1) : 1,
    isFollowing: follow,
  } as CompetitionWithMyStatus;
}

/** fish `usePollVote#onMutate` optimistic poll — moves one vote, counts a first vote once. */
export function applyPollVote(previous: Poll, optionId: number): Poll {
  const previouslyVotedFor = previous.myVoteOptionId;
  return {
    ...previous,
    myVoteOptionId: optionId,
    totalVotes: previouslyVotedFor === null ? previous.totalVotes + 1 : previous.totalVotes,
    options: previous.options.map(o => {
      if (o.id === optionId) return { ...o, votesCount: o.votesCount + 1 };
      if (o.id === previouslyVotedFor) return { ...o, votesCount: Math.max(0, o.votesCount - 1) };
      return o;
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Follow                                                             */
/* ------------------------------------------------------------------ */

type FollowVars = { competitionId: string; follow: boolean };

/** fish `useFollowCompetition` */
export function followCompetitionMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: ({ competitionId, follow }: FollowVars) => followCompetition(t, competitionId, follow),
    onMutate: async ({ competitionId, follow }: FollowVars) => {
      await qc.cancelQueries({ queryKey: competitionsKeys.byId(competitionId) });
      const previousCompetitions = qc.getQueryData<CompetitionWithMyStatus>(competitionsKeys.byId(competitionId));
      qc.setQueryData(competitionsKeys.byId(competitionId), applyFollowToCompetition(previousCompetitions, follow));
      return { previousCompetitions };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: competitionsKeys.all });
      qc.invalidateQueries({ queryKey: competitionCardsKeys.root });
    },
    onError: (_error, variables, context) => {
      qc.setQueryData(competitionsKeys.byId(variables.competitionId), context?.previousCompetitions);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Registrations                                                      */
/* ------------------------------------------------------------------ */

/** fish `useCreateCompetitionRegistration` */
export function createCompetitionRegistrationMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (data: CompetitionRegistrationInput) => createCompetitionRegistration(t, data),
    // fish onMutate: presents the progress bottom sheet (UI).
    onSettled: () => {
      qc.invalidateQueries({ queryKey: competitionsKeys.all });
      qc.invalidateQueries({ queryKey: competitionsKeys.my });
      qc.invalidateQueries({ queryKey: competitionCardsKeys.root });
      qc.invalidateQueries({ queryKey: profileKeys.my });
    },
  });
}

/**
 * The edge copy of `/feed/competitions/:id` is invalidated by a Cache-Tag purge that lands
 * ~0.65 s after the write. A refetch fired straight from `onSuccess` raced it and could store the
 * pre-write body (old team members) for the query's whole staleTime. Mark stale at once, refetch
 * after the purge.
 */
export const CDN_PURGE_SETTLE_MS = 2000;

/** fish `useUpdateCompetitionRegistration` */
export function updateCompetitionRegistrationMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (data: UpdateCompetitionRegistrationInput) => updateCompetitionRegistration(t, data),
    // fish onMutate: presents the progress bottom sheet (UI).
    onSuccess: (_result, variables) => {
      const competitionKey = competitionsKeys.byId(variables.competition);
      qc.invalidateQueries({ queryKey: competitionKey, refetchType: 'none' });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: competitionKey });
      }, CDN_PURGE_SETTLE_MS);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: competitionsKeys.my });
    },
  });
}

/** fish `useLeaveCompetition` */
export function leaveCompetitionMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (registrationId: string) => removeRegistration(t, registrationId),
    // fish onMutate: presents the progress bottom sheet (UI).
    onSettled: () => {
      qc.invalidateQueries({ queryKey: competitionsKeys.all });
      qc.invalidateQueries({ queryKey: competitionsKeys.my });
      qc.invalidateQueries({ queryKey: competitionCardsKeys.root });
    },
  });
}

/** fish `useRegistrationGuest` */
export function registrationGuestMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: CreateGuestRegistrationPayload) => addGuestRegistration(t, payload),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: competitionsKeys.all });
      qc.invalidateQueries({ queryKey: competitionsKeys.my });
    },
  });
}

/** fish `useUpdateRegistrationGuest` */
export function updateRegistrationGuestMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: UpdateGuestRegistrationPayload) => updateGuestRegistration(t, payload),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: competitionsKeys.all });
      qc.invalidateQueries({ queryKey: competitionsKeys.my });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Polls                                                              */
/* ------------------------------------------------------------------ */

/** fish `usePollVote` */
export function pollVoteMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (vars: PollVoteRequest) => castPollVote(t, vars),
    onMutate: async ({ optionId }: PollVoteRequest) => {
      await qc.cancelQueries({ queryKey: pollKeys.current });
      const previous = qc.getQueryData<Poll | null>(pollKeys.current);
      if (previous) {
        // fish: logs `poll_vote` / `poll_vote_change` to analytics here (UI).
        qc.setQueryData(pollKeys.current, applyPollVote(previous, optionId));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) qc.setQueryData(pollKeys.current, context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: pollKeys.current });
    },
  });
}

/** fish `usePollSuggest` */
export function pollSuggestMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (vars: { pollId: string; text: string }) => submitPollSuggestion(t, vars),
    // fish onSuccess: logs `poll_suggest` to analytics (UI).
  });
}

/* ------------------------------------------------------------------ */
/* Notification preferences                                           */
/* ------------------------------------------------------------------ */

/** fish `useUpdateCompetitionNotificationPreferences` */
export function updateCompetitionNotificationPreferencesMutation(t: Transport, qc: QueryClient, competitionId: string) {
  const key = competitionNotificationKeys.preferences(competitionId);
  return mutationOptions({
    mutationFn: (mutedTypes: string[]) => updateCompetitionNotificationPreferences(t, competitionId, mutedTypes),
    onMutate: async (mutedTypes: string[]) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<NotificationPreferences>(key);
      if (previous) qc.setQueryData<NotificationPreferences>(key, applyMutedTypes(previous, mutedTypes));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSuccess: data => qc.setQueryData(key, data),
    onSettled: () => qc.invalidateQueries({ queryKey: competitionNotificationKeys.followedCompetitions }),
  });
}
