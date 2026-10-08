import type { Metadata } from 'next';
import { connection } from 'next/server';
import { HydrationBoundary } from '@tanstack/react-query';
import { jsonLdHtml } from '@/lib/json-ld';
import { loadCommunitySession } from '../_spectator/load';
import { SpectatorNotFound } from '../_spectator/states';
import { CatchesView } from './_list/CatchesView';
import { prefetchCatches } from './_list/load';
import { catchesJsonLd, catchesMetadata } from './_list/seo';

/*
 * Capturi — /partide/[id]/capturi, every catch of a partidă (parity partide.yml
 * partide.spectator-capturi; fish app/(app)/partide/comunitate/capturi/[id].tsx), behind the
 * partidă page's «Vezi toate ({n})» and the FOLLOW_RECORD_* notifications. Public and static: the
 * partidă (the partidă page's own cached read, ../_spectator/load.ts) and the first catches page
 * (./_list/load.ts) are cached public CMS reads under the tag `session-<id>`, prerendered with the
 * page's JSON-LD (ImageGallery + breadcrumb) and handed to the browser's queries
 * (HydrationBoundary); the next pages load on scroll.
 *
 * A private or unknown partidă (the CMS's 404 — visibleOnProfile false hides it everywhere,
 * invariant 15) renders the partidă's not-found state, `noindex` (never notFound(), as the partidă
 * page). A read that failed here is read again in the browser, which shows its own states.
 */

type Props = { params: Promise<{ id: string }> };

// The page blocks on the partidă read (behind loading.tsx), like the partidă page.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return catchesMetadata(id, await loadCommunitySession(id));
}

export default async function PartidaCatchesPage({ params }: Props) {
  const { id } = await params;
  // Both reads at once (one read budget, not two in a row); the catches are dropped unless the
  // partidă itself loaded.
  const session = loadCommunitySession(id);
  const [load, { state, firstPage, read }] = await Promise.all([session, prefetchCatches(id, session)]);
  if (load.kind === 'missing') return <SpectatorNotFound />;
  if (load.kind === 'unread') return <CatchesView documentId={id} />;
  if (!read) await connection();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(catchesJsonLd(load.detail, firstPage))} />
      <HydrationBoundary state={state}>
        <CatchesView documentId={id} />
      </HydrationBoundary>
    </>
  );
}
