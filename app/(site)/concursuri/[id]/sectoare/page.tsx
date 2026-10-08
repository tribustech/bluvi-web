import { Suspense } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { managementMetadata } from '../_organizer/metadata';
import { SectorsScreen } from './_sectors/SectorsScreen';
import { SectorsSkeleton, SECTORS_TITLE } from './_sectors/SectorsSkeleton';

/*
 * /concursuri/[id]/sectoare — «Alocarea standurilor pe sectoare» (parity organizer.sectors; fish
 * app/(app)/configure/sectors/[competitionId].tsx). Signed in only, per user, never indexed:
 *  - no session cookie → proxy.ts answers 307 /intra?next=/concursuri/[id]/sectoare;
 *  - a cookie the CMS refuses → requireViewer redirects to the same sign-in;
 *  - the CMS cannot say (down, slow) → SessionUnknownError → error.tsx («Serverul nu răspunde»).
 * The competition is read in the browser through /api/cms (SectorsScreen), so the shell is static.
 */

type Props = { params: Promise<{ id: string }> };

export const metadata = managementMetadata(SECTORS_TITLE);

export default function SectorsPage({ params }: Props) {
  return (
    <Suspense fallback={<SectorsSkeleton />}>
      <Gated params={params} />
    </Suspense>
  );
}

async function Gated({ params }: Props) {
  const { id } = await params;
  const viewer = await requireViewer(routes.competitionSectors(id));
  return <SectorsScreen competitionId={id} viewer={{ documentId: viewer.documentId, isOrganizer: viewer.isOrganizer }} />;
}
