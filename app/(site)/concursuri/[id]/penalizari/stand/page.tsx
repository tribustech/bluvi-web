import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../../_organizer/metadata';
import { PenaltyStandScreen } from './_select/PenaltyStandScreen';
import { PenaltyStandSkeleton } from './_select/PenaltyStandSkeleton';

/*
 * /concursuri/[id]/penalizari/stand — the penalties' «Alege standul» (parity
 * organizer.penalties-select-stand; fish app/(app)/penalties/[competitionId]/select-stand.tsx).
 * Signed in only, per user, never indexed (organizer.b.signed-out-gate):
 *  - no session cookie → proxy.ts answers 307 /intra?next=/concursuri/[id]/penalizari/stand;
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in;
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * The competition and its allocations are read in the browser through /api/cms.
 */

type Props = { params: Promise<{ id: string }> };

export const metadata = managementMetadata('Penalizare — Alege standul');

export default function PenaltyStandPage({ params }: Props) {
  return (
    <Suspense fallback={<PenaltyStandSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id } = await params;
  const viewer = await requireViewer(routes.competitionPenaltiesStand(id));
  return <PenaltyStandScreen competitionId={id} viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }} />;
}
