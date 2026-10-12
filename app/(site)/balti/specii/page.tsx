import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clampDescription, lakesCount, listRo, plural, speciesWord } from '@/lib/lake-landing';
import { getLanding } from '@/lib/server/lake-landing';
import { routes } from '@/lib/routes';
import { HOME_CRUMB, LAKES_CRUMB, LandingHubPage, LinkSection, featureLinks, landingMetadata } from '../_seo/LandingPage';

/*
 * Bălți de pescuit după specie (SEO hub, lib/lake-landing.ts): every species with a lake, most
 * lakes first, each a tile linking to /balti/specie/<slug>.
 */

const TITLE = 'Bălți de pescuit după specie';
const PATH = routes.lakesSpeciesHub();

async function load() {
  const landing = await getLanding();
  // Unread (a CMS failure, kept minutes): nothing to show, never an empty hub (rule 4).
  if (!landing || !landing.species.length) notFound();
  return landing;
}

function descriptionOf(species: number, top: string[]) {
  return clampDescription(`Bălți de pescuit din România după specie: ${plural(species, 'specie', 'specii')}, de la ${listRo(top)}. Vezi unde se prinde fiecare, pe Bluvi.`);
}

export async function generateMetadata(): Promise<Metadata> {
  const landing = await load();
  const top = landing.species.slice(0, 3).map((s) => speciesWord(s.name));
  return landingMetadata({ title: TITLE, description: descriptionOf(landing.species.length, top), path: PATH });
}

export default async function SpeciesHubPage() {
  const landing = await load();
  const top = landing.species.slice(0, 3).map((s) => speciesWord(s.name));
  const most = landing.species.slice(0, 3).map((s) => `${speciesWord(s.name)} (${lakesCount(s.lakes.length)})`);
  return (
    <LandingHubPage
      title={TITLE}
      description={descriptionOf(landing.species.length, top)}
      summary={plural(landing.species.length, 'specie', 'specii')}
      intro={`Pe Bluvi, bălțile își declară speciile de pești: ${plural(landing.species.length, 'specie', 'specii')} în total. Cele mai răspândite sunt ${listRo(most)}. Alege specia pe care vrei s-o prinzi și vezi bălțile unde o găsești.`}
      path={PATH}
      trail={[HOME_CRUMB, LAKES_CRUMB, { label: 'Specii' }]}
      groups={landing.species}
      hrefOf={routes.lakesSpecies}
      altOf={(g) => `${g.lakes[0]?.name ?? 'Baltă'}, baltă cu ${speciesWord(g.name)}`}
    >
      <LinkSection title="Caută după județ" links={landing.counties.slice(0, 12).map((c) => ({ href: routes.lakesCounty(c.slug), label: c.name, count: c.lakes.length }))} more={{ href: routes.lakesCounties(), label: 'Toate județele' }} />
      <LinkSection title="Caută după facilități" links={featureLinks(landing)} />
    </LandingHubPage>
  );
}
