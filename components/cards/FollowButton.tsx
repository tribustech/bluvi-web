'use client';

import { useState } from 'react';
import { CheckIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/**
 * "Urmărește" / "Urmăresc" toggle (fish components/FollowButton.tsx copy).
 *  - `look="card"` (default): the angler card's — secondary button (indigo-2 fill, indigo-7 text),
 *    full width, no icon.
 *  - `look="profile"`: fish's own FollowButton on the angler profile (account.angler-profile c10) —
 *    filled accent «Urmărește» with the user-plus icon, neutral «Urmăresc» with a check, as wide as
 *    its label (or the container with `block`).
 *    `size="row"` (look="profile" in a list row, fish's `size` prop): below 1024 a compact 13px label
 *    with 14px sides at one fixed 124px width (both labels, no jump on a toggle), so the row's name keeps
 *    most of a 320 row; the profile's 144px button from 1024, where the grid cards are wide.
 * Controlled when `following` + `onToggle` are passed; otherwise it keeps its own state so the
 * kit can show both looks. Disabled while `pending`. Sits above the card's stretched link (relative z-above).
 */
export function FollowButton({
  following,
  defaultFollowing = false,
  onToggle,
  pending = false,
  name,
  look = 'card',
  block = false,
  size = 'default',
  className,
}: {
  following?: boolean;
  defaultFollowing?: boolean;
  onToggle?: (next: boolean) => void;
  pending?: boolean;
  /** Who is being followed, for the accessible name. */
  name: string;
  look?: 'card' | 'profile';
  /** `look="profile"`: stretch to the container's width. */
  block?: boolean;
  /** `look="profile"`: `row` = compact below 1024 (connections / search rows); `compact` = fish small. */
  size?: 'default' | 'row' | 'compact';
  className?: string;
}) {
  const [local, setLocal] = useState(defaultFollowing);
  const isFollowing = following ?? local;
  const profile = look === 'profile';
  const row = profile && size === 'row' && !block;
  const compact = profile && size === 'compact';

  return (
    <button
      type="button"
      aria-pressed={isFollowing}
      aria-label={isFollowing ? `Nu mai urmări pe ${name}` : `Urmărește pe ${name}`}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => {
        const next = !isFollowing;
        if (following === undefined) setLocal(next);
        onToggle?.(next);
      }}
      className={cn(
        'relative z-above flex items-center justify-center transition-colors duration-(--duration-fast) ease-fast disabled:opacity-60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        row ? 't-button-compact lg:t-body-strong' : compact ? 't-button-compact' : 't-body-strong',
        compact
          ? cn(
              "h-8 gap-1 rounded-lg px-3 before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
              block ? 'w-full' : 'min-w-28',
              isFollowing ? 'bg-soft-fill text-ink hover:bg-hairline' : 'bg-accent text-on-accent hover:brightness-95',
            )
          : profile
          ? cn('h-10 gap-1.5 rounded-control', row ? 'w-31 whitespace-nowrap px-3.5 lg:w-auto lg:min-w-36 lg:px-5.5' : cn('px-5.5', block ? 'w-full' : 'min-w-36'), isFollowing ? 'bg-soft-fill text-ink hover:bg-hairline' : 'bg-accent text-on-accent shadow-button hover:brightness-95')
          : cn('h-10 w-full rounded-control', isFollowing ? 'bg-soft-fill text-ink-2 hover:bg-hairline' : 'bg-accent-tint-2 text-accent-ink hover:bg-accent-tint'),
        className,
      )}
    >
      {profile ? (
        isFollowing ? (
          <CheckIcon aria-hidden className={cn('stroke-2', compact ? 'size-3.5' : 'size-4')} />
        ) : (
          <UserPlusIcon aria-hidden className={cn('stroke-2', compact ? 'size-3.5' : 'size-4')} />
        )
      ) : null}
      {isFollowing ? 'Urmăresc' : 'Urmărește'}
    </button>
  );
}
