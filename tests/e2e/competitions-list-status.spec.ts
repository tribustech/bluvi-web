import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { PIXEL } from './competitions-list.fixtures';

/*
 * The global status lists /concursuri/viitoare · /live · /incheiate (parity
 * docs/parity/areas/competitions-list.yml: competitions-list.viitoare / .live / .incheiate; fish
 * app/(app)/competitions/{notStarted,started,completed}/index.tsx + components/CompetitionsFullList.tsx
 * + components/CompetitionCard.tsx).
 *
 * The first page is read on the server. To drive the first-page states (loading, error, empty,
 * card shapes) a test fails that server read with the dev-only fault switch
 * (POST /concursuri/e2e-fault-liste, app/(site)/concursuri/(lists)/_status/faults.ts): the browser
 * then reads the first page itself and page.route answers it.
 *
 * Local CMS on :1337: Viitoare has 9 (one with a pending registration), Live 3, Încheiate 29 (two
 * pages of 20).
 */

const FEED = /\/feed\/competitions\?/;
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

function consoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function setFaults(page: Page, faults: string[]) {
  const res = await page.request.post('/concursuri/e2e-fault-liste', { data: { faults } });
  expect(res.ok()).toBe(true);
}

type Over = Record<string, unknown>;
const person = (id: number, username: string) => ({ id, documentId: `fx-p${id}`, username, avatar: null });
function item(id: string, over: Over = {}) {
  return {
    id: 1,
    documentId: id,
    name: `Concurs ${id}`,
    startDate: '2026-10-10T05:00:00.000Z',
    endDate: '2026-10-11T15:00:00.000Z',
    competitionStatus: 'notStarted',
    competitionType: 'single',
    rankingType: 'quantity',
    bestOfFishCount: null,
    bestOfTierSizes: null,
    registerFee: null,
    participantsLimit: null,
    teamParticipants: null,
    registrationDeadline: null,
    banner: { url: 'http://localhost:1337/uploads/fixture.jpg', smallUrl: 'http://localhost:1337/uploads/fixture.jpg', blurhash: null },
    lake: { id: 2, documentId: 'fx-lake', name: 'Balta Fixture', coordinates: null, images: [] },
    viewers: 7,
    registrations: [],
    ...over,
  };
}
const listPage = (data: unknown[], total = data.length) => ({
  data,
  meta: { pagination: { page: 1, pageSize: 20, pageCount: Math.max(1, Math.ceil(total / 20)), total } },
});

test.beforeEach(async ({ page }) => {
  await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
});
test.afterEach(async ({ page }) => {
  await setFaults(page, []);
});

const LISTS = [
  { key: 'viitoare', id: 'competitions-list.viitoare', title: 'Concursuri viitoare', status: 'notStarted', count: /\d+ (de )?concursuri viitoare|1 concurs viitor/ },
  { key: 'live', id: 'competitions-list.live', title: 'Concursuri live', status: 'started', count: /în desfășurare/ },
  { key: 'incheiate', id: 'competitions-list.incheiate', title: 'Concursuri trecute', status: 'completed', count: /concurs(uri)? trecut/ },
] as const;

for (const l of LISTS) {
  test(`${l.id}.c1 ${l.id}.c3 ${l.id}.c8 ${l.id}.c9 ${l.id}.c10 ${l.id}.c11 ${l.id}.c12 ${l.id}.c14 — header with back, two-column grid of legacy cards in the HTML, card opens the competition`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = consoleErrors(page);
    await page.setViewportSize({ width: 375, height: 900 });
    // The cards are in the server HTML (SEO), with canonical and JSON-LD.
    const html = await (await page.request.get(`/concursuri/${l.key}`)).text();
    expect(html).toContain(`<link rel="canonical" href="http://localhost:3000/concursuri/${l.key}"`);
    expect(html).toContain('"@type":"SportsEvent"');
    expect(html).toContain('"@type":"BreadcrumbList"');

    await page.goto(`/concursuri/${l.key}`);
    // c1: back + title.
    await expect(page.getByRole('heading', { level: 1, name: l.title })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.locator('#continut').getByText(l.count)).toBeVisible();
    const cards = page.getByRole('list', { name: l.title }).getByRole('listitem');
    await expect(cards.first()).toBeVisible();
    // c3: two columns on a phone (fish numColumns 2).
    if ((await cards.count()) >= 2) {
      const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
      expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);
    }
    const first = cards.first();
    // c11: the date upper-cased (getDisplayedDate, ro): «SÂM, 10 – DUM, 11 OCT» (WEB: en dash).
    // At 375 too: fish's full label (weekdays kept), never a shortened one; no overflow past the card.
    for (const date of await cards.locator('p.t-eyebrow').all()) {
      await expect(date).toHaveText(/^(LUN|MAR|MIE|JOI|VIN|SÂM|DUM), \d{1,2}( [A-ZĂÂÎȘȚ]{3}( \d{4})?)?( – (LUN|MAR|MIE|JOI|VIN|SÂM|DUM), \d{1,2} [A-ZĂÂÎȘȚ]{3}( \d{4})?)?$/);
      expect(await date.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    }
    // c12: «{registered}/{limit} pescari|echipe»; c14: the format + ranking badges.
    await expect(first.getByText(/^\d+\/\d+ (pescari|echipe)$/)).toBeVisible();
    await expect(first.getByText(/^(Individual|Echipe)$/)).toBeVisible();
    // c9: the poster shown whole (contain) over a blurred copy of itself, as fish (every card with a picture);
    // c10: the followers pill with its word on a phone (fish compact prints it), LIVE on a live card.
    for (const poster of await cards.locator('[data-poster]').filter({ has: page.locator('img') }).all()) {
      await expect(poster.locator('img')).toHaveCount(2);
      await expect(poster.locator('img').first()).toHaveClass(/blur/);
      await expect(poster.locator('img').last()).toHaveClass(/object-contain/);
    }
    await expect(first.getByRole('button', { name: /^\d+ urmăritori?$/ })).toBeVisible();
    await expect(first.getByRole('button', { name: /^\d+ urmăritori?$/ })).toHaveText(/^\d+ urmăritori?$/);
    await expect(first.getByText('LIVE', { exact: true })).toHaveCount(l.key === 'live' ? 1 : 0);
    // c8: the card is one link to /concursuri/[id].
    const link = first.getByRole('link');
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/concursuri\/[a-z0-9]{24}$/);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    // Back returns to the list (history).
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: l.title })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

test('competitions-list.incheiate.c2 competitions-list.incheiate.c7 competitions-list.incheiate.s4 competitions-list.incheiate.s5 — legacy /feed/competitions, next page near the end with its footer, refresh refetches', async ({ page }) => {
  const errors = consoleErrors(page);
  const requests: URL[] = [];
  page.on('request', (r) => {
    if (FEED.test(r.url())) requests.push(new URL(r.url()));
  });
  await page.goto('/concursuri/incheiate');
  const cards = page.getByRole('list', { name: 'Concursuri trecute' }).getByRole('listitem');
  await expect(cards).toHaveCount(20);
  // Slow the next page down so its loading footer shows.
  await page.route(FEED, async (r) => {
    await new Promise((res) => setTimeout(res, 800));
    await r.continue();
  });
  await page.getByText(/20 din \d+ (de )?concursuri/).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
  await expect.poll(async () => cards.count()).toBeGreaterThan(20);
  const next = requests.find((u) => u.searchParams.get('page') === '2');
  expect(next?.pathname).toMatch(/\/api\/feed\/competitions$/);
  expect(next?.searchParams.get('status')).toBe('completed');
  expect(next?.searchParams.get('pageSize')).toBe('20');
  // Refresh (pull-to-refresh stand-in) refetches the list.
  const before = requests.length;
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(before);
  await expect(page.getByRole('status').filter({ hasText: 'Actualizat' })).toBeAttached();
  expect(errors).toEqual([]);
});

test('competitions-list.viitoare.c2 competitions-list.viitoare.c4 competitions-list.viitoare.c9 competitions-list.viitoare.c10 competitions-list.viitoare.c13 competitions-list.viitoare.s1 competitions-list.viitoare.s6 — skeleton first, then the poster whole over its blur, followers pill, pending line', async ({ page }) => {
  const errors = consoleErrors(page);
  await setFaults(page, ['viitoare']);
  let asked: URL | undefined;
  await page.route(FEED, async (r) => {
    asked = new URL(r.request().url());
    await new Promise((res) => setTimeout(res, 1200));
    await json(
      r,
      listPage([
        item('fx-pending', {
          name: 'Cupa cu așteptare',
          participantsLimit: 30,
          registrations: [
            { registrationStatus: 'registered', participants: [person(1, 'Ana Pop')] },
            { registrationStatus: 'pending', participants: [person(2, 'Bogdan Ion')] },
            { registrationStatus: 'pending', participants: [person(3, 'Cezar Dan')] },
          ],
        }),
        item('fx-team', { competitionType: 'team', rankingType: 'bestOf', bestOfFishCount: 5, banner: null, lake: null }),
      ]),
    );
  });
  await page.goto('/concursuri/viitoare');
  // c4 / s1: the skeleton while the first page loads.
  await expect(page.getByTestId('status-list-skeleton').first()).toBeVisible();
  const cards = page.getByRole('list', { name: 'Concursuri viitoare' }).getByRole('listitem');
  await expect(cards).toHaveCount(2);
  expect(asked?.searchParams.get('status')).toBe('notStarted');
  expect(asked?.searchParams.get('page')).toBe('1');
  const pending = cards.nth(0);
  // c13: «2 în așteptare» (with the diacritic), next to «1/30 pescari».
  await expect(pending.getByText('1/30 pescari', { exact: true })).toBeVisible();
  await expect(pending.getByText('2 în așteptare', { exact: true })).toBeVisible();
  // c9: the poster shown whole (contain) over a blurred fill.
  const imgs = pending.locator('[data-poster] img');
  await expect(imgs).toHaveCount(2);
  await expect(imgs.nth(0)).toHaveClass(/blur/);
  await expect(imgs.nth(1)).toHaveClass(/object-contain/);
  // c12: no limit → 21; team → «echipe»; c14 ranking label.
  const team = cards.nth(1);
  await expect(team.getByText('0/21 echipe', { exact: true })).toBeVisible();
  await expect(team.getByText('Best of 5', { exact: true })).toBeVisible();
  // No banner and no lake photo: the designed trophy band, never an empty box.
  await expect(team.locator('[data-poster] img')).toHaveCount(0);
  await expect(team.locator('[data-poster] > span > svg')).toBeVisible();
  await expectNoA11yViolations(page);
  // c10: upcoming → the followers pill only, which opens the followers list.
  await expect(pending.getByText('Live', { exact: true })).toHaveCount(0);
  await page.route(/\/feed\/competitions\/fx-pending\/followers/, (r) => json(r, { data: [] }));
  await pending.getByRole('button', { name: '7 urmăritori' }).click();
  // From 1280 the followers list docks as a side panel (Fundații §07 «context» surface).
  const panel = page.getByRole('complementary', { name: 'Urmăritori' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Nu există urmăritori');
  expect(errors).toEqual([]);
});

test('competitions-list.live.c2 competitions-list.live.c10 competitions-list.live.s6 — live cards carry LIVE + the viewers pill', async ({ page }) => {
  await setFaults(page, ['live']);
  let asked: URL | undefined;
  await page.route(FEED, (r) => {
    asked = new URL(r.request().url());
    return json(r, listPage([item('fx-live', { competitionStatus: 'started', viewers: 1 })]));
  });
  await page.goto('/concursuri/live');
  const card = page.getByRole('list', { name: 'Concursuri live' }).getByRole('listitem').first();
  await expect(card.getByText('LIVE', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: '1 urmăritor' })).toBeVisible();
  expect(asked?.searchParams.get('status')).toBe('started');
  // c13 on a live card: pending registrations are never said.
  await expect(card.getByText(/în așteptare/)).toHaveCount(0);
});

for (const l of LISTS) {
  test(`${l.id}.c4 ${l.id}.c6 ${l.id}.s1 ${l.id}.s3 — skeleton while the first page loads, then the empty list`, async ({ page }) => {
    await setFaults(page, [l.key]);
    await page.route(FEED, async (r) => {
      await new Promise((res) => setTimeout(res, 1200));
      await json(r, listPage([]));
    });
    await page.goto(`/concursuri/${l.key}`);
    await expect(page.getByTestId('status-list-skeleton').first()).toBeVisible();
    await expect(page.getByText('Momentan nu este disponibil niciun concurs.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vezi toate concursurile' })).toHaveAttribute('href', '/concursuri');
    await expectNoA11yViolations(page);
  });
}

for (const l of LISTS) {
  test(`${l.id}.c5 ${l.id}.s2 — failed first page: the error card under the header (back stays), retry refetches`, async ({ page }) => {
    await setFaults(page, [l.key]);
    let fail = true;
    await page.route(FEED, (r) => (fail ? json(r, { error: { status: 503, message: 'down' } }, 503) : json(r, listPage([item('fx-ok')]))));
    await page.goto(`/concursuri/${l.key}`);
    const alert = page.getByRole('alert').filter({ has: page.getByRole('button') });
    await expect(alert).toContainText('Serverul nu răspunde', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: l.title })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    fail = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page.getByRole('list', { name: l.title }).getByRole('listitem')).toHaveCount(1);
  });
}

for (const status of [401, 403]) {
  test(`competitions-list.viitoare.c5 competitions-list.viitoare.s2 — a ${status} on the credential-less list is the server's grant: retry, never «Deconectează-te»`, async ({ page }) => {
    await setFaults(page, ['viitoare']);
    let fail = true;
    await page.route(FEED, (r) => (fail ? json(r, { error: { status, message: 'Forbidden' } }, status) : json(r, listPage([item('fx-ok')]))));
    await page.goto('/concursuri/viitoare');
    const alert = page.getByRole('alert').filter({ has: page.getByRole('button') });
    await expect(alert).toContainText('Serverul nu răspunde');
    await expect(alert.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    fail = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page.getByRole('list', { name: 'Concursuri viitoare' }).getByRole('listitem')).toHaveCount(1);
  });
}

for (const l of LISTS) {
  test(`${l.id}.c15 — a render error shows this route's retry card, the shell keeps working`, async ({ page }) => {
    await setFaults(page, [`${l.key}-crash`]);
    await page.goto(`/concursuri/${l.key}`);
    const alert = page.getByRole('alert').filter({ has: page.getByRole('button') });
    await expect(alert).toContainText('Concursurile nu s-au putut afișa');
    await expect(alert.getByRole('button', { name: 'Încearcă din nou' })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Competiții' }).first()).toBeVisible();
    await setFaults(page, []);
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page.getByRole('list', { name: l.title }).getByRole('listitem').first()).toBeVisible();
  });
}

test('competitions-list.viitoare.c1 — keyboard: back, refresh and the cards are reachable in order', async ({ page }) => {
  await page.goto('/concursuri');
  await page.goto('/concursuri/viitoare');
  const back = page.getByRole('button', { name: 'Înapoi' });
  await back.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Reîmprospătează' })).toBeFocused();
  // The status tabs (links), then the first card's link, then its followers pill.
  const tabs = page.getByRole('navigation', { name: 'Concursuri după stare' });
  for (const name of ['Live', 'Viitoare', 'Trecute']) {
    await page.keyboard.press('Tab');
    await expect(tabs.getByRole('link', { name })).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', /^\/concursuri\/[a-z0-9]{24}$/);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText(/urmăritor/);
  await back.click();
  await expect(page).toHaveURL(/\/concursuri$/);
});

/*
 * The per-lake status lists (competitions-list.*-balta) have no page of their own: merged_into
 * lakes.competitions (/balti/[id]/concursuri?tab=…), whose header, page size and card layout win
 * (parity README «Shared routes»). Their own states — the lake from the URL, loading, error, empty,
 * a card opening the competition — are checked here on that page, with the lake page's dev fault
 * switch (POST /balti/<id>/e2e-fault, `competitions-tab`) so the browser reads the tab.
 */
const CHITA = 's84u55lo4n9z0emngozttt6e';
const CARDS = /\/feed\/competition-cards\?/;
const BALTA = [
  { id: 'competitions-list.viitoare-balta', tab: 'viitoare', status: 'notStarted' },
  { id: 'competitions-list.live-balta', tab: 'live', status: 'started' },
  { id: 'competitions-list.incheiate-balta', tab: 'trecute', status: 'completed' },
] as const;

for (const b of BALTA) {
  test(`${b.id}.c3 ${b.id}.c5 ${b.id}.c6 ${b.id}.c7 ${b.id}.s1 ${b.id}.s2 ${b.id}.s3 — the lake's list: lakeId from the URL, skeleton, error with retry, empty`, async ({ page }) => {
    const set = (faults: string[]) => page.request.post(`/balti/${CHITA}/e2e-fault`, { data: { faults } });
    await set(['competitions-tab']);
    try {
      let mode: 'fail' | 'empty' = 'fail';
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let asked: URL | undefined;
      await page.route(CARDS, async (r) => {
        const u = new URL(r.request().url());
        if (u.searchParams.get('status') !== b.status) return r.continue();
        asked = u;
        await gate;
        return mode === 'fail' ? json(r, { error: { status: 503, message: 'down' } }, 503) : json(r, {
          data: [],
          meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 }, counts: { notStarted: 0, started: 0, completed: 0 } },
        });
      });
      await page.goto(`/balti/${CHITA}/concursuri${b.tab === 'live' ? '' : `?tab=${b.tab}`}`);
      // c5 / s1: the skeleton while the tab is read.
      await expect(page.getByRole('tabpanel').getByRole('status').first()).toBeVisible({ timeout: 60_000 });
      // c3: only this lake (lakeId from the route parameter).
      await expect.poll(() => asked?.searchParams.get('lakeId'), { timeout: 30_000 }).toBe(CHITA);
      release();
      // c6 / s2: the error card with «Încearcă din nou»; the header's back stays.
      const alert = page.getByRole('tabpanel').getByRole('alert');
      await expect(alert).toContainText('Nu am putut încărca concursurile', { timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      // c7 / s3: the retry answers empty.
      mode = 'empty';
      await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByRole('tabpanel')).toContainText('Momentan nu este disponibil niciun concurs.');
    } finally {
      await set([]);
    }
  });
}

test('competitions-list.incheiate-balta.c8 competitions-list.incheiate-balta.c9 competitions-list.incheiate-balta.s4 — next page on scroll, a card opens the competition', async ({ page }) => {
  await page.goto(`/balti/${CHITA}/concursuri?tab=trecute`);
  const panel = page.getByRole('tabpanel');
  const items = panel.getByRole('listitem');
  await expect(items.first()).toBeVisible({ timeout: 60_000 });
  const first = await items.count();
  test.skip(first < 10, 'needs more than one page of finished competitions at Chita');
  await page.mouse.wheel(0, 20_000);
  await expect.poll(() => items.count(), { timeout: 30_000 }).toBeGreaterThan(first);
  const href = await panel.locator('a[href^="/concursuri/"]').first().getAttribute('href');
  await panel.locator(`a[href="${href}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 60_000 });
});

for (const l of LISTS) {
  test(`${l.id}.c7 ${l.id}.c13 ${l.id}.s4 ${l.id}.s5 — next page near the end, refresh refetches; pending only on upcoming cards`, async ({ page }) => {
    await setFaults(page, [l.key]);
    const pages: string[] = [];
    const regs = [{ registrationStatus: 'pending', participants: [person(5, 'Dan Pop')] }];
    await page.route(FEED, async (r) => {
      const n = new URL(r.request().url()).searchParams.get('page') ?? '1';
      pages.push(n);
      const status = l.status;
      const rows = Array.from({ length: n === '1' ? 20 : 5 }, (_, i) => item(`fx-${n}-${i}`, { competitionStatus: status, registrations: regs }));
      if (n === '2') await new Promise((res) => setTimeout(res, 800));
      await json(r, { data: rows, meta: { pagination: { page: Number(n), pageSize: 20, pageCount: 2, total: 25 } } });
    });
    await page.goto(`/concursuri/${l.key}`);
    const cards = page.getByRole('list', { name: l.title }).getByRole('listitem');
    await expect(cards).toHaveCount(20);
    // c13: «1 în așteptare» on an upcoming card only.
    await expect(cards.first().getByText('1 în așteptare', { exact: true })).toHaveCount(l.key === 'viitoare' ? 1 : 0);
    await page.getByText('20 din 25 de concursuri').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
    await expect(cards).toHaveCount(25);
    expect(pages).toContain('2');
    const before = pages.length;
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect.poll(() => pages.length).toBeGreaterThan(before);
  });
}

/* ------------------------------------------------------------------ */
/* Robustness: header band, reads, failures, layout stability          */
/* ------------------------------------------------------------------ */

for (const l of LISTS) {
  test(`${l.id}.c1 — the breadcrumb band «Competiții / ${l.title}» from 768, the same trail as the BreadcrumbList`, async ({ page }) => {
    const html = await (await page.request.get(`/concursuri/${l.key}`)).text();
    const crumbs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]))
      .find((j) => j['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Competiții', l.title]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/concursuri/${l.key}`);
    const band = page.getByRole('navigation', { name: 'Cale de navigare' });
    await expect(band).toHaveCount(1);
    await expect(band.getByRole('link', { name: 'Competiții' })).toHaveAttribute('href', '/concursuri');
    await expect(band.locator('[aria-current="page"]')).toHaveText(l.title);
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(band).toBeHidden();
  });
}

test('competitions-list.viitoare.c7 competitions-list.live.c7 — fish freshness: back on the tab after a minute re-reads page 1', async ({ page }) => {
  // fish useFilteredCompetitions has no staleTime (a read on every mount and foreground); the web
  // keeps a read for the CMS's 60s edge TTL, then coming back re-reads it.
  await page.clock.install();
  const reads: URL[] = [];
  page.on('request', (r) => {
    if (FEED.test(r.url())) reads.push(new URL(r.url()));
  });
  await page.goto('/concursuri/live');
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri live' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const before = reads.length;
  await page.clock.fastForward('01:05');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => reads.slice(before).filter((u) => u.searchParams.get('page') === '1' && u.searchParams.get('status') === 'started').length).toBeGreaterThan(0);
});

for (const l of LISTS) {
  test(`${l.id}.c1 — the header's status tabs link the three lists, this one current, Live with its dot`, async ({ page }) => {
    await page.goto(`/concursuri/${l.key}`);
    const tabs = page.getByRole('navigation', { name: 'Concursuri după stare' });
    await expect(tabs.getByRole('link')).toHaveText(['Live', 'Viitoare', 'Trecute']);
    await expect(tabs.getByRole('link', { name: 'Viitoare' })).toHaveAttribute('href', '/concursuri/viitoare');
    await expect(tabs.getByRole('link', { name: 'Live' })).toHaveAttribute('href', '/concursuri/live');
    await expect(tabs.getByRole('link', { name: 'Trecute' })).toHaveAttribute('href', '/concursuri/incheiate');
    await expect(tabs.locator('[aria-current="page"]')).toHaveText(l.key === 'incheiate' ? 'Trecute' : l.key === 'live' ? 'Live' : 'Viitoare');
    const next = l.key === 'live' ? 'Viitoare' : 'Live';
    await tabs.getByRole('link', { name: next }).click();
    await expect(page.getByRole('heading', { level: 1, name: next === 'Live' ? 'Concursuri live' : 'Concursuri viitoare' })).toBeVisible();
  });
}

const faces = [
  { registrationStatus: 'registered', participants: [person(1, 'Ana Pop')] },
  { registrationStatus: 'registered', participants: [person(2, 'Bogdan Ion')] },
];
const twentyRows = () =>
  Array.from({ length: 20 }, (_, i) => item(`fx-${i}`, { name: `Cupa ${i}`, registrations: faces }));

for (const width of [375, 1440]) {
  test(`competitions-list.viitoare.c4 competitions-list.viitoare.s1 — skeleton and cards share one box at ${width} (no layout shift)`, async ({ page }) => {
    await setFaults(page, ['viitoare']);
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(FEED, async (r) => {
      await gate;
      await json(r, listPage(twentyRows(), 25));
    });
    await page.goto('/concursuri/viitoare');
    const skeleton = page.getByTestId('status-list-skeleton');
    // The streamed screen arrives in a hidden template before React swaps it in: one skeleton after.
    await expect(skeleton).toHaveCount(1);
    await expect(skeleton).toBeVisible();
    const title = page.getByRole('heading', { level: 1, name: 'Concursuri viitoare' });
    const bones = skeleton.locator('li');
    const [titleBefore, boneA, boneB] = [await title.boundingBox(), await bones.nth(0).boundingBox(), await bones.nth(1).boundingBox()];
    release();
    const cards = page.getByRole('list', { name: 'Concursuri viitoare' }).getByRole('listitem');
    await expect(cards.first()).toBeVisible();
    const [titleAfter, cardA, cardB] = [await title.boundingBox(), await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
    expect(Math.abs(titleAfter!.y - titleBefore!.y)).toBeLessThan(1);
    for (const [bone, card] of [
      [boneA, cardA],
      [boneB, cardB],
    ]) {
      expect(Math.abs(card!.y - bone!.y)).toBeLessThan(1);
      expect(Math.abs(card!.x - bone!.x)).toBeLessThan(1);
      expect(Math.abs(card!.width - bone!.width)).toBeLessThan(1);
      expect(Math.abs(card!.height - bone!.height)).toBeLessThan(1);
    }
  });
}

test('competitions-list.live.c7 competitions-list.live.s4 — next page fails: footer error, no auto-hammer, Reîncearcă loads it', async ({ page }) => {
  await setFaults(page, ['live']);
  let failNext = true;
  const pages: string[] = [];
  await page.route(FEED, async (r) => {
    const n = new URL(r.request().url()).searchParams.get('page') ?? '1';
    pages.push(n);
    if (n === '2' && failNext) return json(r, { error: { status: 503, message: 'down' } }, 503);
    const rows = Array.from({ length: n === '1' ? 20 : 5 }, (_, i) => item(`fx-${n}-${i}`, { competitionStatus: 'started' }));
    return json(r, { data: rows, meta: { pagination: { page: Number(n), pageSize: 20, pageCount: 2, total: 25 } } });
  });
  await page.goto('/concursuri/live');
  const cards = page.getByRole('list', { name: 'Concursuri live' }).getByRole('listitem');
  await expect(cards).toHaveCount(20);
  await page.getByText('20 din 25 de concursuri').scrollIntoViewIfNeeded();
  await expect(page.getByText('Nu am putut încărca mai multe concursuri.')).toBeVisible({ timeout: 15_000 });
  const retry = page.getByRole('button', { name: 'Reîncearcă' });
  await expect(retry).toBeVisible();
  // The footer is still on screen, but a failed page is not fetched again on its own.
  const tries = pages.filter((p) => p === '2').length;
  await page.waitForTimeout(2000);
  expect(pages.filter((p) => p === '2').length).toBe(tries);
  await expect(cards).toHaveCount(20);
  failNext = false;
  await retry.click();
  await expect(cards).toHaveCount(25);
});

test('competitions-list.incheiate.c7 competitions-list.incheiate.s5 — refresh fails: the cards stay, «Nu s-a putut actualiza»', async ({ page }) => {
  await setFaults(page, ['incheiate']);
  let fail = false;
  await page.route(FEED, (r) =>
    fail ? r.abort('connectionrefused') : json(r, listPage([item('fx-a', { competitionStatus: 'completed' }), item('fx-b', { competitionStatus: 'completed' })])),
  );
  await page.goto('/concursuri/incheiate');
  const cards = page.getByRole('list', { name: 'Concursuri trecute' }).getByRole('listitem');
  await expect(cards).toHaveCount(2);
  fail = true;
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Nu s-a putut actualiza' })).toBeAttached({ timeout: 15_000 });
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('alert').filter({ has: page.getByRole('button') })).toHaveCount(0);
});

for (const l of LISTS) {
  test(`${l.id}.c5 ${l.id}.s2 — network down: the server's fault, not the user's connection; offline says so`, async ({ page, context }) => {
    await setFaults(page, [l.key]);
    await page.route(FEED, (r) => r.abort('connectionrefused'));
    await page.goto(`/concursuri/${l.key}`);
    const alert = page.getByRole('alert').filter({ has: page.getByRole('button') });
    // One browser read after the server's failed one — no retry chain before the card.
    await expect(alert).toContainText('Serverul nu răspunde', { timeout: 6_000 });
    await expect(alert).not.toContainText('Verifică conexiunea');
    await context.setOffline(true);
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(alert).toContainText('Verifică conexiunea la internet', { timeout: 10_000 });
    await context.setOffline(false);
  });
}

test('competitions-list.live.c5 competitions-list.live.s2 — hung CMS: the error card within the read budget, never an endless skeleton', async ({ page }) => {
  test.setTimeout(60_000);
  await setFaults(page, ['live']);
  await page.route(FEED, () => new Promise(() => {}));
  await page.goto('/concursuri/live');
  await expect(page.getByTestId('status-list-skeleton').first()).toBeVisible();
  const alert = page.getByRole('alert').filter({ has: page.getByRole('button') });
  await expect(alert).toContainText('Serverul nu răspunde', { timeout: 15_000 });
  await expect(page.getByTestId('status-list-skeleton')).toHaveCount(0);
});

for (const width of [375, 1440]) {
  for (const state of ['empty', '503'] as const) {
    test(`competitions-list.viitoare.c4 competitions-list.viitoare.s1 competitions-list.viitoare.${state === 'empty' ? 's3' : 's2'} — the header keeps its box from the skeleton to the ${state} state at ${width}`, async ({ page }) => {
      await setFaults(page, ['viitoare']);
      await page.setViewportSize({ width, height: 900 });
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await page.route(FEED, async (r) => {
        await gate;
        return state === 'empty' ? json(r, listPage([])) : json(r, { error: { status: 503, message: 'down' } }, 503);
      });
      await page.goto('/concursuri/viitoare');
      await expect(page.getByTestId('status-list-skeleton')).toHaveCount(1);
      await expect(page.getByTestId('status-list-skeleton')).toBeVisible();
      const title = page.getByRole('heading', { level: 1, name: 'Concursuri viitoare' });
      const region = page.locator('#concursuri-status');
      const [t0, r0] = [await title.boundingBox(), await region.boundingBox()];
      release();
      if (state === 'empty') {
        await expect(page.getByText('Momentan nu este disponibil niciun concurs.')).toBeVisible();
        await expect(page.getByText('0 concursuri viitoare')).toBeVisible();
      } else {
        await expect(page.getByRole('alert').filter({ has: page.getByRole('button') })).toContainText('Serverul nu răspunde', { timeout: 20_000 });
      }
      const [t1, r1] = [await title.boundingBox(), await region.boundingBox()];
      expect(Math.abs(t1!.y - t0!.y)).toBeLessThan(1);
      expect(Math.abs(r1!.y - r0!.y)).toBeLessThan(1);
    });
  }
}

test('competitions-list.viitoare.c14 competitions-list.incheiate.c14 — at 375 a long ranking badge never runs past its card (wraps, then ellipsis, full text in the title)', async ({ page }) => {
  await setFaults(page, ['viitoare']);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.route(FEED, (r) =>
    json(
      r,
      listPage([
        item('fx-fipsed', { rankingType: 'fipsed' }),
        item('fx-tiers', { rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7, 5, 3], competitionType: 'team' }),
        item('fx-cmmc', { rankingType: 'calitateCantitateCMMC' }),
        item('fx-qq', { rankingType: 'quantityQuality' }),
      ]),
    ),
  );
  await page.goto('/concursuri/viitoare');
  const cards = page.getByRole('list', { name: 'Concursuri viitoare' }).getByRole('listitem');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).getByTitle('Campionat Mondial FIPSed')).toBeAttached();
  await expect(cards.nth(1).getByTitle('Best of 9, 7, 5, 3')).toBeAttached();
  for (let i = 0; i < 4; i++) {
    const overflow = await cards.nth(i).evaluate((li) => {
      const card = li.querySelector('article')!.getBoundingClientRect();
      // Everything but the poster band's own (clipped) images: the 125% blurred fill is cut by the band.
      const els = [...li.querySelectorAll('article *')].filter((el) => !el.closest('[data-poster]'));
      return els
        .map((el) => ({ r: el.getBoundingClientRect(), el }))
        .filter(({ r }) => r.width > 0)
        .reduce((m, { r, el }) => (r.right - card.right > m.d ? { d: r.right - card.right, what: `${el.tagName}.${el.className}` } : m), { d: -Infinity, what: '' });
    });
    expect(overflow.d, overflow.what).toBeLessThanOrEqual(0.5);
  }
});

test('competitions-list.viitoare.c12 — a nameless entrant is a neutral person glyph, never invented initials', async ({ page }) => {
  await setFaults(page, ['viitoare']);
  await page.route(FEED, (r) =>
    json(
      r,
      listPage([
        item('fx-anon', {
          participantsLimit: 10,
          registrations: [
            { registrationStatus: 'registered', participants: [] },
            { registrationStatus: 'registered', participants: [person(1, 'Ana Pop')] },
            { registrationStatus: 'registered', participants: [] },
          ],
        }),
      ]),
    ),
  );
  await page.goto('/concursuri/viitoare');
  const card = page.getByRole('list', { name: 'Concursuri viitoare' }).getByRole('listitem').first();
  await expect(card.getByText('3/10 pescari', { exact: true })).toBeVisible();
  await expect(card.getByText('AP', { exact: true })).toBeVisible();
  await expect(card.getByText('PA', { exact: true })).toHaveCount(0);
  await expect(card.locator('article svg.size-3\\.5')).toHaveCount(2);
});

test('competitions-list.live.c7 competitions-list.live.s4 — a hung next page shows the footer error within the read budget (no retry of a timeout)', async ({ page }) => {
  test.setTimeout(60_000);
  await setFaults(page, ['live']);
  const pages: string[] = [];
  await page.route(FEED, async (r) => {
    const n = new URL(r.request().url()).searchParams.get('page') ?? '1';
    pages.push(n);
    if (n === '2') return new Promise(() => {});
    const rows = Array.from({ length: 20 }, (_, i) => item(`fx-${i}`, { competitionStatus: 'started' }));
    return json(r, { data: rows, meta: { pagination: { page: 1, pageSize: 20, pageCount: 2, total: 25 } } });
  });
  await page.goto('/concursuri/live');
  await expect(page.getByRole('list', { name: 'Concursuri live' }).getByRole('listitem')).toHaveCount(20);
  await page.getByText('20 din 25 de concursuri').scrollIntoViewIfNeeded();
  const started = Date.now();
  await expect(page.getByText('Nu am putut încărca mai multe concursuri.')).toBeVisible({ timeout: 12_500 });
  expect(Date.now() - started).toBeLessThan(12_500);
  expect(pages.filter((p) => p === '2')).toHaveLength(1);
});

test('competitions-list.viitoare.s1 competitions-list.viitoare.c4 — a slow CMS: the streamed frame, the screen and the cards share one header (title, bones and focus stay)', async ({ page }) => {
  test.setTimeout(90_000);
  await setFaults(page, ['viitoare-slow']);
  await page.setViewportSize({ width: 1280, height: 900 });
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let browserRead = false;
  await page.route(FEED, async (r) => {
    browserRead = true;
    await gate;
    await json(r, listPage(twentyRows(), 25));
  });
  await page.goto('/concursuri/viitoare', { waitUntil: 'commit' });
  const title = page.getByRole('heading', { level: 1, name: 'Concursuri viitoare' });
  const skeleton = page.getByTestId('status-list-skeleton');
  await expect(skeleton).toBeVisible();
  // The streamed fallback (the server read is still running): focus «Înapoi» now.
  expect(browserRead).toBe(false);
  const back = page.getByRole('button', { name: 'Înapoi' });
  await back.focus();
  const [t0, b0] = [await title.boundingBox(), await skeleton.locator('li').first().boundingBox()];
  // The server gives up on its budget; the screen mounts and the browser reads (held).
  await expect.poll(() => browserRead, { timeout: 20_000 }).toBe(true);
  await expect(skeleton).toBeVisible();
  const [t1, b1] = [await title.boundingBox(), await skeleton.locator('li').first().boundingBox()];
  await expect(back).toBeFocused();
  release();
  const card = page.getByRole('list', { name: 'Concursuri viitoare' }).getByRole('listitem').first();
  await expect(card).toBeVisible();
  const [t2, c2] = [await title.boundingBox(), await card.boundingBox()];
  await expect(back).toBeFocused();
  for (const t of [t1, t2]) expect(Math.abs(t!.y - t0!.y)).toBeLessThan(1);
  for (const b of [b1, c2]) {
    expect(Math.abs(b!.y - b0!.y)).toBeLessThan(1);
    expect(Math.abs(b!.x - b0!.x)).toBeLessThan(1);
    expect(Math.abs(b!.width - b0!.width)).toBeLessThan(1);
  }
});
