import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clampDescription, featureIntro, featureOf, groupFacts, lakesCount, listRo, type FeatureSlug } from '@/lib/lake-landing';
import { getLanding } from '@/lib/server/lake-landing';
import { routes } from '@/lib/routes';
import { HOME_CRUMB, LAKES_CRUMB, LakeCollectionPage, LinkSection, featureLinks, landingMetadata } from './LandingPage';

/*
 * A curated feature page (lib/lake-landing.ts FEATURES): /balti/cu-rezervare-online,
 * /balti/cu-cazare, … Each is its own static route (a dynamic /balti/[feature] would collide with
 * the lake's /balti/[id]) whose page.tsx only names its slug. A feature under FEATURE_MIN lakes, or
 * unread lakes, is a 404 and is neither linked nor in the sitemap.
 */

async function load(slug: FeatureSlug) {
  const landing = await getLanding();
  const group = landing?.features.find((f) => f.slug === slug);
  return landing && group ? { landing, group, feature: featureOf(slug), facts: groupFacts(group.lakes) } : null;
}

function descriptionOf(slug: FeatureSlug, lakes: number, counties: string[]) {
  const f = featureOf(slug);
  return clampDescription(
    `${f.title}: ${lakesCount(lakes)} pe Bluvi${counties.length ? `, mai ales în ${listRo(counties)}` : ''}. Vezi poze, specii, recenzii și detalii despre fiecare baltă.`,
  );
}

export async function featureMetadata(slug: FeatureSlug): Promise<Metadata> {
  const data = await load(slug);
  if (!data) return { title: 'Pagina nu a fost găsită', robots: { index: false, follow: true } };
  const counties = data.facts.counties.slice(0, 3).map((c) => c.name);
  return landingMetadata({ title: data.feature.title, description: descriptionOf(slug, data.facts.lakes, counties), path: routes.lakesFeature(slug) });
}

export async function FeaturePage({ slug }: { slug: FeatureSlug }) {
  const data = await load(slug);
  if (!data) notFound();
  const { landing, group, feature, facts } = data;
  const counties = facts.counties.slice(0, 3).map((c) => c.name);
  return (
    <LakeCollectionPage
      title={feature.title}
      description={descriptionOf(slug, facts.lakes, counties)}
      intro={featureIntro(feature, facts)}
      path={routes.lakesFeature(slug)}
      trail={[HOME_CRUMB, LAKES_CRUMB, { label: feature.chip }]}
      back={{ href: routes.lakes(), label: 'Înapoi la bălți' }}
      lakes={group.lakes}
    >
      <LinkSection
        title="După județ"
        links={facts.counties.map((c) => ({ href: routes.lakesCounty(c.slug), label: c.name, count: c.lakes }))}
        more={{ href: routes.lakesCounties(), label: 'Toate județele' }}
      />
      <LinkSection
        title="După specie"
        links={facts.topSpecies.slice(0, 12).map((s) => ({ href: routes.lakesSpecies(s.slug), label: s.name, count: s.lakes }))}
        more={{ href: routes.lakesSpeciesHub(), label: 'Toate speciile' }}
      />
      <LinkSection title="Alte bălți după facilități" links={featureLinks(landing, slug)} />
    </LakeCollectionPage>
  );
}
