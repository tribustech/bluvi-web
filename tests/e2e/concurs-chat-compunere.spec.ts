import type { BrowserContext, Page, Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { CMS, qaJwt, signIn } from './helpers/session';
import { chatMessage, expect, minutesAgo, mockUpload, test, type FakeChatHandle } from './helpers/fake-chat';

/*
 * Chat concurs — the composer (parity docs/parity/areas/participant.yml, screen participant.chat
 * slice 3 «compunere»: c25, c26, c28, c29, c30 (UI part), c32). Each test names the ids it proves.
 *
 * Firestore is NEVER touched: the auto fixture (helpers/fake-chat.ts) installs the in-page fake and
 * fails the test on any request to Firebase. Uploads are route-mocked at /api/cms/upload, the
 * viewer's statute / follow state are route-mocked: nothing is written anywhere.
 */

const ID = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';
const CHAT = `/concursuri/${ID}/chat`;
const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 800 };
const DESKTOP = { width: 1440, height: 900 };
const SHOTS = path.join(process.cwd(), '.shots', 'chat-compunere');
const PREPARE_FAILED = 'Mesajul nu a putut fi pregătit pentru trimitere.';

let coreName = '';
let jwt = '';
let me = { documentId: '', username: '' };

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${CMS}/feed/competitions/${ID}`);
  expect(res.ok(), `competition ${ID} exists in the local CMS`).toBeTruthy();
  coreName = (await res.json()).data.name;
  jwt = await qaJwt(request);
  me = await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
  mkdirSync(SHOTS, { recursive: true });
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function mockViewer(context: BrowserContext) {
  await context.route(`**/api/cms/user/profile/competition/${ID}/statute`, (route: Route) => route.fulfill({ json: { userRole: 'participant' } }));
  await context.route(`**/api/cms/feed/competitions/${ID}/my-status`, (route: Route) =>
    route.fulfill({ json: { data: { isFollowing: true, userRegistrationStatus: 'registered' } } }),
  );
}

async function openChat(page: Page, context: BrowserContext, size = PHONE) {
  await mockViewer(context);
  await signIn(context, jwt, BASE_URL);
  await page.setViewportSize(size);
  await page.goto(CHAT);
  await expect(page.getByRole('heading', { level: 1, name: coreName })).toBeVisible({ timeout: 60_000 });
  // The live layer is in (source + outbox): the field is enabled.
  await expect(field(page)).toBeEnabled({ timeout: 30_000 });
}

const field = (page: Page) => page.getByRole('textbox', { name: 'Mesaj' });
const composer = (page: Page) => page.getByRole('form', { name: 'Scrie un mesaj' });
const sendButton = (page: Page) => composer(page).getByRole('button', { name: 'Trimite' });
const cameraButton = (page: Page) => composer(page).getByRole('button', { name: 'Fă o poză' });
const addPhotos = (page: Page) => composer(page).getByRole('button', { name: 'Adaugă poze' });
/** The right slot: the hidden one of camera / «Trimite» is inert (out of the tab order and the a11y tree) and transparent. */
async function expectSlot(page: Page, mode: 'camera' | 'send') {
  const [on, off] = mode === 'camera' ? [cameraButton(page), sendButton(page)] : [sendButton(page), cameraButton(page)];
  await expect(on).not.toHaveAttribute('inert');
  await expect(off).toHaveAttribute('inert', '');
  await expect(on).toHaveCSS('opacity', '1');
  await expect(off).toHaveCSS('opacity', '0');
}
const tray = (page: Page) => page.getByRole('list', { name: /^Poze atașate/ });

const messageWrites = async (fakeChat: FakeChatHandle, room = 'participants') =>
  (await fakeChat.writes()).filter(w => w.op === 'set' && w.path.startsWith(`competitions/${ID}/chats/${room}/messages/`));
const typingWrites = async (fakeChat: FakeChatHandle, room = 'participants') =>
  (await fakeChat.writes()).filter(w => w.path === `competitions/${ID}/chats/${room}/typing/${me.documentId}`).map(w => w.data?.isTyping);

/** `n` distinct, decodable photos (drawn in the page: real PNG bytes, different colours). */
async function photos(page: Page, n: number, offset = 0) {
  const data = await page.evaluate(
    ([count, start]) =>
      Array.from({ length: count }, (_, i) => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 240;
        const g = c.getContext('2d')!;
        const hue = ((start + i) * 47) % 360;
        const grad = g.createLinearGradient(0, 0, 320, 240);
        grad.addColorStop(0, `hsl(${hue} 60% 55%)`);
        grad.addColorStop(1, `hsl(${(hue + 60) % 360} 55% 35%)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 320, 240);
        return c.toDataURL('image/png').split(',')[1];
      }),
    [n, offset] as const,
  );
  return data.map((b64, i) => ({ name: `poza-${offset + i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }));
}

async function pick(page: Page, n: number, offset = 0) {
  await page.getByTestId('chat-gallery-input').setInputFiles(await photos(page, n, offset));
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}-${page.viewportSize()?.width}.png`) });
}

/**
 * «Răspunde» / «Editează» on the message with `text`. The per-message menu is slice 2's (its spec
 * proves the menu → setReplyTo / setEditing); here the fake's composer seam (Composer.tsx, outside
 * production only) makes the same controller call, so this spec proves the composer's half.
 */
async function messageAction(page: Page, text: string, action: 'Răspunde' | 'Editează') {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __BLUVI_FAKE_CHAT__?: { composer?: unknown } }).__BLUVI_FAKE_CHAT__?.composer);
  await page.evaluate(
    ([t, a]) => {
      const fake = (window as unknown as { __BLUVI_FAKE_CHAT__: { rooms: Record<string, { messages: { id: string; text: string }[] }>; composer: Record<string, (id: string) => void> } }).__BLUVI_FAKE_CHAT__;
      const all = Object.values(fake.rooms).flatMap(r => r.messages);
      const m = all.find(x => x.text === t);
      if (!m) throw new Error(`no message «${t}»`);
      fake.composer[a === 'Răspunde' ? 'reply' : 'edit'](m.id);
    },
    [text, action] as const,
  );
}

/* ------------------------------------------------------------------ */
/* c28 — the row                                                       */
/* ------------------------------------------------------------------ */

test('participant.chat.c28 — «Adaugă poze» | «Mesaj» | camera «Fă o poză» when empty, «Trimite» with text; 1000 characters at most; the field grows to 5 lines, then scrolls', async ({ page, context, fakeChat }) => {
  await fakeChat.seed({ rooms: { participants: { messages: [chatMessage({ id: 'p1', text: 'Bună dimineața!', createdAt: minutesAgo(3) })] } } });
  const errors = collectConsoleErrors(page);
  await openChat(page, context);
  await expect(addPhotos(page)).toBeVisible();
  await expectSlot(page, 'camera');
  await shot(page, 'empty');

  // Whitespace is not a message: the camera stays.
  await field(page).fill('   ');
  await expectSlot(page, 'camera');
  await field(page).fill('Salut');
  await expectSlot(page, 'send');
  await field(page).fill('');
  await expectSlot(page, 'camera');

  // 1000 characters at most (a paste of 1100 is cut).
  await field(page).fill('a'.repeat(1100));
  await expect(field(page)).toHaveValue('a'.repeat(1000));

  // Grows with its lines up to 5, then scrolls.
  await field(page).fill('');
  const h1 = await field(page).evaluate(el => el.getBoundingClientRect().height);
  await field(page).fill('1\n2\n3');
  const h3 = await field(page).evaluate(el => el.getBoundingClientRect().height);
  await field(page).fill('1\n2\n3\n4\n5');
  const h5 = await field(page).evaluate(el => el.getBoundingClientRect().height);
  await field(page).fill('1\n2\n3\n4\n5\n6\n7\n8');
  const h8 = await field(page).evaluate(el => ({ h: el.getBoundingClientRect().height, overflow: getComputedStyle(el).overflowY, scrolls: el.scrollHeight > el.clientHeight }));
  expect(h3).toBeGreaterThan(h1 + 20);
  expect(h5).toBeGreaterThan(h3 + 20);
  expect(h8.h).toBeCloseTo(h5, 0);
  expect(h8.overflow).toBe('auto');
  expect(h8.scrolls).toBe(true);
  await shot(page, 'five-lines');
  expect(errors).toEqual([]);
});

test('participant.chat.c28 — the composer is part of the column, never over the conversation (phone and desktop)', async ({ page, context, fakeChat }) => {
  await fakeChat.seed({
    rooms: { participants: { messages: Array.from({ length: 30 }, (_, i) => chatMessage({ id: `p${i}`, text: `Mesajul ${i + 1}`, createdAt: minutesAgo(60 - i) })) } },
  });
  for (const size of [PHONE, LAPTOP]) {
    await openChat(page, context, size);
    const panel = page.getByRole('tabpanel', { name: /^Mesaje/ });
    const p = await panel.boundingBox();
    const f = await composer(page).boundingBox();
    expect(p && f).toBeTruthy();
    // The conversation ends where the composer starts (no overlap), and the composer reaches the bottom.
    expect(p!.y + p!.height).toBeLessThanOrEqual(f!.y + 1);
    // …and closes the conversation column at its bottom edge (the column fills the viewport).
    const col = (await page.getByRole('region', { name: 'Conversația' }).boundingBox())!;
    expect(Math.abs(f!.y + f!.height - (col.y + col.height))).toBeLessThanOrEqual(1);
    expect(col.y + col.height).toBeLessThanOrEqual(size.height);
    expect(col.y + col.height).toBeGreaterThanOrEqual(size.height - 16);
    // Scrolling the conversation does not move it.
    await panel.evaluate(el => (el.scrollTop = 0));
    expect((await composer(page).boundingBox())!.y).toBeCloseTo(f!.y, 0);
  }
});

/* ------------------------------------------------------------------ */
/* c30 — sending text                                                  */
/* ------------------------------------------------------------------ */

test('participant.chat.c28 participant.chat.c30 — desktop: Enter sends (recorded doc incl. senderRole), Shift+Enter is a newline; the bubble is there at once and the field is cleared and focused', async ({ page, context, fakeChat }) => {
  await openChat(page, context, LAPTOP);
  await field(page).click();
  await page.keyboard.type('Prima linie');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('a doua linie');
  await expect(field(page)).toHaveValue('Prima linie\na doua linie');
  expect(await messageWrites(fakeChat)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(field(page)).toHaveValue('');
  await expect(field(page)).toBeFocused();
  await expect(page.getByText(/Prima linie\s*a doua linie/)).toBeVisible();
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(1);
  const [w] = await messageWrites(fakeChat);
  expect(w.data).toEqual({
    senderId: me.documentId,
    senderName: me.username,
    senderAvatar: expect.anything(),
    text: 'Prima linie\na doua linie',
    senderRole: 'participant',
    createdAt: 'serverTimestamp',
    type: 'text',
  });
  // Enter on an empty field sends nothing.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect((await messageWrites(fakeChat)).length).toBe(1);
});

test.describe('touch screen', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('participant.chat.c28 — on a touch screen Enter is a newline; «Trimite» sends', async ({ page, context, fakeChat }) => {
    await openChat(page, context);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await field(page).tap();
    await page.keyboard.type('Unu');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Doi');
    await expect(field(page)).toHaveValue('Unu\nDoi');
    expect(await messageWrites(fakeChat)).toEqual([]);
    await sendButton(page).tap();
    await expect.poll(async () => (await messageWrites(fakeChat)).map(w => w.data?.text)).toEqual(['Unu\nDoi']);
  });

  test('participant.chat.c29 — the browser reports the camera denied: «Nu ai acordat permisiuni pentru cameră.» instead of a picker', async ({ page, context }) => {
    await context.addInitScript(() => {
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d: PermissionDescriptor) =>
        d.name === ('camera' as PermissionName) ? Promise.resolve({ state: 'denied', addEventListener() {}, removeEventListener() {} } as unknown as PermissionStatus) : query(d);
    });
    await openChat(page, context);
    let opened = false;
    page.on('filechooser', () => (opened = true));
    await cameraButton(page).tap();
    await expect(page.getByText('Nu ai acordat permisiuni pentru cameră.')).toBeVisible();
    expect(opened).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* c29 / c30 — photos                                                  */
/* ------------------------------------------------------------------ */

test('participant.chat.c29 — photos into the tray up to 10 (the rest refused with a toast), «Elimină poza» removes, the + is off when full; each thumbnail is «Decupează poza {i}»', async ({ page, context, fakeChat }) => {
  await openChat(page, context);
  await pick(page, 3);
  await expect(tray(page)).toHaveAttribute('aria-label', 'Poze atașate: 3 din 10');
  await expect(tray(page).getByRole('listitem')).toHaveCount(3);
  // A photo alone makes the slot «Trimite».
  await expectSlot(page, 'send');
  await shot(page, 'tray');
  // 9 more: 7 fit.
  await pick(page, 9, 3);
  await expect(tray(page).getByRole('listitem')).toHaveCount(10);
  await expect(page.getByText('Poți trimite cel mult 10 poze într-un mesaj.')).toBeVisible();
  await expect(addPhotos(page)).toBeDisabled();
  await shot(page, 'tray-full');
  // Each thumbnail is «Decupează poza {i}» (the crop dialog is participant.chat-photo's, proven in
  // concurs-chat-foto.spec.ts).
  for (let i = 1; i <= 10; i++) await expect(tray(page).getByRole('button', { name: `Decupează poza ${i}`, exact: true })).toBeVisible();
  // Remove two.
  await tray(page).getByRole('button', { name: 'Elimină poza 10' }).click();
  await tray(page).getByRole('button', { name: 'Elimină poza 1', exact: true }).click();
  await expect(tray(page).getByRole('listitem')).toHaveCount(8);
  await expect(addPhotos(page)).toBeEnabled();
  // A non-image never enters the tray.
  await page.getByTestId('chat-gallery-input').setInputFiles({ name: 'notite.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(tray(page).getByRole('listitem')).toHaveCount(8);
  // Only JPEG / PNG / WebP / HEIC are offered, and only what this browser decodes enters: an SVG and a
  // HEIC Chromium cannot read are refused with a toast (never uploaded as an unreadable original).
  await expect(page.getByTestId('chat-gallery-input')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/heic,image/heif');
  await page.getByTestId('chat-gallery-input').setInputFiles([
    { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>') },
    { name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from('not-a-real-heic') },
  ]);
  await expect(page.getByText('Formatul pozei nu este suportat.')).toBeVisible();
  await expect(tray(page).getByRole('listitem')).toHaveCount(8);
  // Removing them all brings the camera back.
  for (let i = 8; i >= 1; i--) await tray(page).getByRole('button', { name: `Elimină poza ${i}`, exact: true }).click();
  await expect(tray(page)).toHaveCount(0);
  await expectSlot(page, 'camera');
  expect(await fakeChat.writes()).toEqual(expect.not.arrayContaining([expect.objectContaining({ op: 'upload' })]));
});

test('participant.chat.c29 — the camera «Fă o poză» opens a picker asking for the back camera; its photo lands in the tray', async ({ page, context }) => {
  await openChat(page, context);
  await expect(page.getByTestId('chat-camera-input')).toHaveAttribute('capture', 'environment');
  const chooser = page.waitForEvent('filechooser');
  await cameraButton(page).click();
  const fc = await chooser;
  expect(fc.isMultiple()).toBe(false);
  await fc.setFiles(await photos(page, 1));
  await expect(tray(page).getByRole('listitem')).toHaveCount(1);
  // «Adaugă poze» is a multi-select picker.
  const chooser2 = page.waitForEvent('filechooser');
  await addPhotos(page).click();
  expect((await chooser2).isMultiple()).toBe(true);
});

test('participant.chat.c30 — photos + text: the bubble at once, each photo uploaded to /upload, then one message doc with the attachments', async ({ page, context, fakeChat }) => {
  const uploads = await mockUpload(page);
  await openChat(page, context);
  await pick(page, 2);
  await field(page).fill('Uite ce a ieșit');
  await sendButton(page).click();
  await expect(tray(page)).toHaveCount(0);
  await expect(field(page)).toHaveValue('');
  await expect(page.getByText('Uite ce a ieșit')).toBeVisible();
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(1);
  expect(uploads).toHaveLength(2);
  const [w] = await messageWrites(fakeChat);
  expect(w.data).toEqual(
    expect.objectContaining({
      text: 'Uite ce a ieșit',
      senderRole: 'participant',
      type: 'text',
      attachments: [expect.objectContaining({ url: expect.stringContaining('/uploads/chat_1.jpg') }), expect.objectContaining({ url: expect.stringContaining('/uploads/chat_2.jpg') })],
    }),
  );
});

test('participant.chat.c30 participant.chat.c31 — an upload refused (413) fails the row at once: «Nu s-a trimis», no message doc', async ({ page, context, fakeChat }) => {
  await mockUpload(page, { status: 413 });
  await openChat(page, context);
  await pick(page, 1);
  await sendButton(page).click();
  await expect(page.getByText(/Nu s-a trimis/)).toBeVisible();
  expect(await messageWrites(fakeChat)).toEqual([]);
  expect((await fakeChat.writes()).filter(w => w.op === 'upload')).toHaveLength(1);
});

test('participant.chat.c30 — when preparing fails, the photos and the reply come back with «Mesajul nu a putut fi pregătit pentru trimitere.»', async ({ page, context, fakeChat }) => {
  await openChat(page, context);
  await pick(page, 2);
  await field(page).fill('Nu pleacă');
  // The browser refuses the photos' local copies (the step before the row is stored).
  await page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new Error('quota');
    };
  });
  await sendButton(page).click();
  await expect(page.getByText(PREPARE_FAILED)).toBeVisible();
  await expect(tray(page).getByRole('listitem')).toHaveCount(2);
  expect(await messageWrites(fakeChat)).toEqual([]);
  await expect(page.getByText('Nu pleacă', { exact: true })).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* c25 / c26 — reply, edit                                             */
/* ------------------------------------------------------------------ */

test('participant.chat.c25 — «Răspunde»: the quoted sender and line above the field, focus in the field; «Renunță la răspuns» clears it; the send carries replyTo', async ({ page, context, fakeChat }) => {
  await fakeChat.seed({
    rooms: {
      participants: {
        messages: [
          chatMessage({ id: 'p1', senderId: 'u-ana', senderName: 'Ana Crap', text: 'Pe ce stand ești?', createdAt: minutesAgo(4) }),
          chatMessage({ id: 'p2', senderId: 'u-ion', senderName: 'Ion Pescaru', text: '', attachments: [{ id: 'a1', url: '/uploads/x.jpg', thumbnailUrl: '/uploads/x.jpg' }], createdAt: minutesAgo(3) }),
        ],
      },
    },
  });
  await openChat(page, context);
  await messageAction(page, 'Pe ce stand ești?', 'Răspunde');
  const preview = page.getByRole('group', { name: 'Răspunzi lui Ana Crap' });
  await expect(preview).toContainText('Ana Crap');
  await expect(preview).toContainText('Pe ce stand ești?');
  await expect(field(page)).toBeFocused();
  await shot(page, 'reply');
  await preview.getByRole('button', { name: 'Renunță la răspuns' }).click();
  await expect(preview).toHaveCount(0);
  await expect(field(page)).toBeFocused();

  await messageAction(page, 'Pe ce stand ești?', 'Răspunde');
  await page.keyboard.type('A7, lângă stuf.');
  await sendButton(page).click();
  await expect(page.getByRole('group', { name: /^Răspunzi lui/ })).toHaveCount(0);
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(1);
  const [w] = await messageWrites(fakeChat);
  expect(w.data).toEqual(
    expect.objectContaining({ text: 'A7, lângă stuf.', replyTo: expect.objectContaining({ messageId: 'p1', senderId: 'u-ana', senderName: 'Ana Crap', text: 'Pe ce stand ești?' }) }),
  );
});

test('participant.chat.c26 — «Editează»: the field filled under «Editezi mesajul», photo buttons hidden, send = an update with editedAt; «Renunță la editare» clears', async ({ page, context, fakeChat }) => {
  await fakeChat.seed({
    rooms: { participants: { messages: [chatMessage({ id: 'mine1', senderId: me.documentId, senderName: me.username, text: 'Am prins un crap', createdAt: minutesAgo(2) })] } },
  });
  await openChat(page, context);
  await messageAction(page, 'Am prins un crap', 'Editează');
  const banner = page.getByRole('group', { name: 'Editezi mesajul' });
  await expect(banner).toBeVisible();
  await expect(field(page)).toHaveValue('Am prins un crap');
  await expect(field(page)).toBeFocused();
  await expect(addPhotos(page)).toHaveCount(0);
  await expectSlot(page, 'send');
  await shot(page, 'edit');
  await banner.getByRole('button', { name: 'Renunță la editare' }).click();
  await expect(banner).toHaveCount(0);
  await expect(field(page)).toHaveValue('');
  await expect(addPhotos(page)).toBeVisible();

  await messageAction(page, 'Am prins un crap', 'Editează');
  await field(page).fill('Am prins un crap de 12 kg');
  await page.keyboard.press('Escape');
  await expect(banner).toHaveCount(0);
  await messageAction(page, 'Am prins un crap', 'Editează');
  await field(page).fill('Am prins un crap de 12 kg');
  await sendButton(page).click();
  await expect(banner).toHaveCount(0);
  await expect.poll(async () => (await fakeChat.writes()).filter(w => w.op === 'update')).toEqual([
    expect.objectContaining({ path: `competitions/${ID}/chats/participants/messages/mine1`, data: { text: 'Am prins un crap de 12 kg', editedAt: 'serverTimestamp' } }),
  ]);
  expect(await messageWrites(fakeChat)).toEqual([]);
});

test('participant.chat.c26 — an edit the database refuses: «Mesajul nu a putut fi editat.», the banner stays, the message keeps its text', async ({ page, context, fakeChat }) => {
  await fakeChat.seed({
    rooms: { participants: { messages: [chatMessage({ id: 'mine1', senderId: me.documentId, senderName: me.username, text: 'Am prins un crap', createdAt: minutesAgo(2) })] } },
  });
  await openChat(page, context);
  const msgPath = `competitions/${ID}/chats/participants/messages/mine1`;
  await fakeChat.failWrites(msgPath, { code: 'permission-denied' });
  await messageAction(page, 'Am prins un crap', 'Editează');
  const banner = page.getByRole('group', { name: 'Editezi mesajul' });
  await field(page).fill('Am prins un crap de 12 kg');
  await sendButton(page).click();
  await expect(page.getByText('Mesajul nu a putut fi editat.')).toBeVisible();
  await expect(banner).toBeVisible();
  // The fake records the attempt; the refused update never reaches the room.
  expect((await fakeChat.writes()).filter(w => w.op === 'update' && w.path === msgPath)).toHaveLength(1);
  await expect(page.getByRole('log', { name: 'Mesaje' }).getByText('Am prins un crap', { exact: true })).toBeVisible();
  await expect(page.getByText('Am prins un crap de 12 kg')).toHaveCount(0);
  expect(await messageWrites(fakeChat)).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* c32 — typing                                                        */
/* ------------------------------------------------------------------ */

test('participant.chat.c32 — typing writes «isTyping» at most every 2.5 s, clears after 5 s idle, on send and on blur', async ({ page, context, fakeChat }) => {
  await page.clock.install();
  await openChat(page, context);
  await field(page).click();
  await page.keyboard.type('Sal');
  await expect.poll(() => typingWrites(fakeChat)).toEqual([true]);
  // Keystrokes within 2.5 s write nothing more.
  await page.clock.runFor(1_000);
  await page.keyboard.type('ut');
  await page.clock.runFor(1_000);
  await page.keyboard.type(' !');
  expect(await typingWrites(fakeChat)).toEqual([true]);
  // Past 2.5 s since the last write: once more.
  await page.clock.runFor(700);
  await page.keyboard.type('!');
  await expect.poll(() => typingWrites(fakeChat)).toEqual([true, true]);
  // 5 s idle: cleared.
  await page.clock.runFor(5_100);
  await expect.poll(() => typingWrites(fakeChat)).toEqual([true, true, false]);
  // Typing again, then sending: cleared at once.
  await page.keyboard.type(' x');
  await expect.poll(() => typingWrites(fakeChat)).toEqual([true, true, false, true]);
  await sendButton(page).click();
  await expect.poll(() => typingWrites(fakeChat)).toEqual([true, true, false, true, false]);
  // Typing, then leaving the field: cleared.
  await page.keyboard.type('Încă');
  await expect.poll(() => typingWrites(fakeChat)).toEqual([true, true, false, true, false, true]);
  await field(page).blur();
  await expect.poll(() => typingWrites(fakeChat)).toEqual([true, true, false, true, false, true, false]);
  // Emptying the field does not report «stopped» per keystroke.
  await field(page).click();
  await page.clock.runFor(3_000);
  await page.keyboard.type('a');
  await page.keyboard.press('Backspace');
  expect((await typingWrites(fakeChat)).at(-1)).toBe(true);
});

/* ------------------------------------------------------------------ */
/* Offline                                                             */
/* ------------------------------------------------------------------ */

test('participant.chat.c30 participant.b.chat-outbox — offline: the message shows at once and is queued; back online it is written once', async ({ page, context, fakeChat }) => {
  await openChat(page, context);
  await context.setOffline(true);
  await field(page).fill('Din barcă');
  await sendButton(page).click();
  await expect(page.getByText('Din barcă')).toBeVisible();
  await expect(field(page)).toHaveValue('');
  await page.waitForTimeout(2_500);
  expect(await messageWrites(fakeChat)).toEqual([]);
  await context.setOffline(false);
  await expect.poll(async () => (await messageWrites(fakeChat)).map(w => w.data?.text)).toEqual(['Din barcă']);
  await expect(page.getByText(/Nu s-a trimis/)).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* a11y, keyboard, layouts                                             */
/* ------------------------------------------------------------------ */

test('participant.chat.c28 — keyboard: «Adaugă poze» → «Mesaj» → «Trimite»; tray buttons in order; Escape drops a reply; axe clean (empty, tray, reply)', async ({ page, context, fakeChat }) => {
  await fakeChat.seed({ rooms: { participants: { messages: [chatMessage({ id: 'p1', senderId: 'u-ana', senderName: 'Ana Crap', text: 'Bună!', createdAt: minutesAgo(2) })] } } });
  await openChat(page, context, LAPTOP);
  await expectNoA11yViolations(page);
  await addPhotos(page).focus();
  await page.keyboard.press('Tab');
  await expect(field(page)).toBeFocused();
  await page.keyboard.type('Salut');
  await page.keyboard.press('Tab');
  await expect(sendButton(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await field(page).fill('');
  await pick(page, 2);
  await expectNoA11yViolations(page);
  // Per photo: «Decupează poza {i}» then «Elimină poza {i}».
  await tray(page).getByRole('button', { name: 'Decupează poza 1', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(tray(page).getByRole('button', { name: 'Elimină poza 1', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(tray(page).getByRole('button', { name: 'Decupează poza 2', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(tray(page).getByRole('button', { name: 'Elimină poza 2', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(tray(page).getByRole('button', { name: 'Elimină poza 1', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tray(page).getByRole('listitem')).toHaveCount(1);
  await messageAction(page, 'Bună!', 'Răspunde');
  await expect(page.getByRole('group', { name: 'Răspunzi lui Ana Crap' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Răspunzi lui Ana Crap' })).toHaveCount(0);
});

for (const size of [PHONE, TABLET, LAPTOP, DESKTOP, { width: 1920, height: 1080 }]) {
  test(`participant.chat compunere layout ${size.width} — empty, tray, reply and edit states`, async ({ page, context, fakeChat }) => {
    await fakeChat.seed({
      rooms: {
        participants: {
          messages: [
            chatMessage({ id: 'p1', senderId: 'u-ana', senderName: 'Ana Crap', text: 'Bună dimineața! Pe ce stand ești? Eu am tras A7, lângă stuf, și bate vântul din față.', createdAt: minutesAgo(30) }),
            chatMessage({ id: 'p2', senderId: me.documentId, senderName: me.username, text: 'B3, la mal. Am prins deja doi crapi.', createdAt: minutesAgo(29) }),
          ],
        },
      },
    });
    await openChat(page, context, size);
    // Under 1280 the field is 16 px (iOS Safari zooms into a smaller one on focus; fish fontSize 16).
    const fontSize = await field(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBe(size.width < 1280 ? 16 : 15);
    // The field lines up with the conversation's reading column (one column, not two components).
    const bubbles = (await page.getByRole('log', { name: 'Mesaje' }).boundingBox())!;
    const fieldBox = (await field(page).boundingBox())!;
    const addBox = (await addPhotos(page).boundingBox())!;
    expect(addBox.x).toBeGreaterThanOrEqual(bubbles.x - 16);
    expect(fieldBox.x + fieldBox.width).toBeLessThanOrEqual(bubbles.x + bubbles.width + 16);
    await shot(page, 'state-empty');
    await pick(page, 4);
    await field(page).fill('Uite ce a ieșit azi dimineață');
    await expect(tray(page).getByRole('listitem')).toHaveCount(4);
    await page.waitForTimeout(300);
    await shot(page, 'state-tray');
    await messageAction(page, 'Bună dimineața! Pe ce stand ești? Eu am tras A7, lângă stuf, și bate vântul din față.', 'Răspunde');
    await page.waitForTimeout(300);
    await shot(page, 'state-reply');
    for (let i = 4; i >= 1; i--) await tray(page).getByRole('button', { name: `Elimină poza ${i}`, exact: true }).click();
    await page.getByRole('button', { name: 'Renunță la răspuns' }).click();
    await messageAction(page, 'B3, la mal. Am prins deja doi crapi.', 'Editează');
    await page.waitForTimeout(300);
    await shot(page, 'state-edit');
    // Nothing scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
