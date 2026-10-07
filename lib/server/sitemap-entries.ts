import 'server-only';
import type { MetadataRoute } from 'next';
import { getCompetition, getCompetitionsByStatus, getCompetitionWeighingStatistics, getSponsors, type CompetitionDetail, type CompetitionListItem } from '@/core/competitions';
import { getClaimedPublicWaters, getLake, getLakesIndex, parseLakeCoordinates, toClaimedPublicWatersMap, type LakeDetail } from '@/core/lakes';
import { getNews } from '@/core/news';
import { getCommunityHistory, getCommunityStats, getCommunityVenueCatches, VENUE_CATCHES_PAGE_SIZE, communityVenueKey, type CommunityStatsDTO, type CommunityVenueRef } from '@/core/partide';
import type { Transport } from '@/core/transport';
import { partideHrefs } from '@/lib/partide-pages';
import { absoluteUrl, routes, type CompetitionTabStatus } from '@/lib/routes';

/*
 * The sitemap's entries (global.b.seo-sitemap). Every URL is a self-canonical page with its own
 * indexable content, read through the same cached public CMS GETs as the pages themselves ('use
 * cache' + CMS tags, lib/server/public-get.ts), so a CMS purge refreshes both:
 *  - a subpage is listed only when its page has the data it shows (rule 4: an empty page is not
 *    advertised) — no coordinates → no /harta, no reviews → no /recenzii, no regulation → no
 *    /regulament, …; a read that fails leaves the subpages it decides out (never guessed in). The
 *    venue / competition predicates (venueSubpageHas, lakeSubpageHas, hasCompetitions,
 *    competitionViewHas) are exported: the subpages' metadata uses
 *    the same ones to mark an empty page `noindex, follow`, so the sitemap and the robots meta
 *    cannot disagree;
 *  - pages that are not indexed (noindex: the competition's Statistici — signed-in only —, its
 *    Extra Cântare — a utility list read in the browser —, the ranking image, the stand timeline,
 *    a public water's full map — the water page embeds it)
 *    and views that canonicalise elsewhere (/clasament, period
 *    and sort params) are never listed;
 *  - the CMS DTOs carry no updatedAt for lakes, competitions or sponsors, so only news has a
 *    lastModified (its createdAt: articles are not edited in place).
 * The URLs are split into sitemaps of at most MAX_URLS (sitemapIds / sitemapChunk, served by
 * app/sitemaps/sitemap.ts and indexed by app/sitemap.xml/route.ts).
 */

type Entry = MetadataRoute.Sitemap[number];

/** Guard rail: the CMS is paginated; never walk more than this many pages of one list. */
export const MAX_PAGES = 50;
/** The protocol's limit is 50 000 URLs per sitemap; chunks stay under it. */
export const MAX_URLS = 45_000;
/** Lakes per sitemap chunk: a lake yields at most 9 URLs. */
export const LAKES_PER_CHUNK = 5_000;
/** Public waters per sitemap chunk: a water yields at most 5 URLs. */
export const WATERS_PER_CHUNK = 7_000;
/** Per-item reads (lake detail, stats, catches; competition detail) in flight at once. */
const CONCURRENCY = 6;

const COMPETITION_STATUSES = ['notStarted', 'started', 'completed'] as const satisfies readonly CompetitionTabStatus[];

/** Maps `items` through `fn` with at most `limit` calls in flight, keeping the order. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** A read that may fail: the value, or null (and the subpages it decides are left out). */
async function maybe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

/** The list pages (each its own canonical; filtered / searched views canonicalise to them). */
export function staticEntries(): Entry[] {
  return [
    { url: absoluteUrl(routes.home()), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl(routes.lakes()), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl(routes.lakesMap()), changeFrequency: 'daily', priority: 0.7 },
    { url: absoluteUrl(routes.publicWaters()), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl(routes.competitions()), changeFrequency: 'hourly', priority: 0.9 },
    { url: absoluteUrl(routes.competitions('started')), changeFrequency: 'hourly', priority: 0.8 },
    { url: absoluteUrl(routes.competitions('notStarted')), changeFrequency: 'hourly', priority: 0.8 },
    { url: absoluteUrl(routes.competitions('completed')), changeFrequency: 'daily', priority: 0.6 },
    { url: absoluteUrl(routes.news()), changeFrequency: 'daily', priority: 0.6 },
    { url: absoluteUrl(routes.partide()), changeFrequency: 'hourly', priority: 0.7 },
    // Partide · Explorează (partide.exploreaza), once its page is on the web.
    ...(partideHrefs.explore() ? [{ url: absoluteUrl(routes.partideExplore()), changeFrequency: 'hourly' as const, priority: 0.6 }] : []),
    // Clasamente (partide.clasament): the bare page, the default period's ranking.
    ...(partideHrefs.ranking() ? [{ url: absoluteUrl(routes.partideRanking()), changeFrequency: 'daily' as const, priority: 0.5 }] : []),
  ];
}

/* ------------------------------------------------------------------------------------------------
 * Competitions
 * ---------------------------------------------------------------------------------------------- */

/** Every competition of one status (paginated, MAX_PAGES guard). */
export async function competitionsOf(t: Transport, status: CompetitionTabStatus): Promise<CompetitionListItem[]> {
  const out: CompetitionListItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await getCompetitionsByStatus(t, status, { page, pageSize: 100 });
    out.push(...res.data);
    if (page >= res.meta.pagination.pageCount) break;
  }
  return out;
}

type RichNode = { text?: string; children?: RichNode[] };
const plain = (blocks: unknown): string => {
  const walk = (n: RichNode): string => (n.text ?? '') + (n.children ?? []).map(walk).join('');
  return Array.isArray(blocks) ? (blocks as RichNode[]).map(walk).join('').trim() : '';
};

/** The Clasament views of a competition that are pages of their own once it has started. */
export type CompetitionContentView = 'cantare' | 'capturi';

/**
 * What a started competition's Cântare / Toți peștii show, from its weighing statistics (the public
 * read the page's stat row uses; one row per weighing, each with its catch count): the number of
 * weighings and of catches, or null when the read failed (unknown).
 */
export type CompetitionFacts = { weighings: number | null; catches: number | null };

/**
 * Whether a competition view has what it shows — shared with the views' metadata (empty →
 * `noindex, follow`) so the sitemap and the robots meta cannot disagree: Cântare needs a weighing,
 * Toți peștii a catch. null: the read failed (the sitemap leaves it out, the metadata keeps it
 * indexable — a CMS hiccup must not noindex a page).
 */
export function competitionViewHas(view: CompetitionContentView, f: CompetitionFacts): boolean | null {
  const n = view === 'cantare' ? f.weighings : f.catches;
  return n === null ? null : n > 0;
}

/** A competition's weighing facts (a failed read → nulls). Cached public GET. */
export async function competitionFacts(t: Transport, id: string): Promise<CompetitionFacts> {
  const res = await maybe(getCompetitionWeighingStatistics(t, id));
  return res ? { weighings: res.data.length, catches: res.data.reduce((n, w) => n + w.catchCount, 0) } : { weighings: null, catches: null };
}

/**
 * One competition's URLs: the page; Informații (always: dates, place, fee, organiser); Participanți
 * with at least one registered entrant; Regulament with a regulation (the detail read decides —
 * unread, it is left out); once it has started, Cântare with a weighing and Toți peștii with a catch
 * (competitionViewHas; before the start they show the preview, canonicalised to the page).
 * `detail`: the competition's detail when the caller already read it.
 */
export async function competitionUrls(
  t: Transport,
  c: CompetitionListItem,
  status: CompetitionTabStatus,
  detail?: CompetitionDetail | null,
): Promise<Entry[]> {
  const done = status === 'completed';
  const freq: Entry['changeFrequency'] = done ? 'monthly' : 'hourly';
  const id = c.documentId;
  const at = (path: string, priority: number): Entry => ({ url: absoluteUrl(path), changeFrequency: freq, priority });
  const out: Entry[] = [at(routes.competition(id), done ? 0.5 : 0.8), at(routes.competitionInfo(id), 0.4)];
  if (c.registrations.some(r => r.registrationStatus === 'registered')) out.push(at(routes.competitionParticipants(id), 0.4));
  const d = detail === undefined ? await maybe(getCompetition(t, id)) : detail;
  if (d && plain(d.regulation)) out.push(at(routes.competitionRules(id), 0.3));
  if (status !== 'notStarted') {
    const facts = await competitionFacts(t, id);
    if (competitionViewHas('cantare', facts) === true) out.push(at(routes.competitionWeighings(id), 0.4));
    if (competitionViewHas('capturi', facts) === true) out.push(at(routes.competitionCatches(id), 0.4));
  }
  return out;
}

/** The URLs of every competition of `status`. */
export async function competitionEntries(t: Transport, status: CompetitionTabStatus): Promise<Entry[]> {
  const list = await competitionsOf(t, status);
  return (await mapLimit(list, CONCURRENCY, c => competitionUrls(t, c, status))).flat();
}

/* ------------------------------------------------------------------------------------------------
 * Lakes
 * ---------------------------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------------------------------
 * What a venue's subpages show — shared with the subpages' metadata (empty → noindex, follow)
 * ---------------------------------------------------------------------------------------------- */

/**
 * A venue's community facts (null = the read failed): the month's stats (the stats pages' default
 * period, fish parity), the current year's (the widest period those pages offer — `year`;
 * undefined = not read),
 * the catches on the first catches page and the finished public partide on record.
 */
export type VenueFacts = { stats: CommunityStatsDTO | null; year?: CommunityStatsDTO | null; catches: number | null; history?: number | null };

/** What each stats page shows of a period's stats. */
const STATS_TEST: Record<'statistici' | 'clasament' | 'standuri', (s: CommunityStatsDTO) => boolean> = {
  statistici: s => s.totals.partide > 0,
  clasament: s => s.topAnglers.length > 0,
  standuri: s => (s.stands?.length ?? 0) > 0,
};

/**
 * Whether a stats page has content in ANY period it offers (month or year — the week is inside the
 * month): the page is judged by the widest period, so a quiet month never drops a venue with a
 * year of partide from the index. true when one read shows content; null when none does and a read
 * failed; else false.
 */
function statsHas(page: keyof typeof STATS_TEST, f: Pick<VenueFacts, 'stats' | 'year'>): boolean | null {
  const reads = f.year === undefined ? [f.stats] : [f.stats, f.year];
  if (reads.some(s => s && STATS_TEST[page](s))) return true;
  return reads.some(s => s === null) ? null : false;
}

/** The community subpages of a venue (lake or public water). */
export type VenueSubpage = 'galerie' | 'capturi' | 'partide' | 'statistici' | 'clasament' | 'standuri';

/**
 * Whether a venue's community subpage has what it shows: true / false, or null when a read it
 * depends on failed (unknown — the sitemap leaves it out, the metadata does not noindex it).
 * `images`: the lake's own photos (the gallery shows them with the catches).
 */
export function venueSubpageHas(page: VenueSubpage, f: VenueFacts, images = 0): boolean | null {
  const known = <T>(v: T | null, test: (v: T) => boolean) => (v === null ? null : test(v));
  switch (page) {
    case 'galerie':
      return images > 0 ? true : known(f.catches, n => n > 0);
    case 'capturi':
      return known(f.catches, n => n > 0);
    case 'partide':
      // The page lists the live partide, the catches and the finished partide.
      if ((f.catches ?? 0) > 0 || (f.stats?.totals.partide ?? 0) > 0 || (f.year?.totals.partide ?? 0) > 0 || (f.history ?? 0) > 0) return true;
      return f.catches === null || f.stats === null || f.history === null ? null : false;
    case 'statistici':
    case 'clasament':
    case 'standuri':
      return statsHas(page, f);
  }
}

/** Whether a lake's own subpages have what they show: reviews → /recenzii, coordinates → /harta. */
export const lakeSubpageHas = {
  recenzii: (lake: Pick<LakeDetail, 'reviewsMeta'>) => (lake.reviewsMeta?.count ?? 0) > 0,
  harta: (lake: Pick<LakeDetail, 'coordinates'>) => parseLakeCoordinates(lake.coordinates) !== null,
};

/** A venue's month and year stats (a failed read → null). Cached public GETs — the same the stats pages prefetch. */
export async function venueStats(t: Transport, venue: CommunityVenueRef): Promise<Required<Pick<VenueFacts, 'stats' | 'year'>>> {
  const [stats, year] = await Promise.all([maybe(getCommunityStats(t, 'month', venue)), maybe(getCommunityStats(t, 'year', venue))]);
  return { stats, year };
}

/** A venue's month + year stats, first catches page and history count, read in parallel (a failed read → null). Cached public GETs. */
export async function venueFacts(t: Transport, venue: CommunityVenueRef): Promise<Required<VenueFacts>> {
  const [stats, catches, history] = await Promise.all([
    venueStats(t, venue),
    maybe(getCommunityVenueCatches(t, venue, { page: 1, pageSize: VENUE_CATCHES_PAGE_SIZE })),
    maybe(getCommunityHistory(t, { page: 1, pageSize: 1, venues: [communityVenueKey(venue)] })),
  ]);
  return { ...stats, catches: catches ? catches.data.length : null, history: history ? history.meta.pagination.total : null };
}

/* ------------------------------------------------------------------------------------------------
 * Lakes
 * ---------------------------------------------------------------------------------------------- */

export type LakeFacts = VenueFacts & {
  lake: LakeDetail | null;
  /**
   * Whether any competition (of any status) is at this lake (hasCompetitions): the bare /concursuri
   * opens Live, else the first tab with competitions. null: unknown (a list read failed).
   */
  hasCompetitions: boolean | null;
};

/** A lake's URLs: the page, then each subpage that has what it shows (see the header). */
export function lakeUrls(id: string, f: LakeFacts): Entry[] {
  const at = (path: string, changeFrequency: Entry['changeFrequency'], priority: number): Entry => ({ url: absoluteUrl(path), changeFrequency, priority });
  const has = (page: VenueSubpage) => venueSubpageHas(page, f, f.lake?.images.length ?? 0) === true;
  const out: Entry[] = [at(routes.lake(id), 'weekly', 0.8)];
  if (has('galerie')) out.push(at(routes.lakeGallery(id), 'weekly', 0.4));
  if (has('capturi')) out.push(at(routes.lakeCatches(id), 'daily', 0.4));
  if (has('partide')) out.push(at(routes.lakePartide(id), 'daily', 0.5));
  if (has('statistici')) out.push(at(routes.lakeStats(id), 'daily', 0.4));
  if (has('clasament')) out.push(at(routes.lakeRanking(id), 'daily', 0.4));
  if (has('standuri')) out.push(at(routes.lakeStands(id), 'daily', 0.3));
  if (f.hasCompetitions === true) out.push(at(routes.lakeCompetitions(id), 'daily', 0.5));
  if (f.lake && lakeSubpageHas.recenzii(f.lake)) out.push(at(routes.lakeReviews(id), 'weekly', 0.5));
  if (f.lake && lakeSubpageHas.harta(f.lake)) out.push(at(routes.lakeMap(id), 'monthly', 0.3));
  return out;
}

/**
 * The lakes that host a competition of any status (from the competitions lists, cached public
 * GETs): their documentIds, and whether every list was read (`complete`: a lake missing from an
 * incomplete set is unknown, not «none»).
 */
export type CompetitionLakes = { lakes: Set<string>; complete: boolean };

export async function lakesWithCompetitions(t: Transport): Promise<CompetitionLakes> {
  const lists = await Promise.all(COMPETITION_STATUSES.map(s => maybe(competitionsOf(t, s))));
  return {
    lakes: new Set(lists.flatMap(l => l ?? []).flatMap(c => (c.lake ? [c.lake.documentId] : []))),
    complete: lists.every(l => l !== null),
  };
}

/**
 * Whether a lake's /concursuri has what it shows (a competition of any status at the lake) — shared
 * by lakeUrls and the subpage's metadata. null: unknown (not found and a list read failed).
 */
export function hasCompetitions(id: string, c: CompetitionLakes): boolean | null {
  return c.lakes.has(id) ? true : c.complete ? false : null;
}

/** The facts of one lake: its detail, its month / year stats and its first catches page, read in parallel. */
export async function lakeFacts(t: Transport, id: string, withCompetitions: CompetitionLakes): Promise<LakeFacts> {
  const [lake, facts] = await Promise.all([maybe(getLake(t, id)), venueFacts(t, { kind: 'lake', id })]);
  return { lake, ...facts, hasCompetitions: hasCompetitions(id, withCompetitions) };
}

/** The URLs of the lakes in `chunk` (LAKES_PER_CHUNK per chunk, index order). */
export async function lakeEntries(t: Transport, chunk = 0): Promise<Entry[]> {
  const ids = (await getLakesIndex(t)).map(l => l.documentId).slice(chunk * LAKES_PER_CHUNK, (chunk + 1) * LAKES_PER_CHUNK);
  if (!ids.length) return [];
  const withCompetitions = await lakesWithCompetitions(t);
  return (await mapLimit(ids, CONCURRENCY, async id => lakeUrls(id, await lakeFacts(t, id, withCompetitions)))).flat();
}

/* ------------------------------------------------------------------------------------------------
 * Public waters, sponsors, news
 * ---------------------------------------------------------------------------------------------- */

/**
 * The public waters (bundled ANAR dataset, read on the server — not a CMS list): the caller hands
 * their canonical keys in (app/sitemaps/sitemap.ts), so this module stays free of the dataset.
 *  - A string key is the water's linkCode: its community subpages exist (Partide, Statistici,
 *    Clasament, Capturi; without one they are a 404). Like a lake's, each is listed only when it
 *    has what it shows (`content`: the water's VenueFacts, venueSubpageHas); a water without facts
 *    (no partide on record, or a failed read) has none listed. A numeric key (no linkCode) has the
 *    page alone.
 *  - A water claimed by a lake (`claimed`: linkCode → lake) is replaced by its lake on the page
 *    (redirect): it is left out; the community subpages stay the water's own. `claimed` null (the
 *    claimed read failed): which linkCode water redirects is unknown, so the page of every linkCode
 *    water is left out (s4: never guessed in).
 *  - The full map (/harta) is never listed: `noindex, follow` (the water page embeds the map).
 */
export function publicWaterEntries(
  keys: readonly (string | number)[],
  claimed: ReadonlyMap<string, string> | null = new Map(),
  content: ReadonlyMap<string, VenueFacts> = new Map(),
): Entry[] {
  return keys.flatMap(k => {
    const out: Entry[] = [];
    const isCode = typeof k === 'string';
    // The water's page only: its full map (/harta) is `noindex, follow` — the page embeds the same
    // map, and thousands of near-identical map pages would only dilute the crawl.
    if (!isCode || (claimed && !claimed.has(k))) {
      out.push({ url: absoluteUrl(routes.publicWater(k)), changeFrequency: 'monthly', priority: 0.4 });
    }
    const facts = isCode ? content.get(k) : undefined;
    if (isCode && facts) {
      const has = (page: VenueSubpage) => venueSubpageHas(page, facts) === true;
      if (has('partide')) out.push({ url: absoluteUrl(routes.publicWaterPartide(k)), changeFrequency: 'daily', priority: 0.3 });
      if (has('statistici')) out.push({ url: absoluteUrl(routes.publicWaterStats(k)), changeFrequency: 'daily', priority: 0.2 });
      if (has('clasament')) out.push({ url: absoluteUrl(routes.publicWaterRanking(k)), changeFrequency: 'daily', priority: 0.2 });
      if (has('capturi')) out.push({ url: absoluteUrl(routes.publicWaterCatches(k)), changeFrequency: 'daily', priority: 0.2 });
    }
    return out;
  });
}

/** linkCode → lake of the claimed waters; null when the read fails (see publicWaterEntries). */
export async function claimedWaters(t: Transport): Promise<Map<string, string> | null> {
  const list = await maybe(getClaimedPublicWaters(t));
  return list ? toClaimedPublicWatersMap(list) : null;
}

/** Guard rail for the community history walk (100 partide a page). */
export const MAX_HISTORY_PAGES = 200;

/**
 * The linkCodes of the waters with a finished public partida on record (the community history,
 * walked once, MAX_HISTORY_PAGES guard): only these can have community subpages with content, so
 * only these are read per water. A page that fails ends the walk (what was read is kept: a water
 * left out is never guessed in).
 */
export async function watersWithPartide(t: Transport): Promise<Set<string>> {
  const codes = new Set<string>();
  for (let page = 1; page <= MAX_HISTORY_PAGES; page++) {
    const res = await maybe(getCommunityHistory(t, { page, pageSize: 100 }));
    if (!res) break;
    for (const s of res.data) if (s.venue.key.startsWith('water:')) codes.add(s.venue.key.slice('water:'.length));
    if (page >= res.meta.pagination.pageCount) break;
  }
  return codes;
}

/** The community facts of the linkCode waters in `keys` that have partide on record (bounded concurrency). */
export async function waterContent(t: Transport, keys: readonly (string | number)[]): Promise<Map<string, VenueFacts>> {
  const withPartide = await watersWithPartide(t);
  const codes = keys.filter((k): k is string => typeof k === 'string' && withPartide.has(k));
  const facts = await mapLimit(codes, CONCURRENCY, code => venueFacts(t, { kind: 'water', code }));
  return new Map(codes.map((c, i) => [c, facts[i]]));
}

/**
 * Every sponsor a page links to: the dashboard's (published, `displayOnDashboard`, at most 20)
 * united with those of every competition (the competition details the competition sitemaps read —
 * the Informații tab links them), deduped. A failed read leaves out only what it would have added.
 */
export async function sponsorIds(t: Transport): Promise<string[]> {
  const [dashboard, ...lists] = await Promise.all([maybe(getSponsors(t)), ...COMPETITION_STATUSES.map(s => maybe(competitionsOf(t, s)))]);
  const competitions = lists.flatMap(l => l ?? []);
  const details = await mapLimit(competitions, CONCURRENCY, c => maybe(getCompetition(t, c.documentId)));
  const ids = [...(dashboard?.data ?? []).map(s => s.documentId), ...details.flatMap(d => d?.sponsors.map(s => s.documentId) ?? [])];
  return [...new Set(ids)];
}

export async function sponsorEntries(t: Transport): Promise<Entry[]> {
  return (await sponsorIds(t)).map(id => ({ url: absoluteUrl(routes.sponsor(id)), changeFrequency: 'monthly', priority: 0.3 }));
}

export async function newsEntries(t: Transport): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await getNews(t, { page, pageSize: 200 });
    for (const a of res.data) {
      out.push({ url: absoluteUrl(routes.newsItem(a.documentId)), lastModified: a.createdAt, changeFrequency: 'monthly', priority: 0.4 });
    }
    if (page >= res.meta.pagination.pageCount) break;
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * The split: one sitemap per group (and per chunk), listed by the sitemap index
 * ---------------------------------------------------------------------------------------------- */

/** Logs a failed list and leaves it out: search engines keep their copy of what is missing. */
async function settle(what: string, p: Promise<Entry[]>): Promise<Entry[]> {
  try {
    return await p;
  } catch (e) {
    console.error(`[sitemap] ${what} failed`, e);
    return [];
  }
}

const COMPETITION_SITEMAP: Record<string, CompetitionTabStatus> = { 'concursuri-viitoare': 'notStarted', 'concursuri-live': 'started', 'concursuri-rezultate': 'completed' };

export type PublicWaterKeys = () => Promise<readonly (string | number)[]> | readonly (string | number)[];

/**
 * The sitemap ids: `pagini` (list pages, news, sponsors), `balti-<n>`, one per competition status
 * (each ≤ MAX_PAGES × 100 competitions × 6 URLs < MAX_URLS) and `ape-publice-<n>`. Counting needs only
 * the lakes index and the dataset's keys; a failed index still lists chunk 0.
 */
export async function sitemapIds(t: Transport, publicWaterKeys?: PublicWaterKeys): Promise<string[]> {
  const lakes = (await maybe(getLakesIndex(t)))?.length ?? 0;
  const waters = publicWaterKeys ? (await Promise.resolve().then(publicWaterKeys)).length : 0;
  const chunks = (n: number, per: number) => Math.max(1, Math.ceil(n / per));
  return [
    'pagini',
    ...Array.from({ length: chunks(lakes, LAKES_PER_CHUNK) }, (_, i) => `balti-${i}`),
    ...Object.keys(COMPETITION_SITEMAP),
    ...(publicWaterKeys ? Array.from({ length: chunks(waters, WATERS_PER_CHUNK) }, (_, i) => `ape-publice-${i}`) : []),
  ];
}

/** The entries of one sitemap id (see sitemapIds); an unknown id is empty. Capped at MAX_URLS. */
export async function sitemapChunk(t: Transport, id: string, publicWaterKeys?: PublicWaterKeys): Promise<Entry[]> {
  const n = Number(id.split('-').pop());
  let out: Entry[] = [];
  if (id === 'pagini') {
    const [news, sponsors] = await Promise.all([settle('news', newsEntries(t)), settle('sponsors', sponsorEntries(t))]);
    out = [...staticEntries(), ...news, ...sponsors];
  } else if (id.startsWith('balti-') && Number.isInteger(n)) {
    out = await settle('lakes', lakeEntries(t, n));
  } else if (id in COMPETITION_SITEMAP) {
    out = await settle(id, competitionEntries(t, COMPETITION_SITEMAP[id]));
  } else if (id.startsWith('ape-publice-') && Number.isInteger(n) && publicWaterKeys) {
    const keys = (await Promise.resolve().then(publicWaterKeys)).slice(n * WATERS_PER_CHUNK, (n + 1) * WATERS_PER_CHUNK);
    if (keys.length) {
      const [claimed, content] = await Promise.all([claimedWaters(t), waterContent(t, keys)]);
      out = publicWaterEntries(keys, claimed, content);
    }
  }
  return out.slice(0, MAX_URLS);
}

/** Every entry of every sitemap (tests, tooling). */
export async function sitemapEntries(t: Transport, publicWaterKeys?: PublicWaterKeys): Promise<Entry[]> {
  const ids = await sitemapIds(t, publicWaterKeys);
  return (await Promise.all(ids.map(id => sitemapChunk(t, id, publicWaterKeys)))).flat();
}
