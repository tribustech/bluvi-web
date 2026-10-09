import type { Metadata } from 'next';
import { Suspense } from 'react';
import { param, type SearchParams } from '@/lib/search-params';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { PescariPageLoading, PescariScreen } from './_search/PescariScreen';

/*
 * /pescari — «Pescari», the angler search (parity partide.pescari, T1).
 * fish: app/(app)/partide/pescari.tsx (the Partide hub's «Pescari» tile; account.suggested's
 * «Caută pescari» opens it too).
 *
 * This static index never shadows its children: /pescari/sugerati is a static segment and
 * /pescari/[id] a dynamic one, both deeper than this page.
 *
 * Signed in only (c1): no cookie → proxy.ts answers a real 307 to /intra?next=/pescari(?q=…);
 * a dead cookie → requireViewer's redirect inside the Suspense boundary (Cache Components: the
 * static shell is the loading page). Search and suggestions are per viewer (isFollowedByMe,
 * friends-of-follows), so they load in the browser through /api/cms. Not indexed.
 */

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Pescari',
  robots: { index: false, follow: false },
};

export default function PescariPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PescariPageLoading />}>
      <Gated searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ searchParams }: Props) {
  const q = (param(await searchParams, 'q') ?? '').slice(0, 100);
  // The way back from /intra is this page with the term it was asked with.
  const viewer = await requireViewer(routes.anglersSearch(q));
  return <PescariScreen viewerId={viewer.documentId} initialQuery={q} />;
}
