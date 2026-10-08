import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../_organizer/metadata';
import { AllocationScreen } from './_allocation/AllocationScreen';
import { AllocationRouteSkeleton } from './_allocation/RouteSkeleton';
import { ALLOCATION_TITLE, legRoundOf } from './_allocation/model';

/*
 * /concursuri/[id]/alocare(?mansa=N) — «Alocare participanți» / «Standuri manșa N» (parity
 * organizer.participants; fish app/(app)/configure/participants/[competitionId].tsx, `?round=n`
 * there). Signed in only, per user, never indexed:
 *  - no session cookie → proxy.ts answers 307 /intra?next=/concursuri/[id]/alocare;
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in (with ?mansa kept);
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * The competition, the allocations and the registrations are read in the browser through /api/cms
 * (AllocationScreen), so the shell is static.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mansa?: string | string[] }> };

export const metadata = managementMetadata(ALLOCATION_TITLE);

export default function AllocationPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<AllocationRouteSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ params, searchParams }: Props) {
  const [{ id }, { mansa }] = await Promise.all([params, searchParams]);
  const legRound = legRoundOf(mansa);
  const viewer = await requireViewer(routes.competitionAllocation(id, legRound ?? undefined));
  return (
    <AllocationScreen
      key={legRound ?? 0}
      competitionId={id}
      legRound={legRound}
      viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }}
    />
  );
}
