import { formatDecimal } from '@/components/cards/format';
import {
  getCompetitorDisplayName,
  resultHeadline,
  type CompetitionCard,
} from '@/core/competitions';

/*
 * The desktop tab views' models (owner-approved prototype A2, 2026-10-06) — plain, serialisable
 * shapes built from core/ reads, shared by the client pieces. No framework here.
 *
 * Every number comes from the CMS through core/: the ranking (/competitions/:id/ranking), the
 * weighing log (/competitions/:id/weighing-statistics), the heaviest catches
 * (/competitions/:id/catches?sort=weight_desc) and the registrations. Nothing is invented; a slot
 * whose data is missing is hidden («când nu știm, nu arătăm», ROADMAP §4b.4).
 */

/** kg for the weight rankings; points where the type ranks by points, the fewest win (core resultHeadline). */
export type ValueUnit = 'kg' | 'puncte';

export type MiniRow = {
  key: string;
  position: number;
  name: string;
  avatar: string | null;
  sector: string | null;
  stand: string | null;
  /** The ranking's headline value (kg total, quality, average, points…), per `valueLabel`. */
  value: number | null;
  catches: number;
  biggest: number;
  /** Positions gained (+) or lost (−) since the latest weighing; null when it cannot be known. */
  delta: number | null;
  /** This stand weighed in one of the competition's latest weighings. */
  fresh: boolean;
  /** Who the row is (identity, never the display name): the users on it and its registration. */
  userIds: number[];
  registrationId: string | null;
};

export type BigCatch = { weight: number; name: string; stand: string | null; sector: string | null };

export type MiniRanking = {
  rows: MiniRow[];
  /** «kg total», «calitate», «medie», «puncte» — the caption of `value`. */
  valueLabel: string;
  unit: ValueUnit;
  /** Points rankings: the fewest lead (gaps are counted the other way). */
  lowerIsBetter: boolean;
  totalKg: number | null;
  totalCatches: number | null;
  biggestCatch: BigCatch | null;
};

/* ---------------------------------------------------------------- values */

/** «12,345» kg (up to 3 decimals) or «3,5» points (whole or halves, as fish feederPoints). */
export function valueText(value: number, unit: ValueUnit): string {
  return unit === 'puncte' ? formatDecimal(value, 0, 1) : formatDecimal(value, 1, 3);
}

/** «1 punct», «2,5 puncte», «20 de puncte» (Romanian agreement). */
export function pointsText(n: number): string {
  const whole = Number.isInteger(n);
  const word = whole && n === 1 ? 'punct' : whole && (n % 100 >= 20 || (n > 0 && n % 100 === 0)) ? 'de puncte' : 'puncte';
  return `${valueText(n, 'puncte')} ${word}`;
}

/** The gap between two rows, always ≥ 0 and in the ranking's own sense (points: points behind). */
export function gapOf(r: Pick<MiniRanking, 'lowerIsBetter'>, first: MiniRow, second: MiniRow): number | null {
  if (first.value == null || second.value == null) return null;
  return r.lowerIsBetter ? second.value - first.value : first.value - second.value;
}

/* ---------------------------------------------------------------- ranking normalisation */

type Raw = Record<string, unknown>;
const num = (r: Raw, k: string): number | null => (typeof r[k] === 'number' ? (r[k] as number) : null);
const str = (r: Raw, k: string): string | null => (typeof r[k] === 'string' && (r[k] as string).trim() ? (r[k] as string) : null);

/** The users a ranking row stands for: its participant and, for a team, every member listed. */
function userIdsOf(r: Raw): number[] {
  const one = r.participant && typeof r.participant === 'object' && !Array.isArray(r.participant) ? [r.participant as Raw] : [];
  const many = Array.isArray(r.participants) ? (r.participants as Raw[]) : [];
  return [...new Set([...one, ...many].map((p) => num(p, 'id')).filter((n): n is number => n != null))];
}

function nameOf(r: Raw): string | null {
  const club = str(r, 'clubName');
  if (club) return club;
  const participant = r.participant && typeof r.participant === 'object' && !Array.isArray(r.participant) ? (r.participant as Raw) : null;
  const participants = Array.isArray(r.participants) ? (r.participants as Raw[]) : [];
  const names = [participant ? str(participant, 'username') : null, ...participants.map((p) => str(p, 'username'))].filter(Boolean);
  const out = getCompetitorDisplayName({ teamName: str(r, 'teamName'), participantNames: [...new Set(names)], guestName: str(r, 'guestName'), fallback: '' });
  return out || null;
}

/**
 * Any ranking response → the rows a mini leaderboard needs, best first. Stands with nobody on them
 * are dropped. `avatars` maps a display name to a photo (the card podium carries them; the ranking
 * does not).
 */
export function miniRanking(res: { rankings: unknown[]; metadata: unknown }, avatars: Map<string, string> = new Map()): MiniRanking {
  const meta = (res.metadata ?? {}) as Raw;
  const type = str(meta, 'rankingType');
  const rows: MiniRow[] = [];
  const labels = new Map<string, string>();
  // Unit and direction are the type's; the value (and, for bestOfTiers, the caption) the row's.
  const base = resultHeadline(type, {}, meta);
  (res.rankings as Raw[]).forEach((r, i) => {
    const name = nameOf(r);
    if (!name) return;
    const headline = resultHeadline(type, r, meta);
    const key = str(r, 'registrationId') ?? str(r, 'clubId') ?? `${str(r, 'sectorName')}-${String(r.standId ?? i)}`;
    labels.set(key, headline.label);
    rows.push({
      key,
      position: num(r, 'generalPosition') ?? num(r, 'clubPosition') ?? i + 1,
      name,
      avatar: avatars.get(name) ?? null,
      sector: str(r, 'sectorName'),
      stand: str(r, 'standName'),
      value: headline.value,
      catches: num(r, 'catchCount') ?? num(r, 'clubTotalCatchCount') ?? 0,
      biggest: num(r, 'biggestFish') ?? num(r, 'clubBiggestCatch') ?? 0,
      delta: null,
      fresh: false,
      userIds: userIdsOf(r),
      registrationId: str(r, 'registrationId'),
    });
  });
  rows.sort((a, b) => a.position - b.position);
  // The caption is the leader's (bestOfTiers: the tier the winner won at, «medie Best 9»).
  const valueLabel = (rows[0] && labels.get(rows[0].key)) ?? base.label;
  const bc = meta.biggestCatch && typeof meta.biggestCatch === 'object' ? (meta.biggestCatch as Raw) : null;
  return {
    rows,
    valueLabel,
    unit: base.unit,
    lowerIsBetter: base.lowerIsBetter,
    totalKg: num(meta, 'totalQuantity'),
    totalCatches: num(meta, 'totalCatchesCount'),
    biggestCatch:
      bc && num(bc, 'weight') != null
        ? { weight: num(bc, 'weight') as number, name: nameOf(bc) ?? `Stand ${str(bc, 'standName') ?? ''}`.trim(), stand: str(bc, 'standName'), sector: str(bc, 'sectorName') }
        : null,
  };
}

/* ---------------------------------------------------------------- identity */

/**
 * The viewer's own row: by user id (the participant, or any listed team member), else by the
 * viewer's own registration (a team member the ranking does not list by name). Never by display
 * name — a team row is the team's name, a pair «A și B», and two anglers can share a name.
 */
export function viewerRow(rows: MiniRow[], viewerId: number | null | undefined, ownRegistrationId?: string | null): MiniRow | null {
  if (viewerId == null && !ownRegistrationId) return null;
  return rows.find((r) => (viewerId != null && r.userIds.includes(viewerId)) || (!!ownRegistrationId && r.registrationId === ownRegistrationId)) ?? null;
}

/* ---------------------------------------------------------------- results podium */

type CardPodium = NonNullable<CompetitionCard['results']>['podium'];

/** The card's podium as rows (no values: the card carries none). */
export function podiumRows(podium: CardPodium): MiniRow[] {
  return podium.slice(0, 3).map((p) => ({
    key: `${p.position}-${p.displayName}`,
    position: p.position,
    name: p.displayName,
    avatar: p.avatarUrls[0] ?? null,
    sector: null,
    stand: p.standName,
    value: null,
    catches: 1,
    biggest: 0,
    delta: null,
    fresh: false,
    userIds: [],
    registrationId: null,
  }));
}

/**
 * One source per finished competition: the ranking when its winner is the card's winner (or the
 * card names none), else the card's podium, without values — the row and its panel never crown two
 * different people. `agrees: false` is a CMS disagreement worth logging.
 */
export function resultsPodium(podium: CardPodium, ranking: MiniRanking | null): { rows: MiniRow[]; fromRanking: boolean; agrees: boolean } {
  const card = podiumRows(podium);
  if (!ranking || !ranking.rows.length) return { rows: card, fromRanking: false, agrees: true };
  // A tie at the top: the card may list either of the tied first.
  const leaders = ranking.rows.filter((r) => r.position === ranking.rows[0].position);
  if (!card.length || leaders.some((r) => r.name === card[0].name)) {
    const avatars = new Map(card.map((p) => [p.name, p.avatar]));
    return { rows: ranking.rows.slice(0, 3).map((r) => ({ ...r, avatar: r.avatar ?? avatars.get(r.name) ?? null })), fromRanking: true, agrees: true };
  }
  return { rows: card, fromRanking: false, agrees: false };
}

/* ---------------------------------------------------------------- time copy */

const TZ = 'Europe/Bucharest';
const hm = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const clock = (iso: string) => hm.format(new Date(iso));
