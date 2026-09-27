/**
 * fish `features/chat/hooks/useChatTyping.ts` without React. Typing indicator: writes this user's
 * "is typing" state (debounced + auto-cleared) and subscribes to the room's typing docs to build
 * the "X scrie..." label.
 */
import { collection, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import type { RealtimeContext } from '../firebase';
import { chatTypingPath, chatTypingUserPath } from './paths';
import type { ChatRoomId } from './types';

export const TYPING_STALE_MS = 8000;
export const TYPING_IDLE_MS = 5000;
/** Once "X scrie..." is on screen it stays at least this long, so a quick write-delete on the other
 * side is one calm appearance, not a row flipping in and out over the list. */
export const TYPING_MIN_VISIBLE_MS = 1500;
/** Minimum gap between two "typing: true" writes. */
const TYPING_WRITE_THROTTLE_MS = 2500;

type RoomArgs = { competitionId: string; roomId: ChatRoomId };
type TypingDoc = { userId?: string; userName?: string; isTyping?: boolean; updatedAt?: Timestamp };

export async function writeTypingState(
  ctx: RealtimeContext,
  { competitionId, roomId, userName, isLocked }: RoomArgs & { userName?: string; isLocked: boolean },
  isTyping: boolean
): Promise<void> {
  const firebaseUserId = ctx.auth.currentUser?.uid;
  if (!competitionId || !userName || !firebaseUserId || isLocked) return;

  await setDoc(
    doc(ctx.chatDb, chatTypingUserPath(competitionId, roomId, firebaseUserId)),
    { userId: firebaseUserId, userName, isTyping, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * fish `onTypingChange` + the unmount cleanup. `dispose()` clears the idle timer and writes
 * `isTyping: false` (fish did that on unmount).
 */
export function createTypingWriter(
  ctx: RealtimeContext,
  args: RoomArgs & { userName?: string; isLocked: boolean },
  now: () => number = Date.now
) {
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTypingWrite = 0;
  const write = (isTyping: boolean) => void writeTypingState(ctx, args, isTyping).catch(() => {});
  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  return {
    onTypingChange(isTyping: boolean) {
      clearIdle();

      if (!isTyping) {
        lastTypingWrite = 0;
        write(false);
        return;
      }

      const t = now();
      if (t - lastTypingWrite > TYPING_WRITE_THROTTLE_MS) {
        lastTypingWrite = t;
        write(true);
      }

      // Idle for this long = stopped. Long enough that pausing to think, or deleting a few words,
      // does not flip the other side's "X scrie..." off and on (a send clears it at once).
      idleTimer = setTimeout(() => {
        lastTypingWrite = 0;
        write(false);
      }, TYPING_IDLE_MS);
    },
    dispose() {
      clearIdle();
      write(false);
    },
  };
}

/** Who else is typing right now (fresh, not me), at most three distinct names. */
export function typingNamesOf(docs: TypingDoc[], currentUserId: string, nowMs: number): string[] {
  const names = docs
    .filter(data => {
      const updatedAt = data.updatedAt?.toMillis?.() ?? 0;
      return data.isTyping === true && data.userId !== currentUserId && nowMs - updatedAt < TYPING_STALE_MS;
    })
    .map(data => data.userName)
    .filter(Boolean) as string[];
  return [...new Set(names)].slice(0, 3);
}

/** fish `typingLabel`. */
export function typingLabel(typingNames: string[]): string | null {
  if (typingNames.length === 0) return null;
  if (typingNames.length === 1) return `${typingNames[0]} scrie...`;
  if (typingNames.length === 2) return `${typingNames[0]} și ${typingNames[1]} scriu...`;
  return `${typingNames[0]} și încă ${typingNames.length - 1} scriu...`;
}

/**
 * The typing listener with fish's display timing: names show at once, disappear no sooner than
 * `TYPING_MIN_VISIBLE_MS` after they appeared, and are cleared after `TYPING_STALE_MS` without a
 * fresh snapshot (a writer that vanished without writing `false`).
 */
export function subscribeTypingNames(
  ctx: RealtimeContext,
  { competitionId, roomId, currentUserId }: RoomArgs & { currentUserId: string },
  onNames: (names: string[]) => void,
  now: () => number = Date.now
): Unsubscribe {
  let shownAt = 0;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    shownAt = 0;
    onNames([]);
  };

  const unsubscribe = onSnapshot(
    collection(ctx.chatDb, chatTypingPath(competitionId, roomId)),
    snapshot => {
      const t = now();
      const nextNames = typingNamesOf(snapshot.docs.map(d => d.data() as TypingDoc), currentUserId, t);
      if (holdTimer) clearTimeout(holdTimer);
      if (nextNames.length > 0) {
        shownAt = shownAt || t;
        onNames(nextNames);
      } else {
        // Hold the row for the rest of its minimum time before it goes.
        const hold = shownAt ? TYPING_MIN_VISIBLE_MS - (t - shownAt) : 0;
        if (hold > 0) holdTimer = setTimeout(clear, hold);
        else clear();
      }

      if (staleTimer) clearTimeout(staleTimer);
      if (nextNames.length > 0) staleTimer = setTimeout(clear, TYPING_STALE_MS);
    },
    () => onNames([])
  );

  return () => {
    if (staleTimer) clearTimeout(staleTimer);
    if (holdTimer) clearTimeout(holdTimer);
    shownAt = 0;
    unsubscribe();
  };
}
