import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityVenueCatchesInfiniteQuery, type LakeCatchesPage } from '@/core/partide';
import { absoluteUrl, routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, lakeSubpageEmpty, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { CatchesScreen } from './CatchesScreen';

/*
 * Capturi — fish app/(app)/lakes/[lakeId]/capturi.tsx (parity lakes.catches; reached from the
 * lake's Partide page with `?foto=<clientId>`). Public and static: the lake and the first catches
 * page are cached public reads (../_sub/server.ts); `?foto=` is read in the browser, so it never
 * makes the page dynamic and the canonical stays the bare page.
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
    title: 'Capturi',
    description: `Toate capturile fotografiate la ${load.lake.name} de pescarii din comunitatea Bluvi: specia, greutatea și pescarul.`,
    path: routes.lakeCatches(load.lake.documentId),
    empty: await lakeSubpageEmpty(load.lake, 'capturi'),
  });
}

export default async function LakeCatchesPage({ params }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  const { state } = await prefetchSub(lake.documentId, 'catches-page', t => [communityVenueCatchesInfiniteQuery(t, { kind: 'lake', id: lake.documentId })]);
  const path = routes.lakeCatches(lake.documentId);
  const first = (state.queries[0]?.state.data as { pages?: LakeCatchesPage[] } | undefined)?.pages?.[0]?.data ?? [];
  const gallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `Capturi · ${lake.name}`,
    url: absoluteUrl(path),
    image: first
      .filter(c => c.photoUrl)
      .map(c => ({
        '@type': 'ImageObject',
        contentUrl: c.photoUrl,
        caption: [c.species, c.weightKg != null ? `${c.weightKg} kg` : null, c.angler.name].filter(Boolean).join(' · ') || 'Captură',
        uploadDate: c.occurredAt,
      })),
  };
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, 'Capturi')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml([gallery, breadcrumbJsonLd(lake, 'Capturi', path)])} />
      <HydrationBoundary state={state}>
        <CatchesScreen lakeId={lake.documentId} lakeName={lake.name} />
      </HydrationBoundary>
    </>
  );
}
