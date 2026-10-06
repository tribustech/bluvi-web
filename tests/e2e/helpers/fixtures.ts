import { getCompetition, getCompetitionsByStatus, type CompetitionStatus } from '@/core/competitions';
import { getCommunityVenueSection, hasPartideActivity } from '@/core/partide';
import { createTestTransport } from '../../transport';

/*
 * Fixtures whose state moves with the clock. A pinned id is only a hint: the local CMS's records
 * age (a registration deadline passes, a «not started» competition reaches its start, a lake's
 * upcoming competitions go live), so a spec that needs a record IN A STATE asks for it here, through
 * core/ (the same reads the app makes), and skips with the reason when the local DB has none:
 *
 *   const empty = await findCompetition({ pinned: ID.empty, status: 'notStarted', matches: c => … });
 *   test.skip(!empty, 'no notStarted competition with its registration still open locally');
 */

const cms = createTestTransport();

export type CompetitionFixture = Awaited<ReturnType<typeof getCompetition>>;

const ts = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** The start / deadline the CMS has now, as epoch ms (NaN when unset). */
export const startOf = (c: CompetitionFixture) => ts(c.startDate);
export const deadlineOf = (c: CompetitionFixture) => ts(c.registrationDeadline);

/** Registration still open: the deadline (or, without one, the start) is ahead. */
export function registrationOpen(c: CompetitionFixture, now = Date.now()) {
  const deadline = deadlineOf(c);
  return (Number.isNaN(deadline) ? startOf(c) : deadline) > now;
}

/**
 * The first competition in `status` that `matches` — the pinned one when it still does (its
 * assertions were written against it), else the first match on the CMS's first pages; null when the
 * local DB has none (the caller skips with the reason).
 */
export async function findCompetition({
  pinned,
  status,
  matches,
  pages = 3,
}: {
  pinned?: string;
  status: CompetitionStatus;
  matches: (c: CompetitionFixture, now: number) => boolean;
  pages?: number;
}): Promise<CompetitionFixture | null> {
  const now = Date.now();
  const fits = (c: CompetitionFixture) => c.competitionStatus === status && matches(c, now);
  if (pinned) {
    const c = await getCompetition(cms, pinned).catch(() => null);
    if (c && fits(c)) return c;
  }
  for (let page = 1; page <= pages; page++) {
    const list = await getCompetitionsByStatus(cms, status, { page, pageSize: 25 });
    for (const item of list.data) {
      if (item.documentId === pinned) continue;
      const c = await getCompetition(cms, item.documentId).catch(() => null);
      if (c && fits(c)) return c;
    }
    if (page >= list.meta.pagination.pageCount) break;
  }
  return null;
}

/**
 * fish LakeCompetitionsSection's two lists for a lake (Live = started, Viitoare = notStarted, 5
 * each): the lake page shows the Concursuri section and chip only when they hold something.
 */
export async function lakeCompetitionCounts(lakeId: string) {
  const [live, upcoming] = await Promise.all(
    (['started', 'notStarted'] as const).map((s) => getCompetitionsByStatus(cms, s, { page: 1, pageSize: 5 }, lakeId)),
  );
  return { live: live.data.length, upcoming: upcoming.data.length, upcomingList: upcoming.data };
}

/** fish hasPartideActivity on the lake's community section: whether its Partide section / chip shows. */
export async function lakeHasPartide(lakeId: string) {
  return hasPartideActivity(await getCommunityVenueSection(cms, { kind: 'lake', id: lakeId }));
}
