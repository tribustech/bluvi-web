'use client';

import { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
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
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { HorizontalRail, RailItem } from './HorizontalRail';
import { SeeAllTitle } from './SeeAllTitle';
import { SolidFollowButton } from './SolidFollowButton';
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
 */
export function SuggestedAnglers({ layout }: { layout: 'rail' | 'grid' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const { data, isPending, isError } = useInfiniteQuery(suggestedAnglersHomeInfiniteQuery(t, { isAuthenticated: true }));
  const follow = useMutation(followAnglerMutation(t, qc));
  const hidden = useSyncExternalStore(dismissedStore.subscribe, dismissedStore.get, dismissedStore.getServer);
  const visible = useMemo(() => withoutDismissed(data?.pages[0]?.data ?? [], hidden), [data, hidden]);

  if (isPending || isError || visible.length < MIN_VISIBLE_SUGGESTIONS) return null;

  const id = `acasa-pescari-${layout}`;
  const card = (a: SuggestedAngler) => (
    <SuggestedAnglerCard
      angler={a}
      onDismiss={() => dismissedStore.dismiss(a.documentId)}
      onFollow={(next) => follow.mutate({ documentId: a.documentId, follow: next })}
      pending={follow.isPending && follow.variables?.documentId === a.documentId}
    />
  );

  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', layout === 'rail' && 'pt-1.5')}>
      <SeeAllTitle id={id} title="Pescari pe care îi poți urmări" href={homeLinks.suggestedAnglers} />
      {layout === 'grid' ? (
        // Four across on narrower desktops, five from 1440 (design); the fifth is hidden below 2xl.
        <ul className="grid grid-cols-4 gap-3 2xl:grid-cols-5" aria-label="Pescari sugerați">
          {visible.slice(0, 5).map((a, i) => (
            <li key={a.documentId} className={i === 4 ? 'hidden min-w-0 2xl:block' : 'min-w-0'}>
              {card(a)}
            </li>
          ))}
        </ul>
      ) : (
        <HorizontalRail label="Pescari sugerați">
          {visible.map((a) => (
            <RailItem key={a.documentId} width={160}>
              {card(a)}
            </RailItem>
          ))}
        </HorizontalRail>
      )}
    </section>
  );
}

/** fish features/anglers/components/SuggestedAnglerCard.tsx */
function SuggestedAnglerCard({
  angler,
  onDismiss,
  onFollow,
  pending,
}: {
  angler: SuggestedAngler;
  onDismiss: () => void;
  onFollow: (next: boolean) => void;
  pending: boolean;
}) {
  const stats = pickTopStats(angler.stats);
  return (
    <article className="relative flex h-full flex-col items-center gap-2.5 rounded-card bg-surface px-3 pt-4 pb-3">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Ascunde sugestia: ${angler.username}`}
        className="absolute top-1.5 right-1.5 z-10 flex size-8 items-center justify-center rounded-full text-muted hover:bg-soft-fill"
      >
        <XMarkIcon aria-hidden className="size-3.5 stroke-[2.5]" />
      </button>
      <Avatar name={angler.username} src={angler.avatarUrl} size={64} />
      <div className="flex w-full flex-col items-center gap-0.5">
        <h3 className="w-full truncate text-center t-body-strong">
          <Link
            href={routes.angler(angler.documentId)}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
          >
            {angler.username}
          </Link>
        </h3>
        {/* Zero followers reads quieter by weight, not by a sub-AA colour: muted (4.8:1) vs ink-2. */}
        <p className={cn('truncate t-caption', angler.stats.followers > 0 ? 'text-ink-2' : 'text-muted')}>{formatFollowers(angler.stats.followers ?? 0)}</p>
      </div>
      <div className="flex min-h-9 items-start justify-center gap-4">
        {stats.length === 0 ? (
          <p className="t-caption leading-9 text-muted">Pescar nou</p>
        ) : (
          stats.map((s) => (
            <p key={s.label} className="flex min-w-12 flex-col items-center">
              <span className="t-body text-ink">{s.value}</span>
              <span className="t-micro text-muted">{s.label}</span>
            </p>
          ))
        )}
      </div>
      <div className="mt-auto w-full">
        <SolidFollowButton name={angler.username} following={angler.isFollowedByMe} onToggle={onFollow} pending={pending} />
      </div>
    </article>
  );
}
