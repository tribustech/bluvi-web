import { getLanding } from '@/lib/server/lake-landing';
import { routes } from '@/lib/routes';
import { LinkSection, featureLinks } from './LandingPage';

/*
 * The foot of /balti: «Caută după județ / specie / facilități» — plain links to the SEO landing
 * pages (lib/lake-landing.ts), the top counties and species and every feature page, each with its
 * hub. From the same cached read as those pages; unread, nothing (rule 4).
 */
export async function LakesBrowseLinks() {
  const landing = await getLanding();
  if (!landing || !landing.counties.length) return null;
  return (
    <nav aria-label="Caută bălți" className="flex flex-col gap-8 border-t border-shimmer pt-8 pb-28 md:pb-12">
      <LinkSection
        title="Caută după județ"
        links={landing.counties.slice(0, 16).map((c) => ({ href: routes.lakesCounty(c.slug), label: c.name, count: c.lakes.length }))}
        more={{ href: routes.lakesCounties(), label: 'Toate județele' }}
      />
      <LinkSection
        title="Caută după specie"
        links={landing.species.slice(0, 12).map((s) => ({ href: routes.lakesSpecies(s.slug), label: s.name, count: s.lakes.length }))}
        more={{ href: routes.lakesSpeciesHub(), label: 'Toate speciile' }}
      />
      <LinkSection title="Caută după facilități" links={featureLinks(landing)} />
    </nav>
  );
}
