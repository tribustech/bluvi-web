import { venuePartideHref as fishVenuePartideHref, type CommunityVenueDTO } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { routes } from './routes';

/*
 * Pure web-side helpers of the Partide community pages (the hub's Comunitate and what reuses its
 * cards). The fish rules stay in core/partide (communityView, cardModel); this file only maps them
 * to the web: routes, Romania-time dates, Romanian plurals with formatCount.
 */

const MONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC'];
const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(iso: string) {
  const p = Object.fromEntries(PARTS.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { year: Number(p.year), day: Number(p.day), month: Number(p.month) - 1, time: `${p.hour}:${p.minute}` };
}

/**
 * fish cardModel `fmtRange` («26 IUL · 06:40 – 18:10»), in Romania's time on the server and in the
 * browser alike (fish formats in the phone's zone; a static page has none). A partidă that runs past
 * midnight names both days («26 IUL 18:00 – 27 IUL 06:10») instead of reading as one day.
 */
export function partidaRange(startedAt: string, endedAt: string): string {
  const s = parts(startedAt);
  const e = parts(endedAt);
  if (s.year === e.year && s.month === e.month && s.day === e.day) return `${s.day} ${MONTHS[s.month]} · ${s.time} – ${e.time}`;
  return `${s.day} ${MONTHS[s.month]} ${s.time} – ${e.day} ${MONTHS[e.month]} ${e.time}`;
}

/**
 * fish venuePartideHref on the web's routes (parity partide.comunitate.c16): a lake → its Partide
 * page, a public water → /ape-publice/<code>/partide (the code read back out of «water:<code>»), a
 * manual pin (or a row missing its id) → null.
 */
export function venuePartidePage(venue: Pick<CommunityVenueDTO, 'key' | 'venueType' | 'lakeId'>): string | null {
  if (!fishVenuePartideHref(venue)) return null;
  if (venue.venueType === 'lake' && venue.lakeId) return routes.lakePartide(venue.lakeId);
  if (venue.venueType === 'publicWater') return routes.publicWaterPartide(venue.key.slice('water:'.length));
  return null;
}

/** «Giurgiu · 3 partide» / «12 de partide» (fish PopularVenues meta, last 30 days; formatCount plurals). */
export function popularVenueMeta(locality: string | null, sessionsLast30d: number): string {
  const count = formatCount(sessionsLast30d, 'partidă', 'partide');
  return locality ? `${locality} · ${count}` : count;
}

/** The noun under a catch count («captură» / «capturi»), fish StatStrip. */
export const catchesNoun = (n: number) => (n === 1 ? 'captură' : 'capturi');
