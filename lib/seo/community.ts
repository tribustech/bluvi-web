import type { DehydratedState } from '@tanstack/react-query';
import { formatCount } from '@/core/realtime/chat/format';
import { isWeighed, sortStands, type CommunityStatsDTO } from '@/core/partide';
import { collectionPageJsonLd } from '@/lib/json-ld';

/*
 * JSON-LD of the community venue subpages (a lake's or a public water's Statistici, Clasament,
 * Standuri, Partide): a CollectionPage about the venue, with the ranked rows the page shows as an
 * ItemList. Built from the SAME prefetched query the page hands its client screen, so the JSON-LD
 * never says more than the HTML (rule 4): no list when the period has no rows, no kg when nothing
 * was weighed (the page's «—»), counts with Romanian plurals.
 */

const KG2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = (n: number) => `${KG2.format(n)} kg`;

/** The period's stats from a dehydrated `communityStatsQuery`, or null when the read failed. */
export function statsFromState(state: DehydratedState): CommunityStatsDTO | null {
  const data = state.queries[0]?.state.data as CommunityStatsDTO | undefined;
  return data && typeof data === 'object' && 'totals' in data ? data : null;
}

type Venue = { type: string; name: string; path: string };

/** «12 partide, 5 pescari, 30 de capturi» — the period's totals as the page's tiles show them. */
export function totalsLine(stats: CommunityStatsDTO): string {
  const t = stats.totals;
  return [formatCount(t.partide, 'partidă', 'partide'), formatCount(t.anglers, 'pescar', 'pescari'), formatCount(t.catches, 'captură', 'capturi')].join(', ');
}

/** The anglers' ranking rows (Clasament pescari), in the page's order. */
export function anglerItems(stats: CommunityStatsDTO) {
  return stats.topAnglers.map(a => ({
    name: a.name ?? 'Pescar',
    description: [isWeighed(a.totalKg) ? kg(a.totalKg) : null, formatCount(a.partide, 'partidă', 'partide'), formatCount(a.catches, 'captură', 'capturi')]
      .filter(Boolean)
      .join(' · '),
  }));
}

/** The stand ranking rows (Clasament standuri) by the default sort (kg), as the canonical page. */
export function standItems(stats: CommunityStatsDTO) {
  return sortStands(stats.stands ?? [], 'kg').map(s => ({
    name: s.name,
    description: [
      s.catches > 0 && isWeighed(s.totalKg) ? kg(s.totalKg) : null,
      formatCount(s.partide, 'partidă', 'partide'),
      formatCount(s.catches, 'captură', 'capturi'),
      s.recordKg != null && isWeighed(s.recordKg) ? `record ${kg(s.recordKg)}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

/** Statistici: a CollectionPage whose description is the period's totals (only when there are any). */
export function statsPageJsonLd(name: string, path: string, venue: Venue, stats: CommunityStatsDTO | null) {
  const has = !!stats && stats.totals.partide > 0;
  return collectionPageJsonLd({
    name,
    path,
    about: venue,
    ...(has ? { description: totalsLine(stats!) } : {}),
    ...(has && stats!.topAnglers.length ? { list: { name: 'Top pescari', items: anglerItems(stats!) } } : {}),
  });
}

/** Clasament pescari: a CollectionPage with the ranking as its ItemList. */
export function anglersRankingJsonLd(name: string, path: string, venue: Venue, stats: CommunityStatsDTO | null) {
  const items = stats ? anglerItems(stats) : [];
  return collectionPageJsonLd({ name, path, about: venue, ...(items.length ? { list: { name: 'Clasament pescari', items } } : {}) });
}

/** Clasament standuri: a CollectionPage with the stands by kg as its ItemList. */
export function standsRankingJsonLd(name: string, path: string, venue: Venue, stats: CommunityStatsDTO | null) {
  const items = stats ? standItems(stats) : [];
  return collectionPageJsonLd({ name, path, about: venue, ...(items.length ? { list: { name: 'Clasament standuri', items } } : {}) });
}
