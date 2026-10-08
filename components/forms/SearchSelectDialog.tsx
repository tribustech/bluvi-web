'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { controlShell } from './Field';
import {
  filterOptions,
  optionHelperLines,
  orderOptions,
  pagerCanObserve,
  pagerIdle,
  pagerOnEnd,
  pagerOnProgress,
  pagerRetry,
  type SearchSelectOption,
} from './searchSelect';

export type { SearchSelectOption } from './searchSelect';

/*
 * SearchSelectDialog — pick one item from a searchable list: the M6 lake picker (wizard), the
 * registration picker (participant allocation, penalties) and the referee picker. The shape of
 * fish's pickers (CompetitionParticipantsSelect, the lake and referee sheets), once for the kit.
 *
 * - A bottom sheet on a phone, a dialog from 768 (ResponsiveSurface `info`); the body mounts only
 *   while open, so a closed picker reads nothing.
 * - The search field on top (sticky). Two modes:
 *   - server search: pass `onQueryChange` — called with the trimmed text after a 250 ms pause; the
 *     caller reads and passes the new `options`;
 *   - local: leave `onQueryChange` out — the options are filtered here (label + helper lines,
 *     diacritics-insensitive).
 * - Each row: the avatar (photo, else initials; `square` for teams and lakes), the label and helper
 *   lines. Disabled options are listed last, dimmed and not choosable, with their reason as a tag;
 *   the selected one has a check mark (selected + disabled = fixed, e.g. the anchor of a team).
 * - Infinite loading: `hasMore` + `onLoadMore` — called when the list's end scrolls into view
 *   (only once the first page is on screen: not while `loading`, on `error` or with no rows);
 *   «Se încarcă...» under the list while `loadingMore`. One page at a time; a page that fails
 *   (`loadMoreError`, or `loadingMore` ended without new rows) is never retried by itself — the list
 *   shows «Nu am putut încărca mai multe.» + «Încearcă din nou» (pure pager: ./searchSelect.ts).
 * - States: `loading` «Se încarcă...», `error` «Eroare la încărcarea datelor» (+ «Încearcă din nou»
 *   with `onRetry`), nothing to show «Nu s-au găsit rezultate».
 * - Choosing calls `onSelect(option)`; the caller closes it (or keeps it open for a multi-pick).
 */

const SEARCH_DEBOUNCE_MS = 250;

type Props<T extends SearchSelectOption> = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The field's accessible name and placeholder. */
  searchLabel: string;
  placeholder?: string;
  options: readonly T[];
  onSelect: (option: T) => void;
  /** Server search: called after a pause in typing. Without it the list is filtered locally. */
  onQueryChange?: (query: string) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** The last `onLoadMore` page failed (e.g. useInfiniteQuery's isFetchNextPageError). */
  loadMoreError?: boolean;
  emptyLabel?: string;
  /** The list's accessible name («Bălți», «Înscrieri», «Arbitri»). */
  listLabel: string;
  testId?: string;
};

export function SearchSelectDialog<T extends SearchSelectOption>({ open, onClose, title, ...body }: Props<T>) {
  return (
    <ResponsiveSurface open={open} onClose={onClose} intent="info" title={title} sheetSnap={0.9} pinnedActions>
      {open ? <PickerBody {...body} /> : null}
    </ResponsiveSurface>
  );
}

function PickerBody<T extends SearchSelectOption>({
  searchLabel,
  placeholder,
  options,
  onSelect,
  onQueryChange,
  loading = false,
  error = false,
  onRetry,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  loadMoreError = false,
  emptyLabel = 'Nu s-au găsit rezultate',
  listLabel,
  testId = 'search-select',
}: Omit<Props<T>, 'open' | 'onClose' | 'title'>) {
  const [input, setInput] = useState('');

  // Server search: the caller hears the text after a pause (the first, empty value is not sent).
  const notify = useRef(onQueryChange);
  useEffect(() => {
    notify.current = onQueryChange;
  }, [onQueryChange]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!notify.current) return;
    const id = window.setTimeout(() => notify.current?.(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [input]);

  const rows = useMemo(
    () => orderOptions(onQueryChange ? options : filterOptions(options, input)),
    [options, input, onQueryChange],
  );

  // The next page when the end of the list comes into view — one at a time, never retried by itself.
  const [pager, setPager] = useState(pagerIdle);
  const [pagerQuery, setPagerQuery] = useState(input);
  if (pagerQuery !== input) {
    // A new search starts a new list: forget the last page's failure.
    setPagerQuery(input);
    setPager(pagerIdle);
  }
  const progressed = pagerOnProgress(pager, { loadingMore, rowCount: rows.length, loadMoreError });
  if (progressed !== pager) setPager(progressed);

  const observe = pagerCanObserve(progressed, { hasMore, hasHandler: !!onLoadMore, loading, error, rowCount: rows.length });
  const latest = useRef({ pager: progressed, loadingMore, rowCount: rows.length, onLoadMore });
  useEffect(() => {
    latest.current = { pager: progressed, loadingMore, rowCount: rows.length, onLoadMore };
  });
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el || !observe) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      const cur = latest.current;
      const next = pagerOnEnd(cur.pager, { loadingMore: cur.loadingMore, rowCount: cur.rowCount });
      if (!next.call || !cur.onLoadMore) return;
      latest.current = { ...cur, pager: next.state };
      setPager(next.state);
      cur.onLoadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [observe]);

  const retryPage = () => {
    if (!onLoadMore) return;
    setPager(pagerRetry({ rowCount: rows.length }));
    onLoadMore();
  };

  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <div className="sticky top-0 z-above -mx-1 bg-surface px-1 pt-1 pb-2">
        <div className={controlShell(false)}>
          <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-accent-ink" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={placeholder ?? searchLabel}
            aria-label={searchLabel}
            autoComplete="off"
            enterKeyHint="search"
            className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </div>
      {loading ? (
        <State role="status">Se încarcă...</State>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <p role="alert" className="t-body text-center text-status-danger-fg">
            Eroare la încărcarea datelor
          </p>
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              Încearcă din nou
            </Button>
          ) : null}
        </div>
      ) : rows.length === 0 ? (
        <State role="status">{emptyLabel}</State>
      ) : (
        <ul aria-label={listLabel} className="flex flex-col gap-2">
          {rows.map((option) => (
            <li key={option.id}>
              <OptionRow option={option} onSelect={() => onSelect(option)} />
            </li>
          ))}
        </ul>
      )}
      {observe ? <div ref={end} aria-hidden className="h-px" /> : null}
      {loadingMore ? (
        <p role="status" className="t-body pb-2 text-muted">
          Se încarcă...
        </p>
      ) : progressed.failed && hasMore && !loading && !error ? (
        <div className="flex flex-col items-center gap-2 pb-2" data-testid={`${testId}-more-error`}>
          <p role="alert" className="t-body text-center text-status-danger-fg">
            Nu am putut încărca mai multe.
          </p>
          <Button variant="secondary" onClick={retryPage}>
            Încearcă din nou
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function OptionRow({ option, onSelect }: { option: SearchSelectOption; onSelect: () => void }) {
  const lines = optionHelperLines(option.helper);
  const name = [option.label, option.disabledReason, option.selected ? 'selectat' : null].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      disabled={option.disabled}
      onClick={onSelect}
      aria-label={name}
      aria-pressed={option.selected || undefined}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-control border border-hairline px-3 py-2 text-left',
        'transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        option.disabled ? 'cursor-not-allowed bg-soft-fill' : option.selected ? 'cursor-pointer bg-accent-tint' : 'cursor-pointer bg-surface hover:bg-soft-fill',
      )}
    >
      {option.avatar ? (
        <Avatar name={option.avatar.name} src={option.avatar.src} size={40} shape={option.avatar.square ? 'square' : 'round'} />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('t-body truncate', option.disabled ? 'text-ink-2' : 'text-ink')}>{option.label}</span>
        {lines.map((line) => (
          <span key={line} className="t-caption truncate text-muted">
            {line}
          </span>
        ))}
      </span>
      {option.disabledReason ? (
        <span aria-hidden className="t-caption shrink-0 rounded-full bg-surface px-2 py-0.5 text-ink-2">
          {option.disabledReason}
        </span>
      ) : null}
      {option.selected ? <CheckIcon aria-hidden className="size-5 shrink-0 text-accent-ink" /> : null}
    </button>
  );
}

function State({ children, role }: { children: string; role: 'status' | 'alert' }) {
  return (
    <p role={role} className="t-body py-6 text-center text-muted">
      {children}
    </p>
  );
}
