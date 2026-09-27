import { NotificationTypes, type NotificationResponse, type NotificationType } from '../schemas';

/**
 * fish `helpers/getRedirectLocationForNotification.ts`, ported as data: instead of an expo-router
 * path it returns a route descriptor `{ kind, params }` that the web router maps to its own URLs.
 *
 * Dropped on purpose: fish appends `timestamp=Date.now()` to most routes so expo-router
 * re-navigates when the same tab is already active. That is a navigation concern; the web router
 * decides whether it needs a cache-buster.
 */

/** fish `common/utils/competitionRoutes.ts#ROUTES` — the competition detail tabs. */
export const CompetitionTabs = {
  CLASAMENT: 'clasament',
  INFORMATII: 'informatii',
  PARTICIPANTI: 'participanti',
  EXTRACANTARE: 'extracantare',
  REGULAMENT: 'regulament',
} as const;
export type CompetitionTab = (typeof CompetitionTabs)[keyof typeof CompetitionTabs];

export type NotificationRoute =
  | {
      kind: 'competition';
      params: { competitionId: string; activeTabId?: CompetitionTab; participantsFilter?: 'pending' };
    }
  | {
      /** Competition detail with the weighing sheet of one stand open. */
      kind: 'competitionWeighing';
      params: { competitionId: string; sectorName: string; standName: string; standId: string; weighingId: string };
    }
  | {
      /** `name` lets the chat header show a title before the competition request answers. */
      kind: 'competitionChat';
      params: { competitionId: string; tab: string; name?: string };
    }
  | { kind: 'penalties'; params: { competitionId: string } }
  | { kind: 'currentPoll'; params: Record<string, never> }
  | { kind: 'news'; params: { newsId: string } }
  | { kind: 'lakesTab'; params: Record<string, never> }
  | { kind: 'competitionsTab'; params: Record<string, never> }
  | { kind: 'angler'; params: { documentId: string } }
  | { kind: 'partidaJoin'; params: { code: string } }
  /** Own/co-op Partidă by its CLIENT id (the fish `/(app)/partide/[id]` param). */
  | { kind: 'partida'; params: { sessionId: string } }
  /** Community session detail, by Strapi documentId. */
  | { kind: 'communitySession'; params: { sessionDocumentId: string } }
  /** Community catches screen of a session, by Strapi documentId. */
  | { kind: 'communityCatches'; params: { sessionDocumentId: string } }
  | { kind: 'organizerDashboard'; params: Record<string, never> }
  | { kind: 'booking'; params: { bookingId: string } }
  | { kind: 'operatorBookings'; params: { lakeId: string; status: 'pending' | 'rejected' | 'cancelled' } }
  | { kind: 'lakeReviews'; params: { lakeId: string } };

export type NotificationRouteKind = NotificationRoute['kind'];

/** The payload fields the mapping reads. Values arrive as strings (FCM data is string-only). */
export type NotificationData = {
  type: NotificationType;
  /** Optional: only competition notifications carry it, and every case that needs it guards. */
  competitionId?: string;
  /** CHAT_MESSAGE: which room to open ('general' | 'participants'); `chatRoom` is the CMS alias. */
  tab?: string;
  chatRoom?: string;
  /** CHAT_MESSAGE: the competition's name, so the chat header can be titled before the API answers. */
  competitionName?: string;
  sectorName?: string;
  standName?: string;
  standId?: string;
  weighingId?: string;
  scaleNumber?: string;
  newsId?: string;
  bookingId?: string;
  lakeId?: string;
  followerDocumentId?: string;
  partidaCode?: string;
  /** Partidă client id — PARTIDA_FINISHED / PARTIDA_AUTO_CLOSE_WARN. */
  sessionId?: string;
  /** Strapi session documentId — PARTIDA_CATCH / PARTIDA_FINISHED_FOLLOWED / FOLLOW_*. */
  sessionDocumentId?: string;
};

const none = {} as Record<string, never>;

export function getRedirectLocationForNotification(data: NotificationData): NotificationRoute | null {
  const competition = (extra: Omit<Extract<NotificationRoute, { kind: 'competition' }>['params'], 'competitionId'> = {}) =>
    data.competitionId ? ({ kind: 'competition', params: { competitionId: data.competitionId, ...extra } } as const) : null;

  switch (data.type) {
    case NotificationTypes.COMPETITION_NEW_REGISTRATION_USER:
    case NotificationTypes.COMPETITION_NEW_REGISTRATION_TEAM:
    case NotificationTypes.COMPETITION_NEW_REJECTION_TEAM:
    case NotificationTypes.COMPETITION_NEW_REJECTION_USER:
    case NotificationTypes.COMPETITION_PENDING_USER:
    case NotificationTypes.COMPETITION_REGISTRATION_MODIFIED_PARTICIPANT:
    case NotificationTypes.COMPETITION_START:
      return competition();
    case NotificationTypes.COMPETITION_END:
      return competition({ activeTabId: CompetitionTabs.CLASAMENT });

    case NotificationTypes.COMPETITION_NEW_REGISTRATION_ORGANIZER:
      return competition({ activeTabId: CompetitionTabs.PARTICIPANTI, participantsFilter: 'pending' });

    case NotificationTypes.COMPETITION_PARTICIPANTS_ALLOCATION:
    case NotificationTypes.COMPETITION_NEW_CANCELLATION_ORGANIZER:
    case NotificationTypes.COMPETITION_REGISTRATION_MODIFIED_ORGANIZER:
      return competition({ activeTabId: CompetitionTabs.PARTICIPANTI });

    case NotificationTypes.COMPETITION_WEIGHING_MODIFIED:
    case NotificationTypes.COMPETITION_WEIGHING_END: {
      const { competitionId, sectorName, standName, standId, weighingId } = data;
      // fish leaves `scaleNumber` unused here too ("TODO: what do we do with this?").
      if (!competitionId || !sectorName || !standName || !standId || !weighingId) return null;
      return { kind: 'competitionWeighing', params: { competitionId, sectorName, standName, standId, weighingId } };
    }

    case NotificationTypes.COMPETITION_EXTRA_WEIGHT_REQUEST:
      return competition({ activeTabId: CompetitionTabs.EXTRACANTARE });

    case NotificationTypes.CHAT_MESSAGE: {
      if (!data.competitionId) return null;
      const params: { competitionId: string; tab: string; name?: string } = {
        competitionId: data.competitionId,
        tab: data.tab ?? data.chatRoom ?? 'general',
      };
      if (data.competitionName) params.name = data.competitionName;
      return { kind: 'competitionChat', params };
    }

    case NotificationTypes.PENALTY:
      if (!data.competitionId) return null;
      return { kind: 'penalties', params: { competitionId: data.competitionId } };

    case NotificationTypes.POLL_OPENED:
    case NotificationTypes.POLL_CLOSED:
    case NotificationTypes.POLL_SUGGESTION_APPROVED:
      return { kind: 'currentPoll', params: none };

    case NotificationTypes.NEWS:
      if (!data.newsId) return null;
      return { kind: 'news', params: { newsId: data.newsId } };

    case NotificationTypes.NEW_LAKES:
      return { kind: 'lakesTab', params: none };

    case NotificationTypes.NEW_FOLLOWER:
      if (!data.followerDocumentId) return null;
      return { kind: 'angler', params: { documentId: data.followerDocumentId } };

    case NotificationTypes.PARTIDA_INVITE:
      if (!data.partidaCode) return null;
      return { kind: 'partidaJoin', params: { code: data.partidaCode } };

    // sessionId is the session's CLIENT id, so a still-subscribed teammate resolves it from the
    // live snapshot. Same for the auto-close warning.
    case NotificationTypes.PARTIDA_FINISHED:
    case NotificationTypes.PARTIDA_AUTO_CLOSE_WARN:
      if (!data.sessionId) return null;
      return { kind: 'partida', params: { sessionId: data.sessionId } };

    case NotificationTypes.PARTIDA_CATCH:
    case NotificationTypes.PARTIDA_FINISHED_FOLLOWED:
    case NotificationTypes.FOLLOW_PARTIDA_START:
    case NotificationTypes.FOLLOW_PARTIDA_FIRST_CATCH:
      if (!data.sessionDocumentId) return null;
      return { kind: 'communitySession', params: { sessionDocumentId: data.sessionDocumentId } };

    case NotificationTypes.SCHEDULED_NOTIFICATION:
      return null;

    case NotificationTypes.COMPETITION_AUTO_CANCELLED_ORGANIZER:
      // The organizer dashboard lists it under Anulate.
      return { kind: 'organizerDashboard', params: none };

    case NotificationTypes.COMPETITION_CANCELLED_USER:
      // Intentionally no navigation — the cancelled competition is hidden from the participant's
      // "My competitions" list, so there is nowhere to route to.
      return null;

    // Angler booking notifications → angler booking detail.
    case NotificationTypes.BOOKING_REQUEST_RECEIVED_ANGLER:
    case NotificationTypes.BOOKING_CONFIRMED_ANGLER:
    case NotificationTypes.BOOKING_REJECTED_ANGLER:
    case NotificationTypes.BOOKING_CANCELLED_ANGLER:
    case NotificationTypes.BOOKING_REMINDER_ANGLER:
    case NotificationTypes.BOOKING_NO_SHOW_ANGLER:
    case NotificationTypes.BOOKING_WALK_IN_ANGLER:
      if (!data.bookingId) return null;
      return { kind: 'booking', params: { bookingId: data.bookingId } };

    // Operator booking notifications → operator lake inbox, on the tab that holds the row.
    case NotificationTypes.BOOKING_NEW_REQUEST_OPERATOR:
    case NotificationTypes.BOOKING_PENDING_NUDGE_OPERATOR:
      if (!data.lakeId) return null;
      return { kind: 'operatorBookings', params: { lakeId: data.lakeId, status: 'pending' } };
    case NotificationTypes.BOOKING_AUTO_REJECTED_OPERATOR:
      if (!data.lakeId) return null;
      return { kind: 'operatorBookings', params: { lakeId: data.lakeId, status: 'rejected' } };
    case NotificationTypes.BOOKING_CANCELLED_OPERATOR:
      if (!data.lakeId) return null;
      return { kind: 'operatorBookings', params: { lakeId: data.lakeId, status: 'cancelled' } };

    case NotificationTypes.NEW_COMPETITIONS:
      return competition() ?? { kind: 'competitionsTab', params: none };
    case NotificationTypes.COMPETITIONS_DIGEST:
      return { kind: 'competitionsTab', params: none };

    // Angler-follow fan-out
    case NotificationTypes.FOLLOW_COMPETITION_REGISTERED:
    case NotificationTypes.FOLLOW_COMPETITION_DIGEST:
      return competition({ activeTabId: CompetitionTabs.PARTICIPANTI });
    case NotificationTypes.FOLLOW_COMPETITION_START:
      return competition();
    case NotificationTypes.FOLLOW_COMPETITION_END:
    case NotificationTypes.FOLLOW_COMPETITION_PODIUM:
      return competition({ activeTabId: CompetitionTabs.CLASAMENT });
    case NotificationTypes.FOLLOW_RECORD_PERSONAL:
    case NotificationTypes.FOLLOW_RECORD_LAKE:
      if (!data.sessionDocumentId) return null;
      return { kind: 'communityCatches', params: { sessionDocumentId: data.sessionDocumentId } };
    case NotificationTypes.FOLLOW_LAKE_REVIEW:
      if (!data.lakeId) return null;
      return { kind: 'lakeReviews', params: { lakeId: data.lakeId } };

    default:
      return null;
  }
}

/** Keeps only string values: FCM data is string-only, anything else is not a usable route param. */
function stringFields(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (typeof v === 'string') out[k] = v;
  return out;
}

/**
 * A raw push payload → route (fish `contexts/NotificationsContextProvider.tsx#getRedirectURL`).
 * Spreads the WHOLE payload — hand-picking fields once dropped followerDocumentId, partidaCode,
 * sessionId and sessionDocumentId so five types never routed — and accepts the CMS's historical
 * `weighihngId` typo.
 */
export function getRouteForNotificationPayload(payload: Record<string, unknown>): NotificationRoute | null {
  const data = stringFields(payload);
  return getRedirectLocationForNotification({
    ...data,
    type: data.type ?? '',
    weighingId: data.weighihngId ?? data.weighingId,
  });
}

/**
 * An inbox row → route (fish `app/(app)/notifications.tsx#NotificationItem`). `type` lives outside
 * `data` there and must win over any `type` key inside `data`.
 */
export function getRouteForNotificationItem(item: NotificationResponse): NotificationRoute | null {
  const data = stringFields(item.notification.data);
  return getRedirectLocationForNotification({
    ...data,
    type: item.notification.type,
    weighingId: data.weighihngId ?? data.weighingId,
  });
}
