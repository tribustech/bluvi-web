import { formatDecimal } from '@/components/cards/format';
import {
  getCompetitorDisplayName,
  resultHeadline,
  type CompetitionCard,
  type CompetitionCatchesResponse,
  type Registration,
  type WeighingStatisticsResponse,
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

export type Weighing = {
  id: string;
  at: string;
  kg: number;
  catches: number;
  stand: string | null;
  sector: string | null;
  /** The competitor on that stand, from the ranking (null when the stand has nobody). */
  name: string | null;
};

export type LiveExtra = {
  id: string;
  ranking: MiniRanking | null;
  /** Oldest first. */
  weighings: Weighing[];
  topCatches: BigCatch[];
};

export type Highlight =
  | { kind: 'record'; id: string; compId: string; compName: string; catch: BigCatch }
  | { kind: 'leader'; id: string; compId: string; compName: string; row: MiniRow; gap: number | null; ranking: MiniRanking }
  | { kind: 'battle'; id: string; compId: string; compName: string; first: MiniRow; second: MiniRow; gap: number; ranking: MiniRanking }
  | { kind: 'weighing'; id: string; compId: string; compName: string; weighing: Weighing }
  | { kind: 'top3'; id: string; compId: string; compName: string; catches: BigCatch[] };

export type TickerItem = Weighing & { compId: string; compName: string };

export type LiveData = { extras: Record<string, LiveExtra>; highlights: Highlight[]; ticker: TickerItem[]; heroId: string | null };

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

/** The short unit beside a value («kg», «p»). */
export const unitShort = (unit: ValueUnit) => (unit === 'puncte' ? 'p' : 'kg');

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

/**
 * Position change since the competition's latest weighing, for a quantity ranking (the only type
 * where a row's value is the plain sum of its weighings): take the last weighing's kg off its
 * stand, re-sort, compare. Rows that weighed in the last few weighings are marked `fresh`.
 */
export function withDeltas(r: MiniRanking, weighings: Weighing[], rankingType: string): MiniRanking {
  if (!weighings.length) return r;
  const recent = new Set(weighings.slice(-5).map((w) => `${w.sector}|${w.stand}`));
  let rows = r.rows.map((row) => ({ ...row, fresh: recent.has(`${row.sector}|${row.stand}`) }));
  const last = weighings[weighings.length - 1];
  if (rankingType === 'quantity' && last) {
    const before = rows
      .map((row) => ({ key: row.key, pos: row.position, v: (row.value ?? 0) - (row.sector === last.sector && row.stand === last.stand ? last.kg : 0) }))
      .sort((a, b) => b.v - a.v || a.pos - b.pos);
    const prev = new Map(before.map((b, i) => [b.key, i + 1]));
    rows = rows.map((row) => {
      const p = prev.get(row.key);
      return { ...row, delta: p != null && row.value != null ? p - row.position : null };
    });
  }
  return { ...r, rows };
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

/* ---------------------------------------------------------------- live */

export type LiveReads = {
  ranking?: { rankings: unknown[]; metadata: unknown } | null;
  weighings?: WeighingStatisticsResponse | null;
  catches?: CompetitionCatchesResponse | null;
};

/** One live competition's reads → its extra (ranking with deltas, weighing log, top catches). */
export function liveExtra(card: CompetitionCard, reads: LiveReads): LiveExtra {
  const base = reads.ranking ? miniRanking(reads.ranking) : null;
  const byStand = new Map((base?.rows ?? []).map((r) => [`${r.sector}|${r.stand}`, r.name]));
  const weighings: Weighing[] = (reads.weighings?.data ?? [])
    .map((w) => ({
      id: w.weighingDocumentId,
      at: w.endDate ?? w.startDate,
      kg: w.totalWeightKg,
      catches: w.catchCount,
      stand: w.standName ?? null,
      sector: w.sectorName ?? null,
      name: byStand.get(`${w.sectorName ?? null}|${w.standName ?? null}`) ?? null,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const topCatches: BigCatch[] = (reads.catches?.data ?? []).slice(0, 5).map((x) => ({
    weight: x.weight,
    name: x.teamName || x.participantUsername || x.guestName || `Stand ${x.standName}`,
    stand: x.standName,
    sector: x.sectorName,
  }));
  const type = ((reads.ranking?.metadata ?? {}) as Raw).rankingType;
  return {
    id: card.documentId,
    ranking: base ? withDeltas(base, weighings, typeof type === 'string' ? type : '') : null,
    weighings,
    topCatches,
  };
}

/** Most catches, then the most followers — from the cards themselves. */
const byInterest = (cards: CompetitionCard[]) => [...cards].sort((a, b) => (b.results?.catchCount ?? 0) - (a.results?.catchCount ?? 0) || b.viewers - a.viewers);

/**
 * The hub's hero: from the cards, so the pick is there at first paint and never jumps when the
 * extra reads land (or on a poll that adds no catch).
 */
export const pickHero = (cards: CompetitionCard[]): string | null => byInterest(cards)[0]?.documentId ?? null;

/** Every live competition's extra → the hub: hero pick, key moments, the cross-competition ticker. */
export function buildLive(cards: CompetitionCard[], extras: Record<string, LiveExtra>): LiveData {
  const ranked = byInterest(cards);
  const heroId = ranked[0]?.documentId ?? null;
  const name = (id: string) => cards.find((c) => c.documentId === id)?.name ?? '';

  const highlights: Highlight[] = [];
  // The heaviest fish across every live competition.
  const records = cards
    .map((c) => extras[c.documentId])
    .filter((e): e is LiveExtra => !!e)
    .map((e) => ({ e, c: e.ranking?.biggestCatch ?? e.topCatches[0] ?? null }))
    .filter((x): x is { e: LiveExtra; c: BigCatch } => !!x.c)
    .sort((a, b) => b.c.weight - a.c.weight);
  if (records[0]) highlights.push({ kind: 'record', id: `rec-${records[0].e.id}`, compId: records[0].e.id, compName: name(records[0].e.id), catch: records[0].c });
  // The latest weighings (across competitions).
  const allW: TickerItem[] = cards.flatMap((c) => (extras[c.documentId]?.weighings ?? []).map((w) => ({ ...w, compId: c.documentId, compName: c.name })));
  allW.sort((a, b) => b.at.localeCompare(a.at));
  if (allW[0]) highlights.push({ kind: 'weighing', id: `w-${allW[0].id}`, compId: allW[0].compId, compName: allW[0].compName, weighing: allW[0] });
  // Each competition's leader, and its closest fight at the top.
  for (const c of ranked) {
    const r = extras[c.documentId]?.ranking;
    const [a, b] = r?.rows ?? [];
    if (!r || !a || a.value == null || a.catches === 0) continue;
    const gap = b && b.catches > 0 ? gapOf(r, a, b) : null;
    highlights.push({ kind: 'leader', id: `lead-${c.documentId}`, compId: c.documentId, compName: c.name, row: a, gap, ranking: r });
  }
  const battles = ranked
    .map((c) => ({ c, r: extras[c.documentId]?.ranking ?? null }))
    .filter((x): x is { c: CompetitionCard; r: MiniRanking } => !!x.r && x.r.rows.length >= 2 && (x.r.rows[1]?.catches ?? 0) > 0)
    .map((x) => ({ ...x, gap: gapOf(x.r, x.r.rows[0], x.r.rows[1]) }))
    .filter((x): x is { c: CompetitionCard; r: MiniRanking; gap: number } => x.gap != null)
    .sort((a, b) => a.gap - b.gap);
  if (battles[0]) {
    const { c, r, gap } = battles[0];
    // The battle tells that competition's lead better than its «Lider» card (same two numbers) — keep one.
    const dup = highlights.findIndex((h) => h.kind === 'leader' && h.compId === c.documentId);
    if (dup >= 0) highlights.splice(dup, 1);
    highlights.push({ kind: 'battle', id: `bat-${c.documentId}`, compId: c.documentId, compName: c.name, first: r.rows[0], second: r.rows[1], gap, ranking: r });
  }
  for (const c of ranked) {
    const top = extras[c.documentId]?.topCatches ?? [];
    if (top.length >= 3) highlights.push({ kind: 'top3', id: `top-${c.documentId}`, compId: c.documentId, compName: c.name, catches: top.slice(0, 3) });
  }

  return { extras, highlights, ticker: allW.slice(0, 8), heroId };
}

/* ---------------------------------------------------------------- upcoming faces */

export type Face = { name: string; src: string | null; followed: boolean };

/** The registered entrants' faces: followed anglers first, then photos, then the rest. */
export function facesOf(regs: Registration[], followed: Set<string>): Face[] {
  const out: Face[] = [];
  for (const r of regs) {
    if (r.registrationStatus !== 'registered') continue;
    const people = r.participants ?? [];
    if (people.length) {
      for (const p of people) out.push({ name: p.username ?? 'Pescar', src: p.avatar?.url ?? null, followed: followed.has(p.documentId) });
    } else {
      const n = r.teamName?.trim() || r.guestName?.trim();
      if (n) out.push({ name: n, src: null, followed: false });
    }
  }
  // Partiful / Luma lead with people you know.
  out.sort((a, b) => Number(b.followed) - Number(a.followed) || Number(!!b.src) - Number(!!a.src));
  return out;
}

/** The card's own faces (photos only, no names) — signed out, or before the registrations answer. */
export const cardFaces = (c: CompetitionCard): Face[] => c.participantFaces.map((src, i) => ({ name: `Participant ${i + 1}`, src, followed: false }));

/* ---------------------------------------------------------------- time copy */

export function agoLabel(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'acum câteva secunde';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'acum 1 min' : `acum ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'acum o oră' : `acum ${h} ore`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ieri' : `acum ${d} zile`;
}

/** «2 zile 4 h», «3 h 12 min», «12 min» — a countdown to (or a span since) a moment. */
export function spanLabel(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return h ? `${d} ${d === 1 ? 'zi' : 'zile'} ${h} h` : `${d} ${d === 1 ? 'zi' : 'zile'}`;
  if (h > 0) return mm ? `${h} h ${mm} min` : `${h} h`;
  return `${mm} min`;
}

const TZ = 'Europe/Bucharest';
const hm = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const clock = (iso: string) => hm.format(new Date(iso));

/* ---------------------------------------------------------------- series */

/** kg weighed per bucket across [from, to] — the «ritmul cântăririlor» strip. */
export function momentum(weighings: Weighing[], from: number, to: number, buckets = 24): number[] {
  const out = new Array<number>(buckets).fill(0);
  const span = Math.max(1, to - from);
  for (const w of weighings) {
    const t = new Date(w.at).getTime();
    const i = Math.min(buckets - 1, Math.max(0, Math.floor(((t - from) / span) * buckets)));
    out[i] += w.kg;
  }
  return out;
}

/** Cumulative kg after each weighing (sparkline points). */
export function cumulative(weighings: Weighing[]): number[] {
  let sum = 0;
  return weighings.map((w) => (sum += w.kg));
}
