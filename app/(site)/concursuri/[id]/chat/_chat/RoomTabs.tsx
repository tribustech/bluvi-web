'use client';

import type { KeyboardEvent } from 'react';
import { BellSlashIcon, ChatBubbleLeftRightIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { countLabel, CountBadge } from '@/components/templates/T5/CountBadge';
import { cn } from '@/components/ui/cn';
import type { RoomId } from '../_live/source';
import { useChat } from './ChatController';

/*
 * fish ChatTabs (participant.chat.c4, c6, c7) on owner rule 20 (switchers look like tabs): one
 * track with a visible edge (surface, handle-grey border, e1 — the ranking views' control), the
 * selected room filled accent-ink with on-accent text, hover and focus states, the unread count as a
 * badge (T5 CountBadge, «99+»), a red crossed bell on a muted room. WAI-ARIA tabs: each tab controls
 * the conversation panel, only the selected one is in the Tab order, arrows / Home / End move.
 * Accessible names as fish: «General, notificări oprite, 3 mesaje noi».
 *
 * Members only (Participanți | General, in that order); a follower has one room and no switcher.
 * `vertical`: the ≥1280 left column's list of rooms (icon, name, bell, badge).
 */

export const ROOM_TITLES: Record<RoomId, string> = { general: 'General', participants: 'Participanți' };
export const ROOM_PANEL_ID = 'chat-camera';
const tabId = (orientation: string, room: RoomId) => `chat-tab-${orientation}-${room}`;
const ICON: Record<RoomId, typeof UserGroupIcon> = { participants: UserGroupIcon, general: ChatBubbleLeftRightIcon };

const FOCUS_RING = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/** c7: «General, notificări oprite, 3 mesaje noi». */
export function roomAccessibleName(room: RoomId, muted: boolean, unread: number, selected: boolean): string {
  const count = countLabel(unread);
  return [ROOM_TITLES[room], muted ? 'notificări oprite' : null, !selected && count ? `${count} mesaje noi` : null].filter(Boolean).join(', ');
}

export function RoomTabs({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical'; className?: string }) {
  const c = useChat();
  if (c.rooms.length < 2) return null;
  const vertical = orientation === 'vertical';

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = c.rooms.indexOf(c.activeRoom);
    const last = c.rooms.length - 1;
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    const backward = vertical ? 'ArrowUp' : 'ArrowLeft';
    const next = { [forward]: i === last ? 0 : i + 1, [backward]: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const room = c.rooms[next];
    c.selectRoom(room);
    document.getElementById(tabId(orientation, room))?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Camere de chat"
      aria-orientation={orientation}
      className={cn(
        'rounded-card border border-handle bg-surface p-1 shadow-e1',
        vertical ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-1',
        className,
      )}
    >
      {c.rooms.map(room => {
        const selected = room === c.activeRoom;
        const muted = c.muted[room];
        const unread = selected ? 0 : c.unread[room];
        const Icon = ICON[room];
        return (
          <button
            key={room}
            id={tabId(orientation, room)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={ROOM_PANEL_ID}
            aria-label={roomAccessibleName(room, muted, c.unread[room], selected)}
            tabIndex={selected ? 0 : -1}
            onClick={() => c.selectRoom(room)}
            onKeyDown={onKey}
            className={cn(
              'flex min-w-0 cursor-pointer items-center gap-2 rounded-[calc(var(--radius-card)-4px)] transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select active:opacity-80',
              FOCUS_RING,
              vertical ? 'min-h-12 px-3 py-2' : 'min-h-10 justify-center px-2 py-1.5',
              selected ? 'bg-accent-ink text-on-accent shadow-e1' : 'text-ink hover:bg-accent-tint hover:text-accent-ink',
            )}
          >
            {vertical ? <Icon aria-hidden className={cn('size-5 shrink-0', !selected && 'text-accent-ink')} /> : null}
            <span className={cn('truncate', selected ? 't-body-strong' : 't-body', vertical && 'flex-1 text-left')}>{ROOM_TITLES[room]}</span>
            {muted ? (
              <span
                aria-hidden
                className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', selected ? 'bg-surface text-status-danger-fg' : 'text-status-danger-fg')}
              >
                <BellSlashIcon className="size-3.5 stroke-[2.4]" />
              </span>
            ) : null}
            <CountBadge count={unread} />
          </button>
        );
      })}
    </div>
  );
}
