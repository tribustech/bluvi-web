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
  className?: string;
}) {
  const [local, setLocal] = useState(defaultFollowing);
  const isFollowing = following ?? local;
  const profile = look === 'profile';

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
        'relative z-above flex items-center justify-center rounded-control t-body-strong transition-colors duration-(--duration-fast) ease-fast disabled:opacity-60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        profile
          ? cn('h-10 gap-1.5 px-5.5', block ? 'w-full' : 'min-w-36', isFollowing ? 'bg-soft-fill text-ink hover:bg-hairline' : 'bg-accent text-on-accent shadow-button hover:brightness-95')
          : cn('h-10 w-full', isFollowing ? 'bg-soft-fill text-ink-2 hover:bg-hairline' : 'bg-accent-tint-2 text-accent-ink hover:bg-accent-tint'),
        className,
      )}
    >
      {profile ? isFollowing ? <CheckIcon aria-hidden className="size-4 stroke-2" /> : <UserPlusIcon aria-hidden className="size-4 stroke-2" /> : null}
      {isFollowing ? 'Urmăresc' : 'Urmărește'}
    </button>
  );
}
