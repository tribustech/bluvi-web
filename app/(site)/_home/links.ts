import { routes } from '@/lib/routes';

/**
 * Destinations Acasă links to that lib/routes.ts does not define yet (their pages are later
 * batches). Kept here, in one place, so the main session can lift them into lib/routes.ts with
 * the page that owns each. fish path in the comment.
 */
export const homeLinks = {
  signIn: '/intra',
  /** fish /bookings */
  myBookings: '/rezervari',
  /** fish /(app)/partide/start */
  partidaStart: '/partide/start',
  /** fish /(app)/partide/join */
  partidaJoin: '/partide/cod',
  /** fish /(app)/organizer */
  organizer: '/organizator',
  /** fish /polls/current */
  polls: '/sondaje',
  /** fish `router.push('/sign-in', { redirectTo: '/polls/current' })` (guest taps a poll option / suggest) */
  pollSignIn: `/intra?next=${encodeURIComponent('/sondaje')}`,
  /** fish /(app)/scale/[competitionId]/history?sectorName&standName&standId (ScaleItem) */
  scaleHistory: (competitionId: string, s: { sectorName: string; standName: string; standId: string }) =>
    `${routes.competition(competitionId)}/cantar?${new URLSearchParams({ sector: s.sectorName, stand: s.standName, standId: s.standId })}`,
  /** fish /raffle (join) */
  raffle: '/tombola',
  /** fish /raffle/confirmation (joined) */
  raffleConfirmation: '/tombola/confirmare',
  /** fish /raffle/winners (ended, with winners) */
  raffleWinners: '/tombola/castigatori',
  /** fish /(app)/anglers/suggested */
  suggestedAnglers: '/pescari/sugerati',
  /** fish /notifications */
  notifications: '/notificari',
  /** fish /sponsors/[id] */
  sponsor: (documentId: string) => `/sponsori/${encodeURIComponent(documentId)}`,
  /** fish (tabs)/competitions with `status` */
  competitions: (status: 'started' | 'notStarted') => `${routes.competitions()}?status=${status}`,
} as const;

/**
 * fish OwnedLakesCard `go(suffix)`: one lake → that lake's panel, several → the picker.
 * fish suffixes map to web segments: '' → panel, '/walk-in' → calendar, '/bookings' → rezervări.
 */
export function operatorHref(lakeId: string | undefined, target: 'panel' | 'calendar' | 'bookings', status?: 'pending' | 'cancelled' | 'toreview') {
  if (!lakeId) return '/operator';
  const base = `/operator/${encodeURIComponent(lakeId)}`;
  if (target === 'panel') return base;
  if (target === 'calendar') return `${base}/calendar`;
  return status ? `${base}/rezervari?status=${status}` : `${base}/rezervari`;
}
