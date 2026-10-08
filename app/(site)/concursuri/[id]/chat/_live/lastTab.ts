import type { RoomId } from './source';

/*
 * fish features/chat/domain/lastTab.ts: the room left open last time in this competition's chat,
 * per competition (key `chat:lastTab:{competitionId}`; fish AsyncStorage → web localStorage). The
 * competition page's chat entry opens it (participant.b.chat-entry), the chat writes it on every
 * room change once the room is readable (participant.chat.c6). Storage blocked → nothing.
 */

const key = (competitionId: string) => `chat:lastTab:${competitionId}`;

export function getLastChatTab(competitionId: string): RoomId | null {
  try {
    const value = window.localStorage.getItem(key(competitionId));
    return value === 'general' || value === 'participants' ? value : null;
  } catch {
    return null;
  }
}

export function setLastChatTab(competitionId: string, tab: RoomId): void {
  try {
    window.localStorage.setItem(key(competitionId), tab);
  } catch {
    // Private mode / quota: the next visit picks the room by the usual rule.
  }
}

/** The URL's `tab` (fish `participants` | `general`; web `participanti`) → the room, else null. */
export function roomFromParam(value: string | null | undefined): RoomId | null {
  if (value === 'participanti' || value === 'participants') return 'participants';
  if (value === 'general') return 'general';
  return null;
}

/** The room → the URL's `tab` value. */
export const tabParamOf = (room: RoomId): 'general' | 'participanti' => (room === 'participants' ? 'participanti' : 'general');

/** sessionStorage: set by the competition page's chat links (the chat was opened from there; c41 fallback). */
export const CHAT_FROM_KEY = 'chat:from';
