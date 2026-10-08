'use client';

import Link from 'next/link';
import { memo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { EllipsisHorizontalIcon, FaceSmileIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import type { chat } from '@/core/realtime';
import { formatTime24 } from '@/core/realtime/chat/format';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { anglerHref } from '@/lib/routes';
import { LinkedText } from './LinkedText';
import { PhotoGrid } from './PhotoGrid';
import { ReactionPill } from './ReactionPill';
import { bubbleShape, deletedCopy, LONG_PRESS_MS, roleLabel, TICK_LABEL, tickOf, type MessageActions, type Tick } from './model';

/*
 * fish MessageBubble (participant.chat c16–c20, c22, c23, c31): one message of a person.
 *
 *  - Groups (c16): consecutive messages of one sender within 5 minutes share their inner corners;
 *    others' first message carries the avatar (a link to /pescari/{id}) and the name, and in General
 *    the role line («Participant» / «Organizator» / «Arbitru») under it.
 *  - Mine on the right, accent (fish indigo5); others on the left, grey. Text with links (c17), the
 *    meta at its end: «(editat)», HH:mm and my ticks (✓ sent, ✓✓ delivered, ✓✓ in the read colour).
 *  - Deleted (c18): «Acest mesaj a fost șters» (… «de organizator»), italic, a ban icon, nothing else.
 *  - A reply's quote (c19) is a button: the parent scrolls to the original.
 *  - Photos (c20): PhotoGrid; edge to edge; a caption-less photo carries its meta on the picture.
 *  - The reaction pill (c22) hangs under the bubble.
 *  - Actions (c23): fish's long-press. Web: a context click or a touch held 450 ms anywhere on the
 *    bubble; and, on a device with hover, «Reacționează» + «Acțiuni mesaj» beside the bubble on hover
 *    or keyboard focus (on touch they stay out of the way until focused). On a column under 600 px
 *    they sit over the bubble's top outer corner instead, so nothing overhangs the list's edge. None when `actions.mode`
 *    is 'none' (system, pending, deleted rows, a closed chat — a failed send excepted).
 *  - A failed send (c31): «Nu s-a trimis» under my bubble, with «Reîncearcă» / «Șterge» right there
 *    (fish: «· apasă lung» to the menu; the menu offers the same two).
 */

export type MenuMode = 'full' | 'react';

type Props = {
  message: chat.ChatMessageItem;
  isMine: boolean;
  roomId: chat.ChatRoomId;
  quote?: { text: string; deleted: boolean };
  highlighted: boolean;
  actions: MessageActions;
  menuOpen: boolean;
  onQuote: (messageId: string) => void;
  onPhoto: (message: chat.ChatListMessage, index: number) => void;
  onReactions: (message: chat.ChatListMessage) => void;
  onMenu: (message: chat.ChatListMessage, anchor: HTMLElement, mode: MenuMode) => void;
  onRetry: (message: chat.ChatListMessage) => void;
  onDiscard: (message: chat.ChatListMessage) => void;
};

function MessageBubbleBase({ message, isMine, roomId, quote, highlighted, actions, menuOpen, onQuote, onPhoto, onReactions, onMenu, onRetry, onDiscard }: Props) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const shape = bubbleShape(message.groupPosition, isMine);
  const deleted = !!message.deletedAt;
  const failed = message.outbox?.status === 'failed';
  const attachments = deleted ? [] : (message.attachments ?? []);
  const hasPhotos = attachments.length > 0;
  const reactions = deleted ? [] : (message.reactions ?? []);
  const showReply = !!message.replyTo && !deleted;
  const role = shape.showName ? roleLabel(message.senderRole, roomId) : null;
  const time = formatTime24(message.createdAt?.toDate?.());
  const tick = tickOf(message, isMine);
  const canAct = actions.mode !== 'none';
  const href = isMine ? null : anglerHref(message.senderId);

  // c23: a touch held LONG_PRESS_MS opens the menu (iOS Safari has no contextmenu event on touch).
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const openMenu = (mode: MenuMode) => {
    if (bubbleRef.current) onMenu(message, bubbleRef.current, mode);
  };
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canAct || e.pointerType === 'mouse') return;
    cancelPress();
    const timer = setTimeout(() => {
      press.current = null;
      openMenu('full');
    }, LONG_PRESS_MS);
    press.current = { x: e.clientX, y: e.clientY, timer };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
  };

  const metaColor = isMine ? 'text-on-accent' : 'text-muted';
  const meta = (color: string) => <Meta edited={!!message.editedAt} time={time} tick={tick} className={color} />;

  const body = (
    <div
      ref={bubbleRef}
      data-bubble=""
      className={cn(
        'relative max-w-full overflow-hidden rounded-card',
        isMine ? 'bg-accent text-on-accent' : 'bg-soft-fill text-ink',
        message.pending && !failed && 'opacity-60',
        isMine ? cn(!shape.isFirst && 'rounded-tr-sm', !shape.isLast && 'rounded-br-sm') : cn(!shape.isFirst && 'rounded-tl-sm', !shape.isLast && 'rounded-bl-sm'),
      )}
    >
      <span aria-hidden data-highlighted={highlighted || undefined} className={cn('pointer-events-none absolute inset-0 bg-ink/25 opacity-0 transition-opacity duration-(--duration-medium)', highlighted && 'opacity-100')} />
      {shape.showName || showReply ? (
        <div className={cn('px-3 pt-2', hasPhotos && !showReply ? 'pb-1.5' : 'pb-0')}>
          {shape.showName ? (
            <div className="mb-0.5 flex flex-col items-start">
              <span className="t-label text-accent-ink">{message.senderName}</span>
              {role ? <span className="t-micro text-muted">{role}</span> : null}
            </div>
          ) : null}
          {showReply ? <ReplyQuote replyTo={message.replyTo!} quote={quote} mine={isMine} onPress={() => onQuote(message.replyTo!.messageId)} /> : null}
        </div>
      ) : null}
      {hasPhotos ? (
        <PhotoGrid
          attachments={attachments}
          uploading={!!message.pending && !failed}
          onOpen={i => onPhoto(message, i)}
          meta={message.text ? undefined : meta('text-on-photo-scrim')}
        />
      ) : null}
      {deleted ? (
        <div className={cn('flex items-end justify-end gap-1.5 px-3 pb-2', shape.showName ? 'pt-0' : 'pt-2')}>
          <span className={cn('flex min-w-0 flex-1 items-center gap-1.5 t-body italic', isMine ? 'text-on-accent' : 'text-muted')}>
            <NoSymbolIcon aria-hidden className="size-3.5 shrink-0" />
            {deletedCopy(message)}
          </span>
          {meta(metaColor)}
        </div>
      ) : message.text || !hasPhotos ? (
        <div className={cn('flex items-end gap-1.5 px-3 pb-2', hasPhotos ? 'pt-1.5' : shape.showName || showReply ? 'pt-0' : 'pt-2')}>
          {message.text ? (
            <p className="min-w-0 flex-1 t-body">
              <LinkedText text={message.text} mine={isMine} />
            </p>
          ) : (
            <span className="flex-1" />
          )}
          {meta(metaColor)}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      data-group-position={message.groupPosition}
      className={cn('group/msg flex items-end gap-2 px-3', shape.isFirst ? 'mt-2' : 'mt-0.5', reactions.length ? 'mb-2.5' : 'mb-0', isMine ? 'justify-end' : 'justify-start')}
    >
      {shape.avatar === 'avatar' ? (
        href ? (
          <Link href={href} aria-label={`Profilul lui ${message.senderName}`} className="mb-0.5 shrink-0 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent">
            <Avatar name={message.senderName} src={message.senderAvatar} size={32} tone={toneForId(message.senderId)} />
          </Link>
        ) : (
          <Avatar name={message.senderName} src={message.senderAvatar} size={32} tone={toneForId(message.senderId)} className="mb-0.5" />
        )
      ) : shape.avatar === 'spacer' ? (
        <span aria-hidden className="w-8 shrink-0" />
      ) : null}
      <div className={cn('relative flex max-w-[82%] min-w-0 flex-col md:max-w-[min(82%,560px)]', isMine ? 'items-end' : 'items-start')}>
        <span className="sr-only">{isMine ? 'Eu: ' : shape.showName ? '' : `${message.senderName}: `}</span>
        <div
          className={cn('max-w-full', canAct && 'cursor-default [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none')}
          onContextMenu={
            canAct
              ? e => {
                  e.preventDefault();
                  cancelPress();
                  openMenu('full');
                }
              : undefined
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
        >
          {body}
        </div>
        {isMine && failed ? <FailedLine onRetry={() => onRetry(message)} onDiscard={() => onDiscard(message)} /> : null}
        {reactions.length ? <ReactionPill reactions={reactions} mine={isMine} onOpen={() => onReactions(message)} /> : null}
        {canAct ? (
          <div
            data-toolbar=""
            className={cn(
              'absolute flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100',
              '[@media(hover:none)]:pointer-events-none [@media(hover:none)]:focus-within:pointer-events-auto',
              // Never past the list's edge (a phone would pan sideways): over the bubble's top outer
              // corner while the column has no room beside a wide bubble; beside it from 600 px (the
              // widest bubble + avatar + toolbar fit from ~580). The list is the @container.
              '-top-3 @min-[37.5rem]/list:top-1/2 @min-[37.5rem]/list:-translate-y-1/2',
              isMine ? 'left-0 @min-[37.5rem]/list:right-full @min-[37.5rem]/list:left-auto @min-[37.5rem]/list:mr-1.5' : 'right-0 @min-[37.5rem]/list:left-full @min-[37.5rem]/list:right-auto @min-[37.5rem]/list:ml-1.5',
              menuOpen && 'opacity-100',
            )}
          >
            {actions.mode === 'message' ? (
              <ToolbarButton label="Reacționează" tabIndex={-1} onClick={() => openMenu('react')}>
                <FaceSmileIcon className="size-5" />
              </ToolbarButton>
            ) : null}
            <ToolbarButton label="Acțiuni mesaj" expanded={menuOpen} onClick={() => openMenu('full')}>
              <EllipsisHorizontalIcon className="size-5" />
            </ToolbarButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

function ToolbarButton({ label, onClick, children, tabIndex, expanded }: { label: string; onClick: () => void; children: ReactNode; tabIndex?: number; expanded?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded}
      tabIndex={tabIndex}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-surface text-ink-2 shadow-e1 ring-1 ring-hairline outline-none hover:bg-soft-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

/** «(editat) · HH:mm · ✓✓» — the trailing meta of every bubble (c17). */
function Meta({ edited, time, tick, className }: { edited: boolean; time: string; tick: Tick | null; className: string }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-1 pb-px t-micro', className)}>
      {edited ? <span>(editat)</span> : null}
      <span>{time}</span>
      {tick ? <Ticks tick={tick} /> : null}
    </span>
  );
}

/** ✓ (sent) / ✓✓ (delivered) / ✓✓ in the read colour — lucide Check / CheckCheck, drawn inline. */
function Ticks({ tick }: { tick: Tick }) {
  return (
    <span data-tick={tick} className={cn('inline-flex', tick === 'read' && 'text-receipt-read')}>
      <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {tick === 'sent' ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <path d="M18 6 7 17l-5-5" />
            <path d="m22 10-7.5 7.5L13 16" />
          </>
        )}
      </svg>
      <span className="sr-only">{TICK_LABEL[tick]}</span>
    </span>
  );
}

/** c19: the quoted original — its sender and current text; a button that jumps to it. */
function ReplyQuote({ replyTo, quote, mine, onPress }: { replyTo: chat.ChatReplyTo; quote?: { text: string; deleted: boolean }; mine: boolean; onPress: () => void }) {
  const q = quote ?? { text: replyTo.text || (replyTo.hasAttachments ? 'Imagine' : 'Mesaj'), deleted: false };
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onPress();
      }}
      aria-label={`Răspuns la ${replyTo.senderName}: ${q.text}. Mergi la mesaj`}
      className={cn(
        'mb-2 flex w-full min-w-40 cursor-pointer flex-col items-start rounded-md border-l-3 p-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid',
        mine ? 'border-on-accent bg-on-accent/15 hover:bg-on-accent/25 focus-visible:outline-on-accent' : 'border-accent bg-surface/70 hover:bg-surface focus-visible:outline-accent',
      )}
    >
      <span className={cn('max-w-full truncate t-label', mine ? 'text-on-accent' : 'text-accent-ink')}>{replyTo.senderName}</span>
      <span className={cn('line-clamp-2 t-caption', q.deleted && 'italic', mine ? 'text-on-accent' : q.deleted ? 'text-muted' : 'text-ink-2')}>{q.text}</span>
    </button>
  );
}

/** c31: my failed send — «Nu s-a trimis», and the two ways out (the delete asks once more). */
function FailedLine({ onRetry, onDiscard }: { onRetry: () => void; onDiscard: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const btn = 'cursor-pointer rounded-sm font-bold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-accent';
  return (
    <p className="mt-0.5 flex items-center gap-1.5 self-end t-caption text-status-danger-fg">
      <span>Nu s-a trimis</span>
      <span aria-hidden>·</span>
      <button type="button" onClick={onRetry} className={btn}>
        Reîncearcă
      </button>
      <span aria-hidden>·</span>
      <button type="button" onClick={() => (confirm ? onDiscard() : setConfirm(true))} className={btn}>
        {confirm ? 'Sigur? Șterge' : 'Șterge'}
      </button>
    </p>
  );
}
