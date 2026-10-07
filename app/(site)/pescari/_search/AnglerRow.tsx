'use client';

import Link from 'next/link';
import { useFollowAngler } from '@/components/account/angler/useFollowAngler';
import { FollowButton } from '@/components/cards/FollowButton';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import type { AnglerListItem } from '@/core/social';
import { routes } from '@/lib/routes';

/**
 * The list of anglers, drawn two ways (owner rules 5 and 14: a wide screen is not the phone list
 * stretched):
 *  - below 768, fish's two phone shapes (pescari.tsx): `grouped` — one white surface of rows with
 *    hairlines between, fish's «Urmăriți de prietenii tăi» card (pescari.tsx:137-151); `separate` —
 *    each row its own rounded card, 8px apart, fish's «Activi recent» and search results
 *    (pescari.tsx:93-101, ConnectionRow's own white 12px-radius box);
 *  - from 768, both are a dense auto-fill grid of angler cards — at least 160px (176 from 1024, so
 *    the common long names fit), the account.suggested grid's columns: 4 at 768, 6 at 1280, 7 at
 *    1440, 9 at 1920.
 * Shared by the list and its skeleton, so nothing moves when the rows land.
 */
export type AnglerListLook = 'grouped' | 'separate';

const GRID = cn(
  'md:grid md:grid-cols-[repeat(auto-fill,minmax(--spacing(40),1fr))] md:gap-3',
  'lg:grid-cols-[repeat(auto-fill,minmax(--spacing(44),1fr))] lg:gap-4',
);

export function anglerList(look: AnglerListLook) {
  return look === 'grouped'
    ? cn(
        'flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0',
        'md:divide-y-0 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none',
        GRID,
      )
    : cn('flex flex-col gap-2', GRID);
}

/**
 * One entry's box: a 60px row on the phone (inside the grouped surface, or its own rounded card),
 * a card from 768 (avatar on top, name and subline under it, follow in the top-right corner).
 */
const itemBox = (look: AnglerListLook) =>
  cn(
    'relative flex min-h-15 min-w-0 items-center gap-3 px-3 py-2.5',
    look === 'separate' && 'rounded-card bg-surface shadow-e0',
    'md:flex-col md:gap-2.5 md:rounded-card md:bg-surface md:px-3 md:pt-4 md:pb-4 md:shadow-e0',
  );

/**
 * One angler — fish components/profile/ConnectionRow.tsx with a subline (partide.pescari c5): the
 * avatar (photo, or initials on the angler's tone keyed by documentId, the same as their profile),
 * the username on one line, the server's RO subline verbatim («Urmărit de X și încă N», «N
 * urmăritori»), and fish's FollowButton — the icon-only circle on a phone row (fish size 'icon'),
 * the same circle in the card's top-right corner from 768 (one quiet glyph per card, not a wall of
 * filled buttons — Revolut-clean Partide). Every card ends on its subline, so the viewer's own card
 * (no button) ends like its neighbours. The viewer's own entry has no follow button and is marked
 * «Tu» (fish: `isSelfRow`, no button on yourself).
 *
 * The whole row / card opens /pescari/{id}: the name is a link stretched over it (after:inset-0),
 * the follow button sits above it (z-above). The entry's ring is the link's keyboard focus.
 * Following is useFollowAngler → core followAnglerMutation: the entry flips at once in every loaded
 * search / suggestion list and rolls back on an error.
 */
export function AnglerRow({ item, isSelf, look }: { item: AnglerListItem; isSelf: boolean; look: AnglerListLook }) {
  return (
    <li
      className={cn(
        itemBox(look),
        'transition-[box-shadow,background-color] duration-(--duration-fast) ease-fast hover:bg-soft-fill/60 md:hover:bg-surface md:hover:shadow-e1',
        'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-accent md:has-[a:focus-visible]:outline-offset-2',
      )}
      data-testid="angler-row"
      data-id={item.documentId}
      data-self={isSelf || undefined}
    >
      <Avatar
        name={item.username}
        src={item.avatarUrl}
        size={40}
        tone={toneForId(item.documentId)}
        className="md:size-16 md:text-initials-64"
      />
      <div className="flex min-w-0 flex-1 flex-col md:w-full md:flex-none md:items-center">
        <span className="flex min-w-0 items-center gap-2 md:max-w-full md:justify-center">
          <Link
            href={routes.angler(item.documentId)}
            title={item.username}
            className="min-w-0 truncate t-body text-ink outline-hidden after:absolute after:inset-0 after:content-[''] md:t-body-strong md:after:rounded-card"
            data-testid="angler-name"
          >
            {item.username}
          </Link>
          {isSelf ? (
            <Badge color="indigo" className="self-center">
              Tu
            </Badge>
          ) : null}
        </span>
        {item.subline ? (
          <p className="mt-0.5 truncate t-micro text-muted md:line-clamp-2 md:text-center md:whitespace-normal" data-testid="angler-subline">
            {item.subline}
          </p>
        ) : null}
      </div>
      {isSelf ? null : <RowFollow item={item} />}
    </li>
  );
}

function RowFollow({ item }: { item: AnglerListItem }) {
  // Behind the page's gate: always signed in.
  const follow = useFollowAngler(item.documentId, { signedIn: true });
  const common = {
    look: 'profile' as const,
    following: item.isFollowedByMe,
    pending: follow.isPending,
    onToggle: follow.toggle,
    name: item.username,
  };
  return (
    <span className="flex shrink-0 md:absolute md:top-2 md:right-2">
      <FollowButton {...common} size="icon" />
    </span>
  );
}

/**
 * The placeholder while the first page loads, in the list's own shape at each width: fish
 * AnglerListSkeleton rows={7} on the phone (separate rounded rows); from 768 exactly two full rows
 * of cards whatever the column count (18 cards = 2 × the widest 9-column grid; the explicit two
 * rows are kept and every later row collapses to 0 and is clipped, so no orphan card on a row of
 * its own). Each entry: the avatar, the name and subline bars, the follow circle's place.
 */
export function AnglerListSkeleton({ label = 'Se încarcă pescarii…', look = 'separate' }: { label?: string; look?: AnglerListLook }) {
  const widths = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5', 'w-2/5', 'w-1/2', 'w-1/3'];
  return (
    <div role="status" data-testid="anglers-skeleton">
      <span className="sr-only">{label}</span>
      <ul
        aria-hidden
        className={cn(
          anglerList(look),
          'md:auto-rows-[0] md:grid-rows-[auto_auto] md:gap-y-0 md:overflow-hidden md:-mb-3 lg:gap-y-0 lg:-mb-4',
        )}
      >
        {Array.from({ length: SKELETON_GRID }, (_, i) => (
          <li key={i} className={cn(itemBox(look), 'md:mb-3 lg:mb-4', i >= SKELETON_PHONE && 'max-md:hidden')}>
            <span className="size-10 shrink-0 animate-shimmer rounded-full md:size-16" />
            <span className="flex min-w-0 flex-1 flex-col gap-2 md:w-full md:flex-none md:items-center">
              <span className={cn('h-3.5 animate-shimmer rounded-full md:w-[70%]', widths[i % widths.length])} />
              <span className="h-2.5 w-1/3 animate-shimmer rounded-full md:w-1/2" />
            </span>
            <span className="size-8 shrink-0 animate-shimmer rounded-full md:absolute md:top-2 md:right-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** fish's seven skeleton rows on the phone; two full rows of the widest (9-column) grid from 768. */
const SKELETON_PHONE = 7;
const SKELETON_GRID = 18;
