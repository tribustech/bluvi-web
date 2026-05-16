"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/weighing";
import { queryKeys } from "./query-keys";

export function useWeighingSummary(competitionId: string) {
  return useQuery({
    queryKey: queryKeys.weighings.summary(competitionId),
    queryFn: () => api.getWeighingsSummary(competitionId),
    enabled: Boolean(competitionId),
  });
}

export function useWeighings(competitionId: string, standId: string) {
  return useQuery({
    queryKey: queryKeys.weighings.byStand(competitionId, standId),
    queryFn: () => api.getWeighings(competitionId, standId),
    enabled: Boolean(competitionId && standId),
  });
}
