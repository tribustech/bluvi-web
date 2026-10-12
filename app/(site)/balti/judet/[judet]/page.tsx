import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COUNTIES, NEIGHBOURS, clampDescription, countyIntro, groupFacts, lakesCount, listRo, speciesWord } from '@/lib/lake-landing';
import { isPlaceholderId } from '@/lib/server/public-get';
import { getLanding } from '@/lib/server/lake-landing';
import { routes } from '@/lib/routes';
import { COUNTIES_CRUMB, HOME_CRUMB, LAKES_CRUMB, LakeCollectionPage, LinkSection, featureLinks, landingMetadata } from '../../_seo/LandingPage';

/*
 * Bălți de pescuit în <județ> (SEO landing, lib/lake-landing.ts): every lake of the county, a
 * data-driven intro, then the species of the county, the neighbouring and the other counties.
 * Static: one page per county with a lake (generateStaticParams), from the shared cached read
 * (lib/server/lake-landing.ts); a county without lakes, or an unknown slug, is a 404.
 */

export const instant = false;

type Props = { params: Promise<{ judet: string }> };

export async function generateStaticParams() {
  const landing = await getLanding();
  const slugs = landing?.counties.map((c) => c.slug) ?? [];
  return (slugs.length ? slugs : ['_']).map((judet) => ({ judet }));
}

async function load(slug: string) {
  if (isPlaceholderId(slug)) return null;
  const landing = await getLanding();
  // Unread (a CMS failure, kept minutes): nothing to show — a 404 until the next read (rule 4).
  if (!landing) return null;
  const group = landing.counties.find((c) => c.slug === slug);
  return group ? { landing, group, facts: groupFacts(group.lakes) } : null;
}

const titleOf = (name: string) => `Bălți de pescuit în ${name}`;

function descriptionOf(name: string, facts: ReturnType<typeof groupFacts>) {
  const species = facts.topSpecies.slice(0, 3).map((s) => speciesWord(s.name));
  return clampDescription(
    `${lakesCount(facts.lakes)} de pescuit în ${name}${species.length ? ` cu ${listRo(species)}` : ''}. Vezi facilități, recenzii, poze și rezervă online pe Bluvi.`,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { judet } = await params;
  const data = await load(judet);
  if (!data) return { title: 'Pagina nu a fost găsită', robots: { index: false, follow: true } };
  const { group, facts } = data;
  return landingMetadata({ title: titleOf(group.name), description: descriptionOf(group.name, facts), path: routes.lakesCounty(group.slug) });
}

export default async function CountyLakesPage({ params }: Props) {
  const { judet } = await params;
  const data = await load(judet);
  if (!data) notFound();
  const { landing, group, facts } = data;
  const title = titleOf(group.name);
  const path = routes.lakesCounty(group.slug);
  const withLakes = new Map(landing.counties.map((c) => [c.slug, c]));
  const neighbours = (NEIGHBOURS[group.slug] ?? []).flatMap((s) => {
    const c = withLakes.get(s);
    return c ? [c] : [];
  });
  const others = landing.counties.filter((c) => c.slug !== group.slug && !neighbours.includes(c)).slice(0, 8);
  const species = facts.topSpecies.slice(0, 12);

  return (
    <LakeCollectionPage
      title={title}
      description={descriptionOf(group.name, facts)}
      intro={countyIntro(group.slug, facts)}
      path={path}
      trail={[HOME_CRUMB, LAKES_CRUMB, COUNTIES_CRUMB, { label: COUNTIES[group.slug] }]}
      back={{ href: routes.lakesCounties(), label: 'Toate județele' }}
      lakes={group.lakes}
    >
      <LinkSection
        title={`Specii de pești în ${group.name}`}
        links={species.map((s) => ({ href: routes.lakesSpecies(s.slug), label: s.name, count: s.lakes }))}
        more={{ href: routes.lakesSpeciesHub(), label: 'Toate speciile' }}
      />
      <LinkSection
        title="Bălți în județele vecine"
        links={neighbours.map((c) => ({ href: routes.lakesCounty(c.slug), label: c.name, count: c.lakes.length }))}
      />
      <LinkSection
        title="Alte județe"
        links={others.map((c) => ({ href: routes.lakesCounty(c.slug), label: c.name, count: c.lakes.length }))}
        more={{ href: routes.lakesCounties(), label: 'Toate județele' }}
      />
      <LinkSection title="Caută după facilități" links={featureLinks(landing)} />
    </LakeCollectionPage>
  );
}
