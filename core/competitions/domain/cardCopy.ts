import { formatCount } from '../../realtime/chat/format';
import type { CardFormat, CompetitionCard } from '../schemas';

/**
 * The competition card's own copy — fish `features/competitions/components/cards/cardRankingLabel.ts`,
 * `features/competitions/helpers/formatKg.ts` and `features/competitions/helpers/heroCopy.ts`.
 *
 * Everything else a card says (dateLabel, hoursLabel, rankingLabel, counts, unit, podium) is
 * rendered by the server and shown as-is; these only put a number next to a word.
 *
 * `formatCount` is fish `helpers/formatCount.ts`, which lives once in core, in the chat format
 * module (pure, no Firebase).
 */

export { formatCount };

/**
 * The ranking chip of a competition card. A live feeder on legs also says which leg it is in
 * ("Feeder · Manșa 2/2"); everything else is the label the CMS rendered. `rounds` is absent from a
 * CMS that predates it. A single-leg feeder has no leg to name (fish ea89c087).
 */
export function cardRankingLabel(c: Pick<CompetitionCard, 'status' | 'rankingLabel' | 'rounds'>): string {
  if (c.status === 'started' && c.rounds && c.rounds.count > 1) return `${c.rankingLabel} · Manșa ${c.rounds.current}/${c.rounds.count}`;
  return c.rankingLabel;
}

/**
 * Romanian grouping (`.`) and decimal comma, at most `maxDecimals` decimals, trailing zeros
 * dropped. fish uses `toLocaleString('ro-RO', { maximumFractionDigits })`; this is the same string
 * without ICU, so a server render and the browser can never disagree (no hydration drift).
 */
function formatRo(value: number, maxDecimals: number): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  const [int, frac = ''] = rounded.toFixed(maxDecimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmed = frac.replace(/0+$/, '');
  const sign = value < 0 && rounded !== 0 ? '-' : '';
  return `${sign}${grouped}${trimmed ? `,${trimmed}` : ''}`;
}

/**
 * Weights in Romanian, to the gram. The server already rounds to three decimals (a float sum of
 * real catches gives 4800.270000000001), so this only formats.
 */
export function formatKg(value: number): string {
  return formatRo(value, 3);
}

/**
 * A competition total is a sum of hundreds of fish — grams there are noise and "1.024,291 kg" is
 * unreadable at a glance. A single weighed fish keeps its grams.
 */
export function formatTotalKg(value: number): string {
  return formatRo(value, 1);
}

/** The unit in the singular: `pescari` → `pescar`, `echipe` → `echipă`. */
export function unitSingular(unit: CardFormat['unit']): string {
  return unit === 'echipe' ? 'echipă' : 'pescar';
}

/**
 * The stat label over the entrant count on an upcoming hero. Romanian participles agree with the
 * noun's gender: `PESCARI ÎNSCRIȘI`, `ECHIPE ÎNSCRISE`.
 */
export function enrolledLabel(unit: CardFormat['unit']): string {
  return unit === 'echipe' ? 'ECHIPE ÎNSCRISE' : 'PESCARI ÎNSCRIȘI';
}

/** `1 pescar în concurs` / `24 de pescari în concurs` / `3 echipe în concurs`. */
export function entrantsLine(joinedCount: number, unit: CardFormat['unit']): string {
  return `${formatCount(joinedCount, unitSingular(unit), unit)} în concurs`;
}

/** `1 pescar` / `24 de pescari` / `3 echipe` — the card footers' count without a capacity. */
export function entrantsCount(joinedCount: number, unit: CardFormat['unit']): string {
  return formatCount(joinedCount, unitSingular(unit), unit);
}

/**
 * fish CompetitionPhotoCaption `entrantsLabel`: before the start the seats matter; after it, only
 * how many turned up.
 */
export function photoEntrantsLabel(c: Pick<CompetitionCard, 'status' | 'capacity' | 'joinedCount' | 'format'>): string {
  if (c.status === 'notStarted' && c.capacity !== null) return `${c.joinedCount}/${c.capacity} ${c.format.unit}`;
  return `${c.joinedCount} ${c.format.unit}`;
}

/** fish CompetitionRailCard `withHours`: `10 oct · 08:00–16:00`, or just the date. */
export function dateWithHours(c: Pick<CompetitionCard, 'dateLabel' | 'hoursLabel'>): string {
  return c.hoursLabel ? `${c.dateLabel} · ${c.hoursLabel}` : c.dateLabel;
}
