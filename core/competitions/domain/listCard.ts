import type { CompetitionListItem } from '../schemas';
import { getRankingTypeLabel } from './competitionLabels';

/*
 * The legacy competition list card's copy — fish components/CompetitionCard.tsx (the card of the
 * global status lists /competitions/{notStarted|started|completed}, CompetitionsFullList) and
 * helpers/getDisplayedDate.ts. Unlike the /feed/competition-cards DTO, the /feed/competitions list
 * DTO carries raw dates and registrations, so the card derives its own labels here.
 */

/** The zone the dates are read in: fish formats in the phone's zone, and Bluvi's users are in Romania. */
export const COMPETITION_TIME_ZONE = 'Europe/Bucharest';

/** date-fns `ro` locale, `EEE` (by JS weekday, Sunday first) and `MMM` — no ICU, so server and browser agree. */
const DAYS = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'] as const;
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'] as const;
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type Parts = { year: number; month: number; day: number; weekday: number };

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

function partsOf(date: Date, timeZone: string): Parts {
  const out: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) out[p.type] = p.value;
  return { year: Number(out.year), month: Number(out.month) - 1, day: Number(out.day), weekday: WEEKDAY_INDEX[out.weekday] ?? 0 };
}

/** `EEE, d` + ` MMM` + ` yyyy`. */
function dayLabel(p: Parts, { month, year }: { month: boolean; year: boolean }) {
  return `${DAYS[p.weekday]}, ${p.day}${month ? ` ${MONTHS[p.month]}` : ''}${year ? ` ${p.year}` : ''}`;
}

/**
 * fish `getDisplayedDate`: «sâm, 4 oct» for one day; «sâm, 4 - dum, 5 oct» within a month;
 * «vin, 31 oct - sâm, 1 noi» across months; the year only when it is not this year (both ends
 * when the range spans two years).
 */
export function getDisplayedDate(startDate: string, endDate: string, now: Date = new Date(), timeZone: string = COMPETITION_TIME_ZONE): string {
  const start = partsOf(new Date(startDate), timeZone);
  const end = partsOf(new Date(endDate), timeZone);
  const today = partsOf(now, timeZone);
  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;

  if (sameMonth && start.day === end.day) return dayLabel(start, { month: true, year: start.year !== today.year });
  if (!sameYear) return `${dayLabel(start, { month: true, year: true })} - ${dayLabel(end, { month: true, year: true })}`;

  const endWithYear = end.year !== today.year;
  if (sameMonth) return `${dayLabel(start, { month: false, year: false })} - ${dayLabel(end, { month: true, year: endWithYear })}`;
  return `${dayLabel(start, { month: true, year: false })} - ${dayLabel(end, { month: true, year: endWithYear })}`;
}

/** fish: «{registered}/{participantsLimit || 21}» — 21 is fish's fallback for a competition without a limit. */
export const LEGACY_DEFAULT_PARTICIPANTS_LIMIT = 21;
/** fish ParticipantsAvatars displayLimit. */
export const LEGACY_FACES_SHOWN = 3;

export type LegacyCardFace = { name: string; avatarUrl: string | null };

export type LegacyListCard = {
  /** Uppercased getDisplayedDate (fish `.toUpperCase()`). */
  dateLabel: string;
  /** «3/21 pescari» / «2/8 echipe». */
  entrantsLabel: string;
  /** «2 în așteptare» — upcoming competitions with pending registrations only; null otherwise. */
  pendingLabel: string | null;
  /** Registered then pending entrants, the first participant of each, at most 3. */
  faces: LegacyCardFace[];
  /** Entrants past the 3 faces («+N»). */
  facesOverflow: number;
  formatLabel: 'Individual' | 'Echipe';
  rankingLabel: string;
  /** banner, else the lake's first image (fish coverImage); `src` is the small format when there is one. */
  poster: { src: string; blurhash: string | null } | null;
};

/** Everything the legacy list card shows, from one /feed/competitions row. */
export function legacyListCard(c: CompetitionListItem, now: Date = new Date()): LegacyListCard {
  const registered = c.registrations.filter(r => r.registrationStatus === 'registered');
  const pending = c.registrations.filter(r => r.registrationStatus === 'pending');
  const entrants = [...registered, ...pending];
  const unit = c.competitionType === 'single' ? 'pescari' : 'echipe';
  const cover = c.banner ?? c.lake?.images?.[0] ?? null;
  return {
    dateLabel: getDisplayedDate(c.startDate, c.endDate, now).toLocaleUpperCase('ro-RO'),
    entrantsLabel: `${registered.length}/${c.participantsLimit || LEGACY_DEFAULT_PARTICIPANTS_LIMIT} ${unit}`,
    // fish copy reads «in așteptare» (missing diacritic); the web writes it correctly (parity viitoare.c13).
    pendingLabel: pending.length > 0 && c.competitionStatus === 'notStarted' ? `${pending.length} în așteptare` : null,
    faces: entrants.slice(0, LEGACY_FACES_SHOWN).map(r => ({
      name: r.participants[0]?.username ?? '',
      avatarUrl: r.participants[0]?.avatar?.url ?? null,
    })),
    facesOverflow: Math.max(0, entrants.length - LEGACY_FACES_SHOWN),
    formatLabel: c.competitionType === 'single' ? 'Individual' : 'Echipe',
    rankingLabel: getRankingTypeLabel(c),
    poster: cover ? { src: cover.smallUrl ?? cover.url, blurhash: cover.blurhash ?? null } : null,
  };
}
