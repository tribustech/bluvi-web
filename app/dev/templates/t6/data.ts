import 'server-only';
import { getCompetition, getFishSpecies, type CompetitionDetail } from '@/core/competitions';
import { getAllocatedParticipants, getWeighings, getWeighingsSummary, type WeighingByStand } from '@/core/organizer';
import { getUSerStatuteForCompetition, type UserStatuteForCompetition } from '@/core/social';
import { isApiError, networkError, type Transport, type TransportRequest } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';
import { getViewer } from '@/lib/server/viewer';
import { formatStandLabel, standTileLabel } from './stand';

/*
 * The T6 demo's first user screen: the scale («Cântar») — fish app/(app)/scale/[competitionId]/
 * index.tsx (Alege standul) and the add-catch step (add.tsx + AddCatchSheet). Everything is read
 * through core/ with the server transport; nothing is written.
 */

export type ScaleAccess = 'weigh' | 'not-started' | 'finished' | 'no-role' | 'signed-out';

export type StandView = {
  documentId: string;
  name: string;
  /** Tile title: «Stand 3» / NC «Stand A1(3)». */
  tileLabel: string;
  /** Subject title: «Sector A, Stand 3» / NC «Stand A1(3)». */
  fullLabel: string;
  /** NC: the club, the operator's anchor at a weigh-in. */
  club: string | null;
  /** Team competitions: the team name (fish: «Echipa» when empty). */
  team: string | null;
  /**
   * The names on the stand. A guest registration has one name, typed by the organiser (often the
   * team name again, with typos); `guest` says so, so the team is shown alone rather than twice.
   */
  people: string[];
  guest: boolean;
  /** NC: the stand's draw position in its sector (the order a referee walks). */
  drawPosition: number | null;
  occupied: boolean;
  totalKg: number;
  weighings: number;
};

export type SectorView = { name: string; stands: StandView[] };

export type ScaleData = {
  competition: {
    documentId: string;
    name: string;
    lakeName: string | null;
    status: CompetitionDetail['competitionStatus'];
    isTeam: boolean;
    isNc: boolean;
  };
  sectors: SectorView[];
  access: ScaleAccess;
  role: UserStatuteForCompetition['userRole'];
  summary: { standCount: number; occupied: number; weighed: number; totalKg: number; regular: number; extra: number };
  /**
   * Partial failures: the page still works without these reads, but must not present their
   * fallback as fact. summaryFailed → the totals are unknown (not 0); statuteFailed → the role is
   * unknown (not «no role»), so weighing stays off until a retry succeeds.
   */
  summaryFailed: boolean;
  statuteFailed: boolean;
};

export type AddCatchData = {
  stand: StandView;
  species: { value: string; label: string }[];
  weighings: (Pick<WeighingByStand, 'documentId' | 'weighingType' | 'weighingStatus' | 'startDate'> & {
    totalKg: number;
    catches: number;
  })[];
};

/**
 * A page render's reads are bounded together: a CMS that hangs (rather than fails) must reach the
 * error state with «Reîncearcă» within 8 s in total, never leave the skeleton up forever — not
 * 8 s per request, as the reads run in stages (competition → viewer → the rest). 8 s is well above
 * the slow-dev (ngrok) case of 2–3 s per request.
 */
export const READ_TIMEOUT_MS = 8000;

/** One deadline for every read of one page render. */
export type Deadline = {
  signal: AbortSignal;
  /** Rejects with a network ApiError once the deadline passes (the read is aborted when it can be). */
  race<T>(read: Promise<T>, what: string): Promise<T>;
};

export function createDeadline(ms = READ_TIMEOUT_MS): Deadline {
  const signal = AbortSignal.timeout(ms);
  return {
    signal,
    race<T>(read: Promise<T>, what: string) {
      const expired = new Promise<never>((_, reject) => {
        const fail = () => reject(networkError(what, new Error(`no answer within ${ms} ms`)));
        if (signal.aborted) fail();
        else signal.addEventListener('abort', fail, { once: true });
      });
      return Promise.race([read, expired]);
    },
  };
}

/**
 * The server transport under the page's deadline: its abort signal for the fetches that honour it,
 * and a race for the ones that do not (the cached public GET). `hang` (demo `slow`): every request
 * never answers, so the deadline itself is what ends the load — the real worst case.
 */
function timedTransport(deadline: Deadline, hang = false): Transport {
  const t = createServerTransport();
  return {
    request<T>(req: TransportRequest) {
      const signal = req.signal ? AbortSignal.any([req.signal, deadline.signal]) : deadline.signal;
      return deadline.race(hang ? new Promise<never>(() => {}) : t.request<T>({ ...req, signal }), req.path);
    },
  };
}

/** Stands in the order they are numbered: «Stand 2» before «Stand 10». */
const byName = new Intl.Collator('ro', { numeric: true }).compare;

function accessFor(
  signedIn: boolean,
  statute: UserStatuteForCompetition | null,
  status: CompetitionDetail['competitionStatus'],
): ScaleAccess {
  if (!signedIn) return 'signed-out';
  // fish scale/history.tsx: actions only for the author or a referee, and only while started. The
  // status is checked first: on a finished competition nobody weighs, so «Concursul s-a încheiat»
  // (matching the header's pill) is the headline, not the viewer's role.
  if (status === 'notStarted') return 'not-started';
  if (status !== 'started') return 'finished';
  if (statute?.userRole !== 'author' && statute?.userRole !== 'referee') return 'no-role';
  return 'weigh';
}

/** A read the page can live without: its failure is reported (and logged), never swallowed. */
async function settle<T>(what: string, read: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await read };
  } catch (e) {
    console.error(`[t6] ${what} read failed`, e);
    return { ok: false };
  }
}

/** Throws on a CMS failure (the page shows the error state); null when the id is unknown. */
export async function loadScale(
  competitionId: string,
  deadline: Deadline,
  { hang = false }: { hang?: boolean } = {},
): Promise<ScaleData | null> {
  const t = timedTransport(deadline, hang);
  let competition: CompetitionDetail;
  try {
    competition = await getCompetition(t, competitionId);
  } catch (e) {
    if (isApiError(e) && e.status === 404) return null;
    throw e;
  }
  const viewer = await deadline.race(getViewer(), 'viewer');
  const [allocated, summaryRead, statuteRead] = await Promise.all([
    getAllocatedParticipants(t, competitionId),
    // Signed out the scale is a sign-in gate that shows no totals, and /weighings-summary has no
    // Public grant: reading it would only log a 403 on every guest view.
    viewer ? settle('weighings summary', getWeighingsSummary(t, competitionId)) : Promise.resolve({ ok: true as const, value: [] }),
    viewer ? settle('statute', getUSerStatuteForCompetition(t, competitionId)) : Promise.resolve({ ok: true as const, value: null }),
  ]);
  const summaryFailed = !summaryRead.ok;
  const statuteFailed = !statuteRead.ok;
  const summary = summaryRead.ok ? summaryRead.value : [];
  const statute = statuteRead.ok ? statuteRead.value : null;
  const isNc = competition.rankingType === 'nationalChampionship';
  const isTeam = competition.competitionType === 'team';
  const byStand = new Map(summary.map((s) => [s.standId, s]));

  // The CMS returns sectors and stands in insertion order: sorted here (A, B, C…; 1, 2, … 10), before
  // anything iterates them, so the grid, the hrefs and the stand lookup share one order. On NC the
  // stands follow the draw (A1, A2…) where it exists.
  const sectors: SectorView[] = [...competition.sectors]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map((sector) => ({
      name: sector.name,
      stands: sector.stands
        .map((stand) => {
          const alloc = allocated[stand.documentId] ?? null;
          const sum = byStand.get(stand.documentId);
          const guest = Boolean(alloc?.guestName);
          const people = alloc ? (guest ? [alloc.guestName] : alloc.participants.map((p) => p.name)) : [];
          const drawPosition = alloc?.sectorDrawPosition ?? null;
          return {
            documentId: stand.documentId,
            name: stand.name,
            tileLabel: standTileLabel(isNc, sector.name, drawPosition, stand.name),
            fullLabel: formatStandLabel(isNc, sector.name, drawPosition, stand.name),
            club: isNc && alloc?.clubName ? alloc.clubName : null,
            team: alloc && isTeam ? alloc.teamName || 'Echipa' : null,
            people,
            guest,
            drawPosition: isNc ? drawPosition : null,
            occupied: Boolean(alloc),
            totalKg: sum?.totalKg ?? 0,
            weighings: (sum?.regularCount ?? 0) + (sum?.extraCount ?? 0),
          };
        })
        .sort((a, b) =>
          a.drawPosition != null && b.drawPosition != null && a.drawPosition !== b.drawPosition
            ? a.drawPosition - b.drawPosition
            : // Drawn stands first, then the rest by name.
              (a.drawPosition == null ? 1 : 0) - (b.drawPosition == null ? 1 : 0) || byName(a.name, b.name),
        ),
    }));

  const stands = sectors.flatMap((s) => s.stands);
  return {
    competition: {
      documentId: competition.documentId,
      name: competition.name,
      lakeName: competition.lake?.name ?? null,
      status: competition.competitionStatus,
      isTeam,
      isNc,
    },
    sectors,
    access: accessFor(Boolean(viewer), statute, competition.competitionStatus),
    summaryFailed,
    statuteFailed,
    role: statute?.userRole ?? null,
    summary: {
      standCount: stands.length,
      occupied: stands.filter((s) => s.occupied).length,
      weighed: stands.filter((s) => s.weighings > 0).length,
      totalKg: summary.reduce((acc, s) => acc + s.totalKg, 0),
      regular: summary.reduce((acc, s) => acc + s.regularCount, 0),
      extra: summary.reduce((acc, s) => acc + s.extraCount, 0),
    },
  };
}

type AddCatchReads = Pick<AddCatchData, 'species' | 'weighings'>;

/**
 * Step 2's own reads (the competition's species, the stand's weighings — fish useWeighings). They
 * need only the two ids from the URL, so the page starts them alongside loadScale instead of after
 * it: no request waterfall on a slow CMS.
 */
export async function startAddCatchReads(competitionId: string, standId: string, deadline: Deadline): Promise<AddCatchReads> {
  const t = timedTransport(deadline);
  const [species, weighings] = await Promise.all([getFishSpecies(t, competitionId), getWeighings(t, competitionId, standId)]);
  return {
    species: species.map((f) => ({ value: f.documentId, label: f.Name })),
    weighings: weighings.map((w) => ({
      documentId: w.documentId,
      weighingType: w.weighingType,
      weighingStatus: w.weighingStatus,
      startDate: w.startDate,
      totalKg: w.catches.reduce((acc, c) => acc + c.weight, 0),
      catches: w.catches.length,
    })),
  };
}

/**
 * Step 2: null when the stand is not an occupied stand of this competition. `reads` are the ones
 * the page already started (startAddCatchReads); started here otherwise.
 */
export async function loadAddCatch(
  scale: ScaleData,
  standId: string,
  deadline: Deadline,
  reads?: Promise<AddCatchReads>,
): Promise<AddCatchData | null> {
  const stand = scale.sectors.flatMap((s) => s.stands).find((s) => s.documentId === standId && s.occupied);
  if (!stand) return null;
  return { stand, ...(await (reads ?? startAddCatchReads(scale.competition.documentId, standId, deadline))) };
}
