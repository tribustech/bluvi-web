import { parseStatsPeriodParam, type StatsPeriod } from '@/core/partide';

/*
 * «Clasamente»'s place in the URL (partide.clasament c1, T1 rule: a reload, the browser's back and a
 * shared link bring the same view back). fish keeps the period in `?period=` (router.setParams) and
 * the segment in local state; the web mirrors both:
 *   ?perioada=week|year        the period (luna, the default, is left out; anything else → luna)
 *   ?tab=balti|specii          the ranking (pescari, the default, is left out; anything else → pescari)
 * Pure: the server page and the browser read the same way.
 */

export type RankingTab = 'pescari' | 'balti' | 'specii';

export type RankingPlace = { period: StatsPeriod; tab: RankingTab };

export const DEFAULT_PERIOD: StatsPeriod = 'month';

export const DEFAULT_PLACE: RankingPlace = { period: DEFAULT_PERIOD, tab: 'pescari' };

export const TABS: { key: RankingTab; label: string }[] = [
  { key: 'pescari', label: 'Pescari' },
  { key: 'balti', label: 'Bălți' },
  { key: 'specii', label: 'Specii' },
];

export function parseTab(raw: string | null | undefined): RankingTab {
  return raw === 'balti' || raw === 'specii' ? raw : 'pescari';
}

export function placeFromParams(params: { get(key: string): string | null }): RankingPlace {
  return { period: parseStatsPeriodParam(params.get('perioada') ?? undefined), tab: parseTab(params.get('tab')) };
}

/** The query values for useListUrlState (null = removed). */
export function placeToParams(place: RankingPlace): Record<string, string | null> {
  return { perioada: place.period === DEFAULT_PERIOD ? null : place.period, tab: place.tab === 'pescari' ? null : place.tab };
}

/**
 * The order the page ranks the period's anglers in — the podium, the rows, the «EU» pill's place and
 * the JSON-LD ItemList all read this one list. The CMS sorts by kg desc, then uid; within a kg tie
 * (nothing weighed is the common case) the web orders by catches, then partide, the server order
 * kept after that: the venue family's order (ape-publice venue bits rankAnglers, also «Top pescari»
 * on /partide/statistici), so the figure shown beside each place explains it. A deliberate deviation
 * from fish, which keeps the server order (parity partide.clasament c2/c4/c7; proposed server-side in
 * docs/private/cms-patches/M1-community-ranking-ties.md). Pure: the server page (JSON-LD) and the
 * browser read the same way (bits.tsx is a client module the server cannot call).
 */
export function rankingOrder<T extends { totalKg: number; catches: number; partide: number }>(anglers: T[]): T[] {
  return anglers
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.totalKg - x.a.totalKg || y.a.catches - x.a.catches || y.a.partide - x.a.partide || x.i - y.i)
    .map((x) => x.a);
}

/**
 * The «EU» pill's period phrase. fish periodPhraseFor says «anul asta» (a typo: «an» is masculine);
 * the web writes «anul ăsta», the other two as fish.
 */
export const PERIOD_PHRASE: Record<StatsPeriod, string> = {
  week: 'săptămâna asta',
  month: 'luna asta',
  year: 'anul ăsta',
};
