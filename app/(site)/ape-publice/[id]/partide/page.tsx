import type { Metadata } from 'next';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityHistoryInfiniteQuery, communityVenueCatchesInfiniteQuery, communityVenueKey, communityVenueSectionQuery } from '@/core/partide';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { PartideScreen } from '../../_components/venue/PartideScreen';
import { collectionPageJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, loadCommunityWater, metadataWater, unresolvedMetadata, prefetchWater, qualifiedWaterName, subMetadata, subPath, subTrail, waterAbout } from '../../_server/sub';

/*
 * Partide pe <apă> — fish app/(app)/public-waters/[id]/partide.tsx (parity public-waters.partide,
 * T1). Public and static: the water is a dataset read; the live section, the first history page and
 * the first catches page are cached public CMS reads prefetched into the HTML (the client screen
 * takes the same queries over, polls the live section every 60s and loads the next pages).
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const water = await metadataWater((await params).id);
  if (typeof water === 'string') return unresolvedMetadata(water);
  return subMetadata(water, { page: 'partide', title: 'Partide' });
}

export default async function PublicWaterPartidePage({ params }: Props) {
  const { id } = await params;
  const cw = await loadCommunityWater(id);
  const state = await prefetchWater(id, (t) => [
    communityVenueSectionQuery(t, cw.venue),
    communityHistoryInfiniteQuery(t, [communityVenueKey(cw.venue)]),
    communityVenueCatchesInfiniteQuery(t, cw.venue),
  ]);
  return (
    <>
      <SetBreadcrumb trail={subTrail(cw.water, 'Partide')} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml([
          collectionPageJsonLd({ name: `Partide · ${qualifiedWaterName(cw.water)}`, path: subPath(cw.water, 'partide'), about: waterAbout(cw.water) }),
          breadcrumbJsonLd(cw.water, 'Partide', subPath(cw.water, 'partide')),
        ])}
      />
      <HydrationBoundary state={state}>
        <PartideScreen code={cw.code} waterKey={cw.key} title={cw.water.name ?? 'Partide'} />
      </HydrationBoundary>
    </>
  );
}
