import { PATHS } from '@/components/nav/items';
import { routes } from '@/lib/routes';
import { FOCUS_SUGGEST } from '../sondaje/_components/model';

/**
 * Acasă's link table — every destination from lib/routes.ts (the one route builder), named as the
 * home blocks use them. fish path in the comment.
 */
export const homeLinks = {
  signIn: PATHS.signIn,
  /** fish /profile */
  profile: PATHS.profile,
  /** fish /bookings */
  myBookings: routes.myBookings(),
  /** fish /(app)/organizer */
  organizer: PATHS.organizer,
  /** fish /polls/current */
  polls: routes.polls(),
  /** fish PollCard `router.push('/polls/current', { focus: 'suggest' })` — the poll page, its suggestion field focused (home.acasa.c34) */
  pollSuggest: `${routes.polls()}?focus=${FOCUS_SUGGEST}`,
  /** fish `router.push('/sign-in', { redirectTo: '/polls/current' })` (guest taps a poll option / suggest) */
  pollSignIn: routes.signIn(routes.polls()),
  /** fish /(app)/scale/[competitionId]/history?sectorName&standName&standId (ScaleItem) */
  scaleHistory: (competitionId: string, s: { sectorName: string; standName: string; standId: string }) =>
    `${routes.competition(competitionId)}/cantar?${new URLSearchParams({ sector: s.sectorName, stand: s.standName, standId: s.standId })}`,
  /** fish /raffle (join) */
  raffle: routes.raffle(),
  /** fish RaffleDashboardCard guest tap `dismissTo('/sign-in')` — web keeps the way back to the raffle (participant.b.raffle-entry) */
  raffleSignIn: routes.signIn(routes.raffle()),
  /** fish /raffle/confirmation (joined) */
  raffleConfirmation: routes.raffleConfirmation(),
  /** fish /raffle/winners (ended, with winners) */
  raffleWinners: routes.raffleWinners(),
  /** fish /(app)/anglers/suggested */
  suggestedAnglers: routes.suggestedAnglers(),
  /** fish /notifications */
  notifications: PATHS.notifications,
  /** fish /sponsors/[id] */
  sponsor: routes.sponsor,
  /** fish (tabs)/competitions with `status` */
  competitions: (status: 'started' | 'notStarted') => routes.competitions(status),
} as const;

/**
 * fish OwnedLakesCard `go(suffix)`: one lake → that lake's panel, several → the picker.
 * fish suffixes map to web segments: '' → panel, '/walk-in' → calendar, '/bookings' → rezervări.
 */
export function operatorHref(lakeId: string | undefined, target: 'panel' | 'calendar' | 'bookings', status?: 'pending' | 'cancelled' | 'toreview') {
  if (!lakeId) return routes.operator();
  if (target === 'panel') return routes.operator(lakeId);
  if (target === 'calendar') return routes.operatorCalendar(lakeId);
  return routes.operatorBookings(lakeId, status);
}
