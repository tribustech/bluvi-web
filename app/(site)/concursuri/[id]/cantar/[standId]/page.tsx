import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../../_organizer/metadata';
import { HistoryScreen } from './_history/HistoryScreen';
import { HISTORY_TITLE, HistorySkeleton } from './_history/HistorySkeleton';

/*
 * /concursuri/[id]/cantar/[standId] — one stand's weighings, «Istoric cântăriri» (parity
 * organizer.scale-history; fish app/(app)/scale/[competitionId]/history.tsx). Signed in only, per
 * user, never indexed (organizer.b.signed-out-gate):
 *  - no session cookie → proxy.ts answers 307 /intra?next=/concursuri/[id]/cantar/[standId];
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in;
 *  - the CMS cannot say → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * Everything else is read in the browser through /api/cms (HistoryScreen): the shell is static.
 */

type Props = { params: Promise<{ id: string; standId: string }> };

export const metadata = managementMetadata(HISTORY_TITLE);

export default function StandHistoryPage({ params }: Props) {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id, standId } = await params;
  const viewer = await requireViewer(routes.competitionScaleStand(id, standId));
  return (
    <HistoryScreen
      competitionId={id}
      standId={standId}
      viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }}
    />
  );
}
