import { getCompetitorDisplayName } from '@/core/competitions';

/*
 * A2's view models — plain, serialisable shapes the server loader builds and the client pieces
 * read. No framework here, so the live hub (client) and the loader (server) share one contract.
 *
 * Every number comes from the local CMS through core/: the ranking (/competitions/:id/ranking),
 * the weighing log (/competitions/:id/weighing-statistics) and the heaviest catches
 * (/competitions/:id/catches?sort=weight_desc). Nothing is invented; a slot whose data is missing
 * is hidden («când nu știm, nu arătăm», ROADMAP §4b.4).
 */

export type MiniRow = {
  key: string;
  position: number;
  name: string;
  avatar: string | null;
  sector: string | null;
  stand: string | null;
  /** The ranking's headline value (kg total, quality, average…), per `valueLabel`. */
  value: number | null;
  catches: number;
  biggest: number;
  /** Positions gained (+) or lost (−) since the latest weighing; null when it cannot be known. */
  delta: number | null;
  /** This stand weighed in one of the competition's latest weighings. */
  fresh: boolean;
};

export type BigCatch = { weight: number; name: string; stand: string | null; sector: string | null };

export type MiniRanking = {
  rows: MiniRow[];
  /** Ranked entrants (rows with a competitor). */
  entrants: number;
  /** «kg total», «calitate», «medie»… — the caption of `value`. */
  valueLabel: string;
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
  | { kind: 'leader'; id: string; compId: string; compName: string; row: MiniRow; gap: number | null; valueLabel: string }
  | { kind: 'battle'; id: string; compId: string; compName: string; first: MiniRow; second: MiniRow; gap: number }
  | { kind: 'weighing'; id: string; compId: string; compName: string; weighing: Weighing }
  | { kind: 'top3'; id: string; compId: string; compName: string; catches: BigCatch[] };

/* ---------------------------------------------------------------- ranking normalisation */

/** Which field carries the ranking's headline value, per ranking type (CMS rankings/*). */
const VALUE_FIELD: Record<string, { field: string; label: string }> = {
  quantity: { field: 'quantity', label: 'kg total' },
  quality: { field: 'quality', label: 'calitate' },
  quantityQuality: { field: 'quantity', label: 'kg total' },
  qualityQuantity: { field: 'quantity', label: 'kg total' },
  bestOf: { field: 'topNCatchesAvarage', label: 'medie' },
  bestOfTiers: { field: 'totalQuantity', label: 'kg total' },
  calitateCalitate: { field: 'quality', label: 'calitate' },
  calitateCantitateCMMC: { field: 'quantity', label: 'kg total' },
  feederRounds: { field: 'quantity', label: 'kg total' },
  nationalChampionship: { field: 'clubTotalQuantity', label: 'kg total' },
  fipsed: { field: 'clubTotalQuantity', label: 'kg total' },
};

type Raw = Record<string, unknown>;
const num = (r: Raw, k: string): number | null => (typeof r[k] === 'number' ? (r[k] as number) : null);
const str = (r: Raw, k: string): string | null => (typeof r[k] === 'string' && (r[k] as string).trim() ? (r[k] as string) : null);

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
  const type = str(meta, 'rankingType') ?? 'quantity';
  const spec = VALUE_FIELD[type] ?? { field: 'quantity', label: 'kg total' };
  const rows: MiniRow[] = [];
  (res.rankings as Raw[]).forEach((r, i) => {
    const name = nameOf(r);
    if (!name) return;
    const value = num(r, spec.field) ?? num(r, 'quantity') ?? num(r, 'totalQuantity') ?? num(r, 'biggestFish');
    rows.push({
      key: str(r, 'registrationId') ?? str(r, 'clubId') ?? `${str(r, 'sectorName')}-${String(r.standId ?? i)}`,
      position: num(r, 'generalPosition') ?? num(r, 'clubPosition') ?? i + 1,
      name,
      avatar: avatars.get(name) ?? null,
      sector: str(r, 'sectorName'),
      stand: str(r, 'standName'),
      value,
      catches: num(r, 'catchCount') ?? num(r, 'clubTotalCatchCount') ?? 0,
      biggest: num(r, 'biggestFish') ?? num(r, 'clubBiggestCatch') ?? 0,
      delta: null,
      fresh: false,
    });
  });
  rows.sort((a, b) => a.position - b.position);
  const bc = meta.biggestCatch && typeof meta.biggestCatch === 'object' ? (meta.biggestCatch as Raw) : null;
  return {
    rows,
    entrants: rows.length,
    valueLabel: spec.label,
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

/** kg weighed per bucket across [from, to] — the «puls» strip. */
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
