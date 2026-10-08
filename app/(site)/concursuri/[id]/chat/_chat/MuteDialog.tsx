'use client';

import { BellIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { CHAT_ROOM_LABELS } from '../_live/hooks';
import type { RoomId } from '../_live/source';
import { useChat } from './ChatController';

/*
 * fish MuteSheet (participant.chat.c9–c10): the bell's confirmation, naming the room it applies to
 * and the one it leaves alone (the mute is per room). Phone: a sheet sized to its content; from 768
 * a dialog. «Oprește» / «Pornește» toggles the room's key in the competition's notification
 * preferences (busy while saving); the toast says what happened.
 */

const OTHER_ROOM: Record<RoomId, RoomId> = { general: 'participants', participants: 'general' };

export function muteCopy(roomId: RoomId, isMuted: boolean, hasOtherRoom: boolean) {
  const room = CHAT_ROOM_LABELS[roomId];
  return {
    title: isMuted ? 'Pornește notificările' : 'Oprește notificările',
    room,
    body: isMuted
      ? `Vei primi din nou notificări pentru mesajele noi din ${room}.`
      : hasOtherRoom
        ? `Ceilalți nu văd asta. Primești în continuare notificări pentru ${CHAT_ROOM_LABELS[OTHER_ROOM[roomId]]}.`
        : 'Ceilalți nu văd asta.',
    action: isMuted ? 'Pornește' : 'Oprește',
  };
}

export function MuteDialog() {
  const c = useChat();
  const copy = muteCopy(c.activeRoom, c.bell.muted, c.hasOtherRoom);
  return (
    <ResponsiveSurface
      open={c.muteOpen}
      onClose={c.closeMute}
      intent="info"
      title={copy.title}
      sheetSnap="fit"
      actions={
        <Button
          block
          aria-busy={c.prefsSaving || undefined}
          aria-disabled={c.prefsSaving || undefined}
          onClick={() => !c.prefsSaving && void c.confirmMute()}
          className={c.prefsSaving ? 'cursor-progress opacity-70' : undefined}
        >
          {c.prefsSaving ? 'Se salvează…' : copy.action}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
          {c.bell.muted ? <BellIcon className="size-7" /> : <BellSlashIcon className="size-7" />}
        </span>
        <span className="inline-flex h-6.5 items-center rounded-full bg-accent-tint px-3 t-label text-accent-ink">{copy.room}</span>
        <p className="t-body text-ink-2">{copy.body}</p>
      </div>
    </ResponsiveSurface>
  );
}
