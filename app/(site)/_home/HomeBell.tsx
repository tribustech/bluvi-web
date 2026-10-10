'use client';

import { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { BellAlertIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import type { notificationsKeys } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { cn } from '@/components/ui/cn';
import { homeLinks } from './links';

/** core/social's `notificationsKeys.unread` (the type checks it): the shell's top-bar dot reads the same cache entry. */
const UNREAD_KEY = ['notifications', 'unread'] as const satisfies typeof notificationsKeys.unread;
const noSubscribe = () => () => {};
const readUnread = async (t: ReturnType<typeof createBrowserTransport>) =>
  (await import('@/core/social')).getUnreadNotificationsForLoggedInUser(t);

/**
 * fish (tabs)/index.tsx `home-notifications-bell`: the outline BellAlertIcon (24, black, stroke 2)
 * in the profile card's top-right corner, with a 10px red dot when anything is unread; it opens
 * Notificări. Signed in only (fish's guest card has no bell). Phone only — from 768 the top bar
 * owns notifications.
 */
export function HomeBell({ className }: { className?: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const unread = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => readUnread(t),
    select: (data: { count: number }) => data.count,
    staleTime: 60_000,
  });
  // The top bar reads the same cache entry and often fills it before this streamed card hydrates:
  // the dot waits for hydration so the first client render matches the server's (no dot).
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const hasUnread = hydrated && (unread.data ?? 0) > 0;
  return (
    <Link
      href={homeLinks.notifications}
      data-testid="home-notifications-bell"
      aria-label={hasUnread ? 'Notificări, ai notificări noi' : 'Notificări'}
      className={cn('relative -m-2.5 flex size-12 items-center justify-center rounded-control text-ink active:opacity-50', className)}
    >
      <BellAlertIcon aria-hidden className="size-6 stroke-2" />
      {hasUnread ? <span aria-hidden className="absolute top-3 right-3 size-2.5 rounded-full bg-live" /> : null}
    </Link>
  );
}
