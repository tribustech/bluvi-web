import { infiniteQueryOptions, nextPageParam, queryOptions } from '../shared';
import type { Transport } from '../transport';
import { getNews, getNewsById } from './api';

/** fish `queryKeys.news` */
export const newsKeys = {
  all: ['news'] as const,
  list: (pageSize: number) => ['news', { pageSize }] as const,
  byId: (id: string) => ['news', id] as const,
};

const NEWS_STALE_TIME_MS = 60 * 60 * 1000;

/** fish `useNews` */
export function newsInfiniteQuery(t: Transport, { pageSize = 200 }: { pageSize?: number } = {}) {
  return infiniteQueryOptions({
    queryKey: newsKeys.list(pageSize),
    queryFn: ({ pageParam }) => getNews(t, { page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.meta),
    staleTime: NEWS_STALE_TIME_MS,
    gcTime: NEWS_STALE_TIME_MS,
  });
}

/** fish `useNewsById` */
export function newsByIdQuery(t: Transport, id: string) {
  return queryOptions({
    queryKey: newsKeys.byId(id),
    queryFn: () => getNewsById(t, id),
    enabled: !!id,
  });
}
