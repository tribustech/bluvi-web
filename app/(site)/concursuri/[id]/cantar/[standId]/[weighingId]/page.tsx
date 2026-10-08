import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../../../_organizer/metadata';
import { WeighingScreen } from './_weighing/WeighingScreen';
import { WeighingSkeleton } from './_weighing/WeighingSkeleton';

/*
 * /concursuri/[id]/cantar/[standId]/[weighingId] — one weighing: catches, signatures, reopen (parity
 * organizer.scale-weighing; fish app/(app)/scale/[competitionId]/add.tsx). Signed in only, per user,
 * never indexed: no cookie → proxy.ts 307 /intra?next=…; a refused cookie → requireViewer redirects;
 * the CMS cannot say → error.tsx. Every read and write runs in the browser through /api/cms
 * (WeighingScreen), so the shell is static and the weighing is always fresh.
 */

type Props = { params: Promise<{ id: string; standId: string; weighingId: string }> };

export const metadata = managementMetadata('Cântar');

export default function WeighingPage({ params }: Props) {
  return (
    <Suspense fallback={<WeighingSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id, standId, weighingId } = await params;
  const viewer = await requireViewer(routes.competitionScaleWeighing(id, standId, weighingId));
  return (
    <WeighingScreen
      competitionId={id}
      standId={standId}
      weighingId={weighingId}
      viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }}
    />
  );
}
