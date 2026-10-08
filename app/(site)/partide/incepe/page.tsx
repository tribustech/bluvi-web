import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { param, type SearchParams } from '@/lib/search-params';
import { requireViewer } from '@/lib/server/require-viewer';
import { StartFlow } from './_flow/StartFlow';
import { StartSkeleton } from './_flow/StartSkeleton';

/*
 * /partide/incepe — «Începe o partidă» (parity docs/parity/areas/partide.yml partide.incepe, T4; fish
 * app/(app)/partide/start.tsx). `?balta=<lake documentId>` / `?apa=<public water linkCode>` preselect
 * the venue and open step 2 (fish ?lakeId / ?waterCode — the «Începe o partidă aici» buttons).
 *
 * Signed in only (fish D6: every entry — header pill, hero, invitation tiles, venue pages — lands on
 * sign-in when anonymous): proxy.ts answers a cookie-less request with a 307 to /intra?next=, and
 * the gate below (Cache Components: it awaits the session inside the Suspense boundary) sends a dead
 * session there too, this path and its query included. Everything past the gate is per user and
 * runs in the browser (./_flow). Not indexed.
 */

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Începe o partidă',
  description: 'Pornește o partidă: alege balta, apa sau locul de pe hartă, standul, durata și speciile.',
  robots: { index: false, follow: false },
};

export default function StartPartidaPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<StartSkeleton />}>
      <Gated searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ searchParams }: Props) {
  const sp = await searchParams;
  const balta = param(sp, 'balta')?.trim() || null;
  const apa = param(sp, 'apa')?.trim() || null;
  await requireViewer(routes.startPartida({ balta: balta ?? undefined, apa: apa ?? undefined }));
  return <StartFlow balta={balta} apa={apa} />;
}
