'use client';

import type { ReactNode } from 'react';
import { useBack } from '@/components/nav/useBack';
import { ListHeader, ListPage } from '@/components/templates/T1';
import { routes } from '@/lib/routes';

export const TITLE = 'Concursuri urmărite';
export const TITLE_ID = 'concursuri-urmarite';

/**
 * The rows: one column of row-cards on a phone (fish's list), an auto-fill grid of row-cards from
 * 768 (ROADMAP §4: more columns as the screen grows, never stretched rows) — 352px minimum, so two
 * columns at 768, three at 1280 and 1440, four at 1920. Shared by the list and nothing else needs
 * to match it (the loading state is fish's centred spinner).
 */
export const FOLLOWED_GRID = 'grid grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(88),1fr))] md:gap-3';

/**
 * The page's T1 frame (account.notification-preferences c1): the back control (in-app history,
 * else Setări → Notificări) and the h1 «Concursuri urmărite», then the content. The same box for the
 * gate's fallback, the list, its states and error.tsx, so nothing moves between them.
 */
export function FollowedFrame({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  const back = useBack(routes.notificationSettings());
  return (
    <ListPage header={<ListHeader title={TITLE} titleId={TITLE_ID} back={{ label: 'Înapoi', onClick: back }} />}>
      <section aria-labelledby={TITLE_ID} aria-busy={busy || undefined} className="flex flex-col">
        {children}
      </section>
    </ListPage>
  );
}

/** Loading (c2): fish's centred spinner (Spinner large, indigo), announced once. */
export function FollowedLoading() {
  return (
    <div role="status" className="flex min-h-[50dvh] items-center justify-center" data-testid="followed-loading">
      <span aria-hidden className="block size-9 animate-spin rounded-full border-3 border-accent-tint border-t-accent" />
      <span className="sr-only">Se încarcă…</span>
    </div>
  );
}
