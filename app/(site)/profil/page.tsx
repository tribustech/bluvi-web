import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { AnglerProfileView } from '@/components/account/angler/AnglerProfileView';
import { parseProfileTab } from '@/components/account/angler/tabs';
import { param, type SearchParams } from '@/lib/search-params';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { prefetchProfileTab } from '../pescari/[id]/_components/prefetch';
import { OwnProfileFallback } from './_components/OwnProfileFallback';

/*
 * Profilul meu — fish app/(app)/(tabs)/profile.tsx → AnglerProfileScreen mode="own" (parity
 * account.own-profile, T3). The same view as /pescari/[id], in own mode: the settings cog (→ /setari)
 * top right, no back control, no follow button, a skeleton without the follow pill.
 *
 * Signed in only: proxy.ts answers a cookie-less request with a 307 to /intra?next=/profil, and
 * requireViewer (awaited inside the Suspense boundary, Cache Components) redirects a dead session
 * there too; an unknown session (CMS down) throws to error.tsx. The viewer's documentId comes from
 * the server session (fish: useProfile().documentId). The selected tab's first page is a cached
 * PUBLIC read, prefetched like /pescari/[id] (HydrationBoundary); the header is per viewer and loads
 * in the browser through /api/cms. Per-user page: never indexed.
 */

export const metadata: Metadata = {
  title: 'Profilul meu',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<SearchParams> };

export default function OwnProfilePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<OwnProfileFallback />}>
      <Gated searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ searchParams }: Props) {
  const tab = parseProfileTab(param(await searchParams, 'tab'));
  // `next` keeps the selected tab, so sign-in returns to it (the view writes `?tab=` the same way).
  const viewer = await requireViewer(tab === 'capturi' ? routes.profile() : `${routes.profile()}?tab=${tab}`);
  const state = await prefetchProfileTab(viewer.documentId, tab);
  return (
    <HydrationBoundary state={state}>
      <AnglerProfileView documentId={viewer.documentId} mode="own" initialTab={tab} />
    </HydrationBoundary>
  );
}
