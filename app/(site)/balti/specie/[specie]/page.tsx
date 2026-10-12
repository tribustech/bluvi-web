import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clampDescription, groupFacts, lakesCount, listRo, speciesIntro, speciesWord, type GroupFacts } from '@/lib/lake-landing';
import { isPlaceholderId } from '@/lib/server/public-get';
import { getLanding } from '@/lib/server/lake-landing';
import { routes } from '@/lib/routes';
import { HOME_CRUMB, LAKES_CRUMB, LakeCollectionPage, LinkSection, SPECIES_CRUMB, featureLinks, landingMetadata } from '../../_seo/LandingPage';

/*
 * Bălți cu <specie> (SEO landing, lib/lake-landing.ts): every lake that lists the species, a
 * data-driven intro, then the counties where it is and the other species. Static: one page per
 * species with a lake (generateStaticParams), from the shared cached read; else a 404.
 */

export const instant = false;

type Props = { params: Promise<{ specie: string }> };

export async function generateStaticParams() {
  const landing = await getLanding();
  const slugs = landing?.species.map((s) => s.slug) ?? [];
  return (slugs.length ? slugs : ['_']).map((specie) => ({ specie }));
}

async function load(slug: string) {
  if (isPlaceholderId(slug)) return null;
  const landing = await getLanding();
  // Unread (a CMS failure, kept minutes): nothing to show — a 404 until the next read (rule 4).
  if (!landing) return null;
  const group = landing.species.find((s) => s.slug === slug);
  return group ? { landing, group, facts: groupFacts(group.lakes) } : null;
}

const titleOf = (name: string) => `Bălți cu ${speciesWord(name)}`;

function descriptionOf(name: string, facts: GroupFacts) {
  const where = facts.counties.slice(0, 3).map((c) => c.name);
  return clampDescription(
    `${lakesCount(facts.lakes)} de pescuit cu ${speciesWord(name)}${where.length ? `, în ${facts.counties.length > 3 ? `${where.join(', ')} și altele` : listRo(where)}` : ''}. Vezi recenzii, facilități și rezervă online pe Bluvi.`,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { specie } = await params;
  const data = await load(specie);
  if (!data) return { title: 'Pagina nu a fost găsită', robots: { index: false, follow: true } };
  const { group, facts } = data;
  return landingMetadata({ title: titleOf(group.name), description: descriptionOf(group.name, facts), path: routes.lakesSpecies(group.slug) });
}

export default async function SpeciesLakesPage({ params }: Props) {
  const { specie } = await params;
  const data = await load(specie);
  if (!data) notFound();
  const { landing, group, facts } = data;
  const title = titleOf(group.name);
  const others = landing.species.filter((s) => s.slug !== group.slug).slice(0, 12);

  return (
    <LakeCollectionPage
      title={title}
      description={descriptionOf(group.name, facts)}
      intro={speciesIntro(group.name, facts)}
      path={routes.lakesSpecies(group.slug)}
      trail={[HOME_CRUMB, LAKES_CRUMB, SPECIES_CRUMB, { label: group.name }]}
      back={{ href: routes.lakesSpeciesHub(), label: 'Toate speciile' }}
      lakes={group.lakes}
    >
      <LinkSection
        title={`Județe cu bălți cu ${speciesWord(group.name)}`}
        links={facts.counties.map((c) => ({ href: routes.lakesCounty(c.slug), label: c.name, count: c.lakes }))}
        more={{ href: routes.lakesCounties(), label: 'Toate județele' }}
      />
      <LinkSection
        title="Alte specii"
        links={others.map((s) => ({ href: routes.lakesSpecies(s.slug), label: s.name, count: s.lakes.length }))}
        more={{ href: routes.lakesSpeciesHub(), label: 'Toate speciile' }}
      />
      <LinkSection title="Caută după facilități" links={featureLinks(landing)} />
    </LakeCollectionPage>
  );
}
