import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { SearchParams } from '@/lib/search-params';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { IstoricPageLoading, IstoricScreen } from './_history/IstoricScreen';
import { filtersFromParams } from './_history/view';

/*
 * /partide/istoric — «Istoric partide» (parity docs/parity/areas/partide.yml partide.istoric, T1).
 * fish: app/(app)/partide/istoric.tsx, reached from «Vezi tot» on Ale mele.
 *
 * Signed in only: no cookie → proxy.ts answers a real 307 to /intra?next=/partide/istoric(?…);
 * a dead cookie → requireViewer's redirect inside the Suspense boundary (Cache Components: the
 * static shell is the loading page). The history is the viewer's own (/feed/sessions/mine), read in
 * the browser through /api/cms. Not indexed.
 */

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Istoric partide',
  description: 'Toate partidele tale încheiate, pe luni, cu filtre după baltă, greutate și capturi.',
  robots: { index: false, follow: false },
};

export default function IstoricPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<IstoricPageLoading />}>
      <Gated searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ searchParams }: Props) {
  const filters = filtersFromParams(await searchParams);
  // The way back from /intra is this page with the filters it was opened with.
  await requireViewer(routes.partideHistory(filters));
  return <IstoricScreen initial={filters} />;
}
