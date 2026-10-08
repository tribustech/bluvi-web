'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StarIcon } from '@heroicons/react/24/solid';
import { cn } from '@/components/ui/cn';
import { userReputationQuery } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { ratingText } from './detail/model';

/**
 * fish features/operator/AnglerRatingBadge.tsx — the Uber-style rating pill on a list avatar,
 * matching the one the profile header puts on its big avatar («★ 4,6»). Renders nothing until the
 * angler's reputation has loaded, and nothing when they have no rating: an empty badge would read
 * as a bad one (operator.b.reputation). Place it inside a `relative` wrapper around the avatar.
 */
export function AnglerRatingBadge({ userId, className }: { userId?: string | null; className?: string }) {
  // Public and edge-cached (fish useUserReputation is not session-gated): the direct CDN read.
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useQuery(userReputationQuery(t, userId ?? undefined));
  const text = ratingText(data?.avgStars);
  if (!text) return null;
  return (
    <span
      data-testid="angler-rating-badge"
      className={cn(
        'pointer-events-none absolute -right-2 -bottom-1 flex items-center gap-0.5 rounded-full bg-surface px-1.25 py-px shadow-e2',
        className,
      )}
    >
      <StarIcon aria-hidden className="size-2.5 text-rating" />
      <span className="t-label text-ink-2">
        <span className="sr-only">Evaluat cu </span>
        {text}
        <span className="sr-only"> din 5</span>
      </span>
    </span>
  );
}
