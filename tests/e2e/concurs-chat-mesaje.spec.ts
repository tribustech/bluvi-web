import type { BrowserContext, Locator, Page, Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';
import { BASE_URL } from './helpers/base-url';
import { chatMessage, expect, minutesAgo, systemMessage, test, type FakeChatHandle, type FakeChatMessage } from './helpers/fake-chat';

/*
 * Chat concurs — the message list (docs/parity/areas/participant.yml, participant.chat slice 2
 * «mesaje»: c12–c24, c27, c33–c39 and the failed-row line of c31). Each test names the ids it proves.
 *
 * Firestore is NEVER touched: the auto fixture (helpers/fake-chat.ts) serves seeded histories behind
 * the chat's source seam, records every write (receipts, reactions, deletes, sends) and fails the
 * test on any request to Firebase. The competition is the local CMS's live «[CHAT25]» (its public
 * read names the header); the viewer's statute, follow state and the notification preferences are
 * route-mocked, so nothing is written to the CMS.
 */

const ID = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';
const CHAT = `/concursuri/${ID}/chat`;
const GENERAL = `${CHAT}?tab=general`;
const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 800 };
const DESKTOP = { width: 1440, height: 900 };
const WIDE = { width: 1920, height: 1080 };
const SHOTS = path.join(process.cwd(), '.shots', 'chat-mesaje');
const MSGS = `competitions/${ID}/chats`;

let jwt = '';
let core: { name: string };
let me = { documentId: '', username: '' };

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${CMS}/feed/competitions/${ID}`);
  expect(res.ok(), `competition ${ID} exists in the local CMS`).toBeTruthy();
  core = (await res.json()).data;
  jwt = await qaJwt(request);
  me = await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
  mkdirSync(SHOTS, { recursive: true });
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Role = 'author' | 'referee' | 'participant' | null;

async function mockViewer(context: BrowserContext, { role = 'participant' as Role, following = true } = {}) {
  await context.route(`**/api/cms/user/profile/competition/${ID}/statute`, (route: Route) => route.fulfill({ json: { userRole: role } }));
  await context.route(`**/api/cms/feed/competitions/${ID}/my-status`, (route: Route) =>
    route.fulfill({ json: { data: { isFollowing: following, userRegistrationStatus: role === 'participant' ? 'registered' : null } } }),
  );
  await context.route('**/api/cms/feed/competitions/*/notification-preferences', (route: Route) =>
    route.fulfill({ json: { groups: [], extraMuted: [] } }),
  );
}

async function openChat(page: Page, context: BrowserContext, { url = GENERAL, size = PHONE }: { url?: string; size?: { width: number; height: number } } = {}) {
  await signIn(context, jwt, BASE_URL);
  await page.setViewportSize(size);
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: core.name })).toBeVisible({ timeout: 60_000 });
}

const panel = (page: Page) => page.getByRole('tabpanel', { name: /^Mesaje/ });
const log = (page: Page) => page.getByRole('log', { name: 'Mesaje' });
const row = (page: Page, id: string) => page.locator(`[data-message-id="${id}"]`);
const bubbleOf = (page: Page, text: string) => log(page).getByText(text, { exact: true }).first();
const menu = (page: Page) => page.getByRole('menu', { name: 'Acțiuni mesaj' });

/** Opens a message's actions with a context click (fish's long-press). */
async function contextMenu(page: Page, text: string) {
  await bubbleOf(page, text).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}-${page.viewportSize()?.width}.png`) });
}

const ago = (min: number) => minutesAgo(min);
const daysAgo = (d: number, hour = 10, min = 0) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  x.setHours(hour, min, 0, 0);
  return x.getTime();
};
const writesTo = async (fakeChat: FakeChatHandle, prefix: string) => (await fakeChat.writes()).filter(w => w.path.startsWith(prefix));
const receipts = (fakeChat: FakeChatHandle, room = 'general') => writesTo(fakeChat, `${MSGS}/${room}/receipts/`);

/** A coloured photo as a data URL (no network). */
function photo(id: string, w = 1200, h = 900, tone = '6265f1') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#${tone}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="#ffffff" fill-opacity="0.5"/></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return { id, url, thumbnailUrl: url, width: w, height: h, blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' };
}

/** n messages from others, one a minute, oldest first, ids `${prefix}${i}`. */
function history(n: number, { prefix = 'h', startMin = n + 5, sender = { senderId: 'u-ion', senderName: 'Ion Pescaru' } } = {}): FakeChatMessage[] {
  return Array.from({ length: n }, (_, i) => chatMessage({ id: `${prefix}${i + 1}`, text: `Mesajul ${i + 1}`, createdAt: ago(startMin - i), ...sender }));
}

async function scrollToTop(page: Page) {
  await panel(page).evaluate(el => el.scrollTo({ top: -el.scrollHeight }));
}
async function scrollUp(page: Page, px: number) {
  await panel(page).evaluate((el, d) => el.scrollBy({ top: -d }), px);
}
const distanceFromEnd = (page: Page) => panel(page).evaluate(el => Math.abs(el.scrollTop));
async function inView(page: Page, loc: Locator) {
  const [a, b] = await Promise.all([panel(page).boundingBox(), loc.boundingBox()]);
  return !!a && !!b && b.y >= a.y - 1 && b.y + b.height <= a.y + a.height + 1;
}

/* ------------------------------------------------------------------ */
/* c13 c14 — loading, empty                                             */
/* ------------------------------------------------------------------ */

test('participant.chat.c13 participant.chat.c14 — bubble skeletons while the room loads; an empty room «Niciun mesaj încă» + the room line; «Trimite un salut» sends 👋👋👋 through the normal send', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  // The fake answers its listeners from `defer` (a 0 ms timer): held here, the room stays loading.
  await context.addInitScript(() => {
    const w = window as unknown as { __holdChat?: (() => void)[] | null; setTimeout: typeof setTimeout };
    w.__holdChat = [];
    const real = window.setTimeout.bind(window);
    w.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => {
      if (w.__holdChat && !ms && /\bat defer\b/.test(new Error().stack ?? '')) {
        w.__holdChat.push(fn);
        return 0;
      }
      return real(fn, ms, ...rest);
    }) as typeof setTimeout;
  });
  await openChat(page, context);
  const skeleton = page.getByRole('status', { name: 'Se încarcă mesajele' });
  await expect(skeleton).toBeVisible();
  await expect(skeleton.locator('span')).toHaveCount(6);
  await shot(page, 'skeleton');
  await page.evaluate(() => {
    const w = window as unknown as { __holdChat?: (() => void)[] | null };
    const held = w.__holdChat ?? [];
    w.__holdChat = null;
    held.forEach(fn => fn());
  });
  await expect(page.getByText('Niciun mesaj încă')).toBeVisible();
  await expect(page.getByText('Fii primul care le scrie urmăritorilor concursului.')).toBeVisible();
  await expectNoA11yViolations(page);
  await shot(page, 'empty');
  await expect(page.getByRole('button', { name: 'Apasă ca să saluți 👋👋👋' })).toHaveAttribute('title', 'Trimite un salut');
  await page.getByRole('button', { name: 'Apasă ca să saluți 👋👋👋' }).click();
  await expect.poll(async () => (await writesTo(fakeChat, `${MSGS}/general/messages/`)).map(w => w.data?.text)).toEqual(['👋👋👋']);
  await expect(log(page).getByText('👋👋👋')).toBeVisible();
  await expect(page.getByText('Niciun mesaj încă')).toHaveCount(0);

  // Participanți: its own line.
  await page.getByRole('tab', { name: /Participanți/ }).first().click();
  await expect(page.getByText('Fii primul care scrie participanților.')).toBeVisible();
});

test('participant.chat.c14 — a closed chat: the empty room offers no greeting', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ meta: { closesAt: daysAgo(1) } });
  await openChat(page, context);
  await expect(page.getByText('Niciun mesaj încă')).toBeVisible();
  await expect(page.getByRole('button', { name: /saluți/ })).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* c12 — pagination, conversation start                                 */
/* ------------------------------------------------------------------ */

test('participant.chat.c12 — the newest 50 first; older pages of 50 load near the top; the whole history ends in «Acesta este începutul conversației.» + who reads the room', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ rooms: { general: { messages: history(120) }, participants: { messages: history(3, { prefix: 'p' }) } } });
  await openChat(page, context, { size: TABLET });
  await expect(row(page, 'h120')).toBeVisible();
  await expect(log(page).locator('[data-message-id]')).toHaveCount(50);
  await expect(page.getByText('Acesta este începutul conversației.')).toHaveCount(0);
  await expect(row(page, 'h120')).toBeInViewport();
  // Scrolling up asks for the next page before the top is reached.
  await scrollToTop(page);
  await expect(log(page).locator('[data-message-id]')).toHaveCount(100);
  await scrollToTop(page);
  await expect(log(page).locator('[data-message-id]')).toHaveCount(120);
  await scrollToTop(page);
  await expect(page.getByText('Acesta este începutul conversației.')).toBeVisible();
  await expect(page.getByText('Mesajele se văd de către urmăritorii concursului.').first()).toBeVisible();
  await shot(page, 'start-general');

  // A short room is whole from the first page.
  await page.getByRole('tab', { name: /Participanți/ }).first().click();
  await expect(row(page, 'p3')).toBeVisible();
  await expect(page.getByText('Acesta este începutul conversației.')).toBeVisible();
  await expect(panel(page).getByText('Mesajele se văd de către participanți și organizatori.')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* c15 c16 c17 c18 — days, groups, bubbles                              */
/* ------------------------------------------------------------------ */

function bubblesHistory(): FakeChatMessage[] {
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1, 11, 12);
  lastYear.setHours(9, 0, 0, 0);
  return [
    chatMessage({ id: 'y1', text: 'Mesaj de anul trecut', createdAt: lastYear.getTime(), senderId: 'u-ana', senderName: 'Ana Crap' }),
    chatMessage({ id: 'd3', text: 'Acum trei zile', createdAt: daysAgo(3), senderId: 'u-ana', senderName: 'Ana Crap' }),
    chatMessage({ id: 'i1', text: 'Ieri la mal', createdAt: daysAgo(1, 9, 0), senderId: 'u-org', senderName: 'Org Bluvi', senderRole: 'organizer' }),
    // A group: Ion, three messages within 5 minutes.
    chatMessage({ id: 'g1', text: 'Bună dimineața!', createdAt: ago(30), senderRole: 'participant' }),
    chatMessage({ id: 'g2', text: 'Detalii pe https://bluvi.ro/reguli sau la 0722 123 456', createdAt: ago(28), senderRole: 'participant' }),
    chatMessage({ id: 'g3', text: 'Am corectat ora', createdAt: ago(27), senderRole: 'participant', editedAt: ago(26) }),
    // Ten minutes later: a new group.
    chatMessage({ id: 'g4', text: 'Altă grupă', createdAt: ago(16), senderRole: 'participant' }),
    chatMessage({ id: 'ref', text: 'Atenție la start', createdAt: ago(15), senderId: 'u-ref', senderName: 'Radu Arbitru', senderRole: 'referee', senderAvatar: photo('av').url }),
    chatMessage({ id: 'del1', text: '', createdAt: ago(14), senderId: 'u-ana', senderName: 'Ana Crap', deletedAt: ago(13), deletedBy: 'u-ana' }),
    chatMessage({ id: 'del2', text: '', createdAt: ago(12), senderId: 'u-ana', senderName: 'Ana Crap', deletedAt: ago(11), deletedBy: 'u-org' }),
    chatMessage({ id: 'mine1', text: 'Văzut de toți', createdAt: ago(10), senderId: me.documentId, senderName: me.username }),
    chatMessage({ id: 'mine2', text: 'Văzut doar de unii', createdAt: ago(5), senderId: me.documentId, senderName: me.username }),
  ];
}

test('participant.chat.c15 participant.chat.c16 participant.chat.c17 participant.chat.c18 — day chips, 5-minute groups with avatar link and role, mine vs others, links, (editat), ✓✓ / read, deleted copy', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({
    rooms: {
      general: {
        messages: bubblesHistory(),
        // Ana read past mine1, Ion only up to g4: mine1 read by every known reader, mine2 delivered.
        receipts: [
          { userId: 'u-ana', lastReadAt: ago(8) },
          { userId: 'u-ion', lastReadAt: ago(9) },
          { userId: me.documentId, lastReadAt: ago(4) },
        ],
      },
    },
  });
  await openChat(page, context, { size: DESKTOP });
  await expect(row(page, 'mine2')).toBeVisible();

  // c15: the day separators.
  const year = new Date().getFullYear() - 1;
  const chips = log(page).locator('[data-sep]');
  await expect(chips.first()).toHaveText(`12 dec. ${year}`);
  await expect(chips.filter({ hasText: 'Ieri' })).toHaveCount(1);
  await expect(chips.filter({ hasText: 'Astăzi' })).toHaveCount(1);
  const weekday = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'][new Date(daysAgo(3)).getDay()];
  await expect(chips.filter({ hasText: new RegExp(`^${weekday}, \\d+ `) })).toHaveCount(1);

  // c16: Ion's three messages are one group (first / middle / last), the 4th starts a new one.
  await expect(row(page, 'g1').locator('[data-group-position]')).toHaveAttribute('data-group-position', 'first');
  await expect(row(page, 'g2').locator('[data-group-position]')).toHaveAttribute('data-group-position', 'middle');
  await expect(row(page, 'g3').locator('[data-group-position]')).toHaveAttribute('data-group-position', 'last');
  await expect(row(page, 'g4').locator('[data-group-position]')).toHaveAttribute('data-group-position', 'single');
  // Avatar + name on the first only; the avatar links to the angler's profile; the role under the name (General).
  await expect(row(page, 'g1').getByRole('link', { name: 'Profilul lui Ion Pescaru' })).toHaveAttribute('href', '/pescari/u-ion');
  await expect(row(page, 'g2').getByRole('link', { name: /Profilul lui/ })).toHaveCount(0);
  await expect(row(page, 'g1').getByText('Participant', { exact: true })).toBeVisible();
  await expect(row(page, 'i1').getByText('Organizator', { exact: true })).toBeVisible();
  await expect(row(page, 'ref').getByText('Arbitru', { exact: true })).toBeVisible();
  await expect(row(page, 'ref').locator('img').first()).toBeVisible();

  // c17: links and tel:, HH:mm, (editat); mine on the right in the accent, others on the left.
  await expect(row(page, 'g2').getByRole('link', { name: 'https://bluvi.ro/reguli' })).toHaveAttribute('href', 'https://bluvi.ro/reguli');
  await expect(row(page, 'g2').getByRole('link', { name: 'https://bluvi.ro/reguli' })).toHaveAttribute('target', '_blank');
  await expect(row(page, 'g2').getByRole('link', { name: '0722 123 456' })).toHaveAttribute('href', 'tel:0722123456');
  await expect(row(page, 'g3').getByText('(editat)')).toBeVisible();
  const hhmm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);
  await expect(row(page, 'g3')).toContainText(hhmm(Date.now() - 27 * 60_000).slice(0, 2));
  const mineBox = await row(page, 'mine1').locator('[data-bubble]').boundingBox();
  const otherBox = await row(page, 'g4').locator('[data-bubble]').boundingBox();
  expect(mineBox!.x).toBeGreaterThan(otherBox!.x + 100);
  await expect(row(page, 'mine1').locator('[data-tick]')).toHaveAttribute('data-tick', 'read');
  await expect(row(page, 'mine2').locator('[data-tick]')).toHaveAttribute('data-tick', 'delivered');
  await expect(row(page, 'mine1').getByText('Citit')).toBeAttached();
  await expect(row(page, 'g1').locator('[data-tick]')).toHaveCount(0);

  // c18: deleted by the sender / by an organizer.
  await expect(row(page, 'del1')).toContainText('Acest mesaj a fost șters');
  await expect(row(page, 'del1')).not.toContainText('de organizator');
  await expect(row(page, 'del2')).toContainText('Acest mesaj a fost șters de organizator');
  await expectNoA11yViolations(page);
  for (const size of [PHONE, TABLET, LAPTOP, DESKTOP, WIDE]) {
    await page.setViewportSize(size);
    await panel(page).evaluate(el => el.scrollTo({ top: 0 }));
    await page.waitForTimeout(150);
    await shot(page, 'bubbles');
  }
});

test('participant.chat.c15 — scrolling floats the day of the topmost row', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  const older = Array.from({ length: 30 }, (_, i) => chatMessage({ id: `o${i}`, text: `Ieri ${i}`, createdAt: daysAgo(1, 8, i) }));
  const today = Array.from({ length: 30 }, (_, i) => chatMessage({ id: `t${i}`, text: `Azi ${i}`, createdAt: ago(40 - i) }));
  await fakeChat.seed({ rooms: { general: { messages: [...older, ...today] } } });
  await openChat(page, context);
  await expect(row(page, 't29')).toBeVisible();
  const chip = page.getByTestId('chat-floating-day');
  // The reader scrolls (the wheel) into yesterday's messages, short of the top (where the real «Ieri» chip is).
  const box = (await panel(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6 && !(await row(page, 'o20').isVisible().then(v => v && inView(page, row(page, 'o20')))); i++) await page.mouse.wheel(0, -500);
  await expect(chip).toHaveText('Ieri');
  await expect(chip).toHaveAttribute('data-on');
  await shot(page, 'floating-day');
  // It fades once scrolling stops.
  await expect(chip).not.toHaveAttribute('data-on', { timeout: 5_000 });
});

/* ------------------------------------------------------------------ */
/* c19 — replies                                                        */
/* ------------------------------------------------------------------ */

test('participant.chat.c19 — the quote shows the original’s current text / «Mesaj șters» / the snapshot; clicking it loads older pages, centres and flashes the original; an unknown one toasts', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  const old = chatMessage({ id: 'orig', text: 'Unde e standul 7?', createdAt: ago(300), senderId: 'u-ana', senderName: 'Ana Crap' });
  const filler = history(70, { startMin: 250 });
  const edited = chatMessage({ id: 'ed', text: 'Text corectat', createdAt: ago(9), editedAt: ago(8), senderId: 'u-ana', senderName: 'Ana Crap' });
  const gone = chatMessage({ id: 'gone', text: '', createdAt: ago(8), senderId: 'u-ana', senderName: 'Ana Crap', deletedAt: ago(7), deletedBy: 'u-ana' });
  const reply = (id: string, to: FakeChatMessage, text: string, snapshot: string, min: number) =>
    chatMessage({ id, text, createdAt: ago(min), senderId: me.documentId, senderName: me.username, replyTo: { messageId: to.id, senderId: to.senderId, senderName: to.senderName, text: snapshot } });
  await fakeChat.seed({
    rooms: {
      general: {
        messages: [
          old,
          ...filler,
          edited,
          gone,
          reply('r-ed', edited, 'Mersi', 'Text greșit', 6),
          reply('r-gone', gone, 'Ok', 'Ce s-a șters', 5),
          reply('r-old', old, 'La capăt, lângă stuf', 'Unde e standul 7?', 4),
          chatMessage({ id: 'r-miss', text: 'Răspuns la ceva dispărut', createdAt: ago(3), replyTo: { messageId: 'nu-exista', senderId: 'u-x', senderName: 'Cineva', text: 'Vechi' } }),
        ],
      },
    },
  });
  await openChat(page, context, { size: TABLET });
  await expect(row(page, 'r-old')).toBeVisible();
  await expect(row(page, 'r-ed').getByRole('button', { name: /Răspuns la Ana Crap: Text corectat/ })).toBeVisible();
  await expect(row(page, 'r-gone').getByRole('button', { name: /Răspuns la Ana Crap: Mesaj șters/ })).toBeVisible();
  // The original is not loaded yet: the snapshot.
  await expect(row(page, 'orig')).toHaveCount(0);
  await row(page, 'r-old').getByRole('button', { name: /Răspuns la Ana Crap: Unde e standul 7\?/ }).click();
  await expect(row(page, 'orig')).toBeVisible();
  await expect.poll(() => inView(page, row(page, 'orig'))).toBe(true);
  await expect(row(page, 'orig').locator('[data-highlighted]')).toHaveCount(1);
  await shot(page, 'reply-jump');
  await expect(row(page, 'orig').locator('[data-highlighted]')).toHaveCount(0, { timeout: 5_000 });
  // Missing everywhere: fish's toast.
  await panel(page).evaluate(el => el.scrollTo({ top: 0 }));
  await row(page, 'r-miss').getByRole('button', { name: /Răspuns la Cineva/ }).click();
  await expect(page.getByText('Nu am găsit mesajul la care s-a răspuns.')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* c20 c21 — photos, viewer                                             */
/* ------------------------------------------------------------------ */

test('participant.chat.c20 participant.chat.c21 — 1 photo at its ratio, 2–4 in a square grid, more with «+{n-3}»; «Imagine i din n»; the viewer pages the room’s photos with sender / time, zoom, keys, Escape, Salvează', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  const tall = photo('a-tall', 600, 1600, '0e7490');
  await fakeChat.seed({
    rooms: {
      general: {
        messages: [
          chatMessage({ id: 'ph1', text: '', createdAt: ago(20), senderId: 'u-ana', senderName: 'Ana Crap', attachments: [tall] }),
          chatMessage({ id: 'ph3', text: 'Trei de azi', createdAt: ago(15), attachments: [photo('b1', 800, 600, '4f46e5'), photo('b2', 800, 600, '15803d'), photo('b3', 800, 600, 'b45309')] }),
          chatMessage({ id: 'ph6', text: '', createdAt: ago(10), senderId: me.documentId, senderName: me.username, attachments: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id, i) => photo(id, 900, 900, ['e11d48', '6265f1', '0891b2', '4cb944', 'eab308', '20263d'][i])) }),
        ],
      },
    },
  });
  await openChat(page, context, { size: PHONE });
  await expect(row(page, 'ph6')).toBeVisible();
  // c20: the single photo is 260 wide, clamped to 3:4 (195 × 260 would be 0.375 → 0.75).
  const single = row(page, 'ph1').getByRole('button', { name: 'Imagine 1 din 1' });
  const box = (await single.boundingBox())!;
  expect(Math.round(box.width)).toBe(260);
  expect(Math.round(box.height)).toBe(347);
  await expect(row(page, 'ph3').getByRole('button', { name: /^Imagine \d din 3$/ })).toHaveCount(3);
  const tile = (await row(page, 'ph3').getByRole('button', { name: 'Imagine 1 din 3' }).boundingBox())!;
  expect(Math.round(tile.width)).toBe(Math.round(tile.height));
  await expect(row(page, 'ph6').getByRole('button', { name: /^Imagine \d din 6$/ })).toHaveCount(4);
  await expect(row(page, 'ph6').getByRole('button', { name: 'Imagine 4 din 6' })).toContainText('+3');
  await expect(row(page, 'ph1').getByRole('button', { name: 'Imagine 1 din 1' })).toHaveAttribute('style', /background-image: url\("?data:image\/bmp/);
  await shot(page, 'photos');

  // c21: the viewer over the room's gallery (oldest first): 1 + 3 + 6 = 10 photos.
  await row(page, 'ph3').getByRole('button', { name: 'Imagine 2 din 3' }).click();
  const viewer = page.getByTestId('chat-media-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('heading', { name: 'Ion Pescaru' })).toBeVisible();
  await expect(viewer).toContainText('3 din 10');
  await page.waitForTimeout(400);
  await expectNoA11yViolations(page);
  await shot(page, 'viewer');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(viewer).toContainText('5 din 10');
  await expect(viewer.getByRole('heading', { name: `${me.username} (eu)` })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer).toContainText('4 din 10');
  // Zoom up to 4×, and back.
  for (let i = 0; i < 4; i++) await viewer.getByRole('button', { name: 'Mărește' }).click();
  await expect(viewer.getByText('400%')).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Mărește' })).toBeDisabled();
  await viewer.getByRole('button', { name: 'Micșorează' }).click();
  await expect(viewer.getByText('267%')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(row(page, 'ph3').getByRole('button', { name: 'Imagine 2 din 3' })).toBeFocused();

  // «Salvează» downloads the original; drag down closes.
  await row(page, 'ph1').getByRole('button', { name: 'Imagine 1 din 1' }).click();
  await expect(viewer).toContainText('1 din 10');
  const download = page.waitForEvent('download');
  await viewer.getByRole('button', { name: 'Salvează' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.jpg$/);
  await expect(viewer.getByRole('button', { name: 'Distribuie' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Închide' })).toBeVisible();
  const stage = (await viewer.locator('img[alt^="Poză de la"]').boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2, stage.y + 40);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + 140, { steps: 5 });
  await page.mouse.move(stage.x + stage.width / 2, stage.y + 240, { steps: 5 });
  await page.mouse.up();
  await expect(viewer).toBeHidden();
});

test('participant.chat.c20 — a photo being sent shows the upload ring until the message is written', async ({ page, context }) => {
  await mockViewer(context, { role: 'participant' });
  let release: () => void = () => {};
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/api/cms/upload', async route => {
    await gate;
    await route.fulfill({ json: [{ id: 1, documentId: 'f1', url: '/uploads/x.jpg', name: 'x.jpg', mime: 'image/jpeg', width: 10, height: 10, formats: {} }] });
  });
  await openChat(page, context);
  await page.getByTestId('chat-gallery-input').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') });
  await page.getByRole('button', { name: 'Trimite', exact: true }).click();
  const ring = log(page).getByRole('status', { name: 'Se încarcă poza' });
  await expect(ring).toBeVisible();
  // c21: the pending photo is not in the room's gallery yet; the viewer shows its own message's time.
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const now = Date.now();
  const times = [hhmm(new Date(now - 60_000)), hhmm(new Date(now))];
  await log(page).getByRole('button', { name: 'Imagine 1 din 1' }).click();
  const viewer = page.getByTestId('chat-media-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('heading', { level: 2 })).toContainText('(eu)');
  const sentAt = (await viewer.locator('h2 + p').innerText()).trim();
  expect(times).toContain(sentAt);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  release();
  await expect(ring).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* c22 c24 — reactions                                                  */
/* ------------------------------------------------------------------ */

test('participant.chat.c22 participant.chat.c24 — the pill (mine highlighted) opens «Reacții»; choosing an emoji sets it, the same removes it, another replaces it; failure toasts', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({
    rooms: {
      general: {
        messages: [chatMessage({ id: 'r1', text: 'Am prins un crap de 12 kg', createdAt: ago(10), senderId: 'u-ana', senderName: 'Ana Crap' }), chatMessage({ id: 'r2', text: 'Fără reacții', createdAt: ago(9) })],
        reactions: [
          { messageId: 'r1', userId: 'u-ion', userName: 'Ion Pescaru', emoji: '👍' },
          { messageId: 'r1', userId: 'u-radu', userName: 'Radu', emoji: '👍' },
          { messageId: 'r1', userId: me.documentId, userName: me.username, emoji: '❤️' },
        ],
      },
    },
  });
  await openChat(page, context, { size: DESKTOP });
  const pill = row(page, 'r1').getByRole('button', { name: /^Vezi cine a reacționat/ });
  await expect(pill).toContainText('👍2');
  await expect(pill.locator('[data-mine]')).toHaveText('❤️1');
  await expect(row(page, 'r2').getByRole('button', { name: /^Vezi cine a reacționat/ })).toHaveCount(0);
  await pill.click();
  const dialog = page.getByRole('dialog', { name: 'Reacții' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ion Pescaru')).toBeVisible();
  await expect(dialog.getByText(`${me.username} (eu)`)).toBeVisible();
  await page.waitForTimeout(400); // the dialog's fade-in (axe reads mid-fade colours)
  await expectNoA11yViolations(page);
  await shot(page, 'reactions-dialog');
  // Live: another reaction arrives while it is open.
  await fakeChat.push('general', {
    reactions: [
      { messageId: 'r1', userId: 'u-ion', userName: 'Ion Pescaru', emoji: '👍' },
      { messageId: 'r1', userId: 'u-radu', userName: 'Radu', emoji: '👍' },
      { messageId: 'r1', userId: me.documentId, userName: me.username, emoji: '❤️' },
      { messageId: 'r1', userId: 'u-mara', userName: 'Mara', emoji: '😮' },
    ],
  });
  await expect(dialog.getByText('Mara')).toBeVisible();
  await page.keyboard.press('Escape');

  const reactionPath = `${MSGS}/general/reactions/r1_${me.documentId}`;
  // My current ❤️ again: removed.
  await contextMenu(page, 'Am prins un crap de 12 kg');
  await expect(menu(page).getByRole('menuitemradio', { name: 'Reacționează cu ❤️' })).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(400);
  await shot(page, 'menu');
  await menu(page).getByRole('menuitemradio', { name: 'Reacționează cu ❤️' }).click();
  await expect.poll(async () => (await writesTo(fakeChat, reactionPath)).map(w => w.op)).toEqual(['delete']);
  await expect(pill.locator('[data-mine]')).toHaveCount(0);
  // 😂: set.
  await contextMenu(page, 'Am prins un crap de 12 kg');
  await menu(page).getByRole('menuitemradio', { name: 'Reacționează cu 😂' }).click();
  await expect.poll(async () => (await writesTo(fakeChat, reactionPath)).map(w => [w.op, w.data?.emoji])).toEqual([['delete', undefined], ['set', '😂']]);
  await expect(pill.locator('[data-mine]')).toHaveText('😂1');
  // 🙏 replaces 😂.
  await contextMenu(page, 'Am prins un crap de 12 kg');
  await menu(page).getByRole('menuitemradio', { name: 'Reacționează cu 🙏' }).click();
  await expect(pill.locator('[data-mine]')).toHaveText('🙏1');
  await expect(pill).not.toContainText('😂');
  // Refused write: fish's toast.
  await fakeChat.failWrites(`${MSGS}/general/reactions/r2_`, { code: 'permission-denied' });
  await row(page, 'r2').hover();
  await row(page, 'r2').getByRole('button', { name: 'Reacționează' }).click();
  await menu(page).getByRole('menuitemradio', { name: 'Reacționează cu 👍' }).click();
  await expect(page.getByText('Reacția nu a putut fi salvată.')).toBeVisible();
});

test('participant.chat.c24 participant.chat.c23 — a closed chat: reactions stay visible, no menu, nothing to react with', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({
    meta: { closesAt: daysAgo(1) },
    rooms: { general: { messages: [chatMessage({ id: 'c1', text: 'Ultimul', createdAt: daysAgo(2) })], reactions: [{ messageId: 'c1', userId: 'u-ana', userName: 'Ana', emoji: '👍' }] } },
  });
  await openChat(page, context, { size: DESKTOP });
  await expect(row(page, 'c1').getByRole('button', { name: /^Vezi cine a reacționat/ })).toBeVisible();
  await bubbleOf(page, 'Ultimul').click({ button: 'right' });
  await expect(menu(page)).toHaveCount(0);
  await expect(row(page, 'c1').getByRole('button', { name: 'Acțiuni mesaj' })).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* c23 c27 c31 — actions, delete, the failed row                        */
/* ------------------------------------------------------------------ */

test('participant.chat.c23 participant.chat.c27 — the menu: others’ text (Răspunde, Copiază), mine (+ Editează, Șterge → «Sigur? Șterge» → soft delete); keyboard path; Copiază toasts', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fakeChat.seed({
    rooms: {
      general: {
        messages: [
          systemMessage('competition:start', '🏁 Concursul a început', { id: 's1', createdAt: ago(30) }),
          chatMessage({ id: 'o1', text: 'De la Ana', createdAt: ago(20), senderId: 'u-ana', senderName: 'Ana Crap' }),
          chatMessage({ id: 'op', text: '', createdAt: ago(15), senderId: 'u-ana', senderName: 'Ana Crap', attachments: [photo('op1')] }),
          chatMessage({ id: 'm1', text: 'Al meu', createdAt: ago(10), senderId: me.documentId, senderName: me.username }),
        ],
      },
    },
  });
  await openChat(page, context, { size: DESKTOP });
  await expect(row(page, 'm1')).toBeVisible();
  const items = () => menu(page).getByRole('menuitem');

  // Others' text: reply and copy only.
  await contextMenu(page, 'De la Ana');
  await expect(items()).toHaveText(['Răspunde', 'Copiază']);
  await expect(menu(page).getByRole('menuitemradio')).toHaveCount(6);
  await menu(page).getByRole('menuitem', { name: 'Copiază' }).click();
  await expect(page.getByText('Text copiat')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('De la Ana');
  await expect(menu(page)).toHaveCount(0);

  // A photo without text: no copy.
  await row(page, 'op').hover();
  await row(page, 'op').getByRole('button', { name: 'Acțiuni mesaj' }).click();
  await expect(items()).toHaveText(['Răspunde']);
  await page.keyboard.press('Escape');

  // A click outside (the scrim) closes it.
  await contextMenu(page, 'De la Ana');
  await page.mouse.click(8, 300);
  await expect(menu(page)).toHaveCount(0);

  // A system row: no menu at all.
  await expect(row(page, 's1').getByRole('button', { name: 'Acțiuni mesaj' })).toHaveCount(0);

  // Keyboard: Tab reaches «Acțiuni mesaj», Enter opens with focus on the first action, arrows move, Escape returns.
  const trigger = row(page, 'm1').getByRole('button', { name: 'Acțiuni mesaj' });
  await trigger.focus();
  await expect(trigger).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(items()).toHaveText(['Răspunde', 'Copiază', 'Editează', 'Șterge']);
  await expect(menu(page).getByRole('menuitem', { name: 'Răspunde' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('menuitem', { name: 'Copiază' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu(page).getByRole('menuitem', { name: 'Șterge' })).toBeFocused();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Șterge asks once more, then the soft delete (deletedAt, deletedBy = me, text emptied).
  await trigger.click();
  await menu(page).getByRole('menuitem', { name: 'Șterge' }).click();
  await expect(menu(page).getByRole('menuitem', { name: 'Sigur? Șterge' })).toBeVisible();
  expect(await writesTo(fakeChat, `${MSGS}/general/messages/m1`)).toEqual([]);
  await menu(page).getByRole('menuitem', { name: 'Sigur? Șterge' }).click();
  await expect.poll(async () => (await writesTo(fakeChat, `${MSGS}/general/messages/m1`)).map(w => [w.op, w.data])).toEqual([['update', { deletedAt: 'serverTimestamp', deletedBy: me.documentId, text: '' }]]);
  await expect(row(page, 'm1')).toContainText('Acest mesaj a fost șters');
  await expect(row(page, 'm1').getByRole('button', { name: 'Acțiuni mesaj' })).toHaveCount(0);
});

test('participant.chat.c23 participant.chat.c27 — the author may delete anyone’s message; a refused delete toasts', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'author' });
  await fakeChat.seed({ rooms: { general: { messages: [chatMessage({ id: 'x1', text: 'Spam', createdAt: ago(5), senderId: 'u-ana', senderName: 'Ana Crap' })] } } });
  await openChat(page, context, { size: DESKTOP });
  await contextMenu(page, 'Spam');
  await expect(menu(page).getByRole('menuitem')).toHaveText(['Răspunde', 'Copiază', 'Șterge']);
  await fakeChat.failWrites(`${MSGS}/general/messages/x1`, { code: 'permission-denied' });
  await menu(page).getByRole('menuitem', { name: 'Șterge' }).click();
  await menu(page).getByRole('menuitem', { name: 'Sigur? Șterge' }).click();
  await expect(page.getByText('Mesajul nu a putut fi șters.')).toBeVisible();
});

test('participant.chat.c23 participant.chat.c31 participant.chat.c27 — a failed send: «Nu s-a trimis» under my bubble, the menu offers only Reîncearcă / Șterge; Șterge discards it locally', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await page.clock.install();
  await openChat(page, context, { size: DESKTOP });
  await fakeChat.failWrites(`${MSGS}/general/messages/`, { code: 'unavailable' });
  await page.getByRole('textbox', { name: 'Mesaj' }).fill('Nu pleacă');
  await page.getByRole('button', { name: 'Trimite', exact: true }).click();
  // Four attempts (2 s, 8 s, 30 s apart), then failed.
  await expect
    .poll(async () => {
      await page.clock.runFor(5_000);
      return page.getByText('Nu s-a trimis').count();
    })
    .toBe(1);
  await shot(page, 'failed');
  await contextMenu(page, 'Nu pleacă');
  await expect(menu(page).getByRole('menuitem')).toHaveText(['Reîncearcă', 'Șterge']);
  await expect(menu(page).getByRole('menuitemradio')).toHaveCount(0);
  const before = (await fakeChat.writes()).length;
  await menu(page).getByRole('menuitem', { name: 'Șterge' }).click();
  await menu(page).getByRole('menuitem', { name: 'Sigur? Șterge' }).click();
  await expect(bubbleOf(page, 'Nu pleacă')).toHaveCount(0);
  expect((await fakeChat.writes()).length).toBe(before);
});

/* ------------------------------------------------------------------ */
/* c33 c34 c35 — receipts, the divider, holding new messages            */
/* ------------------------------------------------------------------ */

test('participant.chat.c34 participant.chat.c33 — unread history: «Mesaje noi» before the first unread, in view; it stays put as messages are read', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  const read = history(30, { prefix: 'a', startMin: 100 });
  const unread = history(30, { prefix: 'u', startMin: 60, sender: { senderId: 'u-ana', senderName: 'Ana Crap' } });
  await fakeChat.seed({ rooms: { general: { messages: [...read, ...unread], receipts: [{ userId: me.documentId, lastReadAt: ago(71) }] } } });
  await openChat(page, context);
  const divider = log(page).locator('[data-divider]');
  await expect(divider).toHaveText('Mesaje noi');
  // Right before the first message newer than my receipt.
  expect(await divider.evaluate(el => el.nextElementSibling?.getAttribute('data-message-id'))).toBe('u1');
  await expect.poll(() => inView(page, divider)).toBe(true);
  await shot(page, 'divider');
  // Reading to the end does not move it (frozen at open).
  await panel(page).evaluate(el => el.scrollTo({ top: 0 }));
  await expect.poll(async () => (await receipts(fakeChat)).at(-1)?.data?.lastReadMessageId).toBe('u30');
  await expect(divider).toHaveCount(1);
});

test('participant.chat.c33 — a receipt only for rows ≥ 50% visible for 250 ms, only while the page is visible', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ rooms: { general: { messages: history(40), receipts: [{ userId: me.documentId, lastReadAt: ago(1) }] } } });
  await page.clock.install();
  await openChat(page, context);
  await expect(row(page, 'h40')).toBeVisible();
  await page.clock.runFor(1_000);
  const start = (await receipts(fakeChat)).length;

  // A new message at the end: written only after 250 ms on screen.
  await fakeChat.pushMessage('general', chatMessage({ id: 'n1', text: 'Nou 1', createdAt: Date.now() }));
  await expect(row(page, 'n1')).toBeVisible();
  await page.clock.runFor(100);
  expect((await receipts(fakeChat)).length).toBe(start);
  await expect
    .poll(async () => {
      await page.clock.runFor(300);
      return (await receipts(fakeChat)).at(-1)?.data?.lastReadMessageId;
    })
    .toBe('n1');

  // The page hidden: nothing is read.
  const hide = (state: 'hidden' | 'visible') =>
    page.evaluate(s => {
      Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await hide('hidden');
  const hiddenStart = (await receipts(fakeChat)).length;
  await fakeChat.pushMessage('general', chatMessage({ id: 'n2', text: 'Nou 2', createdAt: Date.now() + 1000 }));
  await expect(row(page, 'n2')).toBeVisible();
  await page.clock.runFor(2_000);
  expect((await receipts(fakeChat)).length).toBe(hiddenStart);
  await hide('visible');
  await page.clock.runFor(400);
  await expect.poll(async () => (await receipts(fakeChat)).at(-1)?.data?.lastReadMessageId).toBe('n2');

  // Scrolled up: a held-back message is not read until it is shown.
  await scrollUp(page, 600);
  await page.clock.runFor(400);
  const upStart = (await receipts(fakeChat)).length;
  await fakeChat.pushMessage('general', chatMessage({ id: 'n3', text: 'Nou 3', createdAt: Date.now() + 2000 }));
  await page.clock.runFor(2_000);
  expect((await receipts(fakeChat)).filter(w => w.data?.lastReadMessageId === 'n3')).toEqual([]);
  expect((await receipts(fakeChat)).length).toBeGreaterThanOrEqual(upStart);
  await page.getByRole('button', { name: /Mergi la ultimul mesaj/ }).click();
  await expect(row(page, 'n3')).toBeVisible();
  await expect
    .poll(async () => {
      await page.clock.runFor(300);
      return (await receipts(fakeChat)).at(-1)?.data?.lastReadMessageId;
    })
    .toBe('n3');
});

test('participant.chat.c35 — scrolled up, others’ new messages are held and counted on the round button; it reveals them at the end; my own send always goes to the end', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({ rooms: { general: { messages: history(40) } } });
  await openChat(page, context, { size: TABLET });
  await expect(row(page, 'h40')).toBeVisible();
  const pill = page.getByRole('button', { name: /^Mergi la ultimul mesaj/ });
  await expect(pill).toHaveCount(0);
  // At the end, a new message simply appears.
  await fakeChat.pushMessage('general', chatMessage({ id: 'live1', text: 'În direct', createdAt: Date.now() }));
  await expect(row(page, 'live1')).toBeInViewport();
  await scrollUp(page, 800);
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAccessibleName('Mergi la ultimul mesaj');
  await fakeChat.pushMessage('general', chatMessage({ id: 'held1', text: 'Ținut 1', createdAt: Date.now() + 1000 }));
  await fakeChat.pushMessage('general', chatMessage({ id: 'held2', text: 'Ținut 2', createdAt: Date.now() + 2000 }));
  await expect(pill).toHaveAccessibleName('Mergi la ultimul mesaj, 2 mesaje noi');
  await expect(pill).toContainText('2');
  await expect(row(page, 'held1')).toHaveCount(0);
  await shot(page, 'pill');
  await pill.click();
  await expect(row(page, 'held2')).toBeInViewport();
  await expect(pill).toHaveCount(0);
  // My own send while scrolled up: back at the end.
  await scrollUp(page, 800);
  await expect(pill).toBeVisible();
  await page.getByRole('textbox', { name: 'Mesaj' }).fill('Al meu, de sus');
  await page.getByRole('button', { name: 'Trimite', exact: true }).click();
  await expect(bubbleOf(page, 'Al meu, de sus')).toBeInViewport();
  await expect.poll(() => distanceFromEnd(page)).toBeLessThan(5);
});

/* ------------------------------------------------------------------ */
/* c36 c37 c38 c39 — competition events                                 */
/* ------------------------------------------------------------------ */

test('participant.chat.c36 participant.chat.c37 participant.chat.c38 participant.chat.c39 — event cards with icons and details, linked chevrons, the leader card, folded runs «{n} evenimente»; Participanți shows only the closing', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  const events = [
    systemMessage('competition:start', '🏁 Concursul a început', { id: 'e-start', createdAt: ago(120) }),
    systemMessage('competition:participants-allocation', '📍 Alocarea pe standuri a fost publicată', { id: 'e-alloc', createdAt: ago(110), link: { kind: 'allocation' } }),
    systemMessage('competition:weighing-end', '⚖️ A3 · Ion Pescaru: 2 pești, 12,450 kg', { id: 'e-w1', createdAt: ago(100), link: { kind: 'weighing', id: 'w-1', params: { standId: 's-a3', standName: 'A3', sectorName: 'A' } } }),
    systemMessage('competition:weighing-end', '⚖️ B1 · Ana Crap: 1 pește, 3,200 kg', { id: 'e-w2', createdAt: ago(99) }),
    systemMessage('competition:podium', '🥈 A3 · Ion Pescaru urcă pe locul 2', { id: 'e-p2', createdAt: ago(98), link: { kind: 'ranking' } }),
    systemMessage('competition:penalty', '⚠️ Avertisment pentru B1 · Ana Crap: zgomot', { id: 'e-pen', createdAt: ago(90), link: { kind: 'penalties' } }),
    systemMessage('competition:podium', '🥇 A3 · Ion Pescaru urcă pe locul 1', { id: 'e-lead', createdAt: ago(80), link: { kind: 'ranking' }, data: { place: 1, stand: 'A3', name: 'Ion Pescaru' } }),
    systemMessage('registration:registered', '👤 Mara Somn s-a înscris', { id: 'e-reg', createdAt: ago(70), link: { kind: 'registrations' } }),
    chatMessage({ id: 'talk', text: 'Bravo!', createdAt: ago(60) }),
  ];
  await fakeChat.seed({
    rooms: {
      general: { messages: events },
      participants: {
        messages: [
          systemMessage('competition:start', '🏁 Concursul a început', { id: 'pe-start', createdAt: ago(120) }),
          systemMessage('chat:closing', '🔒 Chat-ul se închide mâine', { id: 'pe-close', createdAt: ago(50) }),
        ],
      },
    },
  });
  await openChat(page, context, { size: DESKTOP });
  await expect(row(page, 'talk')).toBeVisible();

  // c36: cards, the emoji dropped, stand chip + name, the detail line, time.
  const start = row(page, 'e-start');
  await expect(start).toContainText('Concursul a început');
  await expect(start).not.toContainText('🏁');
  await expect(start.getByRole('link')).toHaveCount(0);
  const pen = row(page, 'e-pen');
  await expect(pen).toContainText('B1');
  await expect(pen).toContainText('Ana Crap');
  await expect(pen).toContainText('Avertisment · zgomot');
  // c37: penalties have no web page yet — no link.
  await expect(pen.getByRole('link')).toHaveCount(0);
  await expect(row(page, 'e-alloc').getByRole('link', { name: /Vezi alocarea/ })).toHaveAttribute('href', `/concursuri/${ID}/participanti`);
  await expect(row(page, 'e-reg').getByRole('link', { name: /Vezi participanții/ })).toHaveAttribute('href', `/concursuri/${ID}/participanti`);

  // c38: the newest leader.
  const leader = row(page, 'e-lead');
  await expect(leader).toContainText('LIDER NOU');
  await expect(leader).toContainText('A urcat pe locul 1');
  await expect(leader.getByRole('link', { name: /Lider nou: .*Vezi clasamentul/ })).toHaveAttribute('href', `/concursuri/${ID}/clasament`);

  // c39: the two weighings + the podium move fold into one card.
  const group = page.getByRole('button', { name: /^3 evenimente: 2 cântăriri · 1 schimbare pe podium$/ });
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await expect(group).toContainText('Vezi');
  await expect(row(page, 'e-w1')).toHaveCount(0);
  await group.click();
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await expect(group).toContainText('Ascunde');
  await expect(page.getByText('Cântar · 2 pești, 12,450 kg')).toBeVisible();
  await expect(page.getByRole('link', { name: /urcă pe locul 2, Vezi clasamentul/ })).toHaveAttribute('href', `/concursuri/${ID}/clasament`);
  await expectNoA11yViolations(page);
  for (const size of [PHONE, TABLET, LAPTOP, DESKTOP, WIDE]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    await shot(page, 'events');
  }
  await page.setViewportSize(DESKTOP);

  // c37: a weighing opens its detail over the chat (the allocated participants read then).
  const allocated = page.waitForRequest(r => r.url().includes(`/competitions/${ID}/allocated-participants`));
  await page.getByRole('button', { name: /Ion Pescaru: 2 pești, 12,450 kg, Vezi cântărirea/ }).click();
  await allocated;
  await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toBeVisible();
  await shot(page, 'weighing');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toHaveCount(0);

  // c36: Participanți shows only the room's closing; c39: back in General the group is folded again.
  await page.getByRole('tab', { name: /Participanți/ }).first().click();
  await expect(row(page, 'pe-close')).toContainText('Chat-ul se închide mâine');
  await expect(row(page, 'pe-start')).toHaveCount(0);
  await page.getByRole('tab', { name: /General/ }).first().click();
  await expect(page.getByRole('button', { name: /^3 evenimente/ })).toHaveAttribute('aria-expanded', 'false');
});

test('participant.chat list — at 375 a long incoming message never makes the conversation pan sideways', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  const long = 'Am prins un crap frumos lângă stuf, la vreo patruzeci de metri, cu boilies de căpșuni și momeală de porumb fermentat, după două ore de așteptare fără nicio trăsătură.';
  await fakeChat.seed({ rooms: { general: { messages: [chatMessage({ id: 'long1', text: long, createdAt: ago(2), senderId: 'u-ion', senderName: 'Ion Pescaru' })] } } });
  await openChat(page, context, { size: PHONE });
  await expect(row(page, 'long1')).toBeVisible();
  const fits = () => panel(page).evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, doc: document.documentElement.scrollWidth, vw: window.innerWidth }));
  let m = await fits();
  expect(m.sw, 'the conversation does not overflow sideways').toBeLessThanOrEqual(m.cw);
  expect(m.doc, 'the page does not overflow sideways').toBeLessThanOrEqual(m.vw);
  // The actions, once focused from the keyboard, sit over the bubble's corner — still inside the list.
  const toolbar = row(page, 'long1').locator('[data-toolbar]');
  await row(page, 'long1').getByRole('button', { name: 'Acțiuni mesaj' }).focus();
  const [p, t] = await Promise.all([panel(page).boundingBox(), toolbar.boundingBox()]);
  expect(t!.x + t!.width).toBeLessThanOrEqual(p!.x + p!.width);
  m = await fits();
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  // With room beside the bubble (a laptop), the actions sit beside it, not over it.
  await page.setViewportSize(LAPTOP);
  await row(page, 'long1').getByRole('button', { name: 'Acțiuni mesaj' }).focus();
  const [b, t2] = await Promise.all([row(page, 'long1').locator('[data-bubble]').boundingBox(), toolbar.boundingBox()]);
  expect(t2!.x).toBeGreaterThanOrEqual(b!.x + b!.width);
  m = await fits();
  expect(m.sw).toBeLessThanOrEqual(m.cw);
});

/* ------------------------------------------------------------------ */
/* Shots of the overlays at every width                                 */
/* ------------------------------------------------------------------ */

test('participant.chat list — the menu, the viewer and the reactions at 375 / 768 / 1280 / 1440 / 1920; no console errors', async ({ page, context, fakeChat }) => {
  await mockViewer(context, { role: 'participant' });
  await fakeChat.seed({
    rooms: {
      general: {
        messages: [
          ...bubblesHistory(),
          chatMessage({ id: 'phx', text: 'Uite captura', createdAt: ago(3), senderId: 'u-ana', senderName: 'Ana Crap', attachments: [photo('px1', 1200, 900, '0e7490'), photo('px2', 900, 1200, '4f46e5')] }),
        ],
        reactions: [{ messageId: 'phx', userId: 'u-ion', userName: 'Ion Pescaru', emoji: '👍' }],
      },
    },
  });
  const errors = collectConsoleErrors(page);
  for (const size of [PHONE, TABLET, LAPTOP, DESKTOP, WIDE]) {
    await openChat(page, context, { size });
    await expect(row(page, 'phx')).toBeVisible();
    await shot(page, 'room');
    await contextMenu(page, 'Uite captura');
    await page.waitForTimeout(400);
    await shot(page, 'room-menu');
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await row(page, 'phx').getByRole('button', { name: 'Imagine 1 din 2' }).click();
    await expect(page.getByTestId('chat-media-viewer')).toBeVisible();
    await page.waitForTimeout(200);
    await shot(page, 'room-viewer');
    await page.keyboard.press('Escape');
    await row(page, 'phx').getByRole('button', { name: /^Vezi cine a reacționat/ }).click();
    await expect(page.getByRole('dialog', { name: 'Reacții' })).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 'room-reactions');
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});
