import { describe, expect, it } from 'vitest';
import { afterFailure, afterOfflineFailure, isRunnable, MAX_ATTEMPTS, nextWakeMs, outboxRoomMessages, RETRY_DELAYS_MS, toOutboxListMessage } from './state';

const now = 1_000_000;

describe('afterFailure', () => {
  it('re-queues with the 2s / 8s / 30s backoff, then fails', () => {
    expect(afterFailure({ attempts: 0 }, 'net', now)).toEqual({ status: 'queued', attempts: 1, lastError: 'net', nextAttemptAt: now + RETRY_DELAYS_MS[0] });
    expect(afterFailure({ attempts: 1 }, 'net', now)).toEqual({ status: 'queued', attempts: 2, lastError: 'net', nextAttemptAt: now + RETRY_DELAYS_MS[1] });
    expect(afterFailure({ attempts: 2 }, 'net', now)).toEqual({ status: 'queued', attempts: 3, lastError: 'net', nextAttemptAt: now + RETRY_DELAYS_MS[2] });
    expect(afterFailure({ attempts: 3 }, 'net', now)).toEqual({ status: 'failed', attempts: MAX_ATTEMPTS, lastError: 'net', nextAttemptAt: now });
  });
  it('fails at once when fatal', () => {
    expect(afterFailure({ attempts: 0 }, 'Chat-ul s-a închis.', now, true).status).toBe('failed');
  });
});

describe('afterOfflineFailure', () => {
  it('re-queues without touching attempts, using the first retry delay and no error', () => {
    expect(afterOfflineFailure({ attempts: 0 }, now)).toEqual({ status: 'queued', attempts: 0, lastError: null, nextAttemptAt: now + RETRY_DELAYS_MS[0] });
    // Even a row already deep into its retry ladder keeps its attempt count — offline never burns one.
    expect(afterOfflineFailure({ attempts: 3 }, now)).toEqual({ status: 'queued', attempts: 3, lastError: null, nextAttemptAt: now + RETRY_DELAYS_MS[0] });
  });
});

describe('isRunnable / nextWakeMs', () => {
  it('runs queued rows whose time has come and stale uploading/writing rows', () => {
    expect(isRunnable({ status: 'queued', nextAttemptAt: now }, now)).toBe(true);
    expect(isRunnable({ status: 'queued', nextAttemptAt: now + 1 }, now)).toBe(false);
    expect(isRunnable({ status: 'uploading', nextAttemptAt: 0 }, now)).toBe(true);
    expect(isRunnable({ status: 'writing', nextAttemptAt: 0 }, now)).toBe(true);
    expect(isRunnable({ status: 'failed', nextAttemptAt: 0 }, now)).toBe(false);
  });
  it('reports the soonest future retry', () => {
    expect(nextWakeMs([{ status: 'queued', nextAttemptAt: now + 500 }, { status: 'queued', nextAttemptAt: now + 100 }], now)).toBe(100);
    expect(nextWakeMs([{ status: 'failed', nextAttemptAt: now + 100 }], now)).toBeNull();
    expect(nextWakeMs([], now)).toBeNull();
  });
});

describe('toOutboxListMessage', () => {
  it('renders a queued row as a pending bubble with local attachments', () => {
    const message = toOutboxListMessage({
      message: {
        id: 'm1', competitionId: 'c1', roomId: 'general', senderId: 'u1', senderName: 'Ion', senderAvatar: null,
        text: 'salut', replyTo: JSON.stringify({ messageId: 'x', senderId: 'u2', senderName: 'Ana', text: 'hi' }),
        senderRole: 'participant', createdAt: now, status: 'queued', attempts: 0, lastError: null, nextAttemptAt: now,
      },
      attachments: [{ id: 'a1', messageId: 'm1', position: 0, localUri: 'file:///x.jpg', name: 'x.jpg', mime: 'image/jpeg', width: 10, height: 20, uploaded: null }],
    });
    expect(message.pending).toBe(true);
    expect(message.outbox).toEqual({ status: 'queued', lastError: null });
    expect(message.replyTo?.senderName).toBe('Ana');
    expect(message.senderRole).toBe('participant');
    expect(message.attachments?.[0]).toMatchObject({ id: 'a1', url: 'file:///x.jpg', thumbnailUrl: 'file:///x.jpg', width: 10, height: 20 });
    expect(message.createdAt.toMillis()).toBe(now);
  });
});

describe('outboxRoomMessages (fish useOutbox)', () => {
  const row = (id: string, senderId: string, createdAt: number) => ({
    message: {
      id, competitionId: 'c1', roomId: 'general' as const, senderId, senderName: 'x', senderAvatar: null, text: id,
      replyTo: null, senderRole: null, createdAt, status: 'queued' as const, attempts: 0, lastError: null, nextAttemptAt: 0,
    },
    attachments: [],
  });
  it('returns own rows only, newest first', () => {
    const out = outboxRoomMessages([row('a', 'me', 1), row('b', 'other', 2), row('c', 'me', 3)], 'me');
    expect(out.map(m => m.id)).toEqual(['c', 'a']);
  });
});
