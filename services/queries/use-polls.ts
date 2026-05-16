"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  castPollVote,
  fetchCurrentPoll,
  submitPollSuggestion,
} from "@/services/api/polls";
import type { PollSuggestRequest, PollVoteRequest } from "@/types/poll";
import { queryKeys } from "./query-keys";

export function usePollCurrent() {
  return useQuery({
    queryKey: queryKeys.polls.current,
    queryFn: fetchCurrentPoll,
    staleTime: 60 * 1000,
  });
}

export function usePollVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PollVoteRequest) => castPollVote(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.current });
    },
  });
}

export function usePollSuggest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PollSuggestRequest) => submitPollSuggestion(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.current });
    },
  });
}
