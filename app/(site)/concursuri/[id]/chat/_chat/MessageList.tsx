'use client';

import { useEffect, useRef } from 'react';
import type { chat } from '@/core/realtime';
import { formatTime24 } from '@/core/realtime/chat/format';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { useChat } from './ChatController';

/*
 * STUB — slice 2 («list») replaces this file wholesale with fish MessageList / MessageBubble
 * (participant.chat.c12–c25, c32–c39: groups, day chips, replies, photos, reactions, actions,
 * system cards, the «Mesaje noi» divider, the scroll-to-end pill). Contract with the frame:
 *  - render `useChat().current.room` (newest first in `messages`), inside the scroll container this
 *    component owns (it fills its parent: `min-h-0 flex-1`);
 *  - call `current.markRead(message)` for what the reader actually sees, only while
 *    `useChat().pageVisible` (c33);
 *  - failed outbox rows offer `retry(id)` / `deleteMessage(m)` (c31).
 * Until then: a plain, readable conversation so the frame and the send pipeline can be used.
 */

function timeOf(m: chat.ChatListMessage) {
  return formatTime24(m.createdAt?.toDate?.());
}

export function MessageList({ className }: { className?: string }) {
  const c = useChat();
  const { room, markRead } = c.current;
  const ordered = room.messages.slice().reverse();
  const listRef = useRef<HTMLDivElement>(null);
  const newestId = room.messages[0]?.id;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newestId, c.activeRoom]);
  useEffect(() => {
    const newest = room.messages.find(m => !m.pending);
    if (c.pageVisible && newest) markRead(newest);
  }, [newestId, c.pageVisible, markRead, room.messages]);

  return (
    <div
      ref={listRef}
      id="chat-camera"
      role="tabpanel"
      aria-label={c.activeRoom === 'general' ? 'Mesaje, General' : 'Mesaje, Participanți'}
      tabIndex={0}
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent', className)}
    >
      {room.isLoading ? (
        <div role="status" aria-label="Se încarcă mesajele" className="mx-auto flex max-w-160 flex-col gap-3">
          {[60, 40, 72, 52, 36].map((w, i) => (
            <span key={i} aria-hidden className={cn('block h-10 animate-shimmer rounded-card', i % 2 ? 'self-end' : 'self-start')} style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
          <p className="t-body-strong text-ink">Niciun mesaj încă</p>
          <p className="t-caption text-muted">
            {c.activeRoom === 'general' ? 'Fii primul care le scrie urmăritorilor concursului.' : 'Fii primul care scrie participanților.'}
          </p>
        </div>
      ) : (
        <ol aria-label="Mesaje" className="mx-auto flex min-h-full max-w-160 flex-col justify-end gap-2">
          {ordered.map(m => {
            if (m.type === 'system') {
              return (
                <li key={m.id} className="self-center rounded-full bg-soft-fill px-3 py-1 text-center t-caption text-ink-2">
                  {m.text}
                </li>
              );
            }
            const mine = m.senderId === c.viewer.documentId;
            const failed = m.outbox?.status === 'failed';
            return (
              <li key={m.id} data-message-id={m.id} className={cn('flex max-w-[85%] items-end gap-2', mine ? 'self-end' : 'self-start')}>
                {mine ? null : <Avatar name={m.senderName} src={m.senderAvatar} size={32} />}
                <div className={cn('flex min-w-0 flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className={cn('rounded-card px-3 py-2', mine ? 'bg-accent text-on-accent' : 'bg-soft-fill text-ink', m.pending && !failed && 'opacity-60')}>
                    {mine ? null : <p className="t-label text-accent-ink">{m.senderName}</p>}
                    <p className={cn('t-body break-words whitespace-pre-wrap', m.deletedAt && 'italic opacity-80')}>
                      {m.deletedAt ? 'Acest mesaj a fost șters' : m.text}
                    </p>
                    <p className={cn('mt-0.5 text-right t-micro', mine ? 'text-on-accent' : 'text-muted')}>{timeOf(m)}</p>
                  </div>
                  {failed ? (
                    <div className="mt-1 flex items-center gap-2 t-caption text-status-danger-fg">
                      <span>Nu s-a trimis</span>
                      <button type="button" onClick={() => c.retry(m.id)} className="cursor-pointer rounded-sm underline">
                        Reîncearcă
                      </button>
                      <button type="button" onClick={() => c.deleteMessage(m)} className="cursor-pointer rounded-sm underline">
                        Șterge
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
