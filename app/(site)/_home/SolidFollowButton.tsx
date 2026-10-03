'use client';

import { UserPlusIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/**
 * fish components/profile/FollowButton.tsx `size="small"` as the suggestion card uses it: solid
 * indigo with a white label and a 13px UserPlus while not following; soft fill once following.
 * Same contract and toggle as the kit FollowButton (controlled), which only has the tinted look —
 * kit gap: FollowButton needs a `solid` variant; replace this with it once the kit has one.
 */
export function SolidFollowButton({
  following,
  onToggle,
  pending = false,
  name,
}: {
  following: boolean;
  onToggle: (next: boolean) => void;
  pending?: boolean;
  /** Who is being followed, for the accessible name. */
  name: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={following ? `Nu mai urmări pe ${name}` : `Urmărește pe ${name}`}
      disabled={pending}
      onClick={() => onToggle(!following)}
      className={cn(
        'relative z-10 flex h-10 w-full items-center justify-center gap-1.5 rounded-control t-body-strong transition-colors duration-(--duration-fast) ease-fast disabled:opacity-60',
        following ? 'bg-soft-fill text-ink-2 hover:bg-hairline' : 'bg-accent text-on-accent hover:opacity-90'
      )}
    >
      {following ? null : <UserPlusIcon aria-hidden className="size-[13px] stroke-2" />}
      {following ? 'Urmărești' : 'Urmărește'}
    </button>
  );
}
