import { test as base, expect, type Page, type Route } from '@playwright/test';

/*
 * The shared Firestore fake for every competition-chat spec (participant.chat, chat-photo; hard rule:
 * the Firebase project is ONE for every environment — no test may read or write it).
 *
 *  (a) `window.__BLUVI_FAKE_CHAT__` is set before any page script runs (addInitScript). The chat's
 *      source (app/(site)/concursuri/[id]/chat/_live/source.ts) honours it only when NODE_ENV !==
 *      'production' and then serves every read from it and RECORDS every write — never loading the
 *      Firebase SDK. Its docs are Firestore's shapes (times as ISO strings or epoch ms).
 *  (b) Every request to Firebase's hosts and to /api/firebase-token is aborted and recorded; the
 *      fixture FAILS the test if one was attempted.
 *  (c) `mockUpload` / `mockPreferences` route-mock the CMS calls the chat makes (POST /upload, the
 *      notification preferences GET / PUT) so nothing is written to the CMS either.
 *
 * Seeds apply on every navigation (a reload starts from the seed again; the outbox lives in the
 * browser's IndexedDB and survives it, as on a phone). Use it through `test` from this module (an
 * auto fixture), or `installFakeChat(page)` by hand:
 *
 *   import { test, expect, chatMessage } from './helpers/fake-chat';
 *   test('…', async ({ page, fakeChat }) => {
 *     await fakeChat.seed({ rooms: { general: { messages: [chatMessage({ text: 'Salut' })] } }, consent: 'present' });
 *     await page.goto('/concursuri/abc/chat');
 *     await fakeChat.pushMessage('general', chatMessage({ id: 'm2', text: 'Nou' }));  // a new snapshot
 *     await fakeChat.fail('competitions/abc/chats/general/messages');                // the listener fails
 *     expect(await fakeChat.writes()).toContainEqual(expect.objectContaining({ op: 'set' }));
 *   });
 *
 * Every write is `{ op: 'set' | 'update' | 'delete' | 'upload', path, data, at }` with the Firestore
 * path (core/realtime/chat/paths.ts); server timestamps read «serverTimestamp».
 */

export type FakeTime = string | number;

export type FakeChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  text: string;
  createdAt: FakeTime | null;
  type?: 'text' | 'system';
  senderRole?: 'participant' | 'organizer' | 'referee';
  event?: string;
  link?: { kind: string; id?: string; params?: Record<string, string> };
  data?: Record<string, string | number>;
  attachments?: { id: string; url: string; thumbnailUrl: string; width?: number; height?: number; blurhash?: string }[];
  replyTo?: { messageId: string; senderId: string; senderName: string; text: string; hasAttachments?: boolean };
  editedAt?: FakeTime;
  deletedAt?: FakeTime;
  deletedBy?: string;
};
export type FakeChatReaction = { messageId: string; userId: string; userName: string; emoji: string; updatedAt?: FakeTime };
export type FakeChatReceipt = { userId: string; userName?: string; lastReadMessageId?: string; lastReadAt: FakeTime; updatedAt?: FakeTime };
/** `updatedAt` left out = fresh when it reaches the page. */
export type FakeChatTyping = { userId: string; userName: string; isTyping: boolean; updatedAt?: FakeTime };

export type FakeChatRoom = {
  messages: FakeChatMessage[];
  reactions: FakeChatReaction[];
  receipts: FakeChatReceipt[];
  typing: FakeChatTyping[];
  /** What the room's unread counter reports (newer than my receipt, not mine). */
  unread: number;
  /** I have a receipt in this room (none in any readable room = the badge's «Nou»). */
  seen: boolean;
};
export type RoomId = 'general' | 'participants';

export type FakeChatFailure = { code: string; times?: number; ifField?: string };
export type FakeChatWrite = { op: 'set' | 'update' | 'delete' | 'upload'; path: string; data?: Record<string, unknown>; at: number };

export type FakeChatInit = {
  rooms?: Partial<Record<RoomId, Partial<FakeChatRoom>>>;
  meta?: { closesAt: FakeTime; reason?: string } | null | 'unreadable';
  consent?: 'present' | 'absent' | 'unreadable';
  auth?: 'ok' | 'fail';
  listenerErrors?: Record<string, string>;
  failures?: Record<string, FakeChatFailure>;
  fromCache?: boolean;
};

const FIREBASE_HOSTS =
  /^https:\/\/([a-z0-9-]+\.)*(firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseinstallations\.googleapis\.com|firebase\.googleapis\.com|firebaselogging-pa\.googleapis\.com|firebasestorage\.googleapis\.com)\//;

/* ------------------------------------------------------------------ */
/* Doc builders                                                        */
/* ------------------------------------------------------------------ */

let seq = 0;
/** A text message (defaults: from «Ion Pescaru», now). */
export function chatMessage(over: Partial<FakeChatMessage> = {}): FakeChatMessage {
  seq += 1;
  return { id: `m${seq}`, senderId: 'u-ion', senderName: 'Ion Pescaru', senderAvatar: null, text: `Mesaj ${seq}`, createdAt: Date.now(), type: 'text', ...over };
}
/** A competition event (`type: 'system'`), e.g. `systemMessage('competition:start', '🏁 Concursul a început')`. */
export function systemMessage(event: string, text: string, over: Partial<FakeChatMessage> = {}): FakeChatMessage {
  return chatMessage({ senderId: 'system', senderName: 'Bluvi', type: 'system', event, text, ...over });
}
export const minutesAgo = (n: number) => Date.now() - n * 60_000;

/* ------------------------------------------------------------------ */
/* The fake                                                            */
/* ------------------------------------------------------------------ */

type W = { __BLUVI_FAKE_CHAT__?: Record<string, unknown> & { push?: unknown; setMeta?: unknown; fail?: unknown } };

export type FakeChatHandle = {
  /** Every Firebase request the page attempted (all aborted). */
  attempts: string[];
  /** Merge rooms / meta / consent / failures into the fake for the next navigation (and every later one). */
  seed(init: FakeChatInit): Promise<void>;
  /** Merge into a room on the open page and notify its listeners (a new snapshot). */
  push(roomId: RoomId, patch: Partial<FakeChatRoom>): Promise<void>;
  /** Append one message to a room on the open page. */
  pushMessage(roomId: RoomId, message: FakeChatMessage): Promise<void>;
  /** Replace the meta doc on the open page. */
  setMeta(meta: FakeChatInit['meta']): Promise<void>;
  /** Fail the open listeners under `path` (default permission-denied). */
  fail(path: string, code?: string): Promise<void>;
  /** Set a write failure on the open page (by path prefix). */
  failWrites(path: string, failure: FakeChatFailure): Promise<void>;
  /** Every write the page made, in order. */
  writes(): Promise<FakeChatWrite[]>;
  /** Every listener path the page opened, in order. */
  listened(): Promise<string[]>;
};

async function ready(page: Page) {
  await page.waitForFunction(() => typeof (window as unknown as W).__BLUVI_FAKE_CHAT__?.push === 'function');
}

export async function installFakeChat(page: Page): Promise<FakeChatHandle> {
  const attempts: string[] = [];
  // On the context: every page the test opens (context.newPage()) is covered, not just `page`.
  const context = page.context();
  await context.route(FIREBASE_HOSTS, route => {
    attempts.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await context.route('**/api/firebase-token', route => {
    attempts.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await context.addInitScript(() => {
    (window as unknown as W).__BLUVI_FAKE_CHAT__ = {
      rooms: {},
      meta: null,
      consent: 'present',
      auth: 'ok',
      listenerErrors: {},
      failures: {},
      writes: [],
      listened: [],
    };
  });
  return {
    attempts,
    async seed(init) {
      await context.addInitScript(i => {
        const fake = (window as unknown as W).__BLUVI_FAKE_CHAT__ as Record<string, unknown> & {
          rooms: Record<string, Record<string, unknown>>;
          listenerErrors: Record<string, string>;
          failures: Record<string, unknown>;
        };
        for (const [id, room] of Object.entries(i.rooms ?? {})) fake.rooms[id] = { ...(fake.rooms[id] ?? {}), ...(room as Record<string, unknown>) };
        if (i.meta !== undefined) fake.meta = i.meta;
        if (i.consent !== undefined) fake.consent = i.consent;
        if (i.auth !== undefined) fake.auth = i.auth;
        if (i.fromCache !== undefined) fake.fromCache = i.fromCache;
        Object.assign(fake.listenerErrors, i.listenerErrors ?? {});
        // Each navigation starts with fresh counters (a copy: `times` is spent in the page).
        for (const [k, v] of Object.entries(i.failures ?? {})) fake.failures[k] = { ...(v as object) };
      }, init);
    },
    async push(roomId, patch) {
      await ready(page);
      await page.evaluate(([r, p]) => ((window as unknown as W).__BLUVI_FAKE_CHAT__!.push as (a: string, b: unknown) => void)(r, p), [roomId, patch] as const);
    },
    async pushMessage(roomId, message) {
      await ready(page);
      await page.evaluate(
        ([r, m]) => {
          const fake = (window as unknown as W).__BLUVI_FAKE_CHAT__ as { rooms: Record<string, { messages: unknown[] }>; push: (a: string, b: unknown) => void };
          fake.push(r, { messages: [...fake.rooms[r].messages, m] });
        },
        [roomId, message] as const,
      );
    },
    async setMeta(meta) {
      await ready(page);
      await page.evaluate(m => ((window as unknown as W).__BLUVI_FAKE_CHAT__!.setMeta as (a: unknown) => void)(m), meta ?? null);
    },
    async fail(path, code = 'permission-denied') {
      await ready(page);
      await page.evaluate(([p, c]) => ((window as unknown as W).__BLUVI_FAKE_CHAT__!.fail as (a: string, b: string) => void)(p, c), [path, code] as const);
    },
    async failWrites(path, failure) {
      await page.evaluate(([p, f]) => {
        ((window as unknown as W).__BLUVI_FAKE_CHAT__!.failures as Record<string, unknown>)[p] = { ...f };
      }, [path, failure] as const);
    },
    writes: () => page.evaluate(() => ((window as unknown as W).__BLUVI_FAKE_CHAT__?.writes as FakeChatWrite[] | undefined) ?? []),
    listened: () => page.evaluate(() => ((window as unknown as W).__BLUVI_FAKE_CHAT__?.listened as string[] | undefined) ?? []),
  };
}

/**
 * `test` with the fake installed on every page of the test's context, failing any test that let a
 * Firebase request out. Every spec that signs in and opens a competition page uses it (the page's
 * chat badge reads Firestore — through this fake, never the shared project).
 */
export const test = base.extend<{ fakeChat: FakeChatHandle }>({
  fakeChat: [
    async ({ page }, use) => {
      const handle = await installFakeChat(page);
      await use(handle);
      expect(handle.attempts, 'no request may reach Firebase (one project for every environment)').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/* ------------------------------------------------------------------ */
/* CMS mocks the chat needs                                            */
/* ------------------------------------------------------------------ */

/**
 * POST /api/cms/upload → a Strapi file per call (recorded); `status` other than 200 answers that code.
 * Returns the recorded calls (file names).
 */
export async function mockUpload(page: Page, { status = 200 }: { status?: number } = {}) {
  const calls: { name: string | null }[] = [];
  let n = 0;
  await page.route('**/api/cms/upload', async (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    n += 1;
    const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
    calls.push({ name: /filename="([^"]+)"/.exec(body)?.[1] ?? null });
    if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { status, message: 'refused' } }) });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 9000 + n, documentId: `file-${n}`, url: `/uploads/chat_${n}.jpg`, name: `chat_${n}.jpg`, mime: 'image/jpeg', width: 1280, height: 960, formats: { small: { url: `/uploads/small_chat_${n}.jpg` } } }]),
    });
  });
  return calls;
}

/**
 * The DTO of /feed/competitions/:id/notification-preferences as the CMS answers it: the catalog
 * groups (the chat rooms are not in it), and the chat keys a viewer muted in `extraMuted`.
 */
export function preferencesDto(mutedTypes: string[] = []) {
  const types = [
    { key: 'competition:start', label: 'Startul concursului', muted: mutedTypes.includes('competition:start') },
    { key: 'competition:ranking', label: 'Schimbări în clasament', muted: mutedTypes.includes('competition:ranking') },
  ];
  return {
    groups: [{ key: 'competition', label: 'Concursul', types }],
    extraMuted: mutedTypes.filter(k => !types.some(t => t.key === k)),
  };
}

/**
 * GET / PUT /api/cms/feed/competitions/:id/notification-preferences: answers from `muted` (the PUT
 * body becomes the new state); `failPut` answers the PUT 500. Returns the PUT bodies, in order.
 */
export async function mockPreferences(page: Page, { muted = [], failPut = false }: { muted?: string[]; failPut?: boolean } = {}) {
  const puts: { mutedTypes: string[] }[] = [];
  let state = muted;
  await page.route('**/api/cms/feed/competitions/*/notification-preferences', async (route: Route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as { mutedTypes: string[] } & { data?: { mutedTypes: string[] } };
      const next = body.mutedTypes ?? body.data?.mutedTypes ?? [];
      puts.push({ mutedTypes: next });
      if (failPut) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { status: 500, message: 'x' } }) });
      state = next;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preferencesDto(state)) });
    }
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preferencesDto(state)) });
    return route.fallback();
  });
  return puts;
}
