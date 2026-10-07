import type { Metadata } from 'next';
import { notFound, redirect, RedirectType } from 'next/navigation';
import { publicWaterName, publicWaterSubtitle, type PublicWaterDetail } from '@/core/lakes';
import { absoluteUrl, routes } from '@/lib/routes';
import { e2eClaimedLake, e2eWaterFault, e2eWaterOverride } from '../_server/e2e-faults';
import { canonicalPath, loadAttribution, loadClaimedLakeId, loadCountyNames, loadPublicWater, waterDescription } from '../_server/load';
import { sqlitePublicWatersSource } from '../_server/source';
import { PublicWaterScreen } from '../_components/detail/PublicWaterScreen';
import { waterAltName } from '../_components/names';
import { waterTrail } from '../_components/trail';
import { jsonLdHtml } from '@/lib/json-ld';

/*
 * Apă publică — fish app/(app)/public-waters/[id].tsx (parity public-waters.detaliu).
 *
 * The water comes from the bundled ANAR dataset on this server (../_server), resolved from the
 * numeric row id or the stable linkCode (c1). A water claimed by a bookable lake is never shown
 * as a public water: the page is replaced by the lake's (c4). The community sections (Partide,
 * Capturi) are public CMS reads keyed `water:<linkCode>` owned by the browser (60s poll, c31):
 * like fish, they render nothing until their data arrives (c19) — the page itself is static.
 *
 * Loading: loading.tsx (the page's skeleton + back) while the water is read; an unknown id is
 * not-found.tsx (no retry); a dataset failure is error.tsx («Încearcă din nou», c3).
 */

type Props = { params: Promise<{ id: string }> };

// The page blocks on the water read (behind loading.tsx), like /concursuri/<id>.
export const instant = false;

/** The 150 largest waters are prerendered (the rest render on first request, then stay cached). */
export async function generateStaticParams() {
  try {
    const rows = await sqlitePublicWatersSource.getMarkerWatersInViewport({ minLat: 40, minLng: 18, maxLat: 50, maxLng: 32 }, { limit: 150 });
    return rows.map((w) => ({ id: String(w.id) }));
  } catch {
    return [{ id: '_' }];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadPublicWater(id);
  if (load.kind === 'missing') return { title: 'Apa publică nu a fost găsită' };
  const water = load.water;
  const name = publicWaterName(water);
  const description = waterDescription(water);
  const canonical = canonicalPath(water);
  return {
    title: `${name} · ${publicWaterSubtitle(water)}`,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title: name, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title: name, description },
  };
}

export default async function PublicWaterPage({ params }: Props) {
  const { id } = await params;
  await e2eWaterFault(id);
  const load = await loadPublicWater(id);
  if (load.kind === 'missing') notFound();
  const water = e2eWaterOverride(id, load.water);

  // c4: a claimed water is replaced (not pushed) by its lake.
  const lakeId = e2eClaimedLake(id) ?? (await loadClaimedLakeId(water.linkCode));
  if (lakeId) redirect(routes.lake(lakeId), RedirectType.replace);

  const [countyNames, attribution] = await Promise.all([loadCountyNames(water.countyIds), loadAttribution()]);
  return (
    <>
      <WaterJsonLd water={water} />
      <PublicWaterScreen
        routeId={id}
        water={water}
        countyNames={countyNames.length ? countyNames : water.county ? [water.county] : []}
        attribution={attribution}
      />
    </>
  );
}

/** schema.org: the water as a place (LakeBodyOfWater / RiverBodyOfWater) + the breadcrumb trail. */
function WaterJsonLd({ water }: { water: PublicWaterDetail }) {
  const name = publicWaterName(water);
  const url = absoluteUrl(canonicalPath(water));
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': water.type === 'river' ? 'RiverBodyOfWater' : water.type === 'reservoir_lake' ? 'Reservoir' : 'LakeBodyOfWater',
      name,
      ...(waterAltName(water) ? { alternateName: waterAltName(water) } : {}),
      url,
      geo: { '@type': 'GeoCoordinates', latitude: water.centerLat, longitude: water.centerLng },
      ...(water.county ? { containedInPlace: { '@type': 'AdministrativeArea', name: `Județul ${water.county}`, addressCountry: 'RO' } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: waterTrail({ name, key: water.linkCode ?? water.id }).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.label,
        // The current page (the water) has no href in the trail: its canonical URL.
        item: c.href ? absoluteUrl(c.href) : url,
      })),
    },
  ];
  // `<` escaped so a name can never close the script element.
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />;
}
