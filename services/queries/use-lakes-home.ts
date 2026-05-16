"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLakesHome, type GetLakesHomeParams } from "@/services/api/lakes-home";
import { queryKeys } from "./query-keys";

export function useLakesHome(params: GetLakesHomeParams = {}) {
  return useQuery({
    queryKey: queryKeys.lakesHome.with({ ...params }),
    queryFn: () => fetchLakesHome(params),
    staleTime: 5 * 60 * 1000,
  });
}
