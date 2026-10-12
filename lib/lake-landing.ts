import { getFilteredLakes, getLakesHome, type LakeCard } from '@/core/lakes';
import type { Transport } from '@/core/transport';
import { formatDecimal, plural } from '@/components/cards/format';

export { plural };

/*
 * Programmatic SEO landing pages of the lakes (/balti/judete, /balti/judet/<județ>, /balti/specii,
 * /balti/specie/<specie> and a curated list of feature pages such as /balti/cu-rezervare-online):
 * the grouping of every published lake by county, by species and by feature, the ascii slugs, and
 * the data-driven intro sentences. Pure, apart from readLandingLakes (CMS reads over a Transport).
 *
 * Only facts the data holds are said: a group exists only when at least one lake is in it, a
 * feature page only from FEATURE_MIN lakes; counts, species and ratings are counted, never guessed.
 * Every order is total (ties broken by documentId / slug), so the same lakes always give the same
 * pages, the same sitemap and the same 'use cache' keys.
 */

/** A lake of the landing pages: the /feed/lakes/filtered card plus whether it books online. */
export type LandingLake = LakeCard & { bookingEnabled: boolean };

/* ------------------------------------------------------------------------------------------------
 * Slugs and names
 * ---------------------------------------------------------------------------------------------- */

/** «Bistrița-Năsăud» → «bistrita-nasaud», «C&R + Retinere» → «c-r-retinere»: lowercase ascii, `-` between words. */
export function landingSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Romania's 41 counties and Bucharest, slug → name with diacritics (the CMS stores most names
 * without them: «Calarasi», «Timis»). A county text outside this list (a lake abroad, a typo) makes
 * no page.
 */
export const COUNTIES: Readonly<Record<string, string>> = {
  alba: 'Alba',
  arad: 'Arad',
  arges: 'Argeș',
  bacau: 'Bacău',
  bihor: 'Bihor',
  'bistrita-nasaud': 'Bistrița-Năsăud',
  botosani: 'Botoșani',
  braila: 'Brăila',
  brasov: 'Brașov',
  bucuresti: 'București',
  buzau: 'Buzău',
  calarasi: 'Călărași',
  'caras-severin': 'Caraș-Severin',
  cluj: 'Cluj',
  constanta: 'Constanța',
  covasna: 'Covasna',
  dambovita: 'Dâmbovița',
  dolj: 'Dolj',
  galati: 'Galați',
  giurgiu: 'Giurgiu',
  gorj: 'Gorj',
  harghita: 'Harghita',
  hunedoara: 'Hunedoara',
  ialomita: 'Ialomița',
  iasi: 'Iași',
  ilfov: 'Ilfov',
  maramures: 'Maramureș',
  mehedinti: 'Mehedinți',
  mures: 'Mureș',
  neamt: 'Neamț',
  olt: 'Olt',
  prahova: 'Prahova',
  salaj: 'Sălaj',
  'satu-mare': 'Satu Mare',
  sibiu: 'Sibiu',
  suceava: 'Suceava',
  teleorman: 'Teleorman',
  timis: 'Timiș',
  tulcea: 'Tulcea',
  valcea: 'Vâlcea',
  vaslui: 'Vaslui',
  vrancea: 'Vrancea',
};

/** Other spellings of a county, slug → COUNTIES slug. */
const COUNTY_ALIASES: Readonly<Record<string, string>> = {
  'municipiul-bucuresti': 'bucuresti',
  'bistrita': 'bistrita-nasaud',
  'caras': 'caras-severin',
};

/** Land borders between counties (each pair once; NEIGHBOURS makes it symmetric). */
const BORDERS: Readonly<Record<string, readonly string[]>> = {
  alba: ['arad', 'bihor', 'cluj', 'mures', 'sibiu', 'valcea', 'hunedoara'],
  arad: ['timis', 'hunedoara', 'bihor'],
  arges: ['brasov', 'sibiu', 'valcea', 'olt', 'teleorman', 'dambovita'],
  bacau: ['neamt', 'harghita', 'covasna', 'vrancea', 'vaslui'],
  bihor: ['satu-mare', 'salaj', 'cluj'],
  'bistrita-nasaud': ['maramures', 'suceava', 'mures', 'cluj'],
  botosani: ['suceava', 'iasi'],
  braila: ['galati', 'vrancea', 'buzau', 'ialomita', 'tulcea'],
  brasov: ['mures', 'harghita', 'covasna', 'buzau', 'prahova', 'dambovita', 'sibiu'],
  bucuresti: ['ilfov'],
  buzau: ['covasna', 'vrancea', 'ialomita', 'prahova'],
  calarasi: ['ialomita', 'ilfov', 'giurgiu', 'constanta'],
  'caras-severin': ['timis', 'hunedoara', 'gorj', 'mehedinti'],
  cluj: ['maramures', 'mures', 'salaj'],
  constanta: ['tulcea', 'ialomita'],
  covasna: ['harghita', 'vrancea'],
  dambovita: ['prahova', 'teleorman', 'giurgiu', 'ilfov'],
  dolj: ['mehedinti', 'gorj', 'valcea', 'olt'],
  galati: ['vaslui', 'vrancea', 'tulcea'],
  giurgiu: ['teleorman', 'ilfov'],
  gorj: ['hunedoara', 'valcea', 'mehedinti'],
  harghita: ['suceava', 'neamt', 'mures'],
  hunedoara: ['valcea', 'timis'],
  ialomita: ['ilfov', 'prahova'],
  iasi: ['suceava', 'neamt', 'vaslui'],
  ilfov: ['prahova'],
  maramures: ['satu-mare', 'salaj', 'suceava'],
  mures: ['suceava', 'sibiu'],
  neamt: ['suceava', 'vaslui'],
  olt: ['valcea', 'teleorman'],
  salaj: ['satu-mare'],
  sibiu: ['valcea'],
  vaslui: ['vrancea'],
};

/** County slug → its neighbours' slugs, sorted (symmetric BORDERS). */
export const NEIGHBOURS: Readonly<Record<string, readonly string[]>> = (() => {
  const out: Record<string, Set<string>> = {};
  for (const slug of Object.keys(COUNTIES)) out[slug] = new Set();
  for (const [a, list] of Object.entries(BORDERS)) {
    for (const b of list) {
      out[a].add(b);
      out[b].add(a);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
})();

/** The county a lake is in: its countyRef, else its county text; null outside COUNTIES. */
export function lakeCountySlug(lake: Pick<LakeCard, 'county' | 'countyRef'>): string | null {
  const raw = lake.countyRef?.name?.trim() || lake.county?.trim();
  if (!raw) return null;
  const slug = landingSlug(raw);
  const known = COUNTY_ALIASES[slug] ?? slug;
  return known in COUNTIES ? known : null;
}

/** «în județul Ilfov», «în București». */
export function inCounty(slug: string): string {
  const name = COUNTIES[slug] ?? slug;
  return slug === 'bucuresti' ? `în ${name}` : `în județul ${name}`;
}

/** Species names as the CMS writes them (no diacritics) → the Romanian spelling; slug-keyed. */
const SPECIES_NAMES: Readonly<Record<string, string>> = {
  salau: 'Șalău',
  stiuca: 'Știucă',
  platica: 'Plătică',
  rosioara: 'Roșioară',
  babusca: 'Babușcă',
  pastrav: 'Păstrăv',
  oblet: 'Obleț',
  'crap-oglinda': 'Crap oglindă',
  'caras-auriu': 'Caras auriu',
  'somn-clarias': 'Somn clarias',
};

/** «Stiuca» → «Știucă»; a name not in SPECIES_NAMES is kept, its first letter upper-case. */
export function speciesName(raw: string): string {
  const known = SPECIES_NAMES[landingSlug(raw)];
  if (known) return known;
  const t = raw.trim();
  return t.charAt(0).toLocaleUpperCase('ro') + t.slice(1).toLocaleLowerCase('ro');
}

/** The species inside a sentence: «Bălți cu crap», «cu știucă». */
export const speciesWord = (name: string) => name.toLocaleLowerCase('ro');

/* ------------------------------------------------------------------------------------------------
 * Features
 * ---------------------------------------------------------------------------------------------- */

const hasFacility = (lake: LandingLake, slug: string) => lake.facility.some((f) => landingSlug(f.name) === slug);
const regimeSlug = (lake: LandingLake) => (lake.regime ? landingSlug(lake.regime) : '');

/**
 * The curated feature pages (at most 6), each its own static route under /balti. `title` is the
 * h1; `lead` the start of the intro sentence; `test` decides membership from the card's data
 * (facility names and regimes as the CMS stores them, compared by slug).
 */
export const FEATURES = [
  {
    slug: 'cu-rezervare-online',
    title: 'Bălți cu rezervare online',
    chip: 'Rezervare online',
    lead: 'se pot rezerva online, direct pe Bluvi',
    test: (l: LandingLake) => l.bookingEnabled,
  },
  {
    slug: 'cu-cazare',
    title: 'Bălți cu cazare',
    chip: 'Cu cazare',
    lead: 'au cabane sau căsuțe, pentru partidele de mai multe zile',
    test: (l: LandingLake) => hasFacility(l, 'cabane'),
  },
  {
    slug: 'cu-iluminat-nocturn',
    title: 'Bălți cu iluminat nocturn',
    chip: 'Iluminat nocturn',
    lead: 'au iluminat nocturn, pentru pescuitul pe timp de noapte',
    test: (l: LandingLake) => hasFacility(l, 'iluminat-nocturn'),
  },
  {
    slug: 'catch-and-release',
    title: 'Bălți catch & release',
    chip: 'Catch & release',
    lead: 'sunt exclusiv catch & release (C&R): peștele prins se eliberează',
    test: (l: LandingLake) => regimeSlug(l) === 'c-r',
  },
  {
    slug: 'cu-retinere',
    title: 'Bălți cu reținere',
    chip: 'Cu reținere',
    lead: 'permit reținerea peștelui, conform regulamentului fiecărei bălți',
    test: (l: LandingLake) => regimeSlug(l).includes('retinere'),
  },
  {
    slug: 'pentru-familii',
    title: 'Bălți potrivite pentru familii',
    chip: 'Pentru familii',
    lead: 'sunt potrivite pentru familii, după facilitățile declarate de baltă',
    test: (l: LandingLake) => hasFacility(l, 'potrivit-pentru-familii'),
  },
] as const;

export type FeatureSlug = (typeof FEATURES)[number]['slug'];
export type Feature = (typeof FEATURES)[number];

export const FEATURE_SLUGS: readonly FeatureSlug[] = FEATURES.map((f) => f.slug);

/** A feature page is published only from this many lakes (thinner, it is not worth a page). */
export const FEATURE_MIN = 3;

export const featureOf = (slug: FeatureSlug): Feature => FEATURES.find((f) => f.slug === slug)!;

/* ------------------------------------------------------------------------------------------------
 * Grouping
 * ---------------------------------------------------------------------------------------------- */

export type LandingGroup = {
  slug: string;
  /** Display name: «Călărași», «Știucă», «Bălți cu cazare». */
  name: string;
  /** The group's lakes, in page order (landingOrder). */
  lakes: LandingLake[];
};

export type Landing = {
  /** Every county with a lake, most lakes first (then by name). */
  counties: LandingGroup[];
  /** Every species with a lake, most lakes first (then by name). */
  species: LandingGroup[];
  /** The feature pages with at least FEATURE_MIN lakes, in FEATURES order. */
  features: LandingGroup[];
};

const collator = new Intl.Collator('ro', { sensitivity: 'base' });

/**
 * Page order of a group's lakes: with a photo first (a card without one leads nothing), then the
 * most reviewed, the best rated, the name, the documentId (total, so stable).
 */
export function landingOrder(a: LandingLake, b: LandingLake): number {
  const photo = Number(b.images.length > 0) - Number(a.images.length > 0);
  if (photo) return photo;
  const count = (b.reviewsMeta?.count ?? 0) - (a.reviewsMeta?.count ?? 0);
  if (count) return count;
  const overall = (b.reviewsMeta?.overall ?? 0) - (a.reviewsMeta?.overall ?? 0);
  if (overall) return overall;
  return collator.compare(a.name, b.name) || (a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0);
}

const bySize = (a: LandingGroup, b: LandingGroup) =>
  b.lakes.length - a.lakes.length || collator.compare(a.name, b.name) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/** The species slugs of a lake, each once. */
export function lakeSpeciesSlugs(lake: LandingLake): string[] {
  return [...new Set(lake.fishSpecies.map((s) => landingSlug(s.fish.Name)).filter(Boolean))];
}

export function buildLanding(lakes: readonly LandingLake[]): Landing {
  const counties = new Map<string, LandingLake[]>();
  const species = new Map<string, { name: string; lakes: LandingLake[] }>();
  // Each lake once, whatever the CMS pages repeated.
  const unique = [...new Map(lakes.map((l) => [l.documentId, l])).values()];
  for (const lake of unique) {
    const county = lakeCountySlug(lake);
    if (county) counties.set(county, [...(counties.get(county) ?? []), lake]);
    for (const s of lake.fishSpecies) {
      const slug = landingSlug(s.fish.Name);
      if (!slug) continue;
      const g = species.get(slug) ?? { name: speciesName(s.fish.Name), lakes: [] };
      if (!g.lakes.includes(lake)) g.lakes.push(lake);
      species.set(slug, g);
    }
  }
  const sorted = (l: LandingLake[]) => [...l].sort(landingOrder);
  return {
    counties: [...counties].map(([slug, l]) => ({ slug, name: COUNTIES[slug], lakes: sorted(l) })).sort(bySize),
    species: [...species].map(([slug, g]) => ({ slug, name: g.name, lakes: sorted(g.lakes) })).sort(bySize),
    features: FEATURES.map((f) => ({ slug: f.slug, name: f.title, lakes: sorted(unique.filter(f.test)) })).filter((g) => g.lakes.length >= FEATURE_MIN),
  };
}

/* ------------------------------------------------------------------------------------------------
 * Facts for the intro and the meta description
 * ---------------------------------------------------------------------------------------------- */

export type GroupFacts = {
  lakes: number;
  /** The most common species, most lakes first: name and lake count. */
  topSpecies: { slug: string; name: string; lakes: number }[];
  bookable: number;
  /** Reviews over the group's lakes and their weighted mean «overall» (null without reviews). */
  reviews: number;
  rating: number | null;
  /** The counties of the group's lakes, most lakes first. */
  counties: { slug: string; name: string; lakes: number }[];
};

export function groupFacts(lakes: readonly LandingLake[]): GroupFacts {
  const species = new Map<string, { name: string; lakes: number }>();
  const counties = new Map<string, number>();
  let reviews = 0;
  let weighted = 0;
  for (const l of lakes) {
    for (const s of l.fishSpecies) {
      const slug = landingSlug(s.fish.Name);
      if (!slug) continue;
      const g = species.get(slug) ?? { name: speciesName(s.fish.Name), lakes: 0 };
      species.set(slug, g);
    }
    for (const slug of lakeSpeciesSlugs(l)) species.get(slug)!.lakes += 1;
    const c = lakeCountySlug(l);
    if (c) counties.set(c, (counties.get(c) ?? 0) + 1);
    const m = l.reviewsMeta;
    if (m && m.count > 0 && typeof m.overall === 'number') {
      reviews += m.count;
      weighted += m.overall * m.count;
    }
  }
  const rank = <T extends { name: string; lakes: number; slug: string }>(a: T, b: T) =>
    b.lakes - a.lakes || collator.compare(a.name, b.name) || (a.slug < b.slug ? -1 : 1);
  return {
    lakes: lakes.length,
    topSpecies: [...species].map(([slug, g]) => ({ slug, ...g })).sort(rank),
    bookable: lakes.filter((l) => l.bookingEnabled).length,
    reviews,
    rating: reviews > 0 ? weighted / reviews : null,
    counties: [...counties].map(([slug, n]) => ({ slug, name: COUNTIES[slug], lakes: n })).sort(rank),
  };
}

/** «crap, caras și somn». */
export function listRo(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} și ${items.at(-1)}`;
}

export const lakesCount = (n: number) => plural(n, 'baltă', 'bălți');

/** «4,6» (one decimal, comma). */
export const ratingText = (r: number) => formatDecimal(Math.round(r * 10) / 10, 1, 1);

/** The sentences after the lead: species, booking, rating — only those the data supports. */
function factSentences(f: GroupFacts, { species = true, booking = true }: { species?: boolean; booking?: boolean } = {}): string[] {
  const out: string[] = [];
  const top = f.topSpecies.slice(0, 3).map((s) => speciesWord(s.name));
  if (species && top.length) {
    // One lake: its species, not «the most common» ones.
    out.push(f.lakes === 1 ? `Specii: ${listRo(f.topSpecies.slice(0, 5).map((s) => speciesWord(s.name)))}.` : `Cele mai întâlnite specii: ${listRo(top)}.`);
  }
  if (booking && f.bookable > 0) {
    out.push(f.bookable === 1 ? 'Una dintre ele se rezervă online, direct pe Bluvi.' : `${lakesCount(f.bookable)} se pot rezerva online, direct pe Bluvi.`);
  }
  if (f.rating !== null) {
    out.push(`Nota medie a pescarilor: ${ratingText(f.rating)} din 5, din ${plural(f.reviews, 'recenzie', 'recenzii')}.`);
  }
  return out;
}

/** The county page's intro paragraph. */
export function countyIntro(slug: string, f: GroupFacts): string {
  const lead = f.lakes === 1 ? `Pe Bluvi găsești o baltă de pescuit ${inCounty(slug)}.` : `Pe Bluvi găsești ${lakesCount(f.lakes)} de pescuit ${inCounty(slug)}.`;
  return [lead, ...factSentences(f)].join(' ');
}

/** The species page's intro paragraph. */
export function speciesIntro(name: string, f: GroupFacts): string {
  const where = f.counties.slice(0, 3).map((c) => c.name);
  const lead =
    f.lakes === 1
      ? `Pe Bluvi găsești o baltă cu ${speciesWord(name)}`
      : `Pe Bluvi găsești ${lakesCount(f.lakes)} cu ${speciesWord(name)}`;
  const counties = f.counties.length > 1 ? `, în ${plural(f.counties.length, 'județ', 'județe')}` : f.counties.length === 1 ? `, ${inCounty(f.counties[0].slug)}` : '';
  const most = f.counties.length > 1 ? ` Cele mai multe sunt în ${listRo(where)}.` : '';
  return [`${lead}${counties}.${most}`, ...factSentences(f, { species: false })].join(' ');
}

/** A feature page's intro paragraph. */
export function featureIntro(feature: Feature, f: GroupFacts): string {
  const lead = `${f.lakes === 1 ? 'O baltă' : lakesCount(f.lakes)} ${feature.lead}.`;
  const where = f.counties.slice(0, 3).map((c) => c.name);
  const most = where.length ? ` Le găsești mai ales în ${listRo(where)}.` : '';
  return [`${lead}${most}`, ...factSentences(f, { booking: feature.slug !== 'cu-rezervare-online' })].join(' ');
}

/** Cuts a meta description to `max` characters on a word boundary. */
export function clampDescription(s: string, max = 160): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '')}…`;
}

/* ------------------------------------------------------------------------------------------------
 * The CMS read
 * ---------------------------------------------------------------------------------------------- */

/** Guard rail on the /feed/lakes/filtered walk (100 a page). */
export const LANDING_MAX_PAGES = 30;
/** /lakes/home's largest `limit` (the CMS answers 400 above it). */
const HOME_MAX_LIMIT = 20;

/**
 * Every published lake as a LandingLake: /feed/lakes/filtered without filters, 100 a page (public,
 * cached GETs on the server), sorted by documentId. The card DTO has no booking flag, so the
 * bookable lakes are /lakes/home's «bookable» row (its largest limit, 20 — every bookable lake while
 * there are at most 20; a failed read: none marked bookable, and the booking page is not made).
 * A failed lakes read throws.
 */
export async function readLandingLakes(t: Transport): Promise<LandingLake[]> {
  const first = await getFilteredLakes(t, { page: 1, pageSize: 100 });
  const last = Math.min(first.meta.pagination.pageCount, LANDING_MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(last - 1, 0) }, (_, i) => getFilteredLakes(t, { page: i + 2, pageSize: 100 })));
  let bookable = new Set<string>();
  try {
    const sections = await getLakesHome(t, { limit: HOME_MAX_LIMIT });
    bookable = new Set(sections.find((s) => s.key === 'bookable')?.lakes.filter((l) => l.bookingEnabled === true).map((l) => l.documentId) ?? []);
  } catch {
    bookable = new Set();
  }
  const all = [first, ...rest].flatMap((r) => r.data);
  const unique = [...new Map(all.map((l) => [l.documentId, l])).values()];
  return unique
    .map((l) => ({ ...l, bookingEnabled: bookable.has(l.documentId) }))
    .sort((a, b) => (a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0));
}
