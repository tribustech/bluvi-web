import { formatInt } from '@/components/cards/format';
import { formatCount, formatKg, formatTotalKg, resultHeadline, type CompetitionCard } from '@/core/competitions';
import { dayParts } from '../desktop/dates';
import { podiumRows, resultsPodium, valueText, type MiniRanking, type MiniRow, type ValueUnit } from '../desktop/model';

/*
 * Rezultate (/concursuri/rezultate) — the models of the result rows (approved prototype
 * app/dev/hub/Results.tsx). Pure: no React, no Next; unit-tested in model.test.ts.
 *
 * Every number is the one the competition was RANKED BY (core resultHeadline): the row names the
 * winner and that one figure with its label («Total 52,8 kg», «Medie Best 5 7,68 kg», «3 puncte»);
 * the opened row adds the podium, the tiles that make sense for that ranking type and places 4–8.
 * The ranking (/competitions/:id/ranking) is read only once a row is opened; until then the
 * headline slot carries its label and «–» (the card has no headline value) — opening only FILLS
 * it, never swaps it for another metric. The heaviest fish (CMMC) is its own chip, open or not
 * (ROADMAP §4b.4: never a guess, never two answers to one question).
 */

type Raw = Record<string, unknown>;
const num = (r: Raw | null | undefined, k: string): number | null => {
  const v = r?.[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const str = (r: Raw | null | undefined, k: string): string | null => {
  const v = r?.[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type RawRanking = { rankings: unknown[]; metadata: unknown };

/** NC and FIPSed rank clubs (each fields several teams): the podium is the clubs'. */
export const isClubRanking = (type: string | null | undefined) => type === 'nationalChampionship' || type === 'fipsed';

/* ---------------------------------------------------------------- groups (by day, Bucharest) */

const WEEKDAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'] as const;
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'] as const;

export type ResultGroup = {
  key: string;
  /** «Azi», «Ieri», «Duminică, 4 octombrie» (+ the year when it is not the newest result's year). */
  label: string;
  /** The date under a relative label («Ieri» → «Luni, 5 octombrie»); null otherwise. */
  date: string | null;
  cards: CompetitionCard[];
};

/** The day a result belongs to: the day it ended (a two-day competition is a Sunday result). */
const dayOf = (c: CompetitionCard) => c.endDate ?? c.startDate;

/**
 * One group per day, the latest day first (a load-more page or a CMS order that is not by end date
 * never splits a day in two); inside a day the CMS order is kept. Undated results come last.
 * `todayIndex` (days since the epoch, Bucharest) is known only in the browser — on the server and in
 * the first render it is null and every group reads its date; «Azi» / «Ieri» replace the text after
 * hydration, with no change in structure (no layout shift).
 */
export function resultGroups(cards: CompetitionCard[], todayIndex: number | null): ResultGroup[] {
  const byKey = new Map<string, { index: number; group: ResultGroup }>();
  const dated = cards.map((c) => ({ c, d: dayOf(c) ? dayParts(dayOf(c) as string) : null }));
  const newestYear = dated.reduce<{ index: number; year: number } | null>((best, x) => (x.d && (!best || x.d.index > best.index) ? { index: x.d.index, year: x.d.year } : best), null)?.year;
  for (const { c, d } of dated) {
    const key = d ? `d${d.index}` : 'tbd';
    const hit = byKey.get(key);
    if (hit) {
      hit.group.cards.push(c);
      continue;
    }
    if (!d) {
      byKey.set(key, { index: -Infinity, group: { key, label: 'Fără dată', date: null, cards: [c] } });
      continue;
    }
    const date = `${WEEKDAYS[d.weekday]}, ${d.day} ${MONTHS[d.month]}${d.year !== newestYear ? ` ${d.year}` : ''}`;
    const ago = todayIndex == null ? null : todayIndex - d.index;
    const relative = ago === 0 ? 'Azi' : ago === 1 ? 'Ieri' : null;
    byKey.set(key, { index: d.index, group: { key, label: relative ?? date, date: relative ? date : null, cards: [c] } });
  }
  return [...byKey.values()].sort((a, b) => b.index - a.index).map((x) => x.group);
}

/* ---------------------------------------------------------------- values */

/** The word after a value: «kg»; «punct» for exactly one, «de puncte» from 20 (Romanian agreement). */
export function unitWord(unit: ValueUnit, value: number): string {
  if (unit === 'kg') return 'kg';
  const whole = Number.isInteger(value);
  if (whole && value === 1) return 'punct';
  if (whole && (value % 100 >= 20 || (value > 0 && value % 100 === 0))) return 'de puncte';
  return 'puncte';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The caption of the headline figure, per ranking type (prototype: «Total», «Medie Best 5», «Puncte
 * club»). Without the ranking it is the same caption, less the detail only the ranking knows
 * («Medie» → «Medie Best 5»): the read refines the caption, never changes it.
 */
export function headlineLabel(type: string, ranking: RawRanking | null, card?: Pick<CompetitionCard, 'rounds'> | null): string {
  const meta = obj(ranking?.metadata);
  const winner = obj(arr(ranking?.rankings)[0]);
  switch (type) {
    case 'quantity':
      return 'Total';
    case 'quality': {
      const n = num(winner, 'sectorMinNumberOfFish');
      return n ? `Medie top ${n}` : 'Medie';
    }
    case 'bestOf': {
      const n = num(meta, 'bestOfFishCount') ?? num(winner, 'bestOfCount');
      return n ? `Medie Best ${n}` : 'Medie';
    }
    case 'bestOfTiers':
      return cap(winner ? resultHeadline(type, winner, meta).label : 'medie');
    case 'quantityQuality':
    case 'qualityQuantity':
      return 'Calitate + cantitate';
    case 'calitateCalitate':
      return 'Calitate + calitate';
    case 'calitateCantitateCMMC':
      return 'Calitate + cantitate + CMMC';
    case 'feederRounds': {
      const n = num(meta, 'roundsCount') ?? card?.rounds?.count ?? null;
      return n && n > 1 ? `Puncte · ${formatCount(n, 'manșă', 'manșe')}` : 'Puncte';
    }
    case 'nationalChampionship':
    case 'fipsed':
      return 'Puncte club';
    default:
      return cap(resultHeadline(type, {}).label);
  }
}

/* ---------------------------------------------------------------- the podium and the places */

export type Entry = {
  key: string;
  position: number;
  name: string;
  /** Photos: one angler, a team's 2–3 members; none for a club (its initials, square). */
  faces: string[];
  club: boolean;
  value: number | null;
  unit: ValueUnit;
  sector: string | null;
  catches: number;
};

export type ResultView = {
  /** The podium (1, 2, 3), from the ranking when it agrees with the card, else the card's (no values). */
  podium: Entry[];
  /** Places 4–8 — rows that caught something only (a no-catch place is in the full ranking). */
  places: Entry[];
  /** The ranking backs the podium (values shown); false = the card's podium, names only. */
  fromRanking: boolean;
  /** The CMS's ranking crowns someone else than the card: worth a console warning, once. */
  disagrees: boolean;
  unit: ValueUnit;
  lowerIsBetter: boolean;
};

/** The card podium's faces by display name (the ranking carries no photos). */
function facesByName(card: CompetitionCard): Map<string, string[]> {
  return new Map((card.results?.podium ?? []).map((p) => [p.displayName, p.avatarUrls.slice(0, 3)]));
}

const toEntry = (r: MiniRow, faces: Map<string, string[]>, unit: ValueUnit, club: boolean): Entry => ({
  key: r.key,
  position: r.position,
  name: r.name,
  faces: club ? [] : (faces.get(r.name) ?? (r.avatar ? [r.avatar] : [])),
  club,
  value: r.catches > 0 ? r.value : null,
  unit,
  sector: club ? null : r.sector,
  catches: r.catches,
});

/**
 * NC / FIPSed before the ranking: the card's podium is the TEAMS'; the winning club is the first
 * team's club (cardPodiumRowSchema.clubName). Only the winner — the card says nothing of the other
 * clubs' places. No club name = nobody to crown until the ranking is read.
 */
function cardClubPodium(card: CompetitionCard, unit: ValueUnit): Entry[] {
  const first = card.results?.podium[0];
  if (!first?.clubName) return [];
  return [{ key: `club-${first.clubName}`, position: 1, name: first.clubName, faces: [], club: true, value: null, unit, sector: null, catches: 1 }];
}

export function resultView(card: CompetitionCard, ranking: MiniRanking | null): ResultView {
  const faces = facesByName(card);
  const club = isClubRanking(card.rankingType);
  const unit = ranking?.unit ?? resultHeadline(card.rankingType, {}).unit;
  const lowerIsBetter = ranking?.lowerIsBetter ?? resultHeadline(card.rankingType, {}).lowerIsBetter;
  const caught = (ranking?.rows ?? []).filter((r) => r.catches > 0);
  // Clubs: the podium is the clubs' — the ranking's when its first is the card's winning club (or
  // the card names none), else the card's club alone; never the teams (one crown per row).
  if (club) {
    const fromCard = cardClubPodium(card, unit);
    const leaders = caught.filter((r) => r.position === caught[0]?.position);
    const agrees = !fromCard.length || leaders.some((r) => r.name === fromCard[0].name);
    if (ranking && caught.length && agrees) {
      return {
        podium: caught.slice(0, 3).map((r) => toEntry(r, faces, unit, true)),
        places: caught.filter((r) => r.position > 3).slice(0, 5).map((r) => toEntry(r, faces, unit, true)),
        fromRanking: true,
        disagrees: false,
        unit,
        lowerIsBetter,
      };
    }
    return { podium: fromCard, places: [], fromRanking: false, disagrees: !!ranking && caught.length > 0 && !agrees, unit, lowerIsBetter };
  }
  const source = resultsPodium(card.results?.podium ?? [], ranking && caught.length ? { ...ranking, rows: caught } : null);
  if (source.fromRanking) {
    return {
      podium: source.rows.map((r) => toEntry(r, faces, unit, false)),
      places: caught.filter((r) => r.position > 3 && !source.rows.some((p) => p.key === r.key)).slice(0, 5).map((r) => toEntry(r, faces, unit, false)),
      fromRanking: true,
      disagrees: false,
      unit,
      lowerIsBetter,
    };
  }
  return {
    podium: podiumRows(card.results?.podium ?? []).map((r) => ({ ...toEntry(r, faces, unit, false), value: null })),
    places: [],
    fromRanking: false,
    disagrees: !source.agrees,
    unit,
    lowerIsBetter,
  };
}

/* ---------------------------------------------------------------- the row's headline */

export type RowHeadline = {
  /** The winner (the card's, or the club the ranking crowns); null = nobody to name (yet). */
  winner: { name: string; faces: string[]; club: boolean } | null;
  /** «Câștigător» / «Club câștigător» — by ranking type, so it never changes on open. */
  winnerLabel: string;
  /**
   * The ranking type's headline: its label always, its value only once the ranking backs the
   * podium (null = «–»). Null when the competition ended without catches (nothing to rank).
   */
  figure: { label: string; value: number | null; unit: ValueUnit } | null;
  /** The card's heaviest fish — its own chip, never in the headline slot. */
  cmmcKg: number | null;
};

export function rowHeadline(card: CompetitionCard, ranking: MiniRanking | null, raw: RawRanking | null, view: ResultView): RowHeadline {
  const top = view.podium[0] ?? null;
  const winner = top ? { name: top.name, faces: top.faces, club: top.club } : null;
  const winnerLabel = isClubRanking(card.rankingType) ? 'Club câștigător' : 'Câștigător';
  const value = ranking && view.fromRanking && top ? top.value : null;
  const figure = card.results?.hasCatches === false ? null : { label: headlineLabel(card.rankingType, raw, card), value, unit: view.unit };
  return { winner, winnerLabel, figure, cmmcKg: card.results?.biggestFishKg ?? null };
}

/* ---------------------------------------------------------------- stats per ranking type */

export type TileIcon = 'cmmc' | 'fish' | 'scale' | 'chart' | 'grid' | 'flag' | 'trophy' | 'map' | 'group';
export type Tile = { icon: TileIcon; value: string; unit?: string; label: string; sub?: string };
export type TypeStats = { title: string; fish: { title: string; kgs: number[] } | null; tiles: Tile[] };

function competitorName(r: Raw | null): string | null {
  if (!r) return null;
  const team = str(r, 'teamName');
  if (team) return team;
  const ps = [obj(r.participant), ...arr(r.participants).map(obj)].map((p) => str(p, 'username')).filter((n): n is string => !!n);
  if (ps.length) return [...new Set(ps)].join(' și ');
  return str(r, 'guestName');
}

const weights = (v: unknown): number[] =>
  arr(v)
    .map((x) => (typeof x === 'number' ? x : num(obj(x), 'weight')))
    .filter((n): n is number => n != null)
    .sort((a, b) => b - a);

const pts = (n: number) => `${valueText(n, 'puncte')} ${unitWord('puncte', n)}`;

/**
 * The tiles that say HOW the competition was won, per ranking type (prototype TypeStats), from the
 * ranking's metadata and the winner's row; the card's totals when the ranking is not there.
 */
export function typeStats(card: CompetitionCard, raw: RawRanking | null): TypeStats {
  const r = card.results;
  const meta = obj(raw?.metadata);
  const rows = arr(raw?.rankings).map(obj).filter((x): x is Raw => !!x);
  const winner = rows[0] ?? null;
  const type = str(meta, 'rankingType') ?? card.rankingType;

  const bc = obj(meta?.biggestCatch);
  const bcKg = num(bc, 'weight') ?? r?.biggestFishKg ?? null;
  const cmmc: Tile[] = bcKg != null ? [{ icon: 'cmmc', value: formatKg(bcKg), unit: 'kg', label: 'CMMC', sub: competitorName(bc) ?? undefined }] : [];
  const catchCount = num(meta, 'totalCatchesCount') ?? r?.catchCount ?? null;
  const catches: Tile[] = catchCount != null ? [{ icon: 'fish', value: formatInt(catchCount), label: catchCount === 1 ? 'captură' : 'capturi' }] : [];
  const totalKg = r?.totalKg ?? num(meta, 'totalQuantity');
  const weighed: Tile[] = totalKg != null ? [{ icon: 'scale', value: formatTotalKg(totalKg), unit: 'kg', label: 'cântărite în concurs' }] : [];
  const basic = [...cmmc, ...catches, ...weighed];
  const fallback: TypeStats = { title: 'În cifre', fish: null, tiles: basic };
  if (!winner) return fallback;

  switch (type) {
    case 'quantity': {
      const seated = rows.filter((x) => competitorName(x));
      const withFish = seated.filter((x) => (num(x, 'catchCount') ?? 0) > 0).length;
      const extra: Tile[] = [];
      if (seated.length && totalKg != null) extra.push({ icon: 'chart', value: formatTotalKg(totalKg / seated.length), unit: 'kg', label: 'medie pe stand' });
      if (seated.length) extra.push({ icon: 'grid', value: String(Math.round((withFish / seated.length) * 100)), unit: '%', label: 'standuri cu pește', sub: `${withFish} din ${seated.length}` });
      return { title: 'Cum s-a câștigat: cea mai mare cantitate totală', fish: null, tiles: [...basic, ...extra] };
    }
    case 'quality': {
      const n = num(winner, 'sectorMinNumberOfFish');
      const kgs = n ? weights(winner.catches).slice(0, n) : [];
      return {
        title: n ? `Cum s-a câștigat: media celor mai mari ${formatCount(n, 'pește', 'pești')}` : 'Cum s-a câștigat: media celor mai mari pești',
        fish: kgs.length ? { title: `Cei ${kgs.length} pești din media câștigătorului`, kgs } : null,
        tiles: basic,
      };
    }
    case 'bestOf':
    case 'bestOfTiers': {
      const label = headlineLabel(type, raw);
      const n = Number(label.match(/\d+/)?.[0] ?? 0);
      const kgs = n ? weights(winner.catches).slice(0, n) : [];
      return {
        title: n ? `Cum s-a câștigat: cei mai mari ${n} pești, apoi media lor` : 'Cum s-a câștigat: cei mai mari pești, apoi media lor',
        fish: kgs.length ? { title: `Best ${n} al câștigătorului`, kgs } : null,
        tiles: basic,
      };
    }
    case 'quantityQuality':
    case 'qualityQuantity': {
      const tiles: Tile[] = [];
      const qty = num(winner, 'quantity');
      const qual = num(winner, 'quality');
      const qtyP = num(winner, 'quantityPoints');
      const qualP = num(winner, 'qualityPoints');
      if (qty != null) tiles.push({ icon: 'scale', value: formatTotalKg(qty), unit: 'kg', label: 'cantitate câștigător', sub: qtyP != null ? `${pts(qtyP)} la cantitate` : undefined });
      if (qual != null) tiles.push({ icon: 'chart', value: formatKg(qual), unit: 'kg', label: 'medie calitate', sub: qualP != null ? `${pts(qualP)} la calitate` : undefined });
      return { title: 'Cum s-a câștigat: puncte la calitate + puncte la cantitate', fish: null, tiles: [...tiles, ...cmmc, ...catches] };
    }
    case 'calitateCalitate': {
      const tiles: Tile[] = [];
      for (const k of [1, 2] as const) {
        const q = num(winner, `quality${k}`);
        const p = num(winner, `quality${k}Points`);
        if (q != null) tiles.push({ icon: 'chart', value: formatKg(q), unit: 'kg', label: `calitate ${k}`, sub: p != null ? pts(p) : undefined });
      }
      return { title: 'Cum s-a câștigat: puncte la calitate 1 + puncte la calitate 2', fish: null, tiles: [...tiles, ...cmmc, ...catches] };
    }
    case 'calitateCantitateCMMC': {
      const tiles: Tile[] = [];
      const q = num(winner, 'quality1');
      const qty = num(winner, 'quantity');
      const qP = num(winner, 'calitatePoints');
      const qtyP = num(winner, 'cantitatePoints');
      const cP = num(winner, 'cmmcPoints');
      if (q != null) tiles.push({ icon: 'chart', value: formatKg(q), unit: 'kg', label: 'calitate', sub: qP != null ? pts(qP) : undefined });
      if (qty != null) tiles.push({ icon: 'scale', value: formatTotalKg(qty), unit: 'kg', label: 'cantitate', sub: qtyP != null ? pts(qtyP) : undefined });
      if (cP != null) tiles.push({ icon: 'trophy', value: valueText(cP, 'puncte'), unit: unitWord('puncte', cP), label: 'la CMMC' });
      return { title: 'Cum s-a câștigat: puncte la calitate + cantitate + CMMC', fish: null, tiles: [...tiles, ...cmmc, ...catches] };
    }
    case 'feederRounds': {
      const legs = arr(winner.rounds).map(obj).filter((x): x is Raw => !!x);
      const tiles: Tile[] = legs.map((leg) => {
        const place = num(leg, 'sectorPosition');
        const kg = num(leg, 'quantity');
        return {
          icon: 'flag',
          value: place != null ? `Locul ${valueText(place, 'puncte')}` : '–',
          label: `manșa ${num(leg, 'round') ?? '–'} · în sector`,
          sub: place != null && kg != null ? `${formatKg(kg)} kg` : 'Fără capturi',
        };
      });
      if (legs.length > 1) tiles.push({ icon: 'trophy', value: `${legs.filter((l) => num(l, 'sectorPosition') === 1).length}/${legs.length}`, label: 'manșe câștigate' });
      return { title: 'Cum s-a câștigat: locul în sector la fiecare manșă = puncte', fish: null, tiles: [...tiles, ...catches] };
    }
    case 'nationalChampionship':
    case 'fipsed': {
      const teams = arr(winner.teams).map(obj).filter((x): x is Raw => !!x);
      const won = teams.filter((t) => num(t, 'sectorPoints') === 1).length;
      const tiles: Tile[] = [];
      if (teams.length) tiles.push({ icon: 'map', value: `${won}/${teams.length}`, label: 'sectoare câștigate' });
      const clubKg = num(winner, 'clubTotalQuantity');
      if (clubKg != null) tiles.push({ icon: 'scale', value: formatTotalKg(clubKg), unit: 'kg', label: 'kg club câștigător' });
      tiles.push({ icon: 'group', value: String(rows.length), label: rows.length === 1 ? 'club' : 'cluburi' });
      return { title: 'Cum s-a câștigat: suma locurilor din sectoare', fish: null, tiles: [...tiles, ...cmmc] };
    }
    default:
      return fallback;
  }
}

/** The footer line: «30 de pescari · 3 sectoare». */
export function entrantsLine(card: CompetitionCard, raw: RawRanking | null): string {
  const unit = card.format.unit;
  const parts = [formatCount(card.joinedCount, unit === 'echipe' ? 'echipă' : 'pescar', unit)];
  const sectors = num(obj(raw?.metadata), 'numberOfSectors');
  if (sectors) parts.push(formatCount(sectors, 'sector', 'sectoare'));
  return parts.join(' · ');
}
