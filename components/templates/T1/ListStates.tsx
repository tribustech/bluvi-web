'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ExclamationCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { SadSearchIcon } from '@/components/icons/brand';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { LIST_GRID_COLS, listGridClass, ROWS_HEAD } from './ListBody';

/*
 * Every non-data state of a T1 list, in the list's own slot (the header, tabs and toolbar stay, so
 * the user can always change the question). fish: CompetitionsListSkeleton, ErrorScreen,
 * ListEmptyComponent, the «Intră în cont» gate and ListLoadingStateFooter.
 */

/**
 * First-page skeleton in the shape of the real content: `cards` mirrors ListGrid (photo band +
 * three lines), `rows` mirrors ListRows — pass `head` (the same captions ListRows gets) so the
 * column head bar (table layout, by the list's width) is there before the data and the rows do
 * not jump when it lands. The cards grid is ListGrid's own class (listGridClass).
 * Announced once: the label is the live region's TEXT (a status announces content, not its name).
 */
export function ListSkeleton({
  variant = 'cards',
  count = 6,
  label = 'Se încarcă…',
  min = 'md',
  head,
}: {
  variant?: 'cards' | 'rows';
  count?: number;
  label?: string;
  min?: keyof typeof LIST_GRID_COLS;
  /** rows: the ListRows head (shown in table layout, as there). */
  head?: ReactNode;
}) {
  const items = Array.from({ length: count }, (_, i) => i);
  if (variant === 'rows') {
    return (
      <div role="status" className="@container overflow-hidden rounded-card bg-surface shadow-e0">
        <span className="sr-only">{label}</span>
        {head ? (
          <div aria-hidden className={cn('hidden border-b border-hairline px-4 py-2.5 t-label text-muted', ROWS_HEAD)}>
            {head}
          </div>
        ) : null}
        <ul aria-hidden className="divide-y divide-hairline">
          {items.map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3.5">
              <span className="size-14 shrink-0 animate-shimmer rounded-avatar" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-2.5 w-20 rounded-full bg-soft-fill" />
                <span className="h-3.5 w-[70%] rounded-full bg-soft-fill" />
                <span className="h-2.5 w-[45%] rounded-full bg-soft-fill" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <ul aria-hidden className={listGridClass(min)}>
        {items.map((i) => (
          <li key={i} className="overflow-hidden rounded-card bg-surface shadow-e0">
            <span className="block h-33 animate-shimmer" />
            <span className="flex flex-col gap-2.5 p-3">
              <span className="h-2.5 w-24 rounded-full bg-soft-fill" />
              <span className="h-4 w-[80%] rounded-full bg-soft-fill" />
              <span className="h-3 w-[50%] rounded-full bg-soft-fill" />
              <span className="my-0.5 h-px bg-hairline" />
              <span className="h-3 w-[35%] rounded-full bg-soft-fill" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The page-level state card the three states below share: one 48px icon slot, title, caption,
 * actions. It is the kit StateCard (surfaces/StateCard: EmptyState / ErrorState) laid out for a
 * page slot instead of a row — same surface, same danger hairline, and the kit ErrorState's disc
 * spec (40 disc, 22 glyph) so there is ONE error glyph across T1 and every ErrorState.
 * TODO(kit): becomes StateCard `layout="page"` (centred, title t-heading, actions row) with a
 * `--shadow-danger-line` token shared by both layouts (components/surfaces + globals.css are
 * outside T1); ListEmpty / ListError / ListSignInGate then become thin wrappers over it.
 */
function PageState({
  tone = 'neutral',
  icon,
  title,
  description,
  actions,
  after,
  alert = false,
  announceKey,
}: {
  tone?: 'neutral' | 'danger';
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** A line under the actions (a failed retry's «Tot nu merge»). */
  after?: ReactNode;
  alert?: boolean;
  /**
   * Re-mounts the title and description when it changes, so an alert that stays mounted is spoken
   * again (a retry that failed once more) — the container and its focused button stay put.
   */
  announceKey?: string | number;
}) {
  return (
    <div
      role={alert ? 'alert' : undefined}
      className={cn(
        // Capped at the centre column's width with the aside docked (800 at 1440), so the same state
        // is the same card on every page — never a 1100px white slab around a one-line message. It
        // shares the column's LEFT edge with the heading and the search above it (never centred in
        // the column: with the aside gone the column widens and a centred card left two left edges).
        'flex w-full max-w-200 flex-col items-center gap-2 rounded-card bg-surface px-6 py-10 text-center md:py-14 xl:py-16',
        tone === 'danger' ? 'shadow-[inset_0_0_0_1px_var(--color-status-danger-line)]' : 'shadow-e0',
      )}
    >
      <span aria-hidden className="mb-1 flex size-12 items-center justify-center">
        {icon}
      </span>
      <Fragment key={announceKey}>
        <p className="t-heading text-ink">{title}</p>
        {description ? <p className="t-caption max-w-md text-muted">{description}</p> : null}
      </Fragment>
      {actions ? <div className="mt-3 flex flex-wrap items-center justify-center gap-3">{actions}</div> : null}
      {after}
    </div>
  );
}

/** Icon disc of the error and gate cards — the kit ErrorState's: a 40 disc with the 22 glyph. */
function Disc({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn('flex size-10 items-center justify-center rounded-full [&>svg]:size-5.5', className)}>{children}</span>;
}

/**
 * Nothing matches. Centered, generous (fish: paddingVertical 40): the title says what is empty,
 * the description says how to get something («Schimbă tabul…»), `action` undoes the cause
 * («Șterge filtrele») — a secondary Button, the one CTA look of the state cards.
 */
export function ListEmpty({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <PageState
      icon={<span className="flex text-ink">{icon ?? <SadSearchIcon size={48} />}</span>}
      title={title}
      description={description}
      actions={action}
    />
  );
}

/**
 * The first page failed. The header and tabs stay usable; «Încearcă din nou» refetches (fish
 * ErrorScreen). `secondaryAction` is the fix that is not a retry — «Deconectează-te» for a dead
 * session. While retrying the button stays focusable (aria-disabled, not disabled), so a keyboard
 * user does not fall back to <body>.
 *
 * `attempt` (TanStack errorUpdateCount): a retry that fails again is never silent — the alert's
 * text re-mounts (spoken again) and a line under the button says so, for sighted users too.
 * `focusOnMount` moves focus to the retry button when the card replaces the whole page (a route
 * error boundary), so a keyboard user is not left on <body> behind the top bar.
 */
export function ListError({
  title = 'Nu am putut încărca lista',
  description = 'Verifică conexiunea și încearcă din nou.',
  onRetry,
  retrying = false,
  retryLabel = 'Încearcă din nou',
  secondaryAction,
  attempt = 1,
  focusOnMount = false,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  secondaryAction?: ReactNode;
  /** How many times the read has failed (1 = the first failure). */
  attempt?: number;
  focusOnMount?: boolean;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnMount) retryRef.current?.focus();
  }, [focusOnMount]);
  const again = attempt > 1 && !retrying;
  return (
    <PageState
      tone="danger"
      alert
      announceKey={attempt}
      after={
        again ? (
          <p className="t-caption mt-1 text-muted">
            Tot nu merge. Încercarea {attempt}.
          </p>
        ) : null
      }
      icon={
        <Disc className="bg-status-danger-bg text-status-danger-fg">
          <ExclamationCircleIcon />
        </Disc>
      }
      title={title}
      description={description}
      actions={
        onRetry || secondaryAction ? (
          <>
            {onRetry ? (
              <Button
                ref={retryRef}
                variant="secondary"
                aria-disabled={retrying || undefined}
                aria-busy={retrying || undefined}
                onClick={() => {
                  if (!retrying) onRetry();
                }}
              >
                {retrying ? 'Se reîncarcă…' : retryLabel}
              </Button>
            ) : null}
            {secondaryAction}
          </>
        ) : undefined
      }
    />
  );
}

/**
 * A per-user list asked for while signed out (fish: «🔑 Intră în cont ca să vezi concursurile
 * tale.» + «Intră în cont»). The public tabs stay one tap away. The CTA is the outline Button —
 * the sign-in look everywhere a gate stands in for content.
 */
export function ListSignInGate({
  title = 'Intră în cont',
  description,
  href,
  cta = 'Intră în cont',
}: {
  title?: string;
  description: ReactNode;
  /** Sign-in URL that returns here. */
  href: string;
  cta?: string;
}) {
  return (
    <PageState
      icon={
        <Disc className="bg-accent-tint text-accent-ink">
          <LockClosedIcon />
        </Disc>
      }
      title={title}
      description={description}
      actions={
        <ButtonLink href={href} variant="outline">
          {cta}
        </ButtonLink>
      }
    />
  );
}

/**
 * Under the last row. Pages of N load as the footer nears the viewport (fish onEndReached at 0.6),
 * with a real button as the fallback and for keyboard users; the button says a page is on its way
 * (fish ListLoadingStateFooter), and the end says so once.
 *
 * A failed page (`error`) stops the auto-load — otherwise the observer re-fires at once while the
 * footer is in range and hammers a dead CMS — and says so, with a manual «Reîncearcă». Auto-load
 * re-arms only after a page lands. The button is aria-disabled (never disabled) while loading so
 * keyboard focus stays on it; if the last page lands while it has focus, focus moves to the end line.
 */
export function ListFooter({
  hasMore,
  loadingMore,
  onLoadMore,
  error = false,
  shown,
  total,
  noun,
  endLabel,
  errorLabel,
  auto = true,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** The last next-page fetch failed (TanStack isFetchNextPageError). */
  error?: boolean;
  /** «20 din 48 concursuri». */
  shown?: number;
  total?: number;
  /** Plural noun for the progress line («concursuri»). */
  noun?: string;
  /** Shown when everything is loaded; omit to show nothing. */
  endLabel?: string;
  /** «Nu am putut încărca mai multe concursuri.» */
  errorLabel?: string;
  /** Load the next page when the footer scrolls into view. */
  auto?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLParagraphElement>(null);
  const load = useRef(onLoadMore);
  useEffect(() => {
    load.current = onLoadMore;
  });

  useEffect(() => {
    const el = sentinel.current;
    if (!auto || !hasMore || loadingMore || error || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) load.current();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, hasMore, loadingMore, error]);

  // The button unmounts with the last page: if it had focus (focus fell to <body>), keep a keyboard
  // user's place on the end line instead.
  const [focusEnd, setFocusEnd] = useState(false);
  useEffect(() => {
    if (!focusEnd || hasMore) return;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (lost) end.current?.focus();
  }, [focusEnd, hasMore]);

  const progress =
    shown !== undefined && total !== undefined && noun ? `${shown} din ${total} ${noun}` : undefined;

  if (!hasMore) {
    if (endLabel) {
      return (
        <p ref={end} tabIndex={-1} className="t-caption py-4 text-center text-muted outline-none">
          {endLabel}
        </p>
      );
    }
    return focusEnd ? (
      <p ref={end} tabIndex={-1} className="sr-only">
        Ai ajuns la finalul listei.
      </p>
    ) : null;
  }
  return (
    <div ref={sentinel} className="flex flex-col items-center gap-2 py-4">
      <p aria-live="polite" className={cn('t-caption', error && !loadingMore ? 'text-status-danger-fg' : 'text-muted')}>
        {error && !loadingMore ? (errorLabel ?? 'Nu am putut încărca mai multe.') : progress}
      </p>
      <Button
        variant="secondary"
        aria-disabled={loadingMore || undefined}
        aria-busy={loadingMore || undefined}
        onFocus={() => setFocusEnd(true)}
        onClick={() => {
          if (!loadingMore) onLoadMore();
        }}
      >
        {loadingMore ? 'Se încarcă…' : error ? 'Reîncearcă' : 'Încarcă mai multe'}
      </Button>
    </div>
  );
}
