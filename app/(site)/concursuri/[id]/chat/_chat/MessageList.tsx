'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { chat } from '@/core/realtime';
import { allocatedParticipantsQuery } from '@/core/organizer';
import { shouldShowConversationStart, splitHiddenNewest } from '@/core/realtime/chat/domain';
import { formatDayLabel, formatTime24 } from '@/core/realtime/chat/format';
import {
  buildChatListItems,
  collapseSystemRuns,
  isDateSeparatorItem,
  isNewMessagesSeparatorItem,
  isSystemGroupItem,
  latestLeaderMessageId,
} from '@/core/realtime/chat/listItems';
import { cn } from '@/components/ui/cn';
import { pageTransport } from '../../_components/transport';
import { isNationalType } from '../../_components/stand';
import { WeighingDetail, type WeighingDetailTarget } from '../../_components/WeighingDetail';
import { useChat } from './ChatController';
import { ROOM_PANEL_ID } from './RoomTabs';
import { BubbleSkeleton } from './list/BubbleSkeleton';
import { ConversationStart } from './list/ConversationStart';
import { DateChip, NewMessagesDivider } from './list/DateChip';
import { EmptyRoom } from './list/EmptyRoom';
import { LeaderCard } from './list/LeaderCard';
import { MediaViewer, type ViewerPhoto } from './list/MediaViewer';
import { MessageActionsMenu } from './list/MessageActions';
import { MessageBubble, type MenuMode } from './list/MessageBubble';
import {
  actionsFor,
  FLOATING_CHIP_LINGER_MS,
  HIGHLIGHT_MS,
  messagesForRoom,
  nextHiddenAnchor,
  originalsById,
  readTarget,
  replyQuoteText,
  SCROLL_TO_END_THRESHOLD,
  shouldLoadOlder,
  type OpenWeighingTarget,
} from './list/model';
import { ReactionsDialog } from './list/ReactionsDialog';
import { ScrollToEnd } from './list/ScrollToEnd';
import { SystemGroupRow } from './list/SystemGroupRow';
import { SystemMessageRow } from './list/SystemMessageRow';
import { useVisibilityReceipts } from './list/useVisibilityReceipts';

/*
 * The conversation (participant.chat slice 2, c12–c24, c27, c31's failed line, c33–c39; fish
 * features/chat/components/MessageList.tsx and the overlays ChatScreen hosts). It talks to the page
 * only through the controller (useChat): the room on screen, markRead, send, reactions, delete,
 * reply / edit state; it never opens Firestore. Keyed by room: a switch starts the room fresh (its
 * folded groups fold again, fish), the controller keeps the data.
 *
 * Scrolling: the scroller is `flex-col-reverse`, so its natural rest is the end — a new message at
 * the end stays in view with no measuring, and an older page prepended at the top never moves what
 * the reader is looking at. Its distance from the end is |scrollTop|.
 *  - c12: the next older page is asked for 1.5 screens before the top; the whole history loaded,
 *    «Acesta este începutul conversației.» and who reads the room.
 *  - c34: the «Mesaje noi» divider (core buildChatListItems, the receipt frozen at open) is brought
 *    into view once, unless the reader already scrolled.
 *  - c35: more than 120 px from the end, others' new messages are held back (core splitHiddenNewest
 *    from the newest shown) and the round button counts them; it, or scrolling back to the end, shows
 *    them; my own send always brings the list to the end.
 *  - c15: while scrolling, the day of the topmost row floats at the top (not over a real separator).
 *  - c33: rows ≥ 50% visible for 250 ms advance my receipt (useVisibilityReceipts), only while the
 *    page is visible.
 *  - c19: a quote jumps to its original (the controller pages back as needed) and flashes it.
 */

export function MessageList({ className }: { className?: string }) {
  const c = useChat();
  return <RoomList key={`${c.competitionId}:${c.activeRoom}`} className={className} />;
}

type MenuState = { id: string; anchor: HTMLElement | null; mode: MenuMode } | null;
type ViewerState = { photos: ViewerPhoto[]; index: number } | null;

const dayOf = (m: chat.ChatListMessage) => formatDayLabel(m.createdAt?.toDate?.());

function RoomList({ className }: { className?: string }) {
  const c = useChat();
  const { room, unreadAfter, markRead } = c.current;
  const roomId = c.activeRoom;
  const uid = c.viewer.documentId;
  const all = room.messages;
  // c36: competition events live in General (older CMS builds posted them to Participanți too).
  const messages = useMemo(() => messagesForRoom(all, roomId), [all, roomId]);
  const byId = useMemo(() => new Map(all.map(m => [m.id, m])), [all]);
  const newest = messages[0];
  const newestId = newest?.id;
  const newestMine = !!newest && newest.senderId === uid;

  // ── c35: hold others' new messages while the reader is up the history ──
  const [far, setFar] = useState(false);
  const [hold, setHold] = useState<{ newestId: string | undefined; anchor: string | null }>({ newestId, anchor: null });
  let anchor = hold.anchor;
  if (hold.newestId !== newestId) {
    anchor = nextHiddenAnchor({ anchor: hold.anchor, previousNewestId: hold.newestId, newestId, newestIsMine: newestMine, farFromEnd: far });
    setHold({ newestId, anchor });
  }
  const { visible, hiddenCount } = useMemo(() => splitHiddenNewest(messages, anchor), [messages, anchor]);
  const reveal = useCallback(() => setHold(h => (h.anchor ? { ...h, anchor: null } : h)), []);

  // ── rows ──
  const chronological = useMemo(() => [...visible].reverse(), [visible]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = useCallback(
    (id: string) =>
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const leaderId = useMemo(() => latestLeaderMessageId(chronological), [chronological]);
  const unreadAfterMs = unreadAfter?.toMillis?.() ?? 0;
  const items = useMemo(
    () => collapseSystemRuns(buildChatListItems(chronological, { unreadAfterMs, unreadBoundaryLoaded: room.unreadBoundaryLoaded, currentUserId: uid }), expanded, leaderId),
    [chronological, unreadAfterMs, room.unreadBoundaryLoaded, uid, expanded, leaderId],
  );
  const originals = useMemo(() => originalsById(messages), [messages]);

  // ── scrolling ──
  const scroller = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);
  const markUserScroll = () => {
    userScrolled.current = true;
  };
  const [floating, setFloating] = useState<{ label: string; on: boolean }>({ label: '', on: false });
  const floatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef(0);
  const { hasMore, isLoadingMore, loadMore } = room;

  const checkOlder = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const fromEnd = Math.abs(el.scrollTop);
    const toTop = el.scrollHeight - el.clientHeight - fromEnd;
    if (shouldLoadOlder({ distanceToTop: toTop, viewport: el.clientHeight, hasMore, isLoadingMore })) void loadMore();
  }, [hasMore, isLoadingMore, loadMore]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isFar = Math.abs(el.scrollTop) > SCROLL_TO_END_THRESHOLD;
    setFar(isFar);
    if (!isFar) reveal();
    checkOlder();
    // c15: the day of the topmost row, while the reader scrolls (read once per frame; the list's own
    // moves — the divider at open, a reply jump — do not flash it).
    if (!userScrolled.current) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (el.scrollHeight <= el.clientHeight) return;
      const top = el.getBoundingClientRect().top + 4;
      const rows = el.querySelectorAll<HTMLElement>('[data-day]');
      let row: HTMLElement | null = null;
      for (const r of rows) {
        if (r.getBoundingClientRect().bottom > top) {
          row = r;
          break;
        }
      }
      if (!row) return;
      const label = row.dataset.day ?? '';
      const onSeparator = row.dataset.sep !== undefined && row.getBoundingClientRect().top >= top - 8;
      setFloating({ label, on: !onSeparator });
      if (floatTimer.current) clearTimeout(floatTimer.current);
      floatTimer.current = setTimeout(() => setFloating(f => ({ ...f, on: false })), FLOATING_CHIP_LINGER_MS);
    });
  };
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      if (floatTimer.current) clearTimeout(floatTimer.current);
    },
    [],
  );

  // A short first page (or a tall screen): keep paging until the top is far enough.
  useEffect(() => {
    checkOlder();
  }, [checkOlder, messages.length]);

  const toEnd = useCallback((smooth: boolean) => {
    scroller.current?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  // The round button: show the held rows first, then go to the end once they are drawn.
  const [endRequest, setEndRequest] = useState(0);
  useEffect(() => {
    if (endRequest) toEnd(true);
  }, [endRequest, toEnd]);
  // c35: my own send always brings the list to the end — at once (fish pins it), and again a frame
  // later, once the composer has shrunk back and the bubble has its final height.
  useEffect(() => {
    if (!newestMine) return;
    toEnd(false);
    const id = requestAnimationFrame(() => toEnd(false));
    return () => cancelAnimationFrame(id);
  }, [newestId, newestMine, toEnd]);

  /** Centres a row in the scroller (never scrolls the page). */
  const centre = useCallback((row: Element, at = 0.5) => {
    const el = scroller.current;
    if (!el) return;
    const a = el.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    el.scrollTop += b.top + b.height / 2 - (a.top + a.height * at);
  }, []);

  // c34: bring the «Mesaje noi» divider into view once (per frozen boundary), unless the reader scrolled.
  const dividerDone = useRef<number | null>(null);
  const hasDivider = items.some(isNewMessagesSeparatorItem);
  useEffect(() => {
    if (!hasDivider || dividerDone.current === unreadAfterMs) return;
    dividerDone.current = unreadAfterMs;
    if (userScrolled.current) return;
    const row = scroller.current?.querySelector('[data-divider]');
    if (row) centre(row, 0.45);
  }, [hasDivider, unreadAfterMs, centre]);

  // c19: the reply jump — the controller loaded the original (older pages as needed); centre it, flash it.
  const [highlight, setHighlight] = useState<string | null>(null);
  const flash = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => flash.current.forEach(clearTimeout), []);
  const { scrollToMessageId, onScrollToMessageHandled, jumpToMessage } = room;
  useEffect(() => {
    if (!scrollToMessageId) return;
    const row = scroller.current?.querySelector(`[data-message-id="${CSS.escape(scrollToMessageId)}"]`);
    if (!row) return;
    centre(row);
    // Handled at once (the hook clears the request); the flash outlives that re-render.
    flash.current.forEach(clearTimeout);
    flash.current = [
      setTimeout(() => setHighlight(scrollToMessageId), 120),
      setTimeout(() => setHighlight(h => (h === scrollToMessageId ? null : h)), 120 + HIGHLIGHT_MS),
    ];
    onScrollToMessageHandled();
  }, [scrollToMessageId, items, centre, onScrollToMessageHandled]);
  const onQuote = useCallback(
    (messageId: string) => {
      // The original among the held-back newest: show them first.
      if (anchor && !visible.some(m => m.id === messageId) && messages.some(m => m.id === messageId)) reveal();
      void jumpToMessage(messageId);
    },
    [anchor, visible, messages, reveal, jumpToMessage],
  );

  // ── c33: read receipts for what the reader actually sees ──
  const newestOfRoom = all[0];
  const onSeen = useCallback(
    (ids: string[]) => {
      const seen = ids.map(id => byId.get(id)).filter((m): m is chat.ChatListMessage => !!m);
      const target = readTarget(seen, newestId, newestOfRoom);
      if (target) markRead(target);
    },
    [byId, newestId, newestOfRoom, markRead],
  );
  useVisibilityReceipts(scroller, { active: c.pageVisible, onSeen, deps: items });

  // ── overlays ──
  const [menu, setMenu] = useState<MenuState>(null);
  const [reactionsOf, setReactionsOf] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState>(null);
  const [weighing, setWeighing] = useState<WeighingDetailTarget | null>(null);
  const t = useMemo(() => pageTransport(), []);
  const allocated = useQuery({ ...allocatedParticipantsQuery(t, weighing ? c.competitionId : ''), enabled: !!weighing });

  const actionCtx = { currentUserId: uid, canDeleteAnyMessage: c.canDeleteAnyMessage, closed: c.closed };
  const onMenu = useCallback((m: chat.ChatListMessage, anchorEl: HTMLElement, mode: MenuMode) => setMenu({ id: m.id, anchor: anchorEl, mode }), []);
  const onReactions = useCallback((m: chat.ChatListMessage) => setReactionsOf(m.id), []);
  const { retry, deleteMessage, gallery } = c;
  const onRetry = useCallback((m: chat.ChatListMessage) => retry(m.id), [retry]);
  const onPhoto = useCallback(
    (m: chat.ChatListMessage, i: number) => {
      const tapped = m.attachments?.[i];
      const at = tapped ? gallery.attachments.findIndex(a => a.id === tapped.id) : -1;
      if (at >= 0) {
        setViewer({ photos: gallery.attachments.map((attachment, k) => ({ attachment, ...gallery.meta[k] })), index: at });
        return;
      }
      // A photo still uploading is not in the room's gallery: its own message's photos, at its time
      // (fish ChatScreen: formatTime24(message.createdAt)).
      const sentAt = formatTime24(m.createdAt?.toDate?.());
      setViewer({ photos: (m.attachments ?? []).map(attachment => ({ attachment, senderName: m.senderName, isMine: m.senderId === uid, sentAt })), index: i });
    },
    [gallery, uid],
  );
  const onWeighing = useCallback(
    (w: OpenWeighingTarget) => setWeighing({ competitionId: c.competitionId, weighingId: w.weighingId, standId: w.standId, standName: w.standName, sectorName: w.sectorName, fromLink: true }),
    [c.competitionId],
  );

  const menuMessage = menu ? byId.get(menu.id) : undefined;
  const menuActions = menuMessage ? actionsFor(menuMessage, actionCtx) : null;
  const closeMenu = () => setMenu(null);
  const focusComposer = () => requestAnimationFrame(() => document.getElementById('chat-mesaj')?.focus());

  const isLoading = room.isLoading;
  const empty = !isLoading && messages.length === 0;
  const showStart = shouldShowConversationStart({ messageCount: messages.length, hasMore, isLoading });

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <div
        ref={scroller}
        id={ROOM_PANEL_ID}
        role="tabpanel"
        aria-label={roomId === 'general' ? 'Mesaje, General' : 'Mesaje, Participanți'}
        aria-busy={isLoading || undefined}
        tabIndex={0}
        onScroll={onScroll}
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        onPointerDown={e => {
          // The scrollbar dragged with the mouse.
          if (e.target === e.currentTarget) markUserScroll();
        }}
        onKeyDown={e => {
          if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) markUserScroll();
        }}
        className="@container/list flex min-h-0 flex-1 flex-col-reverse overflow-x-clip overflow-y-auto overscroll-contain outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        {isLoading ? (
          <BubbleSkeleton />
        ) : empty ? (
          <EmptyRoom roomId={roomId} canSend={c.canWrite} onGreet={c.sendGreeting} />
        ) : (
          <div className="mx-auto flex w-full max-w-180 flex-col py-2.5 xl:max-w-none">
            {showStart ? <ConversationStart roomId={roomId} /> : null}
            {isLoadingMore ? (
              <p role="status" className="flex items-center justify-center gap-2 py-2 t-caption text-muted">
                <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-hairline border-t-accent" />
                Se încarcă mesajele mai vechi…
              </p>
            ) : null}
            <div role="log" aria-label="Mesaje" aria-relevant="additions">
              <ol className="flex flex-col">
                {items.map(item => {
                  if (isDateSeparatorItem(item)) {
                    return (
                      <li key={item.id} data-day={item.label} data-sep="" className="flex justify-center py-1.5">
                        <DateChip label={item.label} />
                      </li>
                    );
                  }
                  if (isNewMessagesSeparatorItem(item)) {
                    return (
                      <li key={item.id} data-divider="">
                        <NewMessagesDivider />
                      </li>
                    );
                  }
                  if (isSystemGroupItem(item)) {
                    return (
                      <li key={item.id} data-day={dayOf(item.messages[0])} data-read-ids={item.messages.map(m => m.id).join(',')}>
                        <SystemGroupRow item={item} competitionId={c.competitionId} onToggle={toggleGroup} onWeighing={onWeighing} />
                      </li>
                    );
                  }
                  if (item.type === 'system') {
                    return (
                      <li key={item.id} data-message-id={item.id} data-day={dayOf(item)} data-read-ids={item.id}>
                        {item.id === leaderId ? (
                          <LeaderCard message={item} competitionId={c.competitionId} />
                        ) : (
                          <SystemMessageRow message={item} competitionId={c.competitionId} onWeighing={onWeighing} />
                        )}
                      </li>
                    );
                  }
                  const mine = item.senderId === uid;
                  const original = item.replyTo ? originals.get(item.replyTo.messageId) : undefined;
                  return (
                    <li key={item.id} data-message-id={item.id} data-day={dayOf(item)} data-read-ids={item.pending ? '' : item.id}>
                      <MessageBubble
                        message={item}
                        isMine={mine}
                        roomId={roomId}
                        quote={item.replyTo ? replyQuoteText(item.replyTo, original) : undefined}
                        highlighted={highlight === item.id}
                        actions={actionsFor(item, actionCtx)}
                        menuOpen={menu?.id === item.id}
                        onQuote={onQuote}
                        onPhoto={onPhoto}
                        onReactions={onReactions}
                        onMenu={onMenu}
                        onRetry={onRetry}
                        onDiscard={deleteMessage}
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </div>

      {floating.label && !isLoading && !empty ? (
        <div aria-hidden data-testid="chat-floating-day" data-on={floating.on || undefined} className={cn('pointer-events-none absolute inset-x-0 top-1.5 flex justify-center transition-opacity duration-(--duration-fast)', floating.on ? 'opacity-100' : 'opacity-0')}>
          <DateChip label={floating.label} floating />
        </div>
      ) : null}
      {far && !isLoading && !empty ? (
        <ScrollToEnd
          hidden={hiddenCount}
          onClick={() => {
            reveal();
            setEndRequest(n => n + 1);
          }}
        />
      ) : null}

      {menu && menuMessage && menuActions && menuActions.mode !== 'none' ? (
        <MessageActionsMenu
          key={menu.id}
          message={menuMessage}
          actions={menuActions}
          mode={menu.mode}
          anchor={menu.anchor}
          isMine={menuMessage.senderId === uid}
          onClose={closeMenu}
          handlers={{
            react: emoji => {
              c.toggleReaction(menuMessage, emoji);
              closeMenu();
            },
            reply: () => {
              c.setEditing(null);
              c.setReplyTo(menuMessage);
              closeMenu();
              focusComposer();
            },
            copy: () => {
              void c.copy(menuMessage);
              closeMenu();
            },
            edit: () => {
              c.setReplyTo(null);
              c.setAttachments([]);
              c.setEditing(menuMessage);
              closeMenu();
              focusComposer();
            },
            remove: () => {
              c.deleteMessage(menuMessage);
              closeMenu();
            },
            retry: () => {
              c.retry(menuMessage.id);
              closeMenu();
            },
          }}
        />
      ) : null}
      <ReactionsDialog open={!!reactionsOf} reactions={(reactionsOf && byId.get(reactionsOf)?.reactions) || []} currentUserId={uid} onClose={() => setReactionsOf(null)} />
      {viewer ? <MediaViewer photos={viewer.photos} index={viewer.index} onClose={() => setViewer(null)} /> : null}
      <WeighingDetail
        key={weighing?.weighingId ?? 'none'}
        t={t}
        target={weighing}
        allocated={allocated.data}
        isNc={isNationalType(c.competition?.rankingType)}
        decimals={3}
        onClose={() => setWeighing(null)}
      />
    </div>
  );
}
