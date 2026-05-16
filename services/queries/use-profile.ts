"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/profile";
import { queryKeys } from "./query-keys";

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.my,
    queryFn: api.getProfile,
  });
}

export function useProfileStatistics() {
  return useQuery({
    queryKey: queryKeys.profile.statistics,
    queryFn: api.getStatistics,
  });
}
