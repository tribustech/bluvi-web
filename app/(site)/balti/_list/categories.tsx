import { HomeIcon, SparklesIcon, StarIcon, TicketIcon, TrophyIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { EMPTY_LAKE_FILTERS, type LakeHomeSection, type LakeHomeSectionLake } from '@/core/lakes';
import { FishOutlineIcon } from '@/components/nav/brand';
import { routes } from '@/lib/routes';
import { FishGlyph, hasFishGlyph } from './fishGlyphs';
import { CompassIcon, WavesIcon } from './icons';
import { lakesMapQuery } from './url';

/*
 * The Bălți home's categories (owner rule 5, ROADMAP §4b, 2026-10-06): Airbnb's row of icon chips
 * over the grid; each one filters the grid in place. They are read from what /lakes/home answered,
 * never promised: a category with no lake is not shown (rule 4 — when we don't know, we don't show;
 * «Pe timp de noapte» has no field in the home payload, so it is not offered).
 *
 * - «Recomandate» — every lake the page has (each section's lakes, once), all_lakes first. It is
 *   the home payload's selection, never the catalogue: it is not called «Toate» and no count is
 *   printed for it (or for any category) — the source cannot vouch for one (rule 4). The whole
 *   catalogue lives on the map («Vezi toate pe hartă»).
 * - one per CMS section with lakes (nearby, bookable, top rated, retention, cabins, competitions,
 *   recently added) — the section's own lakes, in its order;
 * - the species most anglers ask for (Crap, Somn, Știucă) — the recommended lakes with that fish
 *   (titled as such), the map holding every lake with it.
 * Each category also says where its full set lives on the map («Vezi pe hartă»).
 */

export type HomeCategory = {
  key: string;
  label: string;
  icon: ReactNode;
  lakes: LakeHomeSectionLake[];
  /** The full set on the results map. */
  mapHref: string;
  /** The grid's heading when this category is picked. */
  title: string;
};

const SECTION_CATEGORY: Record<string, { label: string; icon: ReactNode }> = {
  nearby: { label: 'Aproape de tine', icon: <CompassIcon /> },
  bookable: { label: 'Rezervare online', icon: <TicketIcon /> },
  top_rated: { label: 'Top rating', icon: <StarIcon /> },
  with_retention: { label: 'Cu reținere', icon: <FishOutlineIcon /> },
  with_cabins: { label: 'Cu cazare', icon: <HomeIcon /> },
  competition_lakes: { label: 'Concursuri', icon: <TrophyIcon /> },
  recently_added: { label: 'Adăugate recent', icon: <SparklesIcon /> },
};
/** Where each section sits in the row (Airbnb: the most asked first). */
const SECTION_ORDER = ['nearby', 'bookable', 'top_rated', 'with_cabins', 'with_retention', 'competition_lakes', 'recently_added'];
const SPECIES = ['Crap', 'Somn', 'Știucă'];

const plain = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function speciesOf(lake: LakeHomeSectionLake): { documentId: string; Name: string }[] {
  return (lake.fishSpecies ?? []).flatMap((s) => (s.fish ? [{ documentId: s.fish.documentId, Name: s.fish.Name }] : []));
}

/** Every lake of the page once (recently viewed excluded: it is the user's history, not the catalogue). */
export function allHomeLakes(sections: LakeHomeSection[]): LakeHomeSectionLake[] {
  const seen = new Set<string>();
  const out: LakeHomeSectionLake[] = [];
  const ordered = [...sections.filter((s) => s.key === 'all_lakes'), ...sections.filter((s) => s.key !== 'all_lakes')];
  for (const s of ordered) {
    if (s.key === 'recent_viewed') continue;
    for (const lake of s.lakes) {
      if (seen.has(lake.documentId)) continue;
      seen.add(lake.documentId);
      out.push(lake);
    }
  }
  return out;
}

export function homeCategories(sections: LakeHomeSection[], seeAllHref: (s: LakeHomeSection) => string): HomeCategory[] {
  const all = allHomeLakes(sections);
  if (!all.length) return [];
  const out: HomeCategory[] = [
    { key: 'all', label: 'Recomandate', icon: <WavesIcon />, lakes: all, mapHref: routes.lakesMap(), title: 'Bălți recomandate' },
  ];
  for (const key of SECTION_ORDER) {
    const section = sections.find((s) => s.key === key);
    if (!section?.lakes.length) continue;
    out.push({ key, ...SECTION_CATEGORY[key]!, lakes: section.lakes, mapHref: seeAllHref(section), title: section.title });
  }
  for (const name of SPECIES) {
    const want = plain(name);
    let fish: { documentId: string; Name: string } | null = null;
    const lakes = all.filter((lake) => {
      const hit = speciesOf(lake).find((f) => plain(f.Name) === want);
      if (hit) fish ??= hit;
      return Boolean(hit);
    });
    if (!lakes.length || !fish) continue;
    const f = fish as { documentId: string; Name: string };
    out.push({
      key: `fish:${want}`,
      label: name,
      icon: hasFishGlyph(f.Name) ? <FishGlyph name={f.Name} size={24} /> : <FishOutlineIcon />,
      lakes,
      mapHref: routes.lakesMap(
        lakesMapQuery({ filters: { ...EMPTY_LAKE_FILTERS, selectedFish: [{ id: f.documentId, documentId: f.documentId, name: f.Name }] } }),
      ),
      title: `Bălți recomandate cu ${name.toLowerCase()}`,
    });
  }
  return out;
}
