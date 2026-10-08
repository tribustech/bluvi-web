/*
 * Pure half of SearchSelectDialog (./SearchSelectDialog.tsx): the option shape, the local filter and
 * the order (choosable first, disabled last). Kept free of React so tests/unit can import it.
 */

export type SearchSelectOption = {
  id: string;
  label: string;
  /** Lines under the label («#ion12», «Sector A · Stand 4», the lake's county). */
  helper?: string | readonly string[];
  /** The avatar: a photo, or initials on the name's tone; `square` for teams and lakes. */
  avatar?: { name: string; src?: string | null; square?: boolean } | null;
  /** Not choosable (already picked elsewhere, the anchor…): listed after the choosable ones. */
  disabled?: boolean;
  /** Why it is disabled («adăugat deja», «tu»): shown as a quiet tag and read out. */
  disabledReason?: string;
  /** The current value: a check mark (a selected option may also be disabled, i.e. fixed). */
  selected?: boolean;
};

/** Lowercase, no diacritics: «Ștefan» matches «stefan». */
export const foldText = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const helperLines = (helper: SearchSelectOption['helper']): string[] =>
  helper == null ? [] : typeof helper === 'string' ? [helper] : [...helper];

/** Local find-as-you-type over the label and the helper lines; every option for a blank query. */
export function filterOptions<T extends SearchSelectOption>(options: readonly T[], query: string): T[] {
  const q = foldText(query.trim());
  if (!q) return [...options];
  return options.filter((o) => foldText([o.label, ...helperLines(o.helper)].join(' ')).includes(q));
}

/** Choosable options first, disabled ones last; the order inside each group is kept (stable). */
export function orderOptions<T extends SearchSelectOption>(options: readonly T[]): T[] {
  return [...options.filter((o) => !o.disabled), ...options.filter((o) => o.disabled)];
}

export const optionHelperLines = helperLines;

/* ------------------------------------------------------------------ */
/* Infinite loading — the pager behind the list's end sentinel.        */
/* ------------------------------------------------------------------ */

/**
 * One page request at a time, and never an automatic retry: a request is in flight from the call
 * until its page settles (rows grew, or `loadingMore` went true → false); a page that settled
 * without new rows, or with `loadMoreError`, is `failed` — the sentinel stops and the picker shows
 * «Încearcă din nou» instead (an unobserved failure would otherwise re-fire on every re-subscribe).
 */
export type PagerState = {
  /** The row count when the pending page was asked for; null = nothing in flight. */
  waitingFrom: number | null;
  /** `loadingMore` was seen true for the pending page. */
  sawLoading: boolean;
  failed: boolean;
};

export const pagerIdle: PagerState = { waitingFrom: null, sawLoading: false, failed: false };

/** Whether the end sentinel may be observed (and so may ask for a page by itself). */
export function pagerCanObserve(
  s: PagerState,
  p: { hasMore: boolean; hasHandler: boolean; loading: boolean; error: boolean; rowCount: number },
): boolean {
  return p.hasMore && p.hasHandler && !p.loading && !p.error && p.rowCount > 0 && !s.failed && s.waitingFrom === null;
}

/** The end came into view: ask for a page only when nothing is in flight and the last one did not fail. */
export function pagerOnEnd(s: PagerState, p: { loadingMore: boolean; rowCount: number }): { state: PagerState; call: boolean } {
  if (s.failed || s.waitingFrom !== null || p.loadingMore) return { state: s, call: false };
  return { state: { waitingFrom: p.rowCount, sawLoading: false, failed: false }, call: true };
}

/** «Încearcă din nou» after a failed page: one explicit request. */
export function pagerRetry(p: { rowCount: number }): PagerState {
  return { waitingFrom: p.rowCount, sawLoading: false, failed: false };
}

/** The caller's progress; returns `s` itself when nothing changes (safe to compare by identity). */
export function pagerOnProgress(s: PagerState, p: { loadingMore: boolean; rowCount: number; loadMoreError: boolean }): PagerState {
  if (s.waitingFrom === null) return s;
  if (p.rowCount > s.waitingFrom) return pagerIdle;
  if (p.loadMoreError) return { waitingFrom: null, sawLoading: false, failed: true };
  if (p.loadingMore) return s.sawLoading ? s : { ...s, sawLoading: true };
  if (s.sawLoading) return { waitingFrom: null, sawLoading: false, failed: true };
  return s;
}
