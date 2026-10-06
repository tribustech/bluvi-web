import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { buildGalleryCatchItems, buildGalleryPhotoItems } from '@/core/lakes';
import { communityVenueCatchesInfiniteQuery, type LakeCatchesPage } from '@/core/partide';
import { absoluteUrl, routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { GalleryScreen } from './GalleryScreen';

/*
 * Galerie — fish app/(app)/lakes/[lakeId]/gallery.tsx (parity lakes.gallery, template none: fish's
 * full-screen gallery sheet, here a page). Public and static: the lake read and the first catches
 * page are cached public CMS GETs (../_sub/server.ts), the catches are in the HTML with an
 * ImageGallery JSON-LD; the next pages load in the browser. An unknown lake is the lake's not-found.
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  const ids = await lakeIdsToPrerender();
  return (ids.length ? ids : ['_']).map(id => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') return { title: 'Balta nu a fost găsită' };
  return subMetadata(load.lake, {
    title: 'Galerie',
    description: `Fotografiile bălții ${load.lake.name} și capturile pescarilor din comunitatea Bluvi.`,
    path: routes.lakeGallery(load.lake.documentId),
  });
}

export default async function LakeGalleryPage({ params }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  const venue = { kind: 'lake', id: lake.documentId } as const;
  const { state } = await prefetchSub(lake.documentId, 'catches-page', t => [communityVenueCatchesInfiniteQuery(t, venue)]);
  const path = routes.lakeGallery(lake.documentId);
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, 'Galerie')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml([galleryJsonLd(lake.name, path, lake.images, state), breadcrumbJsonLd(lake, 'Galerie', path)])} />
      <HydrationBoundary state={state}>
        <GalleryScreen lakeId={lake.documentId} lakeName={lake.name} images={lake.images} />
      </HydrationBoundary>
    </>
  );
}

/** schema.org ImageGallery: the lake's photos and the first page of community catches. */
function galleryJsonLd(name: string, path: string, images: Parameters<typeof buildGalleryPhotoItems>[0], state: DehydratedState) {
  const first = (state.queries[0]?.state.data as { pages?: LakeCatchesPage[] } | undefined)?.pages?.[0]?.data ?? [];
  const photos = buildGalleryPhotoItems(images).map(p => ({ '@type': 'ImageObject', contentUrl: p.fullUri, caption: `Balta ${name}` }));
  const catches = buildGalleryCatchItems(first).map(c => ({
    '@type': 'ImageObject',
    contentUrl: c.uri,
    caption: [c.species, c.weightKg != null ? `${c.weightKg} kg` : null, c.anglerName].filter(Boolean).join(' · ') || 'Captură',
    uploadDate: c.occurredAt,
  }));
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `Galerie · ${name}`,
    url: absoluteUrl(path),
    image: [...photos, ...catches],
  };
}
