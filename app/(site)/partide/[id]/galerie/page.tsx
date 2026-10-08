import type { Metadata } from 'next';
import { HydrationBoundary } from '@tanstack/react-query';
import { jsonLdHtml } from '@/lib/json-ld';
import { loadGallery } from './_gallery/load';
import { GalleryScreen } from './_gallery/GalleryScreen';
import { galleryJsonLd, galleryMetadata } from './_gallery/seo';
import { SpectatorNotFound } from '../_spectator/states';

/*
 * Galeria partidei — /partide/[id]/galerie, [id] = the session's documentId (parity partide.yml
 * partide.spectator-galerie; fish app/(app)/partide/comunitate/galerie/[id].tsx →
 * features/partide/screens/SessionGalleryScreen.tsx). T1's ListPage: «Galerie», the members' faces
 * and «{membri} · {N} fotografii», the close control, then every photo of the partidă in the
 * masonry, 30 a page, each opening the kit Lightbox with fish's catch footer.
 *
 * Public and static: the partidă and its first 30 photos are cached public CMS reads
 * (./_gallery/load.ts, tag `session-<id>`), prerendered with an ImageGallery JSON-LD and a share card
 * (opengraph-image.tsx, the first photo), then handed to the browser's queries. A private or
 * unknown partidă (the CMS's 404 — visibleOnProfile false, invariant 15) is the not-found state,
 * `noindex`, and its photos are never asked for.
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  // As /partide/[id]: no list of partide at build — one placeholder for Cache Components' build
  // validation; every real id renders on its first request and is cached.
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return galleryMetadata(id, (await loadGallery(id)).session);
}

export default async function PartidaGalleryPage({ params }: Props) {
  const { id } = await params;
  const { session, state, firstPage } = await loadGallery(id);
  if (session.kind === 'missing') return <SpectatorNotFound />;
  return (
    <>
      {session.kind === 'ok' ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(galleryJsonLd(session.detail, firstPage))} />
      ) : null}
      <HydrationBoundary state={state}>
        <GalleryScreen documentId={id} />
      </HydrationBoundary>
    </>
  );
}
