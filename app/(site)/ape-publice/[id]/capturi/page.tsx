import type { Metadata } from 'next';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityVenueCatchesInfiniteQuery, type LakeCatchesPage } from '@/core/partide';
import { absoluteUrl } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { CatchesScreen } from '../../_components/venue/CatchesScreen';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, loadCommunityWater, metadataWater, unresolvedMetadata, prefetchWater, subMetadata, subPath, subTrail } from '../../_server/sub';

/*
 * Capturi pe <apă> — fish app/(app)/public-waters/[id]/capturi.tsx (parity public-waters.capturi;
 * reached from the water's Partide rail with `?foto=<clientId>`). Public and static: the water is a
 * dataset read, the first catches page a cached public CMS read prefetched into the HTML; `?foto=`
 * is read in the browser, so it never makes the page dynamic and the canonical stays the bare page.
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const water = await metadataWater((await params).id);
  if (typeof water === 'string') return unresolvedMetadata(water);
  return subMetadata(water, {
    page: 'capturi',
    title: 'Capturi',
    description: `Toate capturile fotografiate pe ${water.name ?? 'această apă'} de pescarii din comunitatea Bluvi: specia, greutatea și pescarul.`,
  });
}

export default async function PublicWaterCatchesPage({ params }: Props) {
  const { id } = await params;
  const cw = await loadCommunityWater(id);
  const state = await prefetchWater(id, (t) => [communityVenueCatchesInfiniteQuery(t, cw.venue)]);
  const name = cw.water.name ?? '';
  const path = subPath(cw.water, 'capturi');
  const first = (state.queries[0]?.state.data as { pages?: LakeCatchesPage[] } | undefined)?.pages?.[0]?.data ?? [];
  const gallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `Capturi · ${name || 'apă publică'}`,
    url: absoluteUrl(path),
    image: first
      .filter((c) => c.photoUrl)
      .map((c) => ({
        '@type': 'ImageObject',
        contentUrl: c.photoUrl,
        caption: [c.species, c.weightKg != null ? `${c.weightKg} kg` : null, c.angler.name].filter(Boolean).join(' · ') || 'Captură',
        uploadDate: c.occurredAt,
      })),
  };
  return (
    <>
      <SetBreadcrumb trail={subTrail(cw.water, 'Capturi')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml([gallery, breadcrumbJsonLd(cw.water, 'Capturi', path)])} />
      <HydrationBoundary state={state}>
        <CatchesScreen code={cw.code} waterKey={cw.key} waterName={name} />
      </HydrationBoundary>
    </>
  );
}
