import type { CompetitionCardsParams } from '../api';
import type { CompetitionCard, PulsePerson } from '../schemas';
import { DEFAULT_COMPETITION_FILTERS } from './filters';
import { pickHero, type HeroPick, type MyRegistration } from './pickHero';
import { pickMoment, type Moment } from './pickMoment';
import { pulsePersonToMoment } from './pulsePersonToMoment';

/**
 * The pure half of fish `features/competitions/helpers/useCompetitionsPulse.ts` — the Concursuri
 * bento. The hook composes the hero and the count tile from the SAME cached card lists the tab
 * already uses; the person tile reads `/feed/pulse-person`, and the hero reads
 * `/feed/featured-competition` when it would otherwise fall through to a discovery pick.
 *
 * What stays in the UI layer: the five `competitionCardsInfiniteQuery` observers, the
 * freeze-per-mount (a ref: the local pick is picked once per mount and re-picked only when the
 * live set changes or on pull-to-refresh), and the refresh callbacks. Everything those need to
 * decide is here.
 */

export const PULSE_PAGE = { live: 6, upcoming: 12, completed: 6 } as const;
/** A notStarted competition this far past its start never happened; the server cancels it. */
export const STALE_START_MS = 24 * 60 * 60 * 1000;

type PulseParams = Omit<CompetitionCardsParams, 'page' | 'pageSize'>;
const common = { search: null, filters: DEFAULT_COMPETITION_FILTERS, sort: 'date' as const, scope: 'all' as const };

/**
 * The five card lists the bento reads. `live` is byte-for-byte the Live tab's params, so the two
 * share one cache entry. `followedLive` is read only for its total (the invite card).
 */
export const PULSE_CARD_PARAMS = {
  live: { ...common, status: 'started' },
  upcoming: { ...common, status: 'notStarted' },
  completed: { ...common, status: 'completed' },
  mine: { ...common, scope: 'registered' },
  followedLive: { ...common, scope: 'followed', status: 'started' },
} as const satisfies Record<string, PulseParams>;

export type PulseLists = { live: CompetitionCard[]; upcoming: CompetitionCard[]; completed: CompetitionCard[] };

/**
 * The three lists the pick reads, from the loaded card pages.
 *
 * The upcoming page is sorted by start, so a competition whose organizer never pressed Start sits
 * at its head with a date in the past (the server cancels those a day later). They are not
 * upcoming for the bento: dropped here. My own notStarted competitions are merged in from the
 * `mine` list, so an imminent start of mine cannot fall off a page crowded by other people's.
 *
 * The live list wins on status: `?status=started` and `?status=notStarted` are two cache entries
 * with two ages, so a competition that just went live can sit in BOTH until the older refetches.
 * Seeding the dedupe set with the live ids keeps it out of the hero stack twice.
 */
export function pulseLists(
  loaded: { live: CompetitionCard[]; upcoming: CompetitionCard[]; completed: CompetitionCard[]; mine: CompetitionCard[] },
  nowMs: number
): PulseLists {
  const live = loaded.live.slice(0, PULSE_PAGE.live);
  const cutoff = nowMs - STALE_START_MS;
  const notStale = (c: { startDate: string | null }) => !c.startDate || new Date(c.startDate).getTime() >= cutoff;
  const seen = new Set(live.map(c => c.documentId));
  const upcoming = [...loaded.upcoming, ...loaded.mine.filter(c => c.status === 'notStarted')]
    .filter(c => notStale(c) && !seen.has(c.documentId) && (seen.add(c.documentId), true))
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    .slice(0, PULSE_PAGE.upcoming);
  const completed = loaded.completed.slice(0, PULSE_PAGE.completed);
  return { live, upcoming, completed };
}

/** The freeze re-picks when this changes: a competition going live or ending is not unrelated. */
export function pulseLiveKey(live: CompetitionCard[]): string {
  return live.map(c => c.documentId).join(',');
}

/** The local pick the hook freezes for the life of the screen. */
export function pickPulse(lists: PulseLists, mine: CompetitionCard[], now: Date): { hero: HeroPick | null; moment: Moment | null } {
  const registrations: MyRegistration[] = mine.map(c => ({
    documentId: c.documentId,
    status: c.status,
    startDate: c.startDate,
  }));
  return { hero: pickHero(lists, registrations, now), moment: pickMoment(lists, now) };
}

/**
 * Featured is asked for ONLY when it would be used. Two things disqualify it: anything live (the
 * hero then belongs to the live stack — this reads the live LIST, not `hero.kind`, because a
 * personal urgent start wins the hero over competitions that are nonetheless live), and a personal
 * rung (`next` + `mine`, rung 2's signature), which a draw identical for everyone cannot outrank.
 */
export function wantsFeaturedHero(input: {
  enabled: boolean;
  ready: boolean;
  liveCount: number;
  localHero: HeroPick | null;
}): boolean {
  const { enabled, ready, liveCount, localHero } = input;
  return enabled && ready && liveCount === 0 && !(localHero?.kind === 'next' && localHero.mine);
}

/**
 * The featured competition, dressed as an ordinary hero pick: `next` because that is what it is,
 * `featured` so the chip can say so, never `mine` (a pick the viewer is in would have taken the
 * slot two rungs earlier and disabled the query).
 */
export function featuredHeroPick(card: CompetitionCard | null | undefined): HeroPick | null {
  return card ? { kind: 'next', competition: card, mine: false, live: [], myImminent: null, featured: true } : null;
}

/**
 * Server slots win the moment they answer; the frozen local pick holds the slot until then — and
 * for good, if the draw is empty or fails. `wantsFeatured` guards the read as well as the fetch: a
 * cached draw from earlier in the session must not surface once something has gone live.
 */
export function resolvePulseSlots(input: {
  wantsFeatured: boolean;
  featured: CompetitionCard | null | undefined;
  person: PulsePerson | null | undefined;
  frozen: { hero: HeroPick | null; moment: Moment | null } | null;
}): { hero: HeroPick | null; moment: Moment | null } {
  const featuredPick = featuredHeroPick(input.featured);
  const serverMoment = input.person ? pulsePersonToMoment(input.person) : null;
  return {
    hero: (input.wantsFeatured ? featuredPick : null) ?? input.frozen?.hero ?? null,
    moment: serverMoment ?? input.frozen?.moment ?? null,
  };
}

/**
 * The count tile: live competitions, or — when none are — the ones starting within a week. Both
 * numbers and the faces come from the same set. Six faces across cards is a real crowd and what
 * the tile fits; four read as "four people are fishing".
 */
export function pulseCountTile(lists: Pick<PulseLists, 'live' | 'upcoming'>, nowMs: number) {
  const week = nowMs + 7 * 86_400_000;
  const startingSoon = lists.upcoming.filter(c => {
    if (!c.startDate) return false;
    const t = new Date(c.startDate).getTime();
    return t >= nowMs && t <= week;
  });
  const source = lists.live.length ? lists.live : startingSoon;
  const faces = [...new Set(source.flatMap(c => c.participantFaces))].slice(0, 6);
  return { startingSoonCount: startingSoon.length, faces };
}
