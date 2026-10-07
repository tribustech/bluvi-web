import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { absoluteUrl, routes } from '@/lib/routes';
import { LakeScreen } from './_components/LakeScreen';
import { lakeIdsToPrerender, lakeJsonLd, lakeSummary, loadLake, loadLakeSections } from './_components/load';
import { lakePriceFrom } from './_components/priceFrom';
import { jsonLdHtml } from '@/lib/json-ld';

/*
 * Baltă — fish app/(app)/lakes/[lakeId].tsx (parity docs/parity/areas/lakes.yml, lakes.detail +
 * lakes.share; the claim and booking-interest dialogs it opens are lakes.claim /
 * lakes.booking-interest).
 *
 * Public and static: every read is a cached public CMS GET (load.ts), purged by the CMS's cache
 * tags, so every lake in the public index is prerendered and refreshed when the CMS purges it.
 * The session only shapes small client bits (the booking link, the owner link, your own partidă),
 * which read it in the browser — the page itself never waits for it.
 *
 * Loading and 404: loading.tsx shows the lake skeleton while the lake is read (fish
 * LakeDetailsSkeleton, c1). That boundary commits the 200 first, so an unknown id is a soft 404
 * (not-found.tsx + `noindex`), as on /concursuri/<id>; a real 404 needs an existence check in
 * proxy.ts (ROADMAP §8). A hung or failing CMS throws to error.tsx («Încearcă din nou», c2).
 */

type Props = { params: Promise<{ id: string }> };

// The page blocks on the lake read (behind loading.tsx), like /concursuri/<id>.
export const instant = false;

export async function generateStaticParams() {
  const ids = await lakeIdsToPrerender();
  return (ids.length ? ids : ['_']).map(id => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') return { title: 'Balta nu a fost găsită' };
  const lake = load.lake;
  const description = lakeSummary(lake);
  const canonical = routes.lake(lake.documentId);
  const where = lake.countyRef?.name ? ` · ${lake.countyRef.name}` : '';
  return {
    title: `${lake.name}${where}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: lake.name,
      description,
      url: absoluteUrl(canonical),
      siteName: 'Bluvi',
      locale: 'ro_RO',
      // No `images` here: the segment's generated card (opengraph-image.tsx, parity global.b.seo-og-images)
      // is og:image — it already carries the photo, sized 1200×630, with its alt.
    },
    twitter: { card: 'summary_large_image', title: lake.name, description },
  };
}

export default async function LakePage({ params }: Props) {
  const { id } = await params;
  // The sections' reads start with the lake read, not after it (they stream behind Suspense).
  const sections = loadLakeSections(id);
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Bălți', item: absoluteUrl(routes.lakes()) },
      { '@type': 'ListItem', position: 2, name: lake.name, item: absoluteUrl(routes.lake(lake.documentId)) },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD: `<` escaped so a lake name can never close the script element.
        dangerouslySetInnerHTML={jsonLdHtml([lakeJsonLd(lake), breadcrumb])}
      />
      <LakeScreen lake={lake} sections={sections} priceFrom={lakePriceFrom(lake)} />
    </>
  );
}
