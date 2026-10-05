'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dismissSuggestion,
  followAnglerMutation,
  formatFollowers,
  pickTopStats,
  suggestedAnglersHomeInfiniteQuery,
  withoutDismissed,
  type SuggestedAngler,
} from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { CardShell, CardTitle, FollowButton } from '@/components/cards';
import { IconButton } from '@/components/nav/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { useSiteToast } from '../_shell/Toast';
import { announce, prepareAnnouncer, restoreFocusTo } from './announce';
import { HorizontalRail, RailItem } from './HorizontalRail';
import { RailSection } from './RailSection';
import { homeLinks } from './links';

/** Under this many VISIBLE cards the whole section disappears (fish, spec 2026-09-04). */
const MIN_VISIBLE_SUGGESTIONS = 3;

/*
 * fish dismissedSuggestionsAtom: a plain in-memory set — a dismissal lasts the app session and the
 * person can resurface next launch. Here: until the tab reloads. Module-level so the mobile and the
 * desktop compositions agree.
 */
let dismissed: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();
const dismissedStore = {
  subscribe: (l: () => void) => (listeners.add(l), () => void listeners.delete(l)),
  get: () => dismissed,
  getServer: () => EMPTY,
  dismiss: (documentId: string) => {
    dismissed = dismissSuggestion(dismissed, documentId);
    listeners.forEach((l) => l());
  },
};

/**
 * fish features/anglers/components/SuggestedAnglersRail.tsx — signed in only, page 1 only, no
 * skeleton (a thin pool would watch a placeholder collapse into nothing): the section appears once
 * loaded and only with at least three visible cards.
 *
 * fish: a refresh never reshuffles the rail (useSuggestedAnglersHome cache policy). On the web the
 * page refresh re-renders the server prefetch, which hydrates a fresh page 1 — so the order (and
 * the set) of the first answer is pinned for the life of the page; later data only updates the
 * cards it shows (a follow).
 */
export function SuggestedAnglers() {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const { data, isPending, isError } = useInfiniteQuery(suggestedAnglersHomeInfiniteQuery(t, { isAuthenticated: true }));
  const follow = useMutation(followAnglerMutation(t, qc));
  const toast = useSiteToast();
  const hidden = useSyncExternalStore(dismissedStore.subscribe, dismissedStore.get, dismissedStore.getServer);
  const latest = data?.pages[0]?.data;
  const [pinned, setPinned] = useState<SuggestedAngler[] | undefined>(latest);
  if (pinned === undefined && latest !== undefined) setPinned(latest);
  const visible = useMemo(() => {
    const byId = new Map((latest ?? []).map((a) => [a.documentId, a]));
    return withoutDismissed((pinned ?? []).map((a) => byId.get(a.documentId) ?? a), hidden);
  }, [pinned, latest, hidden]);

  if (isPending || isError || visible.length < MIN_VISIBLE_SUGGESTIONS) return null;

  return (
    <RailSection title="Pescari pe care îi poți urmări" href={homeLinks.suggestedAnglers}>
      <PrepareAnnouncer />
      <HorizontalRail label="Pescari sugerați" width={160}>
        {visible.map((a, i) => (
          <RailItem key={a.documentId} width={160}>
            <SuggestedAnglerCard
              angler={a}
              onDismiss={(e) => dismiss(e, visible, i)}
              // core rolls a failed follow back silently: say so, or the button just flips back.
              onFollow={(next) =>
                follow.mutate(
                  { documentId: a.documentId, follow: next },
                  { onError: () => toast('Nu am putut actualiza. Încearcă din nou.', 'danger') }
                )
              }
              pending={follow.isPending && follow.variables?.documentId === a.documentId}
            />
          </RailItem>
        ))}
      </HorizontalRail>
    </RailSection>
  );
}

/** The announcer must exist before its first message (see announce.ts). */
function PrepareAnnouncer() {
  useEffect(() => prepareAnnouncer(), []);
  return null;
}

/**
 * Hides one suggestion without dropping keyboard focus: it moves to the next card's dismiss (else
 * the previous one's); when the rail falls under three cards and the whole section goes, to the
 * next section's heading. Either way «Sugestie ascunsă» is announced.
 */
function dismiss(e: MouseEvent<HTMLButtonElement>, visible: SuggestedAngler[], i: number) {
  const section = e.currentTarget.closest('section');
  const neighbour = visible[i + 1] ?? visible[i - 1];
  const collapses = visible.length - 1 < MIN_VISIBLE_SUGGESTIONS;
  let target: HTMLElement | null | undefined = null;
  if (!collapses && neighbour) {
    target = section?.querySelector<HTMLElement>(`[data-dismiss="${CSS.escape(neighbour.documentId)}"]`);
  } else {
    // The next block's heading in the same column, else this column's next focusable heading.
    let next = section?.nextElementSibling;
    while (next && !next.querySelector('h2, h3')) next = next.nextElementSibling;
    target = next?.querySelector<HTMLElement>('h2, h3');
  }
  dismissedStore.dismiss(visible[i].documentId);
  announce('Sugestie ascunsă.');
  if (target) restoreFocusTo(target);
}

/**
 * fish features/anglers/components/SuggestedAnglerCard.tsx, on the kit parts: the Avatar (64, the
 * name's pastel tone — fish's solid swatches are a kit gap, not a fork here), the kit FollowButton
 * (its tinted secondary look: a rail of six solid buttons would outweigh the page's real primary
 * actions), the kit icon button for «Ascunde sugestia». The stats always sit on a two-column grid,
 * so numbers and captions line up from card to card; a lone stat spans both, centred.
 */
function SuggestedAnglerCard({
  angler,
  onDismiss,
  onFollow,
  pending,
}: {
  angler: SuggestedAngler;
  onDismiss: (e: MouseEvent<HTMLButtonElement>) => void;
  onFollow: (next: boolean) => void;
  pending: boolean;
}) {
  const stats = pickTopStats(angler.stats);
  return (
    <CardShell interactive className="h-full items-center gap-2.5 px-3 pt-4 pb-3">
      <span className="absolute top-0.5 right-0.5 z-above">
        <IconButton size="size-10" onClick={onDismiss} data-dismiss={angler.documentId} aria-label={`Ascunde sugestia: ${angler.username}`}>
          <XMarkIcon aria-hidden />
        </IconButton>
      </span>
      <Avatar name={angler.username} src={angler.avatarUrl} size={64} />
      <div className="flex w-full flex-col items-center gap-0.5">
        <CardTitle href={routes.angler(angler.documentId)} className="w-full truncate text-center t-body-strong text-ink">
          {angler.username}
        </CardTitle>
        {/* Zero followers reads quieter by weight, not by a sub-AA colour: muted (4.8:1) vs ink-2. */}
        <p className={cn('truncate t-caption', angler.stats.followers > 0 ? 'text-ink-2' : 'text-muted')}>{formatFollowers(angler.stats.followers ?? 0)}</p>
      </div>
      <div className="grid min-h-9 w-full grid-cols-2 items-start gap-x-2">
        {stats.length === 0 ? (
          <p className="col-span-2 text-center t-caption leading-9 text-muted">Pescar nou</p>
        ) : (
          stats.map((s) => (
            <p key={s.label} className={cn('flex min-w-0 flex-col items-center', stats.length === 1 && 'col-span-2')}>
              <span className="t-body text-ink">{s.value}</span>
              <span className="max-w-full truncate t-micro text-muted">{s.label}</span>
            </p>
          ))
        )}
      </div>
      <div className="mt-auto w-full">
        <FollowButton name={angler.username} following={angler.isFollowedByMe} onToggle={onFollow} pending={pending} />
      </div>
    </CardShell>
  );
}
