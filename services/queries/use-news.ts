"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/news";
import { queryKeys } from "./query-keys";

export function useNews() {
  return useQuery({
    queryKey: queryKeys.news.all,
    queryFn: () => api.getNews({ page: 1, pageSize: 12 }),
  });
}

export function useNewsItem(id: string) {
  return useQuery({
    queryKey: queryKeys.news.byId(id),
    queryFn: () => api.getNewsById(id),
    enabled: Boolean(id),
  });
}
