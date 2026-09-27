/**
 * fish `features/chat/hooks/useRoomUnreadBadge.ts` + `useCompetitionChatBadge.ts` without React.
 */
import {
  collection,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ChatAuth, RealtimeContext } from '../firebase';
import { hasUnreadMessage } from './listItems';
import { chatMessagesPath, chatReceiptUserPath } from './paths';
import type { ChatRoomId } from './types';

/** The tab shows at most "99+"; counting past this is wasted reads. */
export const UNREAD_BADGE_CAP = 99;
export const formatUnread = (count: number) => (count > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(count));

type Newest = { createdAtMs: number; senderId: string } | null;

/**
 * Unread count for a room: messages newer than my receipt. Two tiny listeners (newest message, my
 * receipt) decide whether there is anything unread and re-run one aggregate count when either
 * moves — no per-message reads. The caller only subscribes while the room is readable for this
 * user (rules would reject the read) and while signed in (`uid` = the Firebase uid).
 */
export function subscribeRoomUnreadCount(
  ctx: RealtimeContext,
  { competitionId, roomId, uid }: { competitionId: string; roomId: ChatRoomId; uid: string },
  onCount: (count: number) => void
): Unsubscribe {
  let newest: Newest = null;
  let lastReadAtMs = 0;
  let generation = 0;

  const recount = () => {
    const current = ++generation;
    if (!hasUnreadMessage(newest, lastReadAtMs, uid)) {
      onCount(0);
      return;
    }
    const unreadQuery = query(
      collection(ctx.chatDb, chatMessagesPath(competitionId, roomId)),
      where('createdAt', '>', Timestamp.fromMillis(lastReadAtMs))
    );
    getCountFromServer(unreadQuery)
      .then(snapshot => {
        if (current === generation) onCount(Math.min(snapshot.data().count, UNREAD_BADGE_CAP + 1));
      })
      .catch(() => {
        // The dot-level signal still stands: show at least one unread.
        if (current === generation) onCount(1);
      });
  };

  const unsubNewest = onSnapshot(
    query(collection(ctx.chatDb, chatMessagesPath(competitionId, roomId)), orderBy('createdAt', 'desc'), limit(1)),
    snapshot => {
      const data = snapshot.docs[0]?.data() as { createdAt?: Timestamp; senderId?: string } | undefined;
      newest = data?.createdAt && data.senderId ? { createdAtMs: data.createdAt.toMillis(), senderId: data.senderId } : null;
      // Every new message re-counts.
      recount();
    },
    () => {
      newest = null;
      recount();
    }
  );
  const unsubReceipt = onSnapshot(
    doc(ctx.chatDb, chatReceiptUserPath(competitionId, roomId, uid)),
    snapshot => {
      const lastReadAt = (snapshot.data() as { lastReadAt?: Timestamp } | undefined)?.lastReadAt;
      lastReadAtMs = lastReadAt?.toMillis?.() ?? 0;
      recount();
    },
    () => {
      lastReadAtMs = 0;
      recount();
    }
  );
  return () => {
    generation++;
    unsubNewest();
    unsubReceipt();
  };
}

/** Pill on the competition's Chat entry (same shape as the ranking action bar badge). */
export type ChatBadge = { text: string; tone: 'alert' | 'info' } | null;

/**
 * Unread messages across the rooms this account can read, or "Nou" when the chat of this
 * competition was never opened (no read receipt in either room) and has messages.
 * `receipts` null = not known yet.
 */
export function chatBadgeOf(
  counts: { general: number; participants: number },
  receipts: { general: boolean; participants: boolean } | null
): ChatBadge {
  const total = counts.general + counts.participants;
  if (total <= 0) return null;
  const neverOpened = receipts !== null && !receipts.general && !receipts.participants;
  if (neverOpened) return { text: 'Nou', tone: 'info' };
  return { text: formatUnread(total), tone: 'alert' };
}

/**
 * fish `useCompetitionChatBadge`: signs the account into Firebase first (so the badge works before
 * the first chat visit), then counts General (everyone) and Participanți (members and the
 * organizer side, `isMember` from `chatMembershipOf(statute).canUseParticipantsChat`).
 */
export function subscribeCompetitionChatBadge(
  ctx: RealtimeContext,
  auth: ChatAuth,
  { competitionId, profileDocumentId, isMember }: { competitionId: string; profileDocumentId: string; isMember: boolean },
  onBadge: (badge: ChatBadge) => void
): Unsubscribe {
  let cancelled = false;
  const unsubscribes: Unsubscribe[] = [];
  const counts = { general: 0, participants: 0 };
  let receipts: { general: boolean; participants: boolean } | null = null;
  const emit = () => {
    if (!cancelled) onBadge(chatBadgeOf(counts, receipts));
  };

  auth
    .ensure()
    .then(ok => {
      if (cancelled || !ok || !competitionId) return;
      const uid = profileDocumentId;
      const rooms = isMember ? (['general', 'participants'] as const) : (['general'] as const);
      // A receipt is written the first time a room is opened; none in any readable room = never here.
      const seen = { general: false, participants: false };
      for (const roomId of rooms) {
        unsubscribes.push(
          subscribeRoomUnreadCount(ctx, { competitionId, roomId, uid }, count => {
            counts[roomId] = count;
            emit();
          }),
          onSnapshot(
            doc(ctx.chatDb, chatReceiptUserPath(competitionId, roomId, uid)),
            snapshot => {
              seen[roomId] = snapshot.exists();
              receipts = { ...seen };
              emit();
            },
            () => {
              // Unreadable receipt: do not claim "Nou"; the count still shows.
              seen[roomId] = true;
              receipts = { ...seen };
              emit();
            }
          )
        );
      }
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };
}
