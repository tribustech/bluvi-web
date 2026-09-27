import type { PaginationMeta } from '../../shared';

/** fish `profile?.role?.name === 'Organizer'` — every organizer query is gated on it. */
export function isOrganizerProfile(profile: { role?: { name?: string | null } | null } | null | undefined): boolean {
  return profile?.role?.name === 'Organizer';
}

type LoosePagination = Partial<Record<keyof PaginationMeta, number | undefined>>;

/**
 * fish `api/organizer.ts#normalizePaginatedResponse`: accepts a bare array (old CMS) or
 * `{ data, meta.pagination }` and always returns a complete pagination block.
 */
export function normalizePaginatedResponse<T>(
  payload: T[] | { data?: T[]; meta?: { pagination?: LoosePagination } },
  defaults: { page: number; pageSize: number }
): { data: T[]; meta: { pagination: PaginationMeta } } {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      meta: { pagination: { page: defaults.page, pageSize: defaults.pageSize, pageCount: 1, total: payload.length } },
    };
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  const incoming = payload?.meta?.pagination;
  const page = typeof incoming?.page === 'number' && incoming.page > 0 ? incoming.page : defaults.page;
  const pageSize = typeof incoming?.pageSize === 'number' && incoming.pageSize > 0 ? incoming.pageSize : defaults.pageSize;
  const total = typeof incoming?.total === 'number' && incoming.total >= 0 ? incoming.total : data.length;
  const pageCount =
    typeof incoming?.pageCount === 'number' && incoming.pageCount > 0
      ? incoming.pageCount
      : Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return { data, meta: { pagination: { page, pageSize, total, pageCount } } };
}

/**
 * fish `useOrganizerCompetitions` / `useOrganizerStatDetails` return `data` flattened across
 * pages; the web calls this on the infinite query's `data`.
 */
export function flattenPages<T>(data: { pages: { data: T[] }[] } | undefined): T[] | undefined {
  return data?.pages.flatMap(page => page.data);
}
