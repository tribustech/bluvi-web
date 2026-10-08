'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { userReputationQuery } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { noShowText } from './detail/model';

/**
 * fish NoShowInline (features/operator/BookingDetailSheet.tsx) — the angler's no-show count beside
 * their name, red («2 neprezentări», formatCount plurals). Nothing until the reputation has loaded
 * and nothing at zero (operator.b.reputation); the star rating lives on the avatar badge.
 */
export function NoShowPill({ userId, className }: { userId?: string | null; className?: string }) {
  // Public and edge-cached (fish useUserReputation is not session-gated): the direct CDN read.
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useQuery(userReputationQuery(t, userId ?? undefined));
  const text = noShowText(data?.noShowCount);
  if (!text) return null;
  return (
    <span
      data-testid="no-show-pill"
      className={cn('inline-flex shrink-0 items-center gap-0.75 rounded-full bg-status-danger-bg px-1.75 py-px t-label text-status-danger-fg', className)}
    >
      <ExclamationTriangleIcon aria-hidden className="size-3" strokeWidth={2} />
      {text}
    </span>
  );
}
