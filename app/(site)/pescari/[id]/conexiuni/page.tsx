import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { param, type SearchParams } from '@/lib/search-params';
import { routes } from '@/lib/routes';
import { ConnectionsList } from './_components/ConnectionsList';
import { ConnectionsSkeleton } from './_components/ConnectionsSkeleton';
import { parseConnectionsTab } from './_components/tab';

/*
 * /pescari/[id]/conexiuni — an angler's followers / following (parity account.connections, T1).
 * fish: app/(app)/anglers/[documentId]/connections.tsx.
 *
 * Signed in only: GET /feed/anglers/:id/followers|following are auth-scoped on the CMS (fish
 * redirects a guest to sign-in, c1). No cookie at all → proxy.ts answers a real 307 to
 * /intra?next=<this page + ?tab>; a dead cookie → requireViewer's redirect, inside the Suspense
 * boundary (Cache Components: the static shell is the skeleton). The lists are per viewer
 * (isFollowedByMe), so they load in the browser through /api/cms. Not indexed.
 */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = {
  title: 'Conexiuni',
  robots: { index: false, follow: false },
};

export default function ConnectionsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ConnectionsSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const raw = param(await searchParams, 'tab');
  // The way back from /intra is this page with the tab it was asked with (fish's «following» too).
  const viewer = await requireViewer(`${routes.anglerConnections(id)}${raw ? `?tab=${encodeURIComponent(raw)}` : ''}`);
  return <ConnectionsList documentId={id} viewerId={viewer.documentId} initialTab={parseConnectionsTab(raw)} />;
}
