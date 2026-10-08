'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competitionKeys,
  competitionMyStatusQuery,
  competitionQuery,
  followCompetitionMutation,
  prefetchCompetitionNotificationPreferences,
  userStatuteForCompetitionQuery,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import type { chat } from '@/core/realtime';
import { buildRoomGallery, chatMembershipOf, type ChatMembership } from '@/core/realtime/chat/domain';
import { formatCount, formatTime24 } from '@/core/realtime/chat/format';
import type { LightboxItem } from '@/components/surfaces/Lightbox';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { routes } from '@/lib/routes';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { pageTransport } from '../../_components/transport';
import { setActiveChatRoom } from '../_live/activeRoom';
import {
  enqueueMessage,
  useChatPrefs,
  useChatSource,
  useChatStatus,
  usePageOutbox,
  usePageVisible,
  useRoomBundle,
  useRoomCache,
  useRoomUnread,
  useRulesConsent,
  useTypingNames,
  useTypingWriter,
  type ComposerAttachment,
  type RoomBundle,
} from '../_live/hooks';
import { CHAT_FROM_KEY, setLastChatTab, tabParamOf } from '../_live/lastTab';
import type { ChatSource, RoomId } from '../_live/source';
import type { ChatCompetitionFacts } from './facts';

/*
 * The chat page's brain (fish ChatScreen minus its views): one context every part of the frame
 * reads — the header, the room tabs, the follow prompt, the dialogs, and the message list and
 * composer (slices 2 and 3 replace those two wholesale and talk to the page only through this).
 *
 * Rooms (c4–c7): members (author, referees, registered participants — chatMembershipOf) see
 * Participanți | General; everyone else General only. The room comes from the link's `tab`, else
 * Participanți for a member once the statute arrives, else General; a non-member asking for
 * Participanți gets General. Both rooms stay subscribed (fish: two live lists, a switch is instant).
 * Sends go through the outbox (c30–c31): the bubble shows at once, the core worker uploads and writes
 * with 2 / 8 / 30 s retries.
 */

export type ChatViewer = { documentId: string; username: string; avatarUrl: string | null };

export type MediaState = { items: LightboxItem[]; index: number; label: string } | null;

export type ChatControllerValue = {
  competitionId: string;
  facts: ChatCompetitionFacts | null;
  competition: CompetitionWithMyStatus | undefined;
  /** The browser's competition read failed (after its retry): with no server facts, the header says «Chat». */
  competitionFailed: boolean;
  viewer: ChatViewer;
  source: ChatSource | null;
  membership: ChatMembership;
  /** The statute answered (or failed): the rooms are final. */
  statuteKnown: boolean;
  isAuthor: boolean;
  canDeleteAnyMessage: boolean;

  rooms: RoomId[];
  activeRoom: RoomId;
  selectRoom: (room: RoomId) => void;
  bundles: Record<RoomId, RoomBundle>;
  /** The room on screen. */
  current: RoomBundle;
  isLocked: boolean;
  /** Unread pill per room (only the room NOT on screen counts, c7). */
  unread: Record<RoomId, number>;
  muted: Record<RoomId, boolean>;

  /** c2: the typing label, else followers / participants. */
  subtitle: string;
  typingLabel: string | null;
  onTypingChange: (isTyping: boolean) => void;

  closed: boolean;
  closesAtMs: number | null;
  readOnly: boolean;
  /** The composer may send (signed in, room readable, chat open). */
  canWrite: boolean;
  /** The page is visible (fish: the screen is focused): receipts are written only then. */
  pageVisible: boolean;

  replyTo: chat.ChatListMessage | null;
  setReplyTo: (m: chat.ChatListMessage | null) => void;
  editing: chat.ChatListMessage | null;
  setEditing: (m: chat.ChatListMessage | null) => void;
  attachments: ComposerAttachment[];
  setAttachments: (a: ComposerAttachment[]) => void;

  send: (text: string) => Promise<void>;
  sendGreeting: () => void;
  retry: (id: string) => void;
  deleteMessage: (m: chat.ChatListMessage) => void;
  toggleReaction: (m: chat.ChatListMessage, emoji: string) => void;
  copy: (m: chat.ChatListMessage) => Promise<void>;

  /** The bell (c9). */
  bell: { show: boolean; muted: boolean; disabled: boolean; open: () => void };
  muteOpen: boolean;
  closeMute: () => void;
  confirmMute: () => Promise<void>;
  prefsSaving: boolean;
  hasOtherRoom: boolean;

  followPrompt: { show: boolean; pending: boolean; follow: () => void };
  followPanelOpen: boolean;
  closeFollowPanel: () => void;
  followersOpen: boolean;
  openFollowers: (() => void) | null;
  closeFollowers: () => void;

  rules: { open: boolean; saving: boolean; accept: () => void; decline: () => void };

  media: MediaState;
  openBanner: (() => void) | null;
  openGallery: (attachmentId: string) => void;
  closeMedia: () => void;
  gallery: ReturnType<typeof buildRoomGallery>;

  back: () => void;
};

const Ctx = createContext<ChatControllerValue | null>(null);

export function useChat(): ChatControllerValue {
  const v = use(Ctx);
  if (!v) throw new Error('useChat must be used inside <ChatController>');
  return v;
}


/** c41: the competition is the entry right under the chat (Navigation API, else the launch marker). */
function competitionUnderneath(competitionPath: string, competitionId: string): boolean {
  const nav = (window as unknown as { navigation?: { currentEntry?: { index: number } | null; entries?: () => { url: string | null }[] } }).navigation;
  if (nav?.currentEntry && typeof nav.entries === 'function') {
    const prev = nav.entries()[nav.currentEntry.index - 1];
    if (!prev?.url) return false;
    const path = new URL(prev.url).pathname;
    return path === competitionPath || (path.startsWith(`${competitionPath}/`) && !path.startsWith(`${competitionPath}/chat`));
  }
  try {
    return canGoBackInApp() && window.sessionStorage.getItem(CHAT_FROM_KEY) === competitionId;
  } catch {
    return false;
  }
}

const OTHER: Record<RoomId, RoomId> = { general: 'participants', participants: 'general' };

export function ChatController({
  competitionId,
  linkRoom,
  viewer,
  facts,
  children,
}: {
  competitionId: string;
  /** The link's room (`?tab=`), null when it names none. */
  linkRoom: RoomId | null;
  viewer: ChatViewer;
  facts: ChatCompetitionFacts | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const toast = useSiteToast();
  const qc = useQueryClient();
  const t = useMemo(() => pageTransport(), []);
  const uid = viewer.documentId;

  const session = { isAuthenticated: true };
  const competitionQ = useQuery({ ...competitionQuery(t, competitionId, session), retry: 1 });
  // The follow mutation's optimistic write lands under this key even when the read failed (a bare
  // `{ viewers, isFollowing }`): only a full detail counts as the competition.
  const competition = competitionQ.data?.documentId ? competitionQ.data : undefined;
  // The strict detail read fails for a ranking type core does not parse (load 'unsupported'): the
  // viewer's follow state then comes from /my-status alone (no rankingType in it), so the bell (c9)
  // and the follow prompt (c8) do not silently vanish.
  const myStatusQ = useQuery({ ...competitionMyStatusQuery(t, competitionId, session), enabled: competitionQ.isError });
  const isFollowing: boolean | undefined = competitionQ.data?.isFollowing ?? (competitionQ.isError ? myStatusQ.data?.isFollowing : undefined);
  const statuteQ = useQuery(userStatuteForCompetitionQuery(t, competitionId, session));
  const statute = statuteQ.data;
  const statuteKnown = statuteQ.isSuccess || statuteQ.isError;
  const membership = chatMembershipOf(statute);
  const isMember = membership.canUseParticipantsChat;
  const isAuthor = statute?.userRole === 'author';

  // ── rooms (c4, c5) ────────────────────────────────────────────────
  // `choice`: the room asked for (link or click), null = nobody chose (a member then lands on Participanți).
  const [choice, setChoice] = useState<RoomId | null>(linkRoom);
  const [seenLink, setSeenLink] = useState(linkRoom);
  const [replyTo, setReplyTo] = useState<chat.ChatListMessage | null>(null);
  const [editing, setEditing] = useState<chat.ChatListMessage | null>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  if (linkRoom !== seenLink) {
    // A new link into this same chat (a notification, a pasted URL): it picks the room again.
    setSeenLink(linkRoom);
    if (linkRoom) {
      setChoice(linkRoom);
      setReplyTo(null);
      setEditing(null);
      setAttachments([]);
    }
  }
  const activeRoom: RoomId =
    choice === 'participants' ? (statuteKnown && !isMember ? 'general' : 'participants') : choice === 'general' ? 'general' : statuteKnown && isMember ? 'participants' : 'general';
  const rooms = useMemo<RoomId[]>(() => (isMember ? ['participants', 'general'] : ['general']), [isMember]);
  const isLocked = activeRoom === 'participants' && !isMember;

  const selectRoom = useCallback(
    (room: RoomId) => {
      if (room === activeRoom) return;
      // c6: a switch clears edit / reply / attachments (the composer is shared by the rooms).
      setChoice(room);
      // c5: the URL follows the room on screen (a reload, Back or a shared link reopens it), and a
      // link to the room the reader just left — a notification — differs from the URL again and
      // re-selects it (fish's push nonce `tabAt`). The native replaceState keeps useSearchParams in
      // sync without a server round trip; `seenLink` moves with it so the change does not echo back.
      setSeenLink(room);
      try {
        window.history.replaceState(null, '', routes.competitionChat(competitionId, tabParamOf(room)));
      } catch {
        // A sandboxed history: the room still switches.
      }
      setReplyTo(null);
      setEditing(null);
      setAttachments([]);
      (document.activeElement as HTMLElement | null)?.blur?.();
    },
    [activeRoom, competitionId],
  );

  // c6: remember the room per competition, only once it is readable.
  useEffect(() => {
    if (statuteKnown && !isLocked) setLastChatTab(competitionId, activeRoom);
  }, [competitionId, activeRoom, isLocked, statuteKnown]);

  // ── live data ─────────────────────────────────────────────────────
  const source = useChatSource(uid);
  const store = useRoomCache();
  const outbox = usePageOutbox(source, uid);
  const status = useChatStatus({ source, competitionId, competitionStatus: competition?.competitionStatus ?? facts?.competitionStatus, endDate: competition?.endDate ?? facts?.endDate });
  const readOnly = isLocked || status.isClosed;

  const bundleArgs = { source, store, outbox, competitionId, currentUserId: uid, userName: viewer.username, readOnly: status.isClosed };
  const general = useRoomBundle({ ...bundleArgs, roomId: 'general', isLocked: false });
  const participants = useRoomBundle({ ...bundleArgs, roomId: 'participants', isLocked: !isMember });
  const bundles = { general, participants };
  const current = bundles[activeRoom];

  // c7: the room NOT on screen counts its unread.
  const otherRoom = OTHER[activeRoom];
  const otherUnread = useRoomUnread({ source, room: { competitionId, roomId: otherRoom }, enabled: otherRoom === 'general' || isMember });
  const unread = useMemo<Record<RoomId, number>>(
    () => ({ general: otherRoom === 'general' ? otherUnread : 0, participants: otherRoom === 'participants' ? otherUnread : 0 }),
    [otherRoom, otherUnread],
  );

  const prefs = useChatPrefs({ competitionId, roomId: activeRoom, enabled: true });
  const typingLabel = useTypingNames({ source, room: { competitionId, roomId: activeRoom }, currentUserId: uid, isLocked: readOnly });
  const onTypingChange = useTypingWriter({ source, room: { competitionId, roomId: activeRoom }, userName: viewer.username, isLocked: readOnly });

  // Receipts only for the room on screen and only while the page is visible (fish: focused), c33.
  const pageVisible = usePageVisible();
  const newest = current.room.messages[0];
  const markActive = current.markRead;
  const newestId = newest?.id;
  useEffect(() => {
    if (pageVisible && newest) markActive(newest);
    // Only when the page becomes visible again or the room changes (fish ChatScreen.tsx:339-347);
    // while a room stays on screen the list marks what it shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible, activeRoom, markActive, !!newestId]);

  // b.chat-open-room-push: the room on screen, while visible.
  useEffect(() => {
    setActiveChatRoom(pageVisible ? { competitionId, roomId: activeRoom } : null);
    return () => setActiveChatRoom(null);
  }, [competitionId, activeRoom, pageVisible]);

  // ── rules (c11) ───────────────────────────────────────────────────
  const consent = useRulesConsent({ source, uid });

  // ── back (c41) ────────────────────────────────────────────────────
  const back = useCallback(() => {
    const competitionPath = routes.competition(competitionId);
    if (competitionUnderneath(competitionPath, competitionId)) router.back();
    else router.replace(competitionPath);
  }, [competitionId, router]);
  const decline = useCallback(() => {
    // fish: declining records nothing; a plain back, or home when the chat is the first page.
    if (canGoBackInApp()) router.back();
    else router.replace(routes.home());
  }, [router]);

  // ── send pipeline (c26, c30, c31) ─────────────────────────────────
  const canWrite = !!source && !!outbox && !readOnly;
  const roomRef = useMemo(() => ({ competitionId, roomId: activeRoom }), [competitionId, activeRoom]);
  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!source || !outbox || readOnly) return;
      if (editing) {
        try {
          await source.editMessage({ ...roomRef, messageId: editing.id, text });
          setEditing(null);
          setReplyTo(null);
        } catch (e) {
          toast(e instanceof Error && e.message === source.pure.CHAT_SEND_ERRORS.auth ? e.message : source.pure.CHAT_SEND_ERRORS.edit, 'danger');
        }
        return;
      }
      if (!text && attachments.length === 0) return;
      const toSend = attachments;
      const reply = replyTo;
      setAttachments([]);
      setReplyTo(null);
      try {
        await enqueueMessage({
          source,
          outbox,
          room: roomRef,
          sender: { id: uid, name: viewer.username, avatar: viewer.avatarUrl },
          text,
          replyToMessage: reply,
          senderRole: membership.senderRole,
          attachments: toSend,
        });
      } catch {
        // fish: the photos and the reply come back, nothing was queued.
        setAttachments(toSend);
        setReplyTo(reply);
        toast(source.pure.CHAT_SEND_ERRORS.prepare, 'danger');
      }
    },
    [source, outbox, readOnly, editing, roomRef, attachments, replyTo, uid, viewer.username, viewer.avatarUrl, membership.senderRole, toast],
  );
  const sendGreeting = useCallback(() => void send('👋👋👋'), [send]);
  const retry = useCallback((id: string) => void outbox?.retry(id), [outbox]);
  const deleteMessage = useCallback(
    (m: chat.ChatListMessage) => {
      if (m.outbox) {
        void outbox?.discard(m.id);
        return;
      }
      if (!source) return;
      source.deleteMessage({ ...roomRef, message: m, canDeleteAnyMessage: isAuthor }).catch(() => toast(source.pure.CHAT_SEND_ERRORS.delete, 'danger'));
    },
    [outbox, source, roomRef, isAuthor, toast],
  );
  const toggleReaction = useCallback(
    (m: chat.ChatListMessage, emoji: string) => {
      if (m.pending || status.isClosed) return;
      void current.toggleReaction(m.id, emoji);
    },
    [current, status.isClosed],
  );
  const copy = useCallback(
    async (m: chat.ChatListMessage) => {
      if (!m.text) return;
      try {
        await navigator.clipboard.writeText(m.text);
        toast('Text copiat', 'success');
      } catch {
        // Clipboard refused (permissions): nothing to say.
      }
    },
    [toast],
  );

  // ── bell + mute (c9, c10) ─────────────────────────────────────────
  const receivesGeneralPushes = isFollowing === true || isAuthor;
  const showBell = activeRoom === 'general' ? receivesGeneralPushes : isMember;
  const [muteOpen, setMuteOpen] = useState(false);
  const confirmMute = useCallback(async () => {
    await prefs.toggle();
    setMuteOpen(false);
  }, [prefs]);

  // ── follow prompt (c8) ────────────────────────────────────────────
  const follow = useMutation(followCompetitionMutation(t, qc));
  const [followPanelOpen, setFollowPanelOpen] = useState(false);
  const showFollowPrompt = statuteKnown && isFollowing === false && !isAuthor && activeRoom === 'general';
  const followNow = useCallback(() => {
    if (follow.isPending) return;
    void prefetchCompetitionNotificationPreferences(qc, t, competitionId);
    follow.mutate(
      { competitionId, follow: true },
      {
        onSuccess: data => {
          if ((data as { isFollowing?: boolean } | undefined)?.isFollowing) setFollowPanelOpen(true);
        },
        onError: () => toast('Nu am putut urmări concursul.', 'danger'),
        onSettled: () => void qc.invalidateQueries({ queryKey: competitionKeys.followers(competitionId) }),
      },
    );
  }, [follow, qc, t, competitionId, toast]);

  // ── followers list (c3) ───────────────────────────────────────────
  const [followersOpen, setFollowersOpen] = useState(false);

  // ── media (c3 banner; the room gallery for the photos column) ─────
  const [media, setMedia] = useState<MediaState>(null);
  const name = competition?.name ?? facts?.name ?? null;
  const bannerLarge = competition?.banner ? (competition.banner.formats.large?.url ?? competition.banner.url) : (facts?.bannerLarge ?? null);
  const bannerThumb = competition?.banner ? (competition.banner.formats.small?.url ?? competition.banner.url) : (facts?.bannerThumb ?? null);
  const openBanner = useMemo(
    () => (bannerLarge ? () => setMedia({ items: [{ key: 'banner', src: bannerLarge, preview: bannerThumb ?? undefined, alt: name ? `Poza concursului ${name}` : 'Poza concursului' }], index: 0, label: name ?? 'Poza concursului' }) : null),
    [bannerLarge, bannerThumb, name],
  );
  const gallery = useMemo(() => buildRoomGallery(current.room.messages, uid, m => formatTime24(m.createdAt?.toDate?.())), [current.room.messages, uid]);
  const openGallery = useCallback(
    (attachmentId: string) => {
      const index = gallery.attachments.findIndex(a => a.id === attachmentId);
      if (index < 0) return;
      setMedia({
        items: gallery.attachments.map((a, i) => ({
          key: `${a.id}-${i}`,
          src: a.url,
          preview: a.thumbnailUrl,
          alt: `Poză de la ${gallery.meta[i].isMine ? `${gallery.meta[i].senderName} (eu)` : gallery.meta[i].senderName}`,
        })),
        index,
        label: 'Poze din cameră',
      });
    },
    [gallery],
  );

  // ── subtitle (c2) ─────────────────────────────────────────────────
  const viewers = competition?.viewers ?? facts?.viewers;
  const registered = competition ? competition.registrations.filter(r => r.registrationStatus === 'registered').length : facts?.registered;
  const subtitle =
    typingLabel ??
    (viewers === undefined
      ? ''
      : activeRoom === 'general'
        ? formatCount(viewers, 'urmăritor', 'urmăritori')
        : formatCount(registered ?? 0, 'participant', 'participanți'));

  const value: ChatControllerValue = {
    competitionId,
    facts,
    competition,
    competitionFailed: competitionQ.isError,
    viewer,
    source,
    membership,
    statuteKnown,
    isAuthor,
    canDeleteAnyMessage: isAuthor,
    rooms,
    activeRoom,
    selectRoom,
    bundles,
    current,
    isLocked,
    unread,
    muted: prefs.mutedRooms,
    subtitle,
    typingLabel,
    onTypingChange,
    closed: status.isClosed,
    closesAtMs: status.closesAtMs,
    readOnly,
    canWrite,
    pageVisible,
    replyTo,
    setReplyTo,
    editing,
    setEditing,
    attachments,
    setAttachments,
    send,
    sendGreeting,
    retry,
    deleteMessage,
    toggleReaction,
    copy,
    bell: { show: showBell, muted: prefs.isMuted, disabled: !prefs.isLoaded || prefs.isSaving, open: () => setMuteOpen(true) },
    muteOpen,
    closeMute: () => setMuteOpen(false),
    confirmMute,
    prefsSaving: prefs.isSaving,
    hasOtherRoom: activeRoom === 'general' ? isMember : true,
    followPrompt: { show: showFollowPrompt, pending: follow.isPending, follow: followNow },
    followPanelOpen,
    closeFollowPanel: () => setFollowPanelOpen(false),
    followersOpen,
    openFollowers: activeRoom === 'general' && !typingLabel && viewers !== undefined ? () => setFollowersOpen(true) : null,
    closeFollowers: () => setFollowersOpen(false),
    rules: { open: consent.needsAcknowledgement, saving: consent.saving, accept: () => void consent.acknowledge(), decline },
    media,
    openBanner,
    openGallery,
    closeMedia: () => setMedia(null),
    gallery,
    back,
  };
  return <Ctx value={value}>{children}</Ctx>;
}
