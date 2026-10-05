'use client';

import { useState } from 'react';

/**
 * "Urmărește" toggle on the angler card (secondary button: indigo-2 fill, indigo-7 text).
 * Controlled when `following` + `onToggle` are passed; otherwise it keeps its own state so the
 * kit can show both looks. Sits above the card's stretched link (relative z-above).
 */
export function FollowButton({
  following,
  defaultFollowing = false,
  onToggle,
  pending = false,
  name,
}: {
  following?: boolean;
  defaultFollowing?: boolean;
  onToggle?: (next: boolean) => void;
  pending?: boolean;
  /** Who is being followed, for the accessible name. */
  name: string;
}) {
  const [local, setLocal] = useState(defaultFollowing);
  const isFollowing = following ?? local;

  return (
    <button
      type="button"
      aria-pressed={isFollowing}
      aria-label={isFollowing ? `Nu mai urmări pe ${name}` : `Urmărește pe ${name}`}
      disabled={pending}
      onClick={() => {
        const next = !isFollowing;
        if (following === undefined) setLocal(next);
        onToggle?.(next);
      }}
      className={`relative z-above flex h-10 w-full items-center justify-center rounded-control t-body-strong transition-colors duration-(--duration-fast) ease-fast disabled:opacity-60 ${
        isFollowing
          ? 'bg-soft-fill text-ink-2 hover:bg-hairline'
          : 'bg-accent-tint-2 text-accent-ink hover:bg-accent-tint'
      }`}
    >
      {isFollowing ? 'Urmărești' : 'Urmărește'}
    </button>
  );
}
