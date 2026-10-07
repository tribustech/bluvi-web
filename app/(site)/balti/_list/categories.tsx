import { HomeIcon, MoonIcon, StarIcon, TicketIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import {
  EMPTY_LAKE_FILTERS,
  type LakeFilterValue,
  type LakeFilterValues,
  type LakeHomeSection,
  type LakeHomeSectionLake,
} from '@/core/lakes';
import { FishOutlineIcon } from '@/components/nav/brand';
import { routes } from '@/lib/routes';
import { FishGlyph, hasFishGlyph } from './fishGlyphs';
import { CompassIcon, WavesIcon } from './icons';
import { lakesMapQuery } from './url';

/*
 * The Bălți home's categories (owner rule 5, ROADMAP §4b, 2026-10-06): Airbnb's row of icon chips
 * over the grid; each one filters the grid in place. The owner's list, each mapped to what the
 * data can back (rule 4 — a category the data cannot back is not offered):
 *
 * - «Recomandate» — the default: every lake the home payload has (each section's lakes, once),
 *   all_lakes first. It is the payload's selection, not the catalogue: no count is printed for it.
 * - «Aproape de tine» — the CMS nearby section (/lakes/home with the position), nearest first, with
 *   «50 km ›» to the nearby map. From 768 it is the nearby lakes' only block (no nearby row over
 *   the grid). Without a position the chip stays and its grid is fish's location placeholder (the
 *   one place that asks).
 * - «Rezervare online» — the CMS bookable section (Lake.bookingEnabled).
 * - «Crap», «Somn» — /feed/lakes/filtered by the species (the whole catalogue, every variant of the
 *   name: «Crap», «Crap Oglinda»…), with the total the CMS counts.
 * - «Pe timp de noapte» — /feed/lakes/filtered by the night-lighting facility («Iluminat nocturn»):
 *   the only field that says a lake is fished at night.
 * - «Cu cazare» — /feed/lakes/filtered by the cabins facility, else the CMS with_cabins section.
 * - «Top rating» — the CMS top_rated section.
 * A filtered category shows while its read is in flight (its chip has a known meaning) and goes
 * away when the read answers «none» or fails. A price category is not offered: no endpoint filters
 * by price.
 */

export type HomeCategoryState = 'ready' | 'pending' | 'locate';

export type HomeCategory = {
  key: string;
  label: string;
  icon: ReactNode;
  lakes: LakeHomeSectionLake[];
  /** The full set on the results map. */
  mapHref: string;
  /** The grid's heading when this category is picked. */
  title: string;
  /** The CMS's total for a filtered category (the grid holds its first page). */
  total?: number | null;
  /** `pending`: its read is in flight (skeleton grid); `locate`: nearby without a position. */
  state: HomeCategoryState;
};

/** A category read from /feed/lakes/filtered. */
export type FilteredCategoryDef = {
  key: string;
  label: string;
  icon: ReactNode;
  title: string;
  filters: LakeFilterValues;
};

const plain = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Every lake of the page once (recently viewed excluded: it is the user's history, not the
 * catalogue). The nearby set comes last: it arrives after the first paint (the position), and
 * appended it never pushes the cards already on screen (no layout shift).
 */
export function allHomeLakes(sections: LakeHomeSection[]): LakeHomeSectionLake[] {
  const seen = new Set<string>();
  const out: LakeHomeSectionLake[] = [];
  const rank = (s: LakeHomeSection) => (s.key === 'all_lakes' ? 0 : s.key === 'nearby' ? 2 : 1);
  const ordered = [...sections].sort((a, b) => rank(a) - rank(b));
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

const SPECIES: { key: string; name: string }[] = [
  { key: 'fish:crap', name: 'Crap' },
  { key: 'fish:somn', name: 'Somn' },
];

/**
 * The filtered categories the catalogues can back: a species with every catalogue entry whose name
 * starts with it, a facility found by its name. Absent from the catalogue → not offered.
 */
export function filteredCategoryDefs(catalogs: { fishOptions: LakeFilterValue[]; facilityOptions: LakeFilterValue[] }): FilteredCategoryDef[] {
  const out: FilteredCategoryDef[] = [];
  for (const s of SPECIES) {
    const want = plain(s.name);
    const fish = catalogs.fishOptions.filter((f) => {
      const n = plain(f.name);
      return n === want || n.startsWith(`${want} `);
    });
    if (!fish.length) continue;
    out.push({
      key: s.key,
      label: s.name,
      // Monochrome line art (currentColor): the category bar's icons are one ink, pressed or not.
      icon: hasFishGlyph(s.name) ? <FishGlyph name={s.name} size={24} mono /> : <FishOutlineIcon />,
      title: `Bălți cu ${s.name.toLowerCase()}`,
      filters: { ...EMPTY_LAKE_FILTERS, selectedFish: fish },
    });
  }
  const night = catalogs.facilityOptions.filter((f) => /nocturn|noapte/.test(plain(f.name)));
  if (night.length) {
    out.push({
      key: 'night',
      label: 'Pe timp de noapte',
      icon: <MoonIcon />,
      title: 'Bălți cu pescuit pe timp de noapte',
      filters: { ...EMPTY_LAKE_FILTERS, selectedFacilities: night },
    });
  }
  const cabins = catalogs.facilityOptions.filter((f) => /caban|casut|cazare/.test(plain(f.name)));
  if (cabins.length) {
    out.push({
      key: 'cabins',
      label: 'Cu cazare',
      icon: <HomeIcon />,
      title: 'Bălți cu cazare',
      filters: { ...EMPTY_LAKE_FILTERS, selectedFacilities: cabins },
    });
  }
  return out;
}

/** What one filtered read answered (undefined = not asked yet / in flight). */
export type FilteredResult = { lakes: LakeHomeSectionLake[]; total: number } | 'pending' | 'failed';

/** Where the owner's categories sit in the row. */
const ORDER = ['all', 'nearby', 'bookable', 'fish:crap', 'fish:somn', 'night', 'cabins', 'top_rated'];

export function homeCategories({
  sections,
  seeAllHref,
  nearby,
  filtered,
}: {
  sections: LakeHomeSection[];
  seeAllHref: (s: LakeHomeSection) => string;
  /** The nearby chip without a nearby section: ask (`locate`), wait (`pending`) or hide (null). */
  nearby: 'locate' | 'pending' | null;
  filtered: { def: FilteredCategoryDef; result: FilteredResult }[];
}): HomeCategory[] {
  const all = allHomeLakes(sections);
  if (!all.length) return [];
  const byKey = new Map<string, HomeCategory>();
  byKey.set('all', { key: 'all', label: 'Recomandate', icon: <WavesIcon />, lakes: all, mapHref: routes.lakesMap(), title: 'Bălți recomandate', state: 'ready' });

  const section = (key: string) => sections.find((s) => s.key === key && s.lakes.length > 0) ?? null;
  const near = section('nearby');
  if (near) {
    // Nearest first (the CMS's distance on each lake; one without stays after the measured ones).
    const km = (l: LakeHomeSectionLake) => (l as { distanceKm?: number }).distanceKm ?? Number.POSITIVE_INFINITY;
    const lakes = [...near.lakes].sort((a, b) => km(a) - km(b));
    byKey.set('nearby', { key: 'nearby', label: 'Aproape de tine', icon: <CompassIcon />, lakes, mapHref: seeAllHref(near), title: near.title, state: 'ready' });
  } else if (nearby) {
    byKey.set('nearby', { key: 'nearby', label: 'Aproape de tine', icon: <CompassIcon />, lakes: [], mapHref: routes.lakesMap(), title: 'Bălți din zona ta', state: nearby });
  }
  const bookable = section('bookable');
  if (bookable) {
    byKey.set('bookable', { key: 'bookable', label: 'Rezervare online', icon: <TicketIcon />, lakes: bookable.lakes, mapHref: seeAllHref(bookable), title: bookable.title, state: 'ready' });
  }
  for (const { def, result } of filtered) {
    if (result === 'failed') continue;
    if (result !== 'pending' && result.total === 0) continue;
    byKey.set(def.key, {
      key: def.key,
      label: def.label,
      icon: def.icon,
      lakes: result === 'pending' ? [] : result.lakes,
      total: result === 'pending' ? null : result.total,
      mapHref: routes.lakesMap(lakesMapQuery({ filters: def.filters })),
      title: def.title,
      state: result === 'pending' ? 'pending' : 'ready',
    });
  }
  // No cabins facility in the catalogue: the CMS's with_cabins row stands in.
  const cabinsRow = section('with_cabins');
  if (!byKey.has('cabins') && !filtered.some((f) => f.def.key === 'cabins') && cabinsRow) {
    byKey.set('cabins', { key: 'cabins', label: 'Cu cazare', icon: <HomeIcon />, lakes: cabinsRow.lakes, mapHref: seeAllHref(cabinsRow), title: cabinsRow.title, state: 'ready' });
  }
  const top = section('top_rated');
  if (top) {
    byKey.set('top_rated', { key: 'top_rated', label: 'Top rating', icon: <StarIcon />, lakes: top.lakes, mapHref: seeAllHref(top), title: top.title, state: 'ready' });
  }
  return ORDER.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []));
}

/*
 * The picked category in the URL (`/balti?categorie=crap`): a reload or a shared link reopens the
 * same grid. Written with router.replace (LakesHome), like the map's state (./url.ts); «Recomandate»
 * is the bare /balti.
 */
export const CATEGORY_PARAM = 'categorie';

const CATEGORY_SLUG: Record<string, string> = {
  nearby: 'aproape',
  bookable: 'rezervare-online',
  'fish:crap': 'crap',
  'fish:somn': 'somn',
  night: 'noapte',
  cabins: 'cazare',
  top_rated: 'top-rating',
};

/** The category key a `?categorie=` value names; «all» for none or an unknown value. */
export function categoryKeyFromSlug(slug: string | null): string {
  if (!slug) return 'all';
  const hit = Object.entries(CATEGORY_SLUG).find(([, s]) => s === slug);
  return hit ? hit[0] : 'all';
}

/** The `?categorie=` value of a category key (null: «Recomandate», the bare URL). */
export function categorySlug(key: string): string | null {
  return CATEGORY_SLUG[key] ?? null;
}
