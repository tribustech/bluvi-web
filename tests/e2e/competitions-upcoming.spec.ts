import { collectConsoleErrors } from './helpers/console';
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { card, page as cardsPage, PIXEL } from './competitions-list.fixtures';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';

/*
 * Viitoare (/concursuri/viitoare) — the prototype's tab (app/dev/hub Upcoming.tsx; owner 2026-10-07),
 * parity docs/parity/areas/competitions-list.yml competitions-list.index c38 (live band), c39
 * («În lumina reflectoarelor»), c40 (poster cards grouped by time), and the pulse criteria they
 * stand in for. Local CMS on :1337 (upcoming and live competitions); the people and the lists a test
 * needs exactly are served by page.route. The server prefetches the spotlight with the page, so a
 * test that mocks it opens on Live (no spotlight read) and switches to Viitoare in place: the
 * browser then asks for it.
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };
const WIDE = { width: 1440, height: 900 };

const PEOPLE = /\/feed\/pulse-person\?.*limit=6/;
const PUBLIC = /\/feed\/competition-cards\?/;
const FOLLOWED = /\/feed\/my-competition-cards\?.*scope=followed/;
const REGISTERED = /\/feed\/my-competition-cards\?(?!.*status=).*scope=registered/;

let jwt = '';
test.describe.configure({ timeout: 90_000 });
test.use({ trace: 'off' });
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const list = (page: Page) => page.locator('#concursuri-lista');
const spotlight = (page: Page) => page.getByRole('region', { name: 'În lumina reflectoarelor' });
const band = (page: Page) => page.locator('[data-live-band]');

type Person = {
  criterion: string;
  kicker: string;
  displayName: string;
  line: string;
  meta: string;
  avatarUrls: string[];
  destination: { type: 'competition' | 'angler'; documentId: string };
  rank?: number;
};
const person = (i: number, over: Partial<Person> = {}): Person => ({
  criterion: 'mostPodiums',
  kicker: `KICKER ${i}`,
  displayName: `Pescar ${i}`,
  line: `${i} podiumuri`,
  meta: 'Din toate timpurile',
  avatarUrls: [],
  destination: { type: 'competition', documentId: `cmp-${i}` },
  ...over,
});
const SIX = [
  person(1, { criterion: 'biggestCatchYear', kicker: 'CEA MAI MARE CAPTURĂ', line: '19,4 kg', meta: 'Ultimele 12 luni · Cupa X' }),
  person(2, { rank: 1 }),
  person(3, { criterion: 'debutant', kicker: 'DEBUT', destination: { type: 'angler', documentId: 'ang-3' } }),
  person(4, { criterion: 'mostActive', rank: 2 }),
  person(5, { criterion: 'podiumStreak' }),
  person(6, { criterion: 'mostPopular' }),
];

async function captureEvents(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __events: unknown[]; gtag: (...a: unknown[]) => void };
    w.__events = [];
    w.gtag = (_cmd, name, params) => w.__events.push({ name, params });
  });
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);

async function open(page: Page, path = '/concursuri/viitoare') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
  await expect(page.locator('#concursuri-lista-titlu')).toBeVisible();
}

/** Opens Live, then Viitoare in place: the spotlight is read by the browser (the mocks answer). */
async function viaLive(page: Page) {
  await open(page, '/concursuri/live');
  await page.getByRole('tab', { name: /^Viitoare/ }).click();
  await expect(page).toHaveURL(/\/concursuri\/viitoare/);
}

async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
}

test.describe('signed out (local CMS)', () => {
  test('competitions-list.index.c38 competitions-list.index.c39 competitions-list.index.c40 competitions-list.pulse.c19 competitions-list.pulse.c20 competitions-list.pulse.c24 — the band, the spotlight and the grouped poster cards; the band opens Live', async ({ page, context }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    await captureEvents(context);
    await page.setViewportSize(DESKTOP);
    await open(page);
    // c38: three live competitions locally → the band, one link to the Live page.
    await expect(band(page)).toHaveText(/^\s*\d+ (de )?concursuri live acum|^\s*1 concurs live acum/);
    await expect(band(page)).toHaveAttribute('href', '/concursuri/live');
    // c39: the server-rendered spotlight (prefetched: no bones on the first paint).
    await expect(spotlight(page).getByRole('heading', { level: 2, name: 'În lumina reflectoarelor' })).toBeVisible();
    await expect(spotlight(page).locator('[aria-busy]')).toHaveCount(0);
    // c40: groups on the time axis, each a heading with its count; fish's poster cards in them.
    const groups = list(page).locator('[data-upcoming-groups] > section > h3');
    await expect(groups.first()).toHaveText(
      /^(Azi|Mâine|Săptămâna asta|Weekendul ăsta|Săptămâna viitoare|Mai târziu în \w+|Ianuarie|Februarie|Martie|Aprilie|Mai|Iunie|Iulie|August|Septembrie|Octombrie|Noiembrie|Decembrie|Fără dată|Data de start a trecut)/,
    );
    const first = list(page).locator('[data-upcoming-groups] article').first();
    await expect(first.locator('[class*="poster-ratio"]')).toBeVisible();
    // The card is ONE link, named by the competition (cards.c1), and fish's upcoming footer.
    await expect(first.getByRole('link')).toHaveCount(1);
    await expect(first.getByRole('link')).toHaveAttribute('href', /^\/concursuri\/[^/?]+$/);
    await expect(first.getByText(/^\d+\/\d+ (pescari|echipe)$|^\d+ (de )?(pescari|echipe)$|^1 (pescar|echipă)$/)).toBeVisible();
    // No fish bento, no «Momente cheie», no aside.
    await expect(page.getByRole('region', { name: 'Pulsul concursurilor' })).toHaveCount(0);
    await expect(page.getByText('Momente cheie')).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Ce se întâmplă acum' })).toHaveCount(0);
    await settled(page);
    await expectNoA11yViolations(page);
    // pulse.c20 / c24: the band opens Live and logs the count tile's press.
    await band(page).click();
    await expect(page).toHaveURL(/\/concursuri\/live$/);
    expect(await events(page)).toContainEqual(expect.objectContaining({ name: 'competitions_count_tile_pressed' }));
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c39 competitions-list.index.c40 — phone and wide pass axe; the phone spotlight is a shelf', async ({ page }) => {
    for (const size of [PHONE, WIDE]) {
      await page.setViewportSize(size);
      await open(page);
      await expect(spotlight(page)).toBeVisible();
      await settled(page);
      await expectNoA11yViolations(page);
    }
    await page.setViewportSize(PHONE);
    const shelf = spotlight(page).locator('ul');
    if (await shelf.count()) await expect(shelf).toHaveCSS('overflow-x', 'auto');
  });

  test('competitions-list.index.c38 — nothing live: no band (and none while the live list reads)', async ({ page }) => {
    await open(page, '/concursuri/rezultate');
    await page.route(PUBLIC, (r) => {
      const status = new URL(r.request().url()).searchParams.get('status');
      if (status !== 'started') return r.fallback();
      return json(r, cardsPage([], { total: 0, counts: { notStarted: 3, started: 0, completed: 5 } }));
    });
    // The re-read takes every card list from the mocks.
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
    await page.getByRole('tab', { name: /^Viitoare/ }).click();
    await expect(list(page).locator('[data-upcoming-groups]')).toBeVisible();
    await expect(band(page)).toHaveCount(0);
  });
});

test.describe('spotlight (mocked people)', () => {
  test('competitions-list.index.c39 competitions-list.pulse.c16 competitions-list.pulse.c17 competitions-list.pulse.c18 competitions-list.pulse.c24 — six people: big + four small from 768, five on the phone shelf; each tile one link to its destination', async ({ page, context }) => {
    await captureEvents(context);
    await page.route(PEOPLE, (r) => json(r, { data: SIX[0], items: SIX }));
    await page.setViewportSize(DESKTOP);
    await viaLive(page);
    const s = spotlight(page);
    await expect(s.getByText('Pescar 1', { exact: true })).toBeVisible();
    // The server's copy, untouched; «Locul N · line» and the #N badge when ranked.
    await expect(s.getByText('CEA MAI MARE CAPTURĂ')).toBeVisible();
    await expect(s.getByText('19,4 kg')).toBeVisible();
    await expect(s.getByText('#1', { exact: true })).toBeVisible();
    // From 768: four small tiles beside the big one; the fifth small one lives on the phone shelf only.
    for (const n of [2, 3, 4, 5]) await expect(s.getByText(`Pescar ${n}`, { exact: true })).toBeVisible();
    await expect(s.getByText('Pescar 6', { exact: true })).toBeHidden();
    // pulse.c18: competition → its ranking; an angler (no web profile yet, M2) is not a link — never a 404.
    await expect(s.getByRole('link', { name: 'CEA MAI MARE CAPTURĂ: Pescar 1' })).toHaveAttribute('href', '/concursuri/cmp-1/clasament');
    await expect(s.getByRole('link', { name: 'KICKER 2: Pescar 2, locul 1 în top' })).toHaveAttribute('href', '/concursuri/cmp-2/clasament');
    await expect(s.getByRole('link', { name: /Pescar 3/ })).toHaveCount(0);
    for (const href of await s.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
      expect(href).not.toMatch(/\/pescari\/|^\/intra/);
    }
    await settled(page);
    await expectNoA11yViolations(page);
    // pulse.c24: the moment's press.
    await s.getByRole('link', { name: 'KICKER 2: Pescar 2, locul 1 în top' }).click();
    await expect(page).toHaveURL(/\/concursuri\/cmp-2\/clasament$/);
    expect(await events(page)).toContainEqual({ name: 'competitions_moment_pressed', params: { kicker: 'KICKER 2', competition_id: 'cmp-2' } });

    // The phone: five small tiles on the shelf.
    await page.setViewportSize(PHONE);
    await page.goBack();
    await expect(spotlight(page).getByText('Pescar 6', { exact: true })).toBeAttached();
    await expect(spotlight(page).locator('li')).toHaveCount(5);
  });

  test('competitions-list.index.c39 — a CMS without `limit`: the one person has the section alone', async ({ page }) => {
    await page.route(PEOPLE, (r) => json(r, { data: person(1) }));
    await page.setViewportSize(DESKTOP);
    await viaLive(page);
    await expect(spotlight(page).getByText('Pescar 1', { exact: true })).toBeVisible();
    await expect(spotlight(page).locator('li')).toHaveCount(0);
  });

  test('competitions-list.index.c39 competitions-list.pulse.c23 — bones while it reads; failed or empty → no section; «Reîmprospătează» re-reads it', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    let answer: { status: number; body: unknown } = { status: 500, body: { error: { status: 500, message: 'down' } } };
    await page.route(PEOPLE, async (r) => {
      await held;
      await json(r, answer.body, answer.status);
    });
    await page.setViewportSize(DESKTOP);
    await viaLive(page);
    // Unknown is not shown (§4b.4): bones, never copy.
    await expect(spotlight(page)).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(spotlight(page)).toHaveCount(0);
    // Empty: still nothing. A refresh re-reads the people.
    answer = { status: 200, body: { data: null, items: [] } };
    const reread = page.waitForRequest(PEOPLE);
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await reread;
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
    await expect(spotlight(page)).toHaveCount(0);
    answer = { status: 200, body: { data: person(9), items: [person(9)] } };
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(spotlight(page).getByText('Pescar 9', { exact: true })).toBeVisible();
  });
});

test.describe('spotlight edge cases (mocked people)', () => {
  test('competitions-list.index.c39 — an avatar URL that fails to load shows the initials, never a broken image', async ({ page }) => {
    await page.route(/\/uploads\/missing-avatar\.jpg/, (r) => r.fulfill({ status: 404, body: '' }));
    await page.route(PEOPLE, (r) =>
      json(r, {
        data: person(1, { displayName: 'Toni Radulescu', avatarUrls: ['/uploads/missing-avatar.jpg'] }),
        items: [person(1, { displayName: 'Toni Radulescu', avatarUrls: ['/uploads/missing-avatar.jpg'] }), person(2, { avatarUrls: ['/uploads/missing-avatar.jpg'] })],
      }),
    );
    await page.setViewportSize(DESKTOP);
    await viaLive(page);
    const s = spotlight(page);
    await expect(s.getByText('Toni Radulescu', { exact: true })).toBeVisible();
    await expect(s.locator('[data-avatar-fallback]')).toHaveCount(2);
    await expect(s.locator('[data-avatar-fallback]').first()).toHaveText('TR');
    await expect(s.locator('img')).toHaveCount(0);
  });

  test('competitions-list.index.c39 — every tile an angler (no web profile yet): the phone shelf is still reachable by keyboard; axe passes', async ({ page }) => {
    const anglers = [1, 2, 3, 4, 5, 6].map((i) => person(i, { criterion: 'debutant', destination: { type: 'angler', documentId: `ang-${i}` } }));
    await page.route(PEOPLE, (r) => json(r, { data: anglers[0], items: anglers }));
    await page.setViewportSize(PHONE);
    await viaLive(page);
    const s = spotlight(page);
    await expect(s.getByText('Pescar 6', { exact: true })).toBeAttached();
    // No tile is a link (M2): the overflowing shelf is the tab stop, named by the section.
    await expect(s.getByRole('link')).toHaveCount(0);
    const shelf = s.locator('[data-spotlight-shelf]');
    await expect(shelf).toHaveAttribute('tabindex', '0');
    await expect(shelf).toHaveAccessibleName('În lumina reflectoarelor');
    await shelf.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => shelf.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await settled(page);
    await expectNoA11yViolations(page);
    // From 768 the tiles are a grid that does not scroll: no stray tab stop.
    await page.setViewportSize(DESKTOP);
    await expect(shelf).not.toHaveAttribute('tabindex', '0');
  });
});

test.describe('static shell (local CMS)', () => {
  test('competitions-list.index.c38 competitions-list.index.c39 competitions-list.index.c40 — the shell is the tab in its own order: band, spotlight, then search; the real cards, no layout jump when the page lands', async ({ browser }) => {
    // Without JavaScript the streamed page never swaps in: what shows is the server's frame.
    const shellCtx = await browser.newContext({ javaScriptEnabled: false, viewport: DESKTOP });
    const shell = await shellCtx.newPage();
    await shell.goto('/concursuri/viitoare');
    const search = (p: Page) => p.getByText('Concurs, baltă sau organizator').filter({ visible: true }).first();
    const shellSpot = spotlight(shell).filter({ visible: true }).first();
    await expect(shellSpot.getByRole('heading', { level: 2, name: 'În lumina reflectoarelor' })).toBeVisible();
    await expect(shellSpot).not.toHaveAttribute('aria-busy', 'true');
    await expect(shell.locator('[data-upcoming-groups] article').filter({ visible: true }).first()).toBeVisible();
    const shellBox = { spot: (await shellSpot.boundingBox())!, search: (await search(shell).boundingBox())! };
    expect(shellBox.spot.y).toBeLessThan(shellBox.search.y);
    const shellBand = shell.locator('[data-live-band]').filter({ visible: true });
    if (await shellBand.count()) expect((await shellBand.first().boundingBox())!.y).toBeLessThan(shellBox.spot.y);

    const page = await (await browser.newContext({ viewport: DESKTOP })).newPage();
    await open(page);
    await expect(spotlight(page).locator('[aria-busy]')).toHaveCount(0);
    const live = { spot: (await spotlight(page).boundingBox())!, search: (await search(page).boundingBox())! };
    expect(Math.abs(live.spot.y - shellBox.spot.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(live.search.y - shellBox.search.y)).toBeLessThanOrEqual(2);

    // The phone keeps the search row first.
    await shell.setViewportSize(PHONE);
    expect((await search(shell).boundingBox())!.y).toBeLessThan((await shellSpot.boundingBox())!.y);
    await shellCtx.close();
  });
});

test.describe('groups (mocked lists, signed in)', () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, jwt);
    await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
  });

  test('competitions-list.index.c40 competitions-list.cards.c13 — passed starts last and muted; my registration leads its group; fish\'s upcoming footer', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const day = 86_400_000;
    const iso = (ms: number) => new Date(ms).toISOString();
    // Mid next month: one group, three cards — mine is the latest start, yet it leads.
    const next = new Date();
    const base = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 15, 6);
    const a = card('fx-a', { name: 'FX Primul', startDate: iso(base), endDate: iso(base + 8 * 3_600_000) });
    const b = card('fx-b', { name: 'FX Al doilea', startDate: iso(base + day), endDate: iso(base + day + 8 * 3_600_000) });
    const mine = card('fx-mine', { name: 'FX Al meu', startDate: iso(base + 2 * day), endDate: iso(base + 2 * day + 8 * 3_600_000) });
    const stale = card('fx-stale', { name: 'FX Data trecută', startDate: iso(Date.now() - 8 * day), endDate: iso(Date.now() - 8 * day + 8 * 3_600_000) });
    // Nobody confirmed, one applied: «0/10 pescari» and «1 în așteptare».
    const pending = card('fx-pending', { name: 'FX În așteptare', joinedCount: 0, pendingCount: 1, startDate: iso(base), endDate: iso(base + 3_600_000) });
    await page.route(FOLLOWED, (r) => json(r, cardsPage([stale, b, a, mine, pending], { counts: { notStarted: 5, started: 0, completed: 7 } })));
    await page.route(REGISTERED, (r) => json(r, cardsPage([mine], { counts: { notStarted: 1, started: 0, completed: 0 } })));
    await page.setViewportSize(WIDE);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    // The server prefetched the real registrations: a re-read takes them from the mock.
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
    const groups = list(page).locator('[data-upcoming-groups] > section > h3');
    await expect(groups).toHaveCount(2);
    // The passed start comes LAST, muted, with no explanatory sentence.
    await expect(groups.last()).toHaveText(/^Data de start a trecut\s*1$/);
    await expect(groups.last()).toHaveClass(/text-muted/);
    const month = list(page).locator('[data-upcoming-groups] section').first();
    await expect(month.locator(':scope > h3')).toHaveText(/^\D+\s*4$/);
    // Mine first, then by start time (ties in the CMS order).
    await expect(month.locator('article').getByRole('link')).toHaveText(['FX Al meu', 'FX Primul', 'FX În așteptare', 'FX Al doilea']);
    // From 1280 a group of four spans the three columns (four from 1800).
    await expect(month.locator('ul')).toHaveCSS('grid-template-columns', /^\S+ \S+ \S+$/);
    // fish's upcoming footer: N/M and the pending line.
    const pend = month.locator('article').filter({ hasText: 'FX În așteptare' });
    await expect(pend.getByText('0/10 pescari', { exact: true })).toBeVisible();
    await expect(pend.getByText('1 în așteptare', { exact: true })).toBeVisible();
    // Urmărite keeps the tab's promo (it is not about what the viewer follows).
    await expect(spotlight(page)).toBeVisible();
    await settled(page);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c40 — «Ale mele» keeps the page\'s own list (no time groups)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    const mine = page.getByRole('tab', { name: /^Ale mele/ });
    if (!(await mine.count())) test.skip(true, 'the QA user has no registration tab locally');
    await mine.click();
    await expect(list(page).locator('[data-upcoming-groups]')).toHaveCount(0);
    await expect(spotlight(page)).toHaveCount(0);
  });
});
