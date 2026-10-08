import type { RoomId } from './source';

/*
 * fish features/chat/activeChatRoom.ts (participant.b.chat-open-room-push): the room on screen,
 * while the chat page is visible. fish suppresses that room's own foreground pushes; the web has
 * no in-app push toast, and anything that ever raises one (a notification toaster, a badge pulse)
 * asks `isActiveChatRoom` first and stays quiet for the room the reader is looking at.
 */

let active: { competitionId: string; roomId: RoomId } | null = null;

export function setActiveChatRoom(room: { competitionId: string; roomId: RoomId } | null): void {
  active = room;
}

/** A CHAT_MESSAGE for this competition and room (fish `tab` | `chatRoom`, default general) is on screen. */
export function isActiveChatRoom(competitionId: string, room: string | null | undefined): boolean {
  if (!active || active.competitionId !== competitionId) return false;
  return active.roomId === (room === 'participants' || room === 'participanti' ? 'participants' : 'general');
}
