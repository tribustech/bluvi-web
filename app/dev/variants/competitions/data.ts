import 'server-only';
import {
  DEFAULT_COMPETITION_FILTERS,
  getCompetitionCards,
  getCompetitionMyStatus,
  getCompetitionRegistrations,
  STALE_START_MS,
  type CompetitionCard,
  type CompetitionCardCounts,
} from '@/core/competitions';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import { getShellSession } from '../../../(site)/_shell/session';
import { bounded } from '../../../(site)/concursuri/_list/server';

/*
 * The prototypes' data: the same /feed/competition-cards lists /concursuri reads (core/), straight
 * from the local CMS, plus — for «Ale mele» — the viewer's registered cards with their own status
 * (/feed/competitions/:id/my-status) and stand (/competitions/:id/registrations). When the QA
 * account has too few registrations to judge the layout, sample rows are built from REAL upcoming
 * and live cards and flagged `sample` (the page marks them «Exemplu»).
 */

export type MyStatus = 'registered' | 'pending' | 'rejected' | 'cancelled' | null;

export type MineRow = {
  card: CompetitionCard;
  status: MyStatus;
  /** The stand's name once the draw placed the viewer; null before it. */
  stand: string | null;
  /** A row made up from a real card to show the layout — never the viewer's data. */
  sample: boolean;
};

export type VariantData = {
  upcoming: CompetitionCard[];
  live: CompetitionCard[];
  completed: CompetitionCard[];
  counts: CompetitionCardCounts | null;
  signedIn: boolean;
  viewerName: string | null;
  mine: MineRow[];
  /** How many of `mine` are the viewer's real registrations. */
  mineReal: number;
};

const common = { search: null, filters: DEFAULT_COMPETITION_FILTERS, sort: 'date', page: 1, pageSize: 24 } as const;

export async function loadVariantData(): Promise<VariantData> {
  const t = bounded(createServerTransport(), 6000);
  const token = await getSessionToken();
  const [up, live, done, viewer] = await Promise.all([
    getCompetitionCards(t, { ...common, scope: 'all', status: 'notStarted' }).catch(() => null),
    getCompetitionCards(t, { ...common, scope: 'all', status: 'started' }).catch(() => null),
    getCompetitionCards(t, { ...common, scope: 'all', status: 'completed' }).catch(() => null),
    token ? getShellSession().catch(() => null) : Promise.resolve(null),
  ]);
  const signedIn = !!viewer && !('status' in viewer);
  const viewerId = viewer && !('status' in viewer) ? viewer.id : null;

  // As the bento does (core pulse): a «notStarted» card whose start is already behind us is an
  // organiser who never pressed Start — not upcoming.
  const staleBefore = Date.now() - STALE_START_MS;
  const upcoming = (up?.data ?? []).filter((c) => !c.startDate || new Date(c.startDate).getTime() >= staleBefore);

  let mine: MineRow[] = [];
  if (signedIn) {
    const reg = await getCompetitionCards(t, { ...common, scope: 'registered' }).catch(() => null);
    mine = await Promise.all(
      (reg?.data ?? []).map(async (card): Promise<MineRow> => {
        const [status, regs] = await Promise.all([
          getCompetitionMyStatus(t, card.documentId)
            .then((s) => s.userRegistrationStatus)
            .catch(() => null),
          getCompetitionRegistrations(t, card.documentId).catch(() => []),
        ]);
        const own = regs.find((r) => r.participants?.some((p) => p.id === viewerId));
        return { card, status: status ?? (own ? (own.registrationStatus as MyStatus) : null), stand: own?.stand?.name ?? null, sample: false };
      }),
    );
  }
  const mineReal = mine.length;
  if (signedIn && mineReal < 4) mine = [...mine, ...sampleRows(upcoming, live?.data ?? [], mine)];

  return {
    upcoming,
    live: live?.data ?? [],
    completed: done?.data ?? [],
    counts: up?.meta.counts ?? live?.meta.counts ?? null,
    signedIn,
    viewerName: viewer && !('status' in viewer) ? viewer.username : null,
    mine: sortMine(mine),
    mineReal,
  };
}

/** Live first, then upcoming by date, then finished (newest first). */
function sortMine(rows: MineRow[]): MineRow[] {
  const rank = { started: 0, notStarted: 1, completed: 2 } as const;
  return [...rows].sort((a, b) => {
    const r = rank[a.card.status] - rank[b.card.status];
    if (r) return r;
    const da = new Date(a.card.startDate ?? 0).getTime();
    const db = new Date(b.card.startDate ?? 0).getTime();
    return a.card.status === 'completed' ? db - da : da - db;
  });
}

/** Real cards dressed as the four registration states the tab must show (marked «Exemplu»). */
function sampleRows(upcoming: CompetitionCard[], live: CompetitionCard[], taken: MineRow[]): MineRow[] {
  const used = new Set(taken.map((r) => r.card.documentId));
  const free = upcoming.filter((c) => !used.has(c.documentId));
  const out: MineRow[] = [];
  const liveCard = live.find((c) => !used.has(c.documentId) && (c.results?.catchCount ?? 0) > 0);
  if (liveCard) out.push({ card: liveCard, status: 'registered', stand: '12', sample: true });
  const plan: Array<Pick<MineRow, 'status' | 'stand'>> = [
    { status: 'registered', stand: '7' },
    { status: 'pending', stand: null },
    { status: 'registered', stand: null },
  ];
  plan.forEach((p, i) => {
    const card = free[i];
    if (card) out.push({ card, ...p, sample: true });
  });
  return out;
}
