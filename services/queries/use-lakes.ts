"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/lakes";
import { queryKeys } from "./query-keys";

export function useLakes(search = "") {
  return useInfiniteQuery({
    queryKey: queryKeys.lakes.search(search),
    queryFn: ({ pageParam = 1 }) => api.getLakes({ page: pageParam, pageSize: 9, search }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, pageSize, total } = lastPage.meta.pagination;
      return page * pageSize < total ? page + 1 : undefined;
    },
  });
}

export function useLake(id: string) {
  return useQuery({
    queryKey: queryKeys.lakes.byId(id),
    queryFn: () => api.getLake(id),
    enabled: Boolean(id),
  });
}
