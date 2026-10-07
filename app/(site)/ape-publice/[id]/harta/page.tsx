import type { Metadata } from 'next';
import { notFound, redirect, RedirectType } from 'next/navigation';
import { e2eClaimedLake, e2eWaterFault, e2eWaterOverride } from '../../_server/e2e-faults';
import { publicWaterName } from '@/core/lakes';
import { JsonLd } from '@/components/seo/JsonLd';
import { waterWhereProse } from '@/lib/seo/describe';
import { breadcrumbListJsonLd, mapJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { canonicalKey, loadClaimedLakeId, loadPublicWater } from '../../_server/load';
import { qualifiedWaterName, waterAbout } from '../../_server/sub';
import { WaterFullMap } from '../../_components/WaterFullMap';

/*
 * Apă publică — hartă: fish app/(app)/public-waters/[id]/map.tsx (parity public-waters.harta).
 * The same resolver as the detail page (numeric row id or linkCode, c7); a claimed water goes to
 * its lake, like the detail page.
 * SEO: `noindex, follow` and never in the sitemap — the water page already embeds this map, and
 * thousands of ANAR map pages differing only by name would be thin near-duplicates diluting the
 * crawl. Titled like the lake maps and the JSON-LD Map: «Hartă · <apă> · <județ>».
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadPublicWater(id);
  if (load.kind === 'missing') return { title: 'Apa publică nu a fost găsită' };
  const title = `Hartă · ${qualifiedWaterName(load.water)}`;
  const where = waterWhereProse(load.water);
  const description = `Harta completă a apei ${publicWaterName(load.water)}${where ? ` (${where})` : ''}: geometria ANAR și zona din jur.`;
  const canonical = routes.publicWaterMap(canonicalKey(load.water));
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: { type: 'website', title, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PublicWaterMapPage({ params }: Props) {
  const { id } = await params;
  await e2eWaterFault(id);
  const load = await loadPublicWater(id);
  if (load.kind === 'missing') notFound();
  const water = e2eWaterOverride(id, load.water);
  const lakeId = e2eClaimedLake(id) ?? (await loadClaimedLakeId(water.linkCode));
  if (lakeId) redirect(routes.lake(lakeId), RedirectType.replace);
  const key = canonicalKey(water);
  // Bălți › Ape publice › <apă> › Hartă — the shell's trail, for crawlers.
  const trail = [
    { label: 'Bălți', href: routes.lakes() },
    { label: 'Ape publice', href: routes.publicWaters() },
    { label: qualifiedWaterName(water), href: routes.publicWater(key) },
    { label: 'Hartă' },
  ];
  return (
    <>
      <JsonLd
        data={[
          mapJsonLd({
            name: `Hartă · ${qualifiedWaterName(water)}`,
            path: routes.publicWaterMap(key),
            place: { ...waterAbout(water), lat: water.centerLat, lng: water.centerLng },
          }),
          breadcrumbListJsonLd(trail, routes.publicWaterMap(key)),
        ]}
      />
      <WaterFullMap water={water} />
    </>
  );
}
