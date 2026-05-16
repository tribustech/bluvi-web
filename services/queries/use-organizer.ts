"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/organizer";
import { queryKeys } from "./query-keys";

export function useOrganizerDashboard() {
  return useQuery({
    queryKey: queryKeys.organizer.dashboard,
    queryFn: api.getOrganizerDashboard,
  });
}

export function useOrganizerCompetitions(status?: string) {
  return useQuery({
    queryKey: [...queryKeys.organizer.competitions, status] as const,
    queryFn: () => api.getOrganizerCompetitions(status),
  });
}
