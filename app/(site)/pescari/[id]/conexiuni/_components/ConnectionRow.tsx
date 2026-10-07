'use client';

import Link from 'next/link';
import { useFollowAngler } from '@/components/account/angler/useFollowAngler';
import { FollowButton } from '@/components/cards/FollowButton';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import type { AnglerListItem } from '@/core/social';
import { routes } from '@/lib/routes';

/**
 * One follower / followed angler — fish components/profile/ConnectionRow.tsx (account.connections
 * c5, c6, c11): a white row-card with the 40px avatar (photo, or initials on the angler's tone, keyed
 * by documentId like fish colorForId: stable across renames, the same as their profile header), the
 * username on one line and fish's FollowButton (kit look="profile": accent «Urmărește» + user-plus,
 * neutral «Urmăresc» + check; size="row": compact below 1024 so the name keeps the row, like fish's
 * 13pt row button). The viewer's own row has no button (`isSelf`). A cut name has its full text as
 * the link's title.
 *
 * The whole card opens /pescari/{id}: the name is a link stretched over the card (after:inset-0),
 * the follow button sits above it (z-above) so pressing it never navigates. The card's ring is the
 * link's keyboard focus (has-[a:focus-visible]); the button keeps its own ring.
 *
 * Following is useFollowAngler → core followAnglerMutation: the row flips at once in every loaded
 * connections / search / suggestion list and rolls back on an error (c11).
 */
export function ConnectionRow({ item, isSelf }: { item: AnglerListItem; isSelf: boolean }) {
  return (
    <li
      className="relative flex min-h-15 items-center gap-3 rounded-card bg-surface p-2.5 shadow-e0 transition-shadow duration-(--duration-fast) ease-fast hover:shadow-e1 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-accent"
      data-testid="connection-row"
      data-id={item.documentId}
    >
      <Avatar name={item.username} src={item.avatarUrl} size={40} tone={toneForId(item.documentId)} />
      <Link
        href={routes.angler(item.documentId)}
        title={item.username}
        className="min-w-0 flex-1 truncate t-body text-ink outline-hidden after:absolute after:inset-0 after:rounded-card after:content-['']"
      >
        {item.username}
      </Link>
      {isSelf ? null : <RowFollow item={item} />}
    </li>
  );
}

function RowFollow({ item }: { item: AnglerListItem }) {
  // Behind the gate: always signed in.
  const follow = useFollowAngler(item.documentId, { signedIn: true });
  return (
    <FollowButton
      look="profile"
      size="row"
      following={item.isFollowedByMe}
      pending={follow.isPending}
      onToggle={follow.toggle}
      name={item.username}
      className="shrink-0"
    />
  );
}
