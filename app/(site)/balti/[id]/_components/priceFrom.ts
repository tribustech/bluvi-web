import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { getBookingQuote, zonedWallTimeIso } from '@/core/booking';
import { lakeBookingState, type LakeDetail } from '@/core/lakes';
import { createServerTransport } from '@/lib/server/transport';
import { legacyPriceFrom, quoteHoursNote, type PriceFromValue } from '../../_list/PriceFrom';

/*
 * «de la X RON» for the lake's summary card and phone bar (owner rule 1: the price on the first
 * screen).
 *
 * A lake on the booking-rates model (Chita) has no legacy price rows, and the CMS sends no rates
 * with the lake: the only price there is the server's quote (POST /feed/lakes/:id/quote), which fish
 * asks for every tour it shows (useBookingQuote) — the app never prices anything itself. So the
 * web asks the same quote for the lake's shortest tour (minDurationHours, else incrementHours) at
 * each of its slot start times over a week (weekday- and shift-scoped rate rows included), from
 * the day after tomorrow (past the default 24h lead), and keeps the cheapest the server agrees to
 * sell. Refusals (an end time the lake forbids, a stand not bookable) simply do not count.
 *
 * The stands' price groups are not public, so up to three stands are tried, first to last, until
 * one is priced. Without any priced quote, the legacy rows' cheapest (header as its note); else
 * nothing (rule 4: nothing known → nothing shown).
 *
 * Cached per lake under the lake's own CMS tag (`lake-<id>`: saving the booking config purges
 * it, cms feed/controllers/lakes.ts saveBookingConfig), at most an hour; a failed read lives
 * seconds (minutes while the build prerenders), never baked in.
 */

export type PriceFrom = PriceFromValue;

const TIME_ZONE = 'Europe/Bucharest';
const FIRST_DAY = 2;
const DAYS = 7;
const MAX_STANDS = 3;

function minuteOfDay(time: string): number | null {
  const [h, m] = time.split(':').map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null;
}

/** Today's calendar date in the lake's zone, shifted by `days`. */
function localDate(now: number, days: number): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(now))
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  const shifted = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + days));
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

async function ratesFrom(
  lakeId: string,
  standIds: string[],
  slotStartTimes: string[],
  durationHours: number,
): Promise<PriceFrom | null> {
  'use cache';
  cacheTag(`lake-${lakeId}`);
  const t = createServerTransport();
  const now = Date.now();
  const tours: { startISO: string; endISO: string }[] = [];
  for (let day = FIRST_DAY; day < FIRST_DAY + DAYS; day++) {
    const { y, m, d } = localDate(now, day);
    for (const time of slotStartTimes) {
      const start = minuteOfDay(time);
      if (start == null) continue;
      const end = start + durationHours * 60;
      const endDay = new Date(Date.UTC(y, m - 1, d + Math.floor(end / 1440)));
      tours.push({
        startISO: zonedWallTimeIso(y, m, d, start, TIME_ZONE),
        endISO: zonedWallTimeIso(endDay.getUTCFullYear(), endDay.getUTCMonth() + 1, endDay.getUTCDate(), end % 1440, TIME_ZONE),
      });
    }
  }
  let failed = false;
  for (const standId of standIds) {
    const quotes = await Promise.all(
      tours.map(tour =>
        getBookingQuote(t, { lakeId, standId, ...tour, extras: [] }).catch(() => {
          failed = true;
          return null;
        }),
      ),
    );
    let best: PriceFrom | null = null;
    for (const q of quotes) {
      if (!q || q.total == null) continue;
      if (!best || q.total < best.price) best = { price: q.total, note: q.basis.rowLabel || quoteHoursNote(q.basis.durationHours) };
    }
    if (best) {
      cacheLife('hours');
      return best;
    }
  }
  // A failed quote is never baked for long. While the build prerenders, 'minutes' (expire ≥ 5 min) and
  // not 'seconds': a seconds-lived entry, shared by the lake page and its OG card, is left out of the
  // static shell and the final pass misses it («Unexpected cache miss after cache warming phase»,
  // m8.cache-warming; seen with a slow CMS).
  if (failed) {
    if (process.env.NEXT_PHASE === 'phase-production-build') cacheLife('minutes');
    else cacheLife('seconds');
  } else cacheLife('hours');
  return null;
}

/** The lake's «de la»: the cheapest tour the booking server quotes, else the legacy rows. */
export async function lakePriceFrom(lake: LakeDetail): Promise<PriceFrom | null> {
  const duration = lake.minDurationHours ?? lake.incrementHours;
  if (lakeBookingState(lake) === 'enabled' && lake.stands.length && lake.slotStartTimes.length && duration) {
    const standIds = lake.stands.slice(0, MAX_STANDS).map(s => s.documentId);
    const rates = await ratesFrom(lake.documentId, standIds, lake.slotStartTimes, duration).catch(() => null);
    if (rates) return rates;
  }
  return legacyPriceFrom(lake.price);
}
