/*
 * fish's legacy paths → the web's routes (global.b.legacy-path-redirects): the one table both
 * tests/unit/legacy-redirects.test.ts (next.config redirects() alone) and
 * tests/e2e/legacy-redirects.spec.ts (the running server) check. `query`: the keys the destination
 * must carry with these values (fish's leftovers such as timestamp ride along — Next merges the
 * request query into every redirect — and are not asserted); `absent`: keys it must not carry.
 * Ids are placeholders: a redirect never reads the CMS.
 */
export type LegacyCase = {
  from: string;
  status: 307 | 308;
  path: string;
  query?: Record<string, string>;
  absent?: string[];
  /** What fish sends this URL for (getRedirectLocationForNotification.ts, share sheets). */
  why: string;
  /**
   * The destination query is filled from `has` values (:key). next's config-testing util drops
   * those params (it keeps only the path's), so only the running server (the e2e) can check it.
   */
  hasParams?: true;
};

const T = 'timestamp=1760000000000';

export const LEGACY_CASES: LegacyCase[] = [
  {
    from: `/competitions/c1?openWeighingSheet=1&sectorName=A&standName=Stand%203&standId=s1&weighingId=w1&${T}`,
    status: 308,
    path: '/concursuri/c1/cantare',
    query: { cantar: 'w1', stand: 's1' },
    why: 'COMPETITION_WEIGHING_MODIFIED / _END',
    hasParams: true,
  },
  {
    from: `/competitions/c1?openWeighingSheet=1&standId=s1&${T}`,
    status: 308,
    path: '/concursuri/c1',
    absent: ['cantar', 'stand'],
    why: 'a weighing link without weighingId: just the competition',
  },
  {
    from: `/competitions/c1?activeTabId=participanti&participantsFilter=pending&${T}`,
    status: 308,
    path: '/concursuri/c1/participanti',
    query: { filtru: 'in-asteptare' },
    why: 'COMPETITION_NEW_REGISTRATION_ORGANIZER',
  },
  {
    from: `/competitions/c1?activeTabId=participanti&${T}`,
    status: 308,
    path: '/concursuri/c1/participanti',
    absent: ['filtru'],
    why: 'COMPETITION_PARTICIPANTS_ALLOCATION, ROUND_START, FOLLOW_COMPETITION_REGISTERED…',
  },
  { from: `/competitions/c1?activeTabId=clasament&${T}`, status: 308, path: '/concursuri/c1/clasament', why: 'COMPETITION_END, ROUND_END, FOLLOW_COMPETITION_PODIUM' },
  { from: `/competitions/c1?activeTabId=extracantare&${T}`, status: 308, path: '/concursuri/c1/extra-cantare', why: 'COMPETITION_EXTRA_WEIGHT_REQUEST' },
  { from: '/competitions/c1?activeTabId=informatii', status: 308, path: '/concursuri/c1/informatii', why: 'competitionRoutes INFORMATII' },
  { from: '/competitions/c1?activeTabId=regulament', status: 308, path: '/concursuri/c1/regulament', why: 'competitionRoutes REGULAMENT' },
  { from: `/competitions/c1?activeTabId=necunoscut&${T}`, status: 308, path: '/concursuri/c1', why: 'an unknown tab: the competition' },
  {
    from: '/competitions/c1/chat?tab=participants&name=Cupa%20Bluvi',
    status: 308,
    path: '/concursuri/c1/chat',
    query: { tab: 'participanti' },
    why: 'CHAT_MESSAGE, participants room',
  },
  { from: '/competitions/c1/chat?tab=general', status: 308, path: '/concursuri/c1/chat', query: { tab: 'general' }, why: 'CHAT_MESSAGE, general room' },
  { from: `/competitions/c1?${T}`, status: 308, path: '/concursuri/c1', why: 'COMPETITION_START, NEW_COMPETITIONS…; the share link' },
  { from: '/competitions', status: 308, path: '/concursuri', why: 'the competitions tab' },
  { from: `/lakes/l1/reviews?${T}`, status: 308, path: '/balti/l1/recenzii', why: 'FOLLOW_LAKE_REVIEW' },
  { from: '/lakes/l1', status: 308, path: '/balti/l1', why: 'ShareLakeSheet link' },
  { from: '/lakes', status: 308, path: '/balti', why: 'NEW_LAKES (the lakes tab)' },
  { from: '/lakes/l1/gallery', status: 308, path: '/balti/l1/galerie', why: 'fish lakes/[lakeId]/gallery' },
  { from: '/lakes/l1/map', status: 308, path: '/balti/l1/harta', why: 'fish lakes/[lakeId]/map' },
  { from: '/lakes/l1/capturi', status: 308, path: '/balti/l1/capturi', why: 'fish lakes/[lakeId]/capturi' },
  { from: '/lakes/l1/concursuri', status: 308, path: '/balti/l1/concursuri', why: 'fish lakes/[lakeId]/concursuri' },
  { from: '/lakes/l1/partide', status: 308, path: '/balti/l1/partide', why: 'fish lakes/[lakeId]/partide' },
  { from: '/lakes/l1/standuri', status: 308, path: '/balti/l1/standuri', why: 'fish lakes/[lakeId]/standuri' },
  { from: '/lakes/l1/statistici', status: 308, path: '/balti/l1/statistici', why: 'fish lakes/[lakeId]/statistici' },
  { from: '/lakes/l1/clasament', status: 308, path: '/balti/l1/clasament', why: 'fish lakes/[lakeId]/clasament' },
  { from: '/lakes/review/l1', status: 308, path: '/balti/l1/recenzie', why: 'fish lakes/review/[lakeId] (write a review)' },
  { from: '/news/n1', status: 308, path: '/stiri/n1', why: 'NEWS' },
  { from: '/news', status: 308, path: '/stiri', why: 'the news list' },
  { from: '/organizer', status: 308, path: '/organizator', why: 'COMPETITION_AUTO_CANCELLED_ORGANIZER' },
  { from: '/penalties/c1', status: 308, path: '/concursuri/c1/penalizari', why: 'PENALTY' },
  { from: '/penalties/c1/apply', status: 308, path: '/concursuri/c1/penalizari/aplica', why: 'fish penalties/[competitionId]/apply' },
  { from: '/penalties/c1/select-stand', status: 308, path: '/concursuri/c1/penalizari/stand', why: 'fish penalties/[competitionId]/select-stand' },
  { from: '/competitions/stand-timeline/c1', status: 308, path: '/concursuri/c1/statistici/cronologie', why: 'fish competitions/stand-timeline/[competitionId]' },
  {
    from: `/operator/l1/bookings?status=pending&${T}`,
    status: 308,
    path: '/operator/l1/rezervari',
    query: { status: 'pending' },
    why: 'BOOKING_NEW_REQUEST_OPERATOR, PENDING_NUDGE',
  },
  { from: '/operator/l1/bookings?status=rejected', status: 308, path: '/operator/l1/rezervari', query: { status: 'rejected' }, why: 'BOOKING_AUTO_REJECTED_OPERATOR' },
  { from: '/operator/l1/bookings?status=cancelled', status: 308, path: '/operator/l1/rezervari', query: { status: 'cancelled' }, why: 'BOOKING_CANCELLED_OPERATOR' },
  { from: '/partide/comunitate/capturi/p1', status: 308, path: '/partide/p1/capturi', why: 'FOLLOW_RECORD_PERSONAL / _LAKE' },
  { from: '/partide/comunitate/galerie/p1', status: 308, path: '/partide/p1/galerie', why: 'fish partide/comunitate/galerie/[id]' },
  // Kept from earlier milestones.
  { from: '/partide/comunitate/p1', status: 308, path: '/partide/p1', why: 'the spectate share link, PARTIDA_CATCH' },
  { from: '/partide/join/ABC123', status: 307, path: '/partide', why: 'invite link — app-only on web (ROADMAP §4b rule 21)' },
  { from: '/partide/start', status: 307, path: '/partide', why: 'the start link — app-only on web' },
  { from: `/anglers/a1?${T}`, status: 308, path: '/pescari/a1', why: 'NEW_FOLLOWER' },
  { from: `/bookings/b1?${T}`, status: 308, path: '/rezervari/b1', why: 'BOOKING_*_ANGLER' },
  { from: '/bookings', status: 308, path: '/rezervari', why: 'my bookings' },
  { from: '/polls/current', status: 308, path: '/sondaje', why: 'POLL_OPENED / CLOSED, the poll share link' },
];

/** The web's own routes the legacy table must never shadow. */
export const NOT_REDIRECTED = ['/concursuri', '/concursuri/c1', '/concursuri/c1/clasament', '/balti', '/balti/l1', '/balti/l1/clasament', '/stiri', '/stiri/n1', '/partide', '/partide/p1', '/sondaje'];
