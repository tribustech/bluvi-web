import type { Metadata } from 'next';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityKeys } from '@/core/partide';
import { jsonLdHtml } from '@/lib/json-ld';
import { prefetchState } from '@/lib/client/hydration';
import { loadCommunitySession } from './_spectator/load';
import { partidaJsonLd, partidaMetadata } from './_spectator/seo';
import { SpectatorView } from './_spectator/SpectatorView';
import { SpectatorNotFound } from './_spectator/states';
import { OwnOrSpectator } from './_switch/OwnOrSpectator';

/*
 * Partidă — /partide/[id], [id] = the session's documentId (parity partide.yml partide.spectator;
 * fish app/(app)/partide/comunitate/[id].tsx). Public and static: the partidă is a cached public
 * CMS read (./_spectator/load.ts — 60 s while live, 24 h once ended, purged by `session-<id>`),
 * prerendered with its JSON-LD (SportsEvent + breadcrumb) and its share card (opengraph-image.tsx),
 * then handed to the browser's query (HydrationBoundary), which polls a live partidă every 60 s.
 *
 * Whose partidă (OwnOrSpectator, c1): the viewer's own live partidă goes to the member view
 * (partide.partida, M4-B2); everyone else gets the spectator view. A private or unknown partidă
 * (the CMS's 404 — visibleOnProfile false) is NOT notFound(): the not-found state renders through
 * OwnOrSpectator's `notFound` slot, `noindex`, so B2 can still show a member their private partidă.
 * A read that failed here is read again in the browser (its error state has «Reîncearcă», c2).
 */

type Props = { params: Promise<{ id: string }> };

// The page blocks on the partidă read (behind loading.tsx), like /balti/<id>.
export const instant = false;

export async function generateStaticParams() {
  // No list of partide to prerender at build (thousands, most of them ended): one placeholder for
  // Cache Components' build validation; every real id renders on its first request and is cached.
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return partidaMetadata(id, await loadCommunitySession(id));
}

export default async function PartidaPage({ params }: Props) {
  const { id } = await params;
  const load = await loadCommunitySession(id);
  if (load.kind === 'missing') {
    return <OwnOrSpectator documentId={id} spectator={null} notFound={<SpectatorNotFound />} />;
  }
  const state =
    load.kind === 'ok'
      ? await prefetchState([{ queryKey: communityKeys.session(id), queryFn: async () => load.detail }], [`session-${id}`])
      : { mutations: [], queries: [] };
  return (
    <>
      {load.kind === 'ok' ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(partidaJsonLd(load.detail))} /> : null}
      <HydrationBoundary state={state}>
        <OwnOrSpectator documentId={id} spectator={<SpectatorView documentId={id} />} notFound={<SpectatorNotFound />} />
      </HydrationBoundary>
    </>
  );
}
