/** fish `features/chat/outbox/state.ts` — pure retry/backoff rules and the pending-bubble mapper. */
import { Timestamp } from 'firebase/firestore';
import { toPendingChatAttachment } from '../transforms';
import type { ChatListMessage, ChatReplyTo, ChatSenderRole } from '../types';
import type { OutboxEntry, OutboxMessageRow } from './types';

export const RETRY_DELAYS_MS = [2000, 8000, 30000] as const;
/** One try plus three retries. */
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export function afterFailure(
  row: Pick<OutboxMessageRow, 'attempts'>,
  error: string,
  nowMs: number,
  fatal = false
): Pick<OutboxMessageRow, 'status' | 'attempts' | 'lastError' | 'nextAttemptAt'> {
  const attempts = row.attempts + 1;
  if (fatal || attempts >= MAX_ATTEMPTS)
    return { status: 'failed', attempts: fatal ? attempts : MAX_ATTEMPTS, lastError: error, nextAttemptAt: nowMs };
  return { status: 'queued', attempts, lastError: error, nextAttemptAt: nowMs + RETRY_DELAYS_MS[attempts - 1] };
}

/**
 * A failure that happened while offline doesn't count against the retry budget (spec §4: offline
 * must not burn attempts) — re-queue with `attempts` untouched and the same short first-retry
 * delay, so the row is runnable again quickly once the app's online listener wakes the
 * worker, without ever showing an error on a row that never really had a chance to send.
 */
export function afterOfflineFailure(
  row: Pick<OutboxMessageRow, 'attempts'>,
  nowMs: number
): Pick<OutboxMessageRow, 'status' | 'attempts' | 'lastError' | 'nextAttemptAt'> {
  return { status: 'queued', attempts: row.attempts, lastError: null, nextAttemptAt: nowMs + RETRY_DELAYS_MS[0] };
}

/** `uploading`/`writing` rows are leftovers of a kill mid-send: run them again. */
export function isRunnable(row: Pick<OutboxMessageRow, 'status' | 'nextAttemptAt'>, nowMs: number): boolean {
  if (row.status === 'failed') return false;
  if (row.status === 'queued') return row.nextAttemptAt <= nowMs;
  return true;
}

export function nextWakeMs(rows: Array<Pick<OutboxMessageRow, 'status' | 'nextAttemptAt'>>, nowMs: number): number | null {
  let soonest: number | null = null;
  for (const row of rows) {
    if (row.status !== 'queued' || row.nextAttemptAt <= nowMs) continue;
    const delay = row.nextAttemptAt - nowMs;
    if (soonest === null || delay < soonest) soonest = delay;
  }
  return soonest;
}

function parseReplyTo(json: string | null): ChatReplyTo | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as ChatReplyTo;
  } catch {
    return undefined;
  }
}

export function toOutboxListMessage({ message, attachments }: OutboxEntry): ChatListMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    senderAvatar: message.senderAvatar,
    text: message.text,
    attachments: attachments
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(a =>
        toPendingChatAttachment({
          id: a.id,
          uri: a.localUri,
          name: a.name,
          mime: a.mime ?? undefined,
          width: a.width ?? undefined,
          height: a.height ?? undefined,
        })
      ),
    replyTo: parseReplyTo(message.replyTo),
    createdAt: Timestamp.fromMillis(message.createdAt),
    type: 'text',
    senderRole: (message.senderRole as ChatSenderRole | null) ?? undefined,
    pending: true,
    outbox: { status: message.status, lastError: message.lastError },
  };
}

/**
 * fish `useOutbox` mapping: the room's queued/uploading/failed sends as pending bubbles, newest
 * first like the room's live list. `currentUserId`, when given, filters out any row that isn't
 * that account's own — sign-out clears the outbox (see `discardAll`), but this guards the
 * in-memory gap between a row still being drained and that clear landing.
 */
export function outboxRoomMessages(entries: OutboxEntry[], currentUserId?: string): ChatListMessage[] {
  const own = currentUserId ? entries.filter(entry => entry.message.senderId === currentUserId) : entries;
  return own.map(toOutboxListMessage).reverse();
}
