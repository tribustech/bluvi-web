import type { BrowserContext, Page, Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { CMS, qaJwt, signIn } from './helpers/session';
import { chatMessage, expect, minutesAgo, mockPreferences, systemMessage, test, type FakeChatHandle } from './helpers/fake-chat';

/*
 * Chat concurs — /concursuri/[id]/chat?tab=general|participanti (parity docs/parity/areas/participant.yml,
 * screen participant.chat slice 1 «frame + data»: c1–c11, c30–c31, c40–c42, and the behaviours
 * b.chat-entry, b.chat-badge, b.chat-notification-route, b.chat-open-room-push, b.chat-signed-out,
 * b.chat-realtime, b.chat-outbox). Each test names the ids it proves.
 *
 * Firestore is NEVER touched: the auto fixture (helpers/fake-chat.ts) installs the in-page fake
 * behind the chat's source seam and fails the test on any request to Firebase or /api/firebase-token.
 * The competition is the local CMS's live «[CHAT25]» (server-read for the header); the viewer's
 * statute, follow state, followers, the follow write and the notification preferences are
 * route-mocked, so nothing is written to the CMS either.
 */

const ID = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';
const CHAT = `/concursuri/${ID}/chat`;
const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };
const SHOTS = path.join(process.cwd(), '.shots', 'chat');

type Core = { name: string; viewers: number; registrations: { registrationStatus: string }[]; banner: { url: string } | null };
let core: Core;
let jwt = '';
let me = { documentId: '', username: '' };

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${CMS}/feed/competitions/${ID}`);
  expect(res.ok(), `competition ${ID} exists in the local CMS`).toBeTruthy();
  core = (await res.json()).data;
  jwt = await qaJwt(request);
  const meRes = await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } });
  me = await meRes.json();
  mkdirSync(SHOTS, { recursive: true });
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Role = 'author' | 'referee' | 'participant' | null;

/** The viewer's statute and follow state in this competition (route-mocked). */
async function mockViewer(context: BrowserContext, { role = null, following = true, isParticipant }: { role?: Role; following?: boolean; isParticipant?: boolean } = {}) {
  await context.route(`**/api/cms/user/profile/competition/${ID}/statute`, (route: Route) =>
    route.fulfill({ json: { userRole: role, ...(isParticipant !== undefined ? { isParticipant } : {}) } }),
  );
  await context.route(`**/api/cms/feed/competitions/${ID}/my-status`, (route: Route) =>
    route.fulfill({ json: { data: { isFollowing: following, userRegistrationStatus: role === 'participant' ? 'registered' : null } } }),
  );
  await context.route(`**/api/cms/feed/competitions/${ID}/followers`, (route: Route) =>
    route.fulfill({ json: { data: [{ documentId: 'u-ion', username: 'Ion Pescaru', avatar: null }, { documentId: 'u-ana', username: 'Ana Crap', avatar: null }] } }),
  );
}

async function openChat(page: Page, context: BrowserContext, { url = CHAT, size = PHONE }: { url?: string; size?: { width: number; height: number } } = {}) {
  await signIn(context, jwt, BASE_URL);
  await page.setViewportSize(size);
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible({ timeout: 60_000 });
}

const tab = (page: Page, name: RegExp | string) => page.getByRole('tab', { name });
const toast = (page: Page, text: string | RegExp) => page.getByText(text);
const visibleTablist = (page: Page) => page.locator('[role="tablist"][aria-label="Camere de chat"]:visible');

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}-${page.viewportSize()?.width}.png`) });
}

/* ------------------------------------------------------------------ */
/* Signed out, entry                                                   */
/* ------------------------------------------------------------------ */

test('participant.b.chat-signed-out — no session: 307 to /intra?next=<the chat with its room>', async ({ request }) => {
  const res = await request.get(`${CHAT}?tab=participanti`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe(`/intra?next=${encodeURIComponent(`${CHAT}?tab=participanti`)}`);
});

test('participant.b.chat-signed-out — a dead cookie: the sign-in gate in the chat frame, back to the chat', async ({ page, context }) => {
  await signIn(context, 'not-a-jwt', BASE_URL);
  await page.setViewportSize(PHONE);
  await page.goto(`${CHAT}?tab=general`);
  await expect(page.getByRole('heading', { name: 'Intră în cont ca să vezi chatul' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', `/intra?next=${encodeURIComponent(`${CHAT}?tab=general`)}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expectNoA11yViolations(page);
});

/* ------------------------------------------------------------------ */
/* Header, rooms                                                       */
/* ------------------------------------------------------------------ */

test('participant.chat.c1 participant.chat.c2 participant.chat.c4 participant.b.chat-realtime — a spectator: the competition named at first paint, General only (no switcher), «N urmăritori», live messages from the fake', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: null, following: true });
  await fakeChat.seed({ rooms: { general: { messages: [chatMessage({ id: 'g1', text: 'Salut, pescari!', createdAt: minutesAgo(5) })] } } });
  const errors = collectConsoleErrors(page);
  await openChat(page, context);
  // c1: the server HTML already names the room (the cached public read), before any script.
  const html = await (await context.request.get(CHAT)).text();
  expect(html).toContain(`>${core.name}</h1>`);
  await expect(page.getByRole('button', { name: 'Înapoi la concurs' })).toBeVisible();
  await expect(page.getByText('Salut, pescari!')).toBeVisible();
  await expect(visibleTablist(page)).toHaveCount(0);
  const followers = core.viewers === 1 ? '1 urmăritor' : new RegExp(`^${core.viewers}( de)? urmăritori$`);
  await expect(page.getByRole('button', { name: /urmăritor/ })).toHaveText(followers);
  // b.chat-realtime: a pushed snapshot lands without a reload.
  await fakeChat.pushMessage('general', chatMessage({ id: 'g2', text: 'Mesaj live', createdAt: Date.now() }));
  await expect(page.getByText('Mesaj live')).toBeVisible();
  const listened = await fakeChat.listened();
  expect(listened).toContain(`competitions/${ID}/chats/general/messages`);
  expect(listened.some(p => p.startsWith(`competitions/${ID}/chats/participants/messages`) && !p.includes('#'))).toBe(false);
  await shot(page, 'spectator');
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('participant.chat.c4 participant.chat.c5 participant.chat.c6 participant.chat.c2 — a member: «Participanți» | «General» as tabs, Participanți first, «N participanți», switching remembers the room (chat:lastTab)', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({
    rooms: {
      general: { messages: [chatMessage({ id: 'g1', text: 'Din General', createdAt: minutesAgo(3) })] },
      participants: { messages: [chatMessage({ id: 'p1', text: 'Din Participanți', createdAt: minutesAgo(2) })] },
    },
  });
  await openChat(page, context);
  const tabs = visibleTablist(page).getByRole('tab');
  await expect(tabs).toHaveText(['Participanți', 'General']);
  // c5: a member who did not choose lands on Participanți once the statute is known.
  await expect(tab(page, 'Participanți')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Din Participanți')).toBeVisible();
  const registered = core.registrations.filter(r => r.registrationStatus === 'registered').length;
  await expect(page.locator('header p').first()).toHaveText(registered === 1 ? '1 participant' : new RegExp(`^${registered}( de)? participanți$`));
  await shot(page, 'member');
  // c6: the keyboard moves between tabs (arrows) and the room is remembered per competition.
  await tab(page, 'Participanți').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'General')).toBeFocused();
  await expect(tab(page, 'General')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Din General')).toBeVisible();
  expect(await page.evaluate(id => localStorage.getItem(`chat:lastTab:${id}`), ID)).toBe('general');
  await expectNoA11yViolations(page);
});

test('participant.chat.c4 — a referee who is also on a team (statute.isParticipant) gets both rooms; ?tab=participanti for a spectator falls back to General', async ({ page, context }) => {
  await mockViewer(context, { role: 'referee', isParticipant: true });
  await openChat(page, context, { url: `${CHAT}?tab=participanti` });
  await expect(tab(page, 'Participanți')).toHaveAttribute('aria-selected', 'true');
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await mockViewer(context, { role: null });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible();
  await expect(visibleTablist(page)).toHaveCount(0);
  await expect(page.getByRole('tabpanel', { name: 'Mesaje, General' })).toBeVisible();
});

test('participant.chat.c5 participant.b.chat-notification-route — ?tab=general for a member opens General; a CHAT_MESSAGE notification link re-selects the room in the open chat', async ({ page, context }) => {
  await mockViewer(context, { role: 'participant' });
  await openChat(page, context, { url: `${CHAT}?tab=general` });
  await expect(tab(page, 'General')).toHaveAttribute('aria-selected', 'true');
  // The link a CHAT_MESSAGE row carries (lib/notification-href, unit-tested): same page, another room.
  await page.evaluate(href => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = 'notificare';
    a.id = 'notif-link';
    document.body.append(a);
  }, `${CHAT}?tab=participanti`);
  await page.evaluate(() => (window as unknown as { next?: { router: { push: (h: string) => void } } }).next?.router.push(document.getElementById('notif-link')!.getAttribute('href')!));
  await expect(tab(page, 'Participanți')).toHaveAttribute('aria-selected', 'true');
});

test('participant.chat.c5 participant.b.chat-notification-route — a room switch writes the room to the URL: a reload keeps it, and a notification for the room just left (the very link the chat opened with) re-selects it', async ({ page, context }) => {
  await mockViewer(context, { role: 'participant' });
  await openChat(page, context, { url: `${CHAT}?tab=general` });
  await expect(tab(page, 'General')).toHaveAttribute('aria-selected', 'true');
  await tab(page, 'Participanți').click();
  await expect(tab(page, 'Participanți')).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => new URL(page.url()).search).toBe('?tab=participanti');
  // A reload reopens the room on screen (the URL's), not the one the chat was opened with.
  await page.reload();
  await expect(tab(page, 'Participanți')).toHaveAttribute('aria-selected', 'true');
  // The same link the chat was opened with (a CHAT_MESSAGE for General): back to General.
  await page.evaluate(href => (window as unknown as { next?: { router: { push: (h: string) => void } } }).next?.router.push(href), `${CHAT}?tab=general`);
  await expect(tab(page, 'General')).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => new URL(page.url()).search).toBe('?tab=general');
});

test('participant.chat states — an unknown competition id is the competition’s not-found card: no chat, no Firestore listener', async ({ page, context, fakeChat }) => {
  await signIn(context, jwt, BASE_URL);
  await page.goto('/concursuri/zz00000000000000000000zz/chat');
  await expect(page.getByRole('heading', { name: 'Concursul nu a fost găsit' })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[role="status"][aria-label="Se încarcă chatul"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Înapoi la concurs' })).toHaveCount(0);
  expect(await fakeChat.listened()).toEqual([]);
});

test('participant.chat.c8 participant.chat.c9 — a ranking type core does not parse (the strict detail read fails): the follow state comes from /my-status, so the bell and the follow prompt still show', async ({ page, context }) => {
  // The browser's detail read answers a ranking type added to the CMS after this build.
  await context.route(
    url => url.pathname.endsWith(`/api/cms/feed/competitions/${ID}`),
    async route => {
      const res = await route.fetch();
      const body = (await res.json()) as { data: Record<string, unknown> };
      await route.fulfill({ response: res, json: { ...body, data: { ...body.data, rankingType: 'rankingTypeFromTheFuture' } } });
    },
  );
  // A follower: the General bell (c9).
  await mockViewer(context, { role: null, following: true });
  await mockPreferences(page);
  await openChat(page, context);
  await expect(page.getByRole('button', { name: 'Oprește notificările' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Nu urmărești concursul' })).toHaveCount(0);
  // A non-follower: the prompt (c8), no bell.
  await context.unroute(`**/api/cms/feed/competitions/${ID}/my-status`);
  await context.route(`**/api/cms/feed/competitions/${ID}/my-status`, route => route.fulfill({ json: { data: { isFollowing: false, userRegistrationStatus: null } } }));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Nu urmărești concursul' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /notificările/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible();
});

test('participant.chat.c7 — the room not on screen shows its unread count («99+» cap) and a crossed bell when muted; the tab says it', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await mockPreferences(page, { muted: ['chat:message:general'] });
  await fakeChat.seed({ rooms: { general: { unread: 3 }, participants: { unread: 0 } } });
  await openChat(page, context);
  await expect(tab(page, 'General, notificări oprite, 3 mesaje noi')).toBeVisible();
  await shot(page, 'unread');
  await fakeChat.push('general', { unread: 250 });
  await expect(tab(page, 'General, notificări oprite, 99+ mesaje noi')).toBeVisible();
  await expect(visibleTablist(page).getByText('99+')).toBeVisible();
  // The room on screen never shows its own count.
  await tab(page, 'General, notificări oprite, 99+ mesaje noi').click();
  await expect(tab(page, /^General, notificări oprite$/)).toHaveAttribute('aria-selected', 'true');
});

/* ------------------------------------------------------------------ */
/* Follow prompt, bell                                                 */
/* ------------------------------------------------------------------ */

test('participant.chat.c8 — a non-follower: «Nu urmărești concursul» → Urmărește follows, opens the notifications panel, the card goes; a failure toasts', async ({ page, context }) => {
  await mockViewer(context, { role: null, following: false });
  await mockPreferences(page);
  let following = false;
  const follows: unknown[] = [];
  await context.route(`**/api/cms/competitions/${ID}/follow`, async route => {
    follows.push(route.request().postDataJSON());
    following = true;
    await new Promise(r => setTimeout(r, 300));
    await route.fulfill({ json: { isFollowing: true } });
  });
  await context.route(`**/api/cms/feed/competitions/${ID}/my-status`, route => route.fulfill({ json: { data: { isFollowing: following, userRegistrationStatus: null } } }));
  await openChat(page, context);
  const card = page.getByRole('region', { name: 'Nu urmărești concursul' });
  await expect(card).toContainText('Urmărește-l ca să primești mesajele și evenimentele.');
  // No bell for a room that does not push to this viewer (c9).
  await expect(page.getByRole('button', { name: /notificările/ })).toHaveCount(0);
  await shot(page, 'follow-prompt');
  await card.getByRole('button', { name: 'Urmărește concursul' }).click();
  await expect(page.getByRole('dialog', { name: /Te-ai abonat/ })).toBeVisible();
  expect(follows).toEqual([{ follow: true }]);
  await expect(card).toHaveCount(0);
  // The failure path (a fresh page).
  await page.unroute('**/api/cms/feed/competitions/*/notification-preferences');
  await context.unroute(`**/api/cms/competitions/${ID}/follow`);
  following = false;
  await context.route(`**/api/cms/competitions/${ID}/follow`, route => route.fulfill({ status: 500, json: { error: { status: 500, message: 'x' } } }));
  await page.reload();
  await page.getByRole('button', { name: 'Urmărește concursul' }).click();
  await expect(toast(page, 'Nu am putut urmări concursul.')).toBeVisible();
});

test('participant.chat.c9 participant.chat.c10 — the bell: a confirmation naming the room, PUT mutedTypes with the room key, the toast; failure toast; Pornește when muted', async ({ page, context }) => {
  await mockViewer(context, { role: 'participant' });
  const puts = await mockPreferences(page, { muted: ['competition:start'] });
  await openChat(page, context, { url: `${CHAT}?tab=general` });
  const bell = page.getByRole('button', { name: 'Oprește notificările' });
  await expect(bell).toBeEnabled();
  await bell.click();
  const dialog = page.getByRole('dialog', { name: 'Oprește notificările' });
  await expect(dialog).toContainText('Chat general');
  await expect(dialog).toContainText('Ceilalți nu văd asta. Primești în continuare notificări pentru Chat participanți.');
  await page.waitForTimeout(500);
  await shot(page, 'mute-dialog');
  await expectNoA11yViolations(page);
  await dialog.getByRole('button', { name: 'Oprește' }).click();
  await expect(toast(page, 'Notificările pentru Chat general au fost oprite.')).toBeVisible();
  expect(puts).toEqual([{ mutedTypes: ['competition:start', 'chat:message:general'] }]);
  await expect(dialog).toBeHidden();
  // Muted: the bell turns, the tab says it, and the confirmation offers to turn it back on.
  const unmute = page.getByRole('button', { name: 'Activează notificările' });
  await expect(unmute).toBeVisible();
  await expect(tab(page, /^General, notificări oprite/)).toBeVisible();
  await unmute.click();
  const on = page.getByRole('dialog', { name: 'Pornește notificările' });
  await expect(on).toContainText('Vei primi din nou notificări pentru mesajele noi din Chat general.');
  await on.getByRole('button', { name: 'Pornește' }).click();
  await expect(toast(page, 'Notificările pentru Chat general au fost pornite.')).toBeVisible();
  expect(puts[1]).toEqual({ mutedTypes: ['competition:start'] });
});

test('participant.chat.c9 participant.chat.c10 — a follower without Participanți: «Ceilalți nu văd asta.»; a refused save toasts', async ({ page, context }) => {
  await mockViewer(context, { role: null, following: true });
  await mockPreferences(page, { failPut: true });
  await openChat(page, context);
  await page.getByRole('button', { name: 'Oprește notificările' }).click();
  const dialog = page.getByRole('dialog', { name: 'Oprește notificările' });
  await expect(dialog.getByText('Ceilalți nu văd asta.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Oprește' }).click();
  await expect(toast(page, 'Nu am putut salva preferința de notificări.')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Rules, closing, auth                                                */
/* ------------------------------------------------------------------ */

test('participant.chat.c11 — first chat ever: the blocking rules; «Am înțeles» records acceptedAt and closes', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ consent: 'absent' });
  await openChat(page, context);
  const rules = page.getByRole('alertdialog', { name: 'Reguli de bun-simț' });
  await expect(rules).toBeVisible();
  await expect(rules).toContainText('Chat-ul e al tuturor celor din concurs. Câteva reguli simple:');
  for (const rule of [
    'Fără injurii, jigniri sau limbaj vulgar.',
    'Fără spam, reclame sau mesaje repetate.',
    'Fără hărțuire; respect față de participanți și organizatori.',
    'Discuții despre concurs și pescuit — nimic ilegal sau ofensator.',
    'Încălcarea regulilor duce la blocarea accesului la chat și, la nevoie, la aplicație.',
  ])
    await expect(rules).toContainText(rule);
  // After the dialog's fade-in (axe would measure the button mid-animation).
  await page.waitForTimeout(500);
  await shot(page, 'rules');
  await expectNoA11yViolations(page);
  // Not dismissable: Escape and a click outside keep it.
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 400);
  await expect(rules).toBeVisible();
  await rules.getByRole('button', { name: 'Am înțeles' }).click();
  await expect(rules).toBeHidden();
  const writes = await fakeChat.writes();
  expect(writes.filter(w => w.path.includes('chatConsent'))).toEqual([
    expect.objectContaining({ op: 'set', path: `users/${me.documentId}/chatConsent/rules`, data: { acceptedAt: 'serverTimestamp' } }),
  ]);
});

test('participant.chat.c11 — «Nu accept» leaves the chat and records nothing; a failed save toasts and keeps it; an unreadable doc asks nothing', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ consent: 'absent', failures: { 'users/': { code: 'unavailable', times: 1 } } });
  await signIn(context, jwt, BASE_URL);
  await page.setViewportSize(PHONE);
  await page.goto(`/concursuri/${ID}/informatii`);
  await page.goto(CHAT);
  const rules = page.getByRole('alertdialog', { name: 'Reguli de bun-simț' });
  await rules.getByRole('button', { name: 'Am înțeles' }).click();
  await expect(toast(page, 'Nu am putut salva confirmarea. Te rugăm să încerci din nou.')).toBeVisible();
  await expect(rules).toBeVisible();
  const before = (await fakeChat.writes()).length;
  await rules.getByRole('button', { name: 'Nu accept' }).click();
  await page.waitForURL(`${BASE_URL}/concursuri/${ID}/informatii`);
  expect(before).toBe(1);
  // Unreadable consent doc: no dialog.
  await fakeChat.seed({ consent: 'unreadable' });
  await page.goto(CHAT);
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('participant.chat.c40 — the meta doc closes the chat live at closesAt: the composer becomes «Chat-ul s-a închis astăzi.», history stays', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await page.clock.install();
  await fakeChat.seed({ rooms: { participants: { messages: [chatMessage({ id: 'p1', text: 'Ultimul mesaj', createdAt: minutesAgo(1) })] } } });
  await openChat(page, context);
  await expect(page.getByRole('textbox', { name: 'Mesaj' })).toBeEditable();
  const closesAt = await page.evaluate(() => Date.now() + 60_000);
  await fakeChat.setMeta({ closesAt, reason: 'completed' });
  await page.clock.runFor(30_000);
  await expect(page.getByRole('textbox', { name: 'Mesaj' })).toBeVisible();
  await page.clock.runFor(31_000);
  await expect(page.getByText('Chat-ul s-a închis astăzi.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Mesaj' })).toHaveCount(0);
  await expect(page.getByText('Ultimul mesaj')).toBeVisible();
  await shot(page, 'closed');
});

test('participant.chat.c40 — a meta doc in the past: closed «… ieri.» at once; no meta and a cancelled competition is also closed (unit: resolveChatClosing)', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ meta: { closesAt: Date.now() - 24 * 3600_000, reason: 'completed' } });
  await openChat(page, context, { size: DESKTOP });
  await expect(page.getByText('Chat-ul s-a închis ieri.')).toBeVisible();
  await expect(page.getByText('Chat închis: doar citire')).toBeVisible();
});

test('participant.chat.c42 — Firebase sign-in fails: «Nu am putut autentifica chat-ul…»; a listener refused: «Nu am putut încărca chat-ul…»', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: null });
  await fakeChat.seed({ auth: 'fail' });
  await openChat(page, context);
  await expect(toast(page, 'Nu am putut autentifica chat-ul. Te rugăm să încerci din nou.')).toBeVisible();
  await fakeChat.seed({ auth: 'ok' });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible();
  await fakeChat.fail(`competitions/${ID}/chats/general/messages`, 'permission-denied');
  await expect(toast(page, 'Nu am putut încărca chat-ul. Te rugăm să încerci din nou.')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Header actions, back                                                */
/* ------------------------------------------------------------------ */

test('participant.chat.c3 — the banner opens large in the viewer; «N urmăritori» (General, not typing) opens the followers list; typing replaces the subtitle', async ({ page, context, fakeChat }) => {
  test.skip(!core.banner, 'the competition has no banner locally');
  await mockViewer(context, { role: null });
  await openChat(page, context);
  await page.getByRole('button', { name: 'Poza concursului' }).first().click();
  const viewer = page.getByRole('dialog', { name: core.name });
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await page.getByRole('button', { name: /urmăritori?, vezi lista$/ }).click();
  const list = page.getByRole('dialog', { name: 'Urmăritori' });
  await expect(list.getByText('Ana Crap')).toBeVisible();
  await expect(list.getByRole('link', { name: /Ana Crap/ })).toHaveAttribute('href', '/pescari/u-ana');
  await page.keyboard.press('Escape');
  // c2: someone typing → the header says so (and the subtitle is no longer a button).
  await fakeChat.push('general', { typing: [{ userId: 'u-ana', userName: 'Ana', isTyping: true }] });
  await expect(page.locator('header').getByText('Ana scrie...')).toBeVisible();
  await expect(page.getByRole('button', { name: /vezi lista$/ })).toHaveCount(0);
  await fakeChat.push('general', { typing: [{ userId: 'u-ana', userName: 'Ana', isTyping: true }, { userId: 'u-ion', userName: 'Ion', isTyping: true }] });
  await expect(page.locator('header').getByText('Ana și Ion scriu...')).toBeVisible();
});

test('participant.chat.c41 participant.b.chat-entry — from the competition page: the header link opens the last room; Back returns to the competition (a plain back)', async ({ page, context }) => {
  await mockViewer(context, { role: 'participant' });
  await signIn(context, jwt, BASE_URL);
  await page.setViewportSize(DESKTOP);
  await page.addInitScript(id => localStorage.setItem(`chat:lastTab:${id}`, 'general'), ID);
  await page.goto(`/concursuri/${ID}`);
  const link = page.getByRole('link', { name: /^Chat concurs/ });
  await expect(link).toHaveAttribute('href', `${CHAT}?tab=general`);
  await link.click();
  await page.waitForURL(`${BASE_URL}${CHAT}?tab=general`);
  await expect(tab(page, 'General')).toHaveAttribute('aria-selected', 'true');
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Înapoi la concurs' }).click();
  await page.waitForURL(`${BASE_URL}/concursuri/${ID}`);
  // A plain back: no new history entry was pushed.
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test('participant.chat.c41 — opened from a link (nothing underneath): Back replaces the chat with the competition page', async ({ page, context }) => {
  await mockViewer(context, { role: null });
  await openChat(page, context);
  await page.getByRole('button', { name: 'Înapoi la concurs' }).click();
  await page.waitForURL(`${BASE_URL}/concursuri/${ID}`);
  await page.goBack().catch(() => {});
  // Replaced: Back from the competition does not return to the chat.
  expect(page.url()).not.toContain('/chat');
});

/* ------------------------------------------------------------------ */
/* Entry, badge                                                        */
/* ------------------------------------------------------------------ */

test('participant.b.chat-entry participant.b.chat-badge — the phone bar’s Chat tile links the chat with the unread total; «Nou» for a chat never opened; nothing at 0; signed out: no entry', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ rooms: { general: { unread: 2, seen: true }, participants: { unread: 1, seen: true } } });
  await signIn(context, jwt, BASE_URL);
  await page.setViewportSize(PHONE);
  await page.goto(`/concursuri/${ID}`);
  const tile = page.getByRole('navigation', { name: 'Acțiuni concurs' }).getByRole('link', { name: /^Chat competiție/ });
  await expect(tile).toHaveAccessibleName('Chat competiție, 3 mesaje necitite', { timeout: 30_000 });
  await expect(tile).toHaveAttribute('href', new RegExp(`^${CHAT}`));
  await expect(tile.getByText('3')).toBeVisible();
  // Never opened (no receipt in any readable room) and messages waiting → «Nou».
  await fakeChat.seed({ rooms: { general: { unread: 4, seen: false }, participants: { unread: 0, seen: false } } });
  await page.reload();
  await expect(tile).toHaveAccessibleName('Chat competiție, mesaje noi', { timeout: 30_000 });
  await expect(tile.getByText('Nou')).toBeVisible();
  // Nothing unread → no badge.
  await fakeChat.seed({ rooms: { general: { unread: 0, seen: true }, participants: { unread: 0, seen: true } } });
  await page.reload();
  await expect(tile).toHaveAccessibleName('Chat competiție', { timeout: 30_000 });
  await tile.click();
  await page.waitForURL(new RegExp(`${CHAT}`));
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible();
  // Signed out: no chat entry on the competition page.
  await context.clearCookies();
  await page.goto(`/concursuri/${ID}`);
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Chat/ })).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* Send pipeline                                                       */
/* ------------------------------------------------------------------ */

const messageWrites = async (fakeChat: FakeChatHandle, room = 'participants') =>
  (await fakeChat.writes()).filter(w => w.op === 'set' && w.path.startsWith(`competitions/${ID}/chats/${room}/messages/`));

test('participant.chat.c30 participant.b.chat-realtime — a send shows my bubble at once (pending), then the message doc is written with fish’s fields and the role chip', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await openChat(page, context);
  await page.getByRole('textbox', { name: 'Mesaj' }).fill('Prima captură!');
  await page.getByRole('button', { name: 'Trimite' }).click();
  await expect(page.getByText('Prima captură!')).toBeVisible();
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(1);
  const [w] = await messageWrites(fakeChat);
  expect(w.data).toEqual({
    senderId: me.documentId,
    senderName: me.username,
    senderAvatar: expect.anything(),
    text: 'Prima captură!',
    senderRole: 'participant',
    createdAt: 'serverTimestamp',
    type: 'text',
  });
  await expect(page.getByText('Nu s-a trimis')).toHaveCount(0);
  await shot(page, 'sent');
});

test('participant.chat.c31 — a failing write is retried after 2 s, 8 s and 30 s, then «Nu s-a trimis» with Reîncearcă; Reîncearcă delivers', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await page.clock.install();
  await openChat(page, context);
  await fakeChat.failWrites(`competitions/${ID}/chats/participants/messages/`, { code: 'unavailable', times: 4 });
  await page.getByRole('textbox', { name: 'Mesaj' }).fill('Merge?');
  await page.getByRole('button', { name: 'Trimite' }).click();
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(1);
  await page.clock.runFor(1_900);
  expect((await messageWrites(fakeChat)).length).toBe(1);
  await page.clock.runFor(300);
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(2);
  await page.clock.runFor(7_900);
  expect((await messageWrites(fakeChat)).length).toBe(2);
  await page.clock.runFor(300);
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(3);
  await page.clock.runFor(29_800);
  expect((await messageWrites(fakeChat)).length).toBe(3);
  await page.clock.runFor(400);
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(4);
  // Four attempts: failed, kept on screen with the way out.
  await expect(page.getByText('Nu s-a trimis')).toBeVisible();
  await page.clock.runFor(60_000);
  expect((await messageWrites(fakeChat)).length).toBe(4);
  await page.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(5);
  await expect(page.getByText('Nu s-a trimis')).toHaveCount(0);
  await expect(page.getByText('Merge?')).toBeVisible();
});

test('participant.chat.c31 — a permission-denied write with the role chip is retried once without it', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await openChat(page, context);
  await fakeChat.failWrites(`competitions/${ID}/chats/participants/messages/`, { code: 'permission-denied', ifField: 'senderRole' });
  await page.getByRole('textbox', { name: 'Mesaj' }).fill('Fără chip');
  await page.getByRole('button', { name: 'Trimite' }).click();
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(3);
  const writes = await messageWrites(fakeChat);
  expect(writes.map(w => 'senderRole' in (w.data ?? {}))).toEqual([true, true, false]);
  await expect(page.getByText('Nu s-a trimis')).toHaveCount(0);
});

test('participant.chat.c31 participant.b.chat-outbox — offline spends no attempt; the queued row survives a reload and is delivered once the page is back', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await openChat(page, context);
  // The chat's live layer is in (the room answered, the composer is enabled) before the network goes.
  await expect(tab(page, 'Participanți')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Mesaj' })).toBeEnabled();
  await context.setOffline(true);
  await page.getByRole('textbox', { name: 'Mesaj' }).fill('Din barcă, fără semnal');
  await page.getByRole('button', { name: 'Trimite' }).click();
  await expect(page.getByText('Din barcă, fără semnal')).toBeVisible();
  await page.waitForTimeout(2_500);
  expect(await messageWrites(fakeChat)).toEqual([]);
  // The row is stored (IndexedDB) with no attempt spent.
  const stored = await page.evaluate(
    () =>
      new Promise<unknown>(resolve => {
        const req = indexedDB.open('bluvi-chat', 1);
        req.onsuccess = () => {
          const get = req.result.transaction('kv').objectStore('kv').get('chat-outbox.v1');
          get.onsuccess = () => resolve(get.result);
        };
      }),
  );
  expect(stored).toEqual([expect.objectContaining({ message: expect.objectContaining({ text: 'Din barcă, fără semnal', attempts: 0, status: 'queued' }) })]);
  // Back online the write still fails here (the row stays queued) — then the page is left: the
  // next load drains the stored row.
  await fakeChat.failWrites(`competitions/${ID}/chats/participants/messages/`, { code: 'unavailable' });
  await context.setOffline(false);
  await expect.poll(async () => (await messageWrites(fakeChat)).length).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible();
  await expect.poll(async () => (await messageWrites(fakeChat)).map(w => w.data?.text)).toEqual(['Din barcă, fără semnal']);
  await expect(page.getByText('Din barcă, fără semnal')).toBeVisible();
});

test('participant.b.chat-open-room-push — a message from someone else in the open room raises no in-app toast', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: null });
  await openChat(page, context);
  await fakeChat.pushMessage('general', chatMessage({ id: 'x1', senderId: 'u-ana', senderName: 'Ana Crap', text: 'Am prins unul mare', createdAt: Date.now() }));
  await expect(page.getByText('Am prins unul mare')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('.z-toast p')).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* Layouts                                                             */
/* ------------------------------------------------------------------ */

for (const size of [TABLET, { width: 1280, height: 800 }, DESKTOP, { width: 1920, height: 1080 }]) {
  test(`participant.chat layout ${size.width} — header + tabs over the conversation; from 1280 three columns that scroll on their own; nothing floats`, async ({ page, context, fakeChat }) => {
    await mockViewer(context, { role: 'participant' });
    await mockPreferences(page, { muted: ['chat:message:general'] });
    await fakeChat.seed({
      rooms: {
        participants: {
          messages: [
            systemMessage('competition:start', '🏁 Concursul a început', { id: 's1', createdAt: minutesAgo(40) }),
            chatMessage({ id: 'p1', text: 'Bună dimineața! Pe ce stand ești?', createdAt: minutesAgo(30) }),
            chatMessage({ id: 'p2', senderId: me.documentId, senderName: me.username, text: 'A7, lângă stuf.', createdAt: minutesAgo(29) }),
            chatMessage({
              id: 'p3',
              senderId: 'u-ana',
              senderName: 'Ana Crap',
              text: 'Uite ce a ieșit',
              createdAt: minutesAgo(10),
              attachments: [{ id: 'a1', url: '/images/competition-placeholder-thumb.jpg', thumbnailUrl: '/images/competition-placeholder-thumb.jpg', width: 192, height: 192 }],
            }),
          ],
        },
        general: { unread: 5 },
      },
    });
    await openChat(page, context, { size });
    await expect(page.getByText('A7, lângă stuf.')).toBeVisible();
    if (size.width >= 1280) {
      await expect(page.getByRole('complementary', { name: 'Concursul' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Clasament' })).toHaveAttribute('href', `/concursuri/${ID}/clasament`);
      await expect(page.getByRole('link', { name: 'Participanți' })).toHaveAttribute('href', `/concursuri/${ID}/participanti`);
      await expect(page.getByRole('heading', { name: 'Poze din cameră' })).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Despre cameră' }).getByRole('button', { name: 'Imagine 1 din 1' })).toBeVisible();
      await expect(visibleTablist(page)).toHaveAttribute('aria-orientation', 'vertical');
    } else {
      await expect(page.getByRole('complementary', { name: 'Concursul' })).toBeHidden();
      await expect(visibleTablist(page)).toHaveAttribute('aria-orientation', 'horizontal');
    }
    // The page itself never scrolls (each column does): nothing can float.
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    await shot(page, 'layout');
    await expectNoA11yViolations(page);
  });
}

test('participant.chat states — the loading frame (skeleton, no spinner) streams first while the session and the competition are read', async ({ page, context }) => {
  await mockViewer(context, { role: 'participant' });
  await signIn(context, jwt, BASE_URL);
  // The streamed HTML starts with the Suspense fallback (ChatSkeleton). Frozen here: the boundary's
  // reveal is dropped and no bundle runs, so the fallback stays as the first paint showed it.
  await page.route(url => url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js'), route => route.abort());
  await page.route(`**${CHAT}`, async route => {
    const res = await route.fetch();
    let html = await res.text();
    const boundary = /<template id="(B:\d+)"><\/template><div role="status" aria-label="Se încarcă chatul"/.exec(html)?.[1];
    expect(boundary, 'the chat streams its skeleton first').toBeTruthy();
    html = html.replace(new RegExp(`\\$RC\\("${boundary}","S:\\d+"\\)`, 'g'), '');
    await route.fulfill({ response: res, body: html });
  });
  for (const size of [PHONE, DESKTOP]) {
    await page.setViewportSize(size);
    await page.goto(CHAT);
    await expect(page.locator('[role="status"][aria-label="Se încarcă chatul"]:visible')).toHaveCount(1);
    await shot(page, 'loading');
  }
});
