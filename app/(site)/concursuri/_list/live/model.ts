import type { CompetitionCard, RecentWeighing } from '@/core/competitions';
import { gapOf, pointsText, valueText, type MiniRanking, type MiniRow, type ValueUnit } from '../desktop/model';

/*
 * The Live tab's pure models (prototype app/dev/hub Live.tsx): the stable card order, the viewer's
 * standing in their live competition, the strip's items and the «new weighing» markers. No React.
 */

const startOf = (c: CompetitionCard) => (c.startDate ? Date.parse(c.startDate) : Number.POSITIVE_INFINITY);

/**
 * Mine first, then by start time, then by name — fixed for the whole visit (owner, 2026-10-06: «the
 * cards keep changing»). A poll never reorders: only a competition joining or leaving the set moves
 * the others, and a new weighing only flashes its card in place.
 */
export function liveOrder(cards: CompetitionCard[], mine: ReadonlySet<string>): CompetitionCard[] {
  return [...cards].sort(
    (a, b) =>
      Number(mine.has(b.documentId)) - Number(mine.has(a.documentId)) ||
      startOf(a) - startOf(b) ||
      a.name.localeCompare(b.name, 'ro') ||
      a.documentId.localeCompare(b.documentId),
  );
}

/**
 * The ranking's photos: the card's podium carries them (displayName → first avatar), the /ranking
 * read does not. ../desktop/model miniRanking matches its rows by that name (ROADMAP §4b.13).
 */
export function avatarsOf(c: CompetitionCard): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of c.results?.podium ?? []) if (p.avatarUrls[0]) out.set(p.displayName, p.avatarUrls[0]);
  return out;
}

/** The value's unit as its own word beside the figure (owner rule 10): «kg», «punct», «puncte», «de puncte». */
export function unitWord(unit: ValueUnit, value: number): string {
  if (unit === 'kg') return 'kg';
  return pointsText(value).slice(valueText(value, 'puncte').length + 1);
}

export type MyStanding = {
  row: MiniRow;
  /** How many ranked rows (stands with somebody on them). */
  of: number;
  /** My place among my sector's rows; null without a sector. */
  sectorPlace: number | null;
  /** How far behind the leader, in the ranking's own sense; null when I lead or it is unknown. */
  gapToLeader: number | null;
  leads: boolean;
};

/**
 * The viewer's own row and what it means, found by identity (user id, else my registration), never
 * by name (../desktop/model viewerRow). null when the ranking does not list me.
 */
export function myStanding(ranking: MiniRanking, row: MiniRow | null): MyStanding | null {
  if (!row) return null;
  const rows = ranking.rows;
  const leader = rows[0];
  const sector = row.sector ? rows.filter((r) => r.sector === row.sector) : [];
  const sectorPlace = row.sector ? sector.findIndex((r) => r.key === row.key) + 1 || null : null;
  const leads = !!leader && leader.key === row.key;
  return {
    row,
    of: rows.length,
    sectorPlace,
    gapToLeader: leader && !leads ? gapOf(ranking, leader, row) : null,
    leads,
  };
}

/** The strip's items: newest first, only the given competitions (Urmărite), at most `max`. */
export function stripItems(items: RecentWeighing[], only: ReadonlySet<string> | null, max = 12): RecentWeighing[] {
  return items
    .filter((w) => !only || only.has(w.competition.documentId))
    .sort((a, b) => Date.parse(b.endAt) - Date.parse(a.endAt))
    .slice(0, max);
}

/** Each competition's newest weighing id (its card flashes when this changes between two polls). */
export function latestByCompetition(items: RecentWeighing[]): Record<string, string> {
  const out: Record<string, { id: string; at: number }> = {};
  for (const w of items) {
    const at = Date.parse(w.endAt);
    const cur = out[w.competition.documentId];
    if (!cur || at > cur.at) out[w.competition.documentId] = { id: w.weighingDocumentId, at };
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.id]));
}

/** A weighing at most this old reads as fresh (the red time, the breathing dot). */
export const FRESH_MS = 5 * 60_000;
export const isFresh = (iso: string, now: number) => now - Date.parse(iso) <= FRESH_MS;

/** «acum câteva secunde», «acum 3 min», «acum 2 h», «ieri», «acum 26 de zile» — the strip's short relative time. */
export function shortAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'chiar acum';
  const m = Math.floor(s / 60);
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ieri' : `acum ${d} ${d >= 20 ? 'de zile' : 'zile'}`;
}

/**
 * The next competition to start, for the empty Live tab («Următorul, X, începe …»): the first
 * upcoming card whose start is still ahead (a start already past never happened).
 */
export function nextStart(upcoming: CompetitionCard[], now: number): CompetitionCard | null {
  return (
    [...upcoming]
      .filter((c) => c.startDate && Date.parse(c.startDate) > now)
      .sort((a, b) => startOf(a) - startOf(b))[0] ?? null
  );
}

/** «pe 20 oct la 08:00» from the server's labels (never formatted in the browser's timezone). */
export function startsWhen(c: CompetitionCard): string {
  const hour = c.hoursLabel?.split(/[–-]/)[0]?.trim();
  return hour ? `pe ${firstDay(c.dateLabel)} la ${hour}` : `pe ${firstDay(c.dateLabel)}`;
}

/** A span's first day: «10–11 oct» → «10 oct», «30 sept–2 oct» → «30 sept»; a single day as is. */
function firstDay(label: string): string {
  const [from, to] = label.split('–').map((x) => x.trim());
  if (!to) return label;
  if (/\D/.test(from)) return from;
  const month = to.replace(/^\d+\s*/, '');
  return month ? `${from} ${month}` : from;
}
