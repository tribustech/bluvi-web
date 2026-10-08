import type { NotificationRoute } from '@/core/social';
import { anglerHref, partidaHref, routes } from '@/lib/routes';

/*
 * Notification → web page (parity global.b.notification-routes-web, account.b.notification-route-map).
 * core social getRouteForNotificationItem / getRouteForNotificationPayload turn a notification into
 * fish's route descriptor (same rules, same null cases, the whole payload spread, weighihngId read
 * as weighingId); this maps the descriptor onto the web's paths, built only with lib/routes.
 *
 * A target whose page is not on the web yet answers null, so the notification renders as a plain
 * row — never a link to the catch-all 404. Each gate names the milestone that ships the page;
 * tests/unit/notification-href.test.ts checks every gate against app/(site) (a page that lands
 * while its gate is still off fails the test, so nobody forgets to flip it). Shared switches
 * (ON_WEB in lib/routes) stay there: the angler profile and the partidă page.
 *
 * Re-checked after M2 (2026-10-07): fish sends no notification to Setări, Setări → Notificări,
 * Preferințe concursuri, the own profile, the suggested anglers or Completează profilul (none of
 * those routes appears in fish helpers/getRedirectLocationForNotification.ts), so the M2 account
 * pages add no link here; the unit test pins that no type maps onto them.
 */
export const NOTIFICATION_PAGES_ON_WEB = {
  /** /concursuri/[id]/chat?camera= — competition chat (M5, participant.yml). */
  competitionChat: false,
  /** /concursuri/[id]/penalizari — penalties (M6, organizer.yml). */
  penalties: false,
  /** /sondaje — the current poll (POLL_OPENED / POLL_CLOSED / POLL_SUGGESTION_APPROVED) — ON since M5-B1
   * (participant.b.poll-notification-route). */
  polls: true,
  /**
   * /partide/intra/[cod] — join a partidă with a code (PARTIDA_INVITE) — ON since M4-B6
   * (partide.b.notif-invite).
   */
  partidaJoin: true,
  /**
   * The own / co-op partidă by its CLIENT id (PARTIDA_FINISHED, AUTO_CLOSE_WARN) →
   * /partide/sesiune/[clientId], which resolves it to /partide/[documentId] (live pointer, then the
   * own list) or falls back to Ale mele — ON since M4-B3 (partide.b.notif-finished-autoclose).
   */
  ownPartida: true,
  /**
   * /partide/[id]/capturi — a partidă's catches (FOLLOW_RECORD_PERSONAL / FOLLOW_RECORD_LAKE, the
   * documentId) — ON since M4-B8 (partide.b.notif-community).
   */
  communityCatches: true,
  /** /organizator — the organizer panel (M6). */
  organizer: false,
  /** /rezervari/[id] — the angler's booking detail (M3) — ON since M3-B2. */
  booking: true,
  /** /operator/[lakeId]/rezervari?status= — the operator's bookings (M7). */
  operatorBookings: false,
  /**
   * /concursuri/[id]/participanti?filtru=in-asteptare — the organizer's pending registrations (fish
   * participantsFilter=pending, COMPETITION_NEW_REGISTRATION_ORGANIZER) — M6, organizer.yml. Off: the
   * participants page has no pending filter yet, so the row opens the unfiltered list (a deliberate
   * gap, never a `filtru` the page ignores); the unit test turns this on when the page reads `filtru`.
   */
  organizerPendingFilter: false,
} as const;

export function notificationHref(route: NotificationRoute): string | null {
  switch (route.kind) {
    case 'competition': {
      const { competitionId: id, activeTabId, participantsFilter } = route.params;
      switch (activeTabId) {
        case 'clasament':
          return routes.competitionRanking(id);
        case 'participanti':
          return routes.competitionParticipants(
            id,
            participantsFilter === 'pending' && NOTIFICATION_PAGES_ON_WEB.organizerPendingFilter ? 'in-asteptare' : undefined,
          );
        case 'extracantare':
          return routes.competitionExtraScales(id);
        case 'informatii':
          return routes.competitionInfo(id);
        case 'regulament':
          return routes.competitionRules(id);
        default:
          return routes.competition(id);
      }
    }
    case 'competitionWeighing':
      return routes.competitionWeighing(route.params.competitionId, route.params.weighingId, route.params.standId);
    case 'competitionChat':
      // TODO(M5): routes.competitionChat(id, camera) when the chat ships.
      return null; // NOTIFICATION_PAGES_ON_WEB.competitionChat is off: no page yet
    case 'penalties':
      // TODO(M6): routes.competitionPenalties(id).
      return null; // NOTIFICATION_PAGES_ON_WEB.penalties is off: no page yet
    case 'currentPoll':
      return NOTIFICATION_PAGES_ON_WEB.polls ? routes.polls() : null;
    case 'news':
      return routes.newsItem(route.params.newsId);
    case 'lakesTab':
      return routes.lakes();
    case 'competitionsTab':
      return routes.competitions();
    case 'angler':
      return anglerHref(route.params.documentId);
    case 'partidaJoin':
      // PARTIDA_INVITE (data.partidaCode) → the join confirmation; core already answers null
      // without a code (partide.b.notif-invite).
      return NOTIFICATION_PAGES_ON_WEB.partidaJoin ? routes.partidaJoinCode(route.params.code) : null;
    case 'partida':
      // fish /(app)/partide/{sessionId}: the CLIENT id; the web's pages take the documentId, so the
      // resolver page maps it (getRedirectLocationForNotification.ts:107-116).
      return NOTIFICATION_PAGES_ON_WEB.ownPartida ? routes.partidaSession(route.params.sessionId) : null;
    case 'communitySession':
      // PARTIDA_CATCH, PARTIDA_FINISHED_FOLLOWED, FOLLOW_PARTIDA_START / _FIRST_CATCH (the
      // documentId): the partidă page, member or spectator view (partide.b.notif-community).
      return partidaHref(route.params.sessionDocumentId);
    case 'communityCatches':
      // FOLLOW_RECORD_PERSONAL / FOLLOW_RECORD_LAKE (the documentId; core answers null without one)
      // → the partidă's catches (fish comunitate/capturi/[id], partide.b.notif-community).
      return NOTIFICATION_PAGES_ON_WEB.communityCatches ? routes.partidaCatches(route.params.sessionDocumentId) : null;
    case 'organizerDashboard':
      return NOTIFICATION_PAGES_ON_WEB.organizer ? routes.organizer() : null;
    case 'booking':
      // Every BOOKING_*_ANGLER (request received, confirmed, rejected, cancelled, reminder, no-show,
      // walk-in) → the booking page; signed out, /intra returns there (booking.rezervare.c14).
      return routes.booking(route.params.bookingId);
    case 'operatorBookings':
      // TODO(M7): routes.operatorBookings(lakeId, status) — its status union needs «rejected».
      return null; // NOTIFICATION_PAGES_ON_WEB.operatorBookings is off: no page yet
    case 'lakeReviews':
      return routes.lakeReviews(route.params.lakeId);
    default:
      return null;
  }
}
