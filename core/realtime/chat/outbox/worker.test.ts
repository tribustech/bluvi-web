import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';

vi.mock('firebase/firestore', async orig => (await import('../../__tests__/fakeFirestore')).fakeFirestoreModule(await orig()));
const authSdk = vi.hoisted(() => ({ signInWithCustomToken: vi.fn(), signOut: vi.fn(), getAuth: vi.fn() }));
vi.mock('firebase/auth', () => authSdk);

import { docSnap, fs } from '../../__tests__/fakeFirestore';
import { parseUploadResponse, UploadError } from './uploader';
import { createMemoryOutboxStorage, createOutboxRepo } from './storage';
import { createOutboxWorker, OFFLINE_RECHECK_LIMIT } from './worker';
import type { OutboxAttachmentRow, OutboxEntry } from './types';

// The signed-in Firebase user is always 'u1' (fish mocked getAuth the same way).
const ctx = { db: {}, chatDb: {}, auth: { currentUser: { uid: 'u1' } } } as never;

const baseMessage = (over: Partial<OutboxEntry['message']> = {}): OutboxEntry['message'] => ({
  id: 'm1', competitionId: 'c1', roomId: 'general', senderId: 'u1', senderName: 'Ion', senderAvatar: null,
  text: 'salut', replyTo: null, senderRole: null, createdAt: 1, status: 'queued', attempts: 0, lastError: null, nextAttemptAt: 0, ...over,
});
const attachment = (over: Partial<OutboxAttachmentRow> = {}): OutboxAttachmentRow => ({
  id: 'a1', messageId: 'm1', position: 0, localUri: 'blob:a1', name: 'a1.jpg', mime: 'image/jpeg', width: null, height: null, uploaded: null, ...over,
});

let storage: ReturnType<typeof createMemoryOutboxStorage>;
let uploader: ReturnType<typeof vi.fn>;
let offline: ReturnType<typeof vi.fn>;
let releaseFiles: ReturnType<typeof vi.fn>;
let worker: ReturnType<typeof createOutboxWorker>;

const seed = async (...entries: OutboxEntry[]) => {
  const repo = createOutboxRepo(storage);
  for (const entry of entries) await repo.insert(entry);
};
const rows = () => createOutboxRepo(storage).listAll();
const drain = async () => {
  worker.run();
  await worker.flush();
};

beforeEach(() => {
  fs.reset();
  vi.clearAllMocks();
  storage = createMemoryOutboxStorage();
  uploader = vi.fn();
  offline = vi.fn().mockResolvedValue(false);
  releaseFiles = vi.fn();
  worker = createOutboxWorker({
    ctx,
    storage,
    uploader: uploader as never,
    getCustomToken: async () => 'tok',
    isOffline: offline as never,
    releaseFiles: releaseFiles as never,
  });
});

afterEach(() => {
  worker.dispose();
  vi.restoreAllMocks();
});

test('uploads attachments in order, writes the doc, then deletes the rows and releases the files', async () => {
  uploader.mockImplementation(async (a: OutboxAttachmentRow) => ({ id: a.id, url: `/${a.id}.jpg` }));
  await seed({ message: baseMessage(), attachments: [attachment({ id: 'a2', position: 1 }), attachment({ id: 'a1', position: 0 })] });
  const listener = vi.fn();
  worker.subscribe(listener);
  await drain();
  expect(uploader.mock.calls.map(c => c[0].id)).toEqual(['a1', 'a2']);
  const [ref, payload] = fs.setDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown> & { attachments: { id: string }[] }];
  expect(ref.path).toBe('competitions/c1/chats/general/messages/m1');
  expect(payload).toMatchObject({ senderId: 'u1', text: 'salut', type: 'text', createdAt: 'SERVER_TS' });
  expect(payload.attachments.map(a => a.id)).toEqual(['a1', 'a2']);
  expect(await rows()).toHaveLength(0);
  expect(releaseFiles).toHaveBeenCalledWith('m1');
  expect(listener).toHaveBeenCalled();
});

test('a resumed writing row whose Firestore doc already exists is treated as delivered, never re-written', async () => {
  // I3: a kill between the server ack and the row delete leaves the row at `writing`. Resuming
  // it must not call setDoc again (that would re-date the doc / wipe edits) — just finish cleanup.
  fs.getDoc.mockResolvedValue(docSnap({}));
  await seed({ message: baseMessage({ status: 'writing' }), attachments: [] });
  await drain();
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect(await rows()).toHaveLength(0);
});

test('skips already-uploaded attachments after a resume', async () => {
  await seed({ message: baseMessage({ status: 'uploading' }), attachments: [attachment({ uploaded: JSON.stringify({ id: 9, url: '/9.jpg' }) })] });
  await drain();
  expect(uploader).not.toHaveBeenCalled();
  expect((fs.setDoc.mock.calls[0][1] as { attachments: { id: string }[] }).attachments[0].id).toBe('9');
});

test('a failed write re-queues with backoff and a closed chat fails at once', async () => {
  fs.setDoc.mockRejectedValueOnce(Object.assign(new Error('net'), { code: 'unavailable' }));
  await seed({ message: baseMessage(), attachments: [] });
  await drain();
  // Raw/English SDK error text is never stored — the bubble only ever shows curated Romanian text.
  expect((await rows())[0].message).toMatchObject({ status: 'queued', attempts: 1, lastError: 'Mesajul nu a putut fi trimis.' });

  await worker.discardAll();
  fs.getDoc.mockResolvedValue(docSnap({ closesAt: { toMillis: () => 1 } }));
  await seed({ message: baseMessage({ id: 'm2' }), attachments: [] });
  await drain();
  expect((await rows())[0].message).toMatchObject({ status: 'failed', lastError: 'Chat-ul s-a închis.' });
  expect(fs.setDoc).toHaveBeenCalledTimes(1);
});

test('a row queued under a different account fails fatally and is never uploaded or written', async () => {
  // C1: the signed-in Firebase uid ('u1') never matches this row's sender — re-minting a token
  // can't change who is signed in, so this must fail fatally, not impersonate.
  await seed({ message: baseMessage({ senderId: 'u2' }), attachments: [attachment()] });
  await drain();
  expect(uploader).not.toHaveBeenCalled();
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect((await rows())[0].message).toMatchObject({ status: 'failed', lastError: 'Mesajul aparține altui cont.' });
});

test('the meta read failure never blocks the send and a fatal upload error stops at once with its own message', async () => {
  fs.getDoc.mockRejectedValue(Object.assign(new Error('boom'), { code: 'unavailable' }));
  uploader.mockRejectedValueOnce(new UploadError('Sesiunea a expirat. Intră din nou în cont.', 401));
  await seed({ message: baseMessage({ id: 'm3' }), attachments: [attachment({ messageId: 'm3' })] });
  await drain();
  expect((await rows())[0].message).toMatchObject({ status: 'failed', lastError: 'Sesiunea a expirat. Intră din nou în cont.' });
  expect(fs.setDoc).not.toHaveBeenCalled();
});

test('offline: never touches the network and leaves the row queued with attempts untouched', async () => {
  offline.mockResolvedValue(true);
  await seed({ message: baseMessage(), attachments: [attachment()] });
  await drain();
  expect(uploader).not.toHaveBeenCalled();
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect((await rows())[0].message).toMatchObject({ status: 'queued', attempts: 0 });
});

test('a failure discovered to be offline re-queues without burning an attempt', async () => {
  // drain()'s own check, then processEntry's up-front check both see "online" so the attempt
  // proceeds; only the check right after the setDoc failure reports offline.
  offline.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  fs.setDoc.mockRejectedValueOnce(Object.assign(new Error('net'), { code: 'unavailable' }));
  await seed({ message: baseMessage(), attachments: [] });
  await drain();
  expect((await rows())[0].message).toMatchObject({ status: 'queued', attempts: 0, lastError: null });
});

test('a throwing connectivity check is treated as online and the send proceeds normally', async () => {
  offline.mockRejectedValue(new Error('unavailable'));
  await seed({ message: baseMessage(), attachments: [] });
  await drain();
  expect(fs.setDoc).toHaveBeenCalledTimes(1);
  expect(await rows()).toHaveLength(0);
});

test('offline with work waiting arms a 5 s re-check instead of going silent', async () => {
  offline.mockResolvedValue(true);
  await seed({ message: baseMessage({ id: 'm-wait' }), attachments: [] });
  const spy = vi.spyOn(globalThis, 'setTimeout');
  await drain();
  expect(spy.mock.calls.some(call => call[1] === 5000)).toBe(true);
  expect(fs.setDoc).not.toHaveBeenCalled();
});

test('once the offline re-check budget is spent, an external run() arms it again', async () => {
  // Regression for I2: the internal timer chain must never reset the budget itself — only an
  // external `run()` call may. Simulated by invoking the captured 5 s-recheck callback by hand.
  offline.mockResolvedValue(true);
  await seed({ message: baseMessage({ id: 'm-wait' }), attachments: [] });
  let pendingRecheck: (() => void) | undefined;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: () => void, ms?: number) => {
    if (ms === 5000) pendingRecheck = cb;
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout);

  await drain(); // external: 1st recheck scheduled
  expect(pendingRecheck).toBeDefined();

  for (let i = 1; i < OFFLINE_RECHECK_LIMIT; i++) {
    const cb = pendingRecheck;
    pendingRecheck = undefined;
    cb?.();
    await worker.flush();
  }
  // One more fire: the budget is now at the limit, so this drain must NOT re-arm.
  const lastCb = pendingRecheck;
  pendingRecheck = undefined;
  lastCb?.();
  await worker.flush();
  expect(pendingRecheck).toBeUndefined();

  // An external kick resets the budget and must re-arm the re-check.
  await drain();
  expect(pendingRecheck).toBeDefined();
});

test('a retried row (attempts > 0) whose doc already exists is treated as delivered too', async () => {
  // A kill after the ack can leave the row `queued` (demoted by the next pass), not only `writing`.
  fs.getDoc.mockResolvedValue(docSnap({}));
  await seed({ message: baseMessage({ status: 'queued', attempts: 1 }), attachments: [] });
  await drain();
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect(await rows()).toHaveLength(0);
});

test('a failing existence read never blocks the write', async () => {
  fs.getDoc.mockRejectedValue(new Error('unavailable'));
  await seed({ message: baseMessage({ status: 'writing' }), attachments: [] });
  await drain();
  expect(fs.setDoc).toHaveBeenCalledTimes(1);
  expect(await rows()).toHaveLength(0);
});

describe('write fallbacks', () => {
  test('permission-denied with a role: re-mint, retry, then send without the chip', async () => {
    authSdk.signInWithCustomToken.mockResolvedValue({});
    fs.setDoc
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce(undefined);
    await seed({ message: baseMessage({ senderRole: 'participant' }), attachments: [] });
    await drain();
    expect(fs.setDoc).toHaveBeenCalledTimes(3);
    expect(fs.setDoc.mock.calls[0][1]).toMatchObject({ senderRole: 'participant' });
    expect('senderRole' in (fs.setDoc.mock.calls[2][1] as object)).toBe(false);
    expect(authSdk.signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'tok');
    expect(await rows()).toHaveLength(0);
  });

  test('a second auth failure without a role is fatal', async () => {
    fs.setDoc.mockRejectedValue({ code: 'permission-denied' });
    await seed({ message: baseMessage(), attachments: [] });
    await drain();
    expect((await rows())[0].message).toMatchObject({ status: 'failed', lastError: 'Nu ai voie să scrii în acest chat.' });
  });
});

describe('enqueue / retry / discard', () => {
  it('enqueue shows the bubble and drains it', async () => {
    await worker.enqueue({ message: baseMessage({ id: 'e1', createdAt: 5 }), attachments: [] });
    expect((await worker.roomMessages('c1', 'general', 'u1')).map(m => m.id)).toEqual(['e1']);
    await worker.flush();
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
    expect(await worker.roomMessages('c1', 'general', 'u1')).toEqual([]);
  });

  it('retry resets a failed row, discard drops it', async () => {
    await seed({ message: baseMessage({ status: 'failed', attempts: 4, lastError: 'x' }), attachments: [] });
    fs.setDoc.mockRejectedValue(Object.assign(new Error('net'), { code: 'unavailable' }));
    await worker.retry('m1');
    await worker.flush();
    expect((await rows())[0].message).toMatchObject({ status: 'queued', attempts: 1 });
    await worker.discard('m1');
    expect(await rows()).toHaveLength(0);
    expect(releaseFiles).toHaveBeenCalledWith('m1');
  });
});

describe('parseUploadResponse', () => {
  it('returns the first uploaded file', () => {
    expect(parseUploadResponse(200, JSON.stringify([{ id: 5, url: '/uploads/a.jpg', blurhash: 'LKO2' }]))).toMatchObject({
      id: 5,
      url: '/uploads/a.jpg',
      blurhash: 'LKO2',
    });
  });
  it('throws a Romanian error on a non-2xx status or a bad body', () => {
    expect(() => parseUploadResponse(413, '')).toThrow(UploadError);
    expect(() => parseUploadResponse(200, 'not json')).toThrow(UploadError);
    expect(() => parseUploadResponse(200, '[]')).toThrow(UploadError);
    expect(() => parseUploadResponse(401, '{}')).toThrow('Sesiunea a expirat');
  });
});

test('an injected io carries the reads and the write (the web e2e fake), the retry ladder unchanged', async () => {
  const write = vi.fn().mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' })).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' })).mockResolvedValue(undefined);
  const io = { readClosesAtMs: vi.fn().mockResolvedValue(null), exists: vi.fn().mockResolvedValue(false), write };
  worker.dispose();
  worker = createOutboxWorker({ ctx, storage, uploader: uploader as never, getCustomToken: async () => null, io });
  await seed({ message: baseMessage({ senderRole: 'participant' }), attachments: [] });
  await drain();
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect(io.readClosesAtMs).toHaveBeenCalledWith('c1');
  expect(write.mock.calls.map(c => c[0])).toEqual(Array(3).fill('competitions/c1/chats/general/messages/m1'));
  expect(write.mock.calls.map(c => 'senderRole' in (c[1] as object))).toEqual([true, true, false]);
  expect(await rows()).toHaveLength(0);
});
