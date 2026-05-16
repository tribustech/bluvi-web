"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/competitions";
import { queryKeys } from "./query-keys";

export function useCompetitions(status?: string) {
  return useInfiniteQuery({
    queryKey: status ? queryKeys.competitions.byStatus(status) : queryKeys.competitions.all,
    queryFn: ({ pageParam = 1 }) =>
      status
        ? api.getCompetitionsByStatus(status as never, { page: pageParam, pageSize: 9 })
        : api.getCompetitionsList({ page: pageParam, pageSize: 9 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, pageSize, total } = lastPage.meta.pagination;
      return page * pageSize < total ? page + 1 : undefined;
    },
  });
}

export function useCompetition(id: string) {
  return useQuery({
    queryKey: queryKeys.competitions.byId(id),
    queryFn: () => api.getCompetition(id),
    enabled: Boolean(id),
  });
}

export function useLiveCompetition() {
  return useQuery({
    queryKey: queryKeys.competitions.live,
    queryFn: api.getLiveCompetition,
  });
}

export function useMyCompetitions() {
  return useQuery({
    queryKey: queryKeys.competitions.my,
    queryFn: api.getMyCompetitions,
  });
}

export function useMyOrganizedCompetitions() {
  return useQuery({
    queryKey: queryKeys.competitions.organizedByMe,
    queryFn: api.getMyOrganizedCompetitions,
  });
}

export function useCompetitionRegistrations(id: string) {
  return useQuery({
    queryKey: queryKeys.competitions.registrations(id),
    queryFn: () => api.getCompetitionRegistrations(id),
    enabled: Boolean(id),
  });
}

export function useCompetitionActiveWeighing(id: string) {
  return useQuery({
    queryKey: queryKeys.competitions.activeWeighing(id),
    queryFn: () => api.getCompetitionActiveWeighing(id),
    enabled: Boolean(id),
  });
}
