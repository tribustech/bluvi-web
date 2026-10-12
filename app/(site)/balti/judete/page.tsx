import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clampDescription, lakesCount, plural } from '@/lib/lake-landing';
import { getLanding } from '@/lib/server/lake-landing';
import { routes } from '@/lib/routes';
import { HOME_CRUMB, LAKES_CRUMB, LandingHubPage, LinkSection, featureLinks, landingMetadata } from '../_seo/LandingPage';

/*
 * Bălți de pescuit pe județe (SEO hub, lib/lake-landing.ts): every county with a lake, most lakes
 * first, each a tile (its first lake's photo, the name, the count) linking to /balti/judet/<slug>.
 */

const TITLE = 'Bălți de pescuit pe județe';
const PATH = routes.lakesCounties();

async function load() {
  const landing = await getLanding();
  // Unread (a CMS failure, kept minutes): nothing to show, never an empty hub (rule 4).
  if (!landing || !landing.counties.length) notFound();
  return landing;
}

const totalLakes = (groups: { lakes: { documentId: string }[] }[]) => new Set(groups.flatMap((g) => g.lakes.map((l) => l.documentId))).size;

function descriptionOf(counties: number, lakes: number) {
  return clampDescription(`${lakesCount(lakes)} de pescuit în ${plural(counties, 'județ', 'județe')} din România. Alege județul și vezi bălțile, speciile, facilitățile și recenziile pe Bluvi.`);
}

export async function generateMetadata(): Promise<Metadata> {
  const landing = await load();
  return landingMetadata({ title: TITLE, description: descriptionOf(landing.counties.length, totalLakes(landing.counties)), path: PATH });
}

export default async function CountiesPage() {
  const landing = await load();
  const lakes = totalLakes(landing.counties);
  const top = landing.counties.slice(0, 3).map((c) => `${c.name} (${c.lakes.length})`);
  return (
    <LandingHubPage
      title={TITLE}
      description={descriptionOf(landing.counties.length, lakes)}
      summary={`${plural(landing.counties.length, 'județ', 'județe')} · ${lakesCount(lakes)}`}
      intro={`Bluvi are ${lakesCount(lakes)} de pescuit în ${plural(landing.counties.length, 'județ', 'județe')}. Cele mai multe sunt în ${top.join(', ')}. Alege un județ ca să vezi bălțile lui, cu poze, facilități, specii și recenziile pescarilor.`}
      path={PATH}
      trail={[HOME_CRUMB, LAKES_CRUMB, { label: 'Județe' }]}
      groups={landing.counties}
      hrefOf={routes.lakesCounty}
      altOf={(g) => `${g.lakes[0]?.name ?? 'Baltă'}, baltă de pescuit în ${g.name}`}
    >
      <LinkSection title="Caută după specie" links={landing.species.slice(0, 12).map((s) => ({ href: routes.lakesSpecies(s.slug), label: s.name, count: s.lakes.length }))} more={{ href: routes.lakesSpeciesHub(), label: 'Toate speciile' }} />
      <LinkSection title="Caută după facilități" links={featureLinks(landing)} />
    </LandingHubPage>
  );
}
