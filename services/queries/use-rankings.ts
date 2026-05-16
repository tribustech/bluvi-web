"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/rankings";
import { queryKeys } from "./query-keys";

export function useRankings(competitionId: string) {
  return useQuery({
    queryKey: queryKeys.rankings.byCompetitionId(competitionId),
    queryFn: () => api.getRankings(competitionId),
    enabled: Boolean(competitionId),
  });
}

export function useRankingBestN(competitionId: string) {
  return useQuery({
    queryKey: queryKeys.rankings.bestN(competitionId),
    queryFn: () => api.getRankingBestN(competitionId),
    enabled: Boolean(competitionId),
  });
}
