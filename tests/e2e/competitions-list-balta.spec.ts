import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS } from './helpers/session';
import { card, media, page as cardsPage } from './competitions-list.fixtures';

/*
 * competitions-list.{viitoare,live,incheiate}-balta — fish /competitions/{status}/[lakeId]. These
 * screens have no page of their own: merged_into lakes.competitions (/balti/[id]/concursuri?tab=…),
 * whose header (the lake's name, not «Concursuri viitoare»), page size (10, not 5), data source
 * (/feed/competition-cards scoped by lakeId, not the legacy /feed/competitions list) and card
 * (the /concursuri compact card, not the legacy two-column card) win — parity README «Shared
 * routes». Each test below names the merged criterion and checks what the owner's page does for it.
 * c3, c5–c7 (lake from the URL, skeleton, error, empty) are in competitions-list-status.spec.ts.
 *
 * The lake page's dev fault switch (`competitions-tab`) makes the browser read the tab, so the
 * mocks answer it.
 */

const CHITA = 's84u55lo4n9z0emngozttt6e';
const CARDS = /\/feed\/competition-cards\?/;
const BALTA = [
  { id: 'competitions-list.viitoare-balta', tab: 'viitoare', status: 'notStarted' },
  { id: 'competitions-list.live-balta', tab: 'live', status: 'started' },
  { id: 'competitions-list.incheiate-balta', tab: 'trecute', status: 'completed' },
] as const;

const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const setFaults = (page: Page, faults: string[]) => page.request.post(`/balti/${CHITA}/e2e-fault`, { data: { faults } });
const url = (tab: string) => `/balti/${CHITA}/concursuri${tab === 'live' ? '' : `?tab=${tab}`}`;

const lakeImage = media({ url: 'http://localhost:1337/uploads/lake.jpg?o' });
lakeImage.smallUrl = 'http://localhost:1337/uploads/lake.jpg?s';

// Live and Trecute cards: the first has catches (stats / podium), the third none yet.
const results = (status: string, i: number) =>
  status === 'notStarted' || i === 1
    ? null
    : {
        capturedAt: '2026-10-05T10:00:00.000Z',
        hasCatches: i !== 2,
        catchCount: i === 2 ? 0 : 23,
        totalKg: i === 2 ? null : 104.5,
        biggestFishKg: i === 2 ? null : 7.6,
        podium:
          i === 2
            ? []
            : [
                { position: 1, tied: false, displayName: 'Ion Podium', standName: '4', clubName: null, avatarUrls: [] },
                { position: 2, tied: false, displayName: 'Vlad Podium', standName: null, clubName: null, avatarUrls: [] },
              ],
      };

// The fourth card was reopened: its start passed its end, and the CMS label runs backwards
// («6–4 oct», local CMS 2026-10-07) — the card shows the start day alone.
const REOPENED = { dateLabel: '6–4 oct', startDate: '2026-10-05T21:02:00.000Z', endDate: '2026-10-04T18:00:00.000Z' };

function rows(status: string, n: number, prefix: string) {
  return Array.from({ length: n }, (_, i) =>
    card(`${prefix}-${i}`, {
      name: `FX ${prefix} ${i}`,
      status,
      lake: { documentId: CHITA, name: 'Chita Lake', county: null, image: lakeImage },
      pendingCount: status === 'notStarted' && i === 0 ? 2 : 0,
      format: i === 1 ? { kind: 'team', teamSize: 2, unit: 'echipe' } : { kind: 'single', teamSize: null, unit: 'pescari' },
      participantFaces: ['http://localhost:1337/uploads/face.jpg'],
      viewers: 3,
      dateLabel: '20 oct – 21 oct',
      results: results(status, i),
      ...(i === 3 ? REOPENED : {}),
    }),
  );
}

for (const b of BALTA) {
  test(`${b.id}.c1 ${b.id}.c2 ${b.id}.c4 ${b.id}.c8 ${b.id}.c9 ${b.id}.c10 ${b.id}.c11 ${b.id}.c12 ${b.id}.c13 ${b.id}.c14 ${b.id}.c15 ${b.id}.s4 ${b.id}.s6 — the lake's tab: header, lake-scoped cards, next page, card content, a card opens the competition`, async ({ page }) => {
    test.setTimeout(120_000);
    await setFaults(page, ['competitions-tab']);
    try {
      const asked: URL[] = [];
      await page.route(CARDS, async (r) => {
        const u = new URL(r.request().url());
        if (u.searchParams.get('status') !== b.status) return r.continue();
        asked.push(u);
        const n = Number(u.searchParams.get('page') ?? '1');
        if (n === 2) await new Promise((res) => setTimeout(res, 800));
        return json(r, cardsPage(rows(b.status, n === 1 ? 10 : 3, `p${n}`), { page: n, pageCount: 2, total: 13 }));
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url(b.tab));
      // c1: a back control beside the title; the owner's title is the lake's name (lakes.competitions.c1).
      await expect(page.getByRole('heading', { level: 1, name: 'Chita Lake' })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      // …with the caption that says what the page is (lakes.competitions.c1: not promotional).
      await expect(page.locator('#balta-sub-titlu + div')).toHaveText('Concursuri');
      await expect(page.getByRole('tab', { selected: true })).toHaveText(b.tab === 'live' ? /Live/ : b.tab === 'viitoare' ? /Viitoare/ : /Trecute/);
      // c2: this lake's cards of this status (owner: competition cards, 10 a page).
      const panel = page.getByRole('tabpanel');
      const items = panel.getByRole('listitem').filter({ has: page.getByRole('link', { name: /^FX / }) });
      await expect(items).toHaveCount(10);
      expect(asked[0].searchParams.get('lakeId')).toBe(CHITA);
      expect(asked[0].searchParams.get('pageSize')).toBe('10');
      // c4: the compact card in a grid.
      const first = items.first();
      // c10: no banner → the lake's image, small format.
      await expect(first.locator('img').first()).toHaveAttribute('src', /lake\.jpg(%3F|\?)s/);
      // c11 / c12: live → LIVE + date; otherwise the date in upper case; the followers pill on every card.
      if (b.status === 'started') await expect(first.getByText('LIVE · 20 oct – 21 oct')).toBeVisible();
      else await expect(first.getByText('20 oct – 21 oct', { exact: true })).toHaveCSS('text-transform', 'uppercase');
      await expect(first.getByRole('button', { name: /3 urmăritori/ })).toBeVisible();
      // c13: the name; the lake line is the owner's call (not repeated on its own lake's page).
      await expect(first.getByRole('link', { name: 'FX p1 0' })).toBeVisible();
      await expect(first.getByText('Chita Lake')).toHaveCount(0);
      // c13 footer, per status (the cards' c13–c17 footers, owner override): seats before the start,
      // catch stats while live, the podium once finished — «N/M» only on Viitoare.
      if (b.status === 'notStarted') {
        await expect(first.getByText('6/10 pescari')).toBeVisible();
        // c14: pending registrations on an upcoming card.
        await expect(first.getByText('2 în așteptare')).toBeVisible();
      } else if (b.status === 'started') {
        await expect(first.getByText('6 pescari în concurs')).toBeVisible();
        await expect(first.getByRole('definition').filter({ hasText: '23' })).toBeVisible();
        await expect(first.getByText('capturi', { exact: true })).toBeVisible();
        await expect(first.getByText('6/10 pescari')).toHaveCount(0);
        await expect(items.nth(1).getByText('Statisticile nu sunt disponibile.')).toBeVisible();
        await expect(items.nth(2).getByText('Încă nu sunt capturi înregistrate.')).toBeVisible();
      } else {
        const podium = first.getByRole('list', { name: 'Podium FX p1 0' });
        await expect(podium.getByRole('listitem')).toHaveCount(2);
        await expect(podium.getByText('Ion Podium')).toBeVisible();
        await expect(first.getByText('6/10 pescari')).toHaveCount(0);
        await expect(items.nth(1).getByText('Rezultatele nu sunt disponibile.')).toBeVisible();
        await expect(items.nth(2).getByText('Fără capturi înregistrate.')).toBeVisible();
      }
      // c12: a reopened competition (end before start) never prints a backwards range.
      const reopened = items.nth(3);
      await expect(reopened.getByText(b.status === 'started' ? /^LIVE · 6 oct$/ : /^6 oct$/)).toBeVisible();
      await expect(reopened.getByText(/6–4/)).toHaveCount(0);
      // c15: format and ranking chips.
      await expect(first.getByText('Individual', { exact: true })).toBeVisible();
      await expect(items.nth(1).getByText('Echipe', { exact: true })).toBeVisible();
      await expect(first.getByText('Cantitate', { exact: true })).toBeVisible();
      // c8: the end of the list loads the next page, with the footer while it loads.
      await page.getByText('10 din 13 concursuri').scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
      await expect(items).toHaveCount(13);
      expect(asked.map((u) => u.searchParams.get('page'))).toContain('2');
      await expectNoA11yViolations(page);
      // c9: a card opens the competition — the poster too (owner 2026-10-08, §4b.24: no photo viewer).
      await expect(first.getByRole('button', { name: /afiș|imaginea/i })).toHaveCount(0);
      // force: the card's stretched link lies over the poster and takes the click (that is the point).
      await first.locator('img').first().click({ force: true });
      await expect(page).toHaveURL(/\/concursuri\/p1-0$/, { timeout: 60_000 });
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } finally {
      await setFaults(page, []);
    }
  });
}

for (const b of BALTA) {
  test(`${b.id}.c16 — a card that crashes the render: the route's retry card, the shell keeps working`, async ({ page }) => {
    test.setTimeout(120_000);
    await setFaults(page, ['competitions-tab']);
    try {
      await page.addInitScript(() => {
        const toFixed = Number.prototype.toFixed;
        Number.prototype.toFixed = function (this: number, digits?: number) {
          if (Number(this) === 4242.4) throw new Error('fixture: unrenderable figure');
          return toFixed.call(this, digits);
        };
      });
      // A live card with a weighed total renders the figure; the other tabs read an empty list.
      const broken = card('fx-crash', {
        name: 'FX Card stricat',
        status: 'started',
        results: { capturedAt: '2026-10-05T10:00:00.000Z', hasCatches: true, catchCount: 3, totalKg: 4242.4, biggestFishKg: 2.5, podium: [] },
      });
      await page.route(CARDS, async (r) => {
        const u = new URL(r.request().url());
        if (u.searchParams.get('status') !== b.status) return r.continue();
        return json(r, cardsPage([broken]));
      });
      await page.goto(url(b.tab));
      const heading = page.getByRole('heading', { name: 'Concursurile nu au putut fi încărcate' });
      await expect(heading).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('link', { name: 'Acasă' }).first()).toBeVisible();
      // The retry is never silent and never a blank page (the cached card still crashes, so the
      // card stays and says so — re-reading on retry is lakes.b.route-error-boundary's call).
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByText(/^Tot nu s-a putut încărca\. Încercarea/)).toBeVisible({ timeout: 30_000 });
      await expect(heading).toBeVisible();
      await expectNoA11yViolations(page);
    } finally {
      await setFaults(page, []);
    }
  });
}

for (const b of BALTA) {
  // fish sends the request with an unknown lakeId and shows empty or error. WEB: the lake is read
  // first, so an unknown one is the shared «not found» page (noindex) and no card list is asked for.
  test(`${b.id}.s7 lakes.competitions.s7 — an unknown lakeId: the not-found page, no card read`, async ({ page }) => {
    const reads: string[] = [];
    page.on('request', (r) => {
      if (CARDS.test(r.url())) reads.push(r.url());
    });
    await page.goto(`/balti/nuexista000000000000000/concursuri?tab=${b.tab}`);
    await expect(page).toHaveTitle(/Balta nu a fost găsită/);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('link', { name: 'Acasă' }).first()).toBeVisible();
    expect(reads.filter((u) => u.includes('nuexista'))).toEqual([]);
    await expectNoA11yViolations(page);
  });
}

for (const b of BALTA) {
  // fish CompetitionsFullList pull-to-refresh → the tab's refetch. WEB: the /concursuri stand-in,
  // DashboardRefresh «Reîmprospătează» in the header's action slot (lakes.competitions.c5).
  test(`${b.id}.c8 ${b.id}.s5 lakes.competitions.c5 lakes.competitions.s6 — «Reîmprospătează» re-reads the open tab once per press, keeps the cards while it runs; a failed re-read keeps them, with a retry`, async ({ page }) => {
    test.setTimeout(120_000);
    await setFaults(page, ['competitions-tab']);
    try {
      const asked: string[] = [];
      let round = 0;
      let fail = false;
      await page.route(CARDS, async (r) => {
        const u = new URL(r.request().url());
        asked.push(u.searchParams.get('status') ?? '');
        if (u.searchParams.get('status') !== b.status) return r.continue();
        const n = round++;
        if (n > 0) await new Promise((res) => setTimeout(res, 1200));
        if (fail) return json(r, { error: { status: 400, message: 'bad' } }, 400);
        return json(r, cardsPage(rows(b.status, 10, `r${n}`), { pageCount: 1, total: 10 }));
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url(b.tab));
      const panel = page.getByRole('tabpanel');
      const items = panel.getByRole('listitem').filter({ has: page.getByRole('link', { name: /^FX / }) });
      await expect(panel.getByRole('link', { name: 'FX r0 0' })).toBeVisible({ timeout: 60_000 });
      await expect(items).toHaveCount(10);
      const button = page.getByRole('button', { name: 'Reîmprospătează' });
      await expect(button).toBeVisible();
      const before = asked.length;

      // One press → one read of this tab, none of the others; the cards stay, the control and the
      // region say it runs.
      await button.click();
      await expect(button).toHaveAttribute('aria-disabled', 'true');
      await expect(panel).toHaveAttribute('aria-busy', 'true');
      await expect(page.getByRole('status').filter({ hasText: 'Se actualizează…' })).toBeAttached();
      await expect(items).toHaveCount(10);
      await expect(panel.getByRole('link', { name: 'FX r0 0' })).toBeVisible();
      await button.click({ force: true }); // ignored while it runs
      await expect(panel.getByRole('link', { name: 'FX r1 0' })).toBeVisible();
      await expect(button).not.toHaveAttribute('aria-disabled');
      await expect(panel).not.toHaveAttribute('aria-busy');
      expect(asked.slice(before)).toEqual([b.status]);
      await expect(page.getByRole('status').filter({ hasText: 'Actualizat' })).toBeAttached();

      // A failed re-read: the cards stay, marked, with their own retry.
      fail = true;
      await button.click();
      const notice = panel.getByText('Nu am putut actualiza lista.');
      await expect(notice).toBeVisible();
      await expect(items).toHaveCount(10);
      await expect(panel.getByRole('link', { name: 'FX r1 0' })).toBeVisible();
      await expect(notice.locator('xpath=ancestor::*[@aria-live="polite"][1]')).toHaveCount(1);
      await expect(button).not.toHaveAttribute('aria-disabled');
      expect(asked.slice(before)).toEqual([b.status, b.status]);
      await expectNoA11yViolations(page);
      fail = false;
      await panel.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(panel.getByRole('link', { name: 'FX r3 0' })).toBeVisible();
      await expect(notice).toHaveCount(0);
    } finally {
      await setFaults(page, []);
    }
  });
}

test('lakes.competitions.s6 — phone: the refresh is the 48px square beside the title, never pushing it out', async ({ page }) => {
  test.setTimeout(120_000);
  await setFaults(page, ['competitions-tab']);
  try {
    await page.route(CARDS, (r) => json(r, cardsPage(rows('started', 3, 'm'), { pageCount: 1, total: 3 })));
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(url('live'));
    await expect(page.getByRole('heading', { level: 1, name: 'Chita Lake' })).toBeVisible({ timeout: 60_000 });
    const square = page.getByRole('button', { name: 'Reîmprospătează' });
    await expect(square).toBeVisible();
    const box = await square.boundingBox();
    expect(box?.width).toBe(48);
    expect(box?.height).toBe(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  } finally {
    await setFaults(page, []);
  }
});

// The bare URL (canonical, sitemapped, every entry point's link) opens Live only while something is
// live; otherwise the first tab that has competitions — read from the local CMS, so the expectation
// follows the data (Chita today: 0 live, upcoming and past ones → Viitoare).
test('lakes.competitions.c2 lakes.competitions.c6 — the bare URL with nothing live opens the tab that has competitions (URL stays bare, Live still first); ?tab=live still wins', async ({ page, request }) => {
  test.setTimeout(120_000);
  const counts = (await (await request.get(`${CMS}/feed/competition-cards?status=started&lakeId=${CHITA}&page=1&pageSize=10`)).json()).meta.counts as {
    started: number;
    notStarted: number;
    completed: number;
  };
  const expected = counts.started > 0 ? 'Live' : counts.notStarted > 0 ? 'Viitoare' : counts.completed > 0 ? 'Trecute' : 'Live';
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/balti/${CHITA}/concursuri`);
  const tabs = page.getByRole('tablist', { name: 'Concursuri la baltă' });
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText(new RegExp(`^${expected}`), { timeout: 60_000 });
  if (counts.started === 0 && counts.notStarted > 0) expect(expected).toBe('Viitoare');
  await expect(tabs.getByRole('tab')).toHaveText([/^Live/, /^Viitoare/, /^Trecute/]);
  // Server-rendered: the open tab's cards are in the HTML, and the ItemList lists them.
  if (expected !== 'Live') {
    await expect(page.getByRole('tabpanel').getByText(/^(Niciun concurs|Momentan nu este disponibil)/)).toHaveCount(0);
    const lists = await page.locator('script[type="application/ld+json"]').evaluateAll(els =>
      els.flatMap(e => [JSON.parse(e.textContent ?? 'null')].flat()).filter((x: { '@type'?: string } | null) => x?.['@type'] === 'ItemList'),
    );
    expect(lists.length).toBe(1);
    expect(lists[0].itemListElement.length).toBeGreaterThan(0);
    expect(lists[0].url).toMatch(new RegExp(`/balti/${CHITA}/concursuri$`));
  }
  await page.waitForTimeout(300);
  expect(new URL(page.url()).search).toBe('');
  // An explicit ?tab=live opens Live, and keeps saying so in the URL.
  await page.goto(`/balti/${CHITA}/concursuri?tab=live`);
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText(/^Live/, { timeout: 60_000 });
  await page.waitForTimeout(300);
  expect(new URL(page.url()).searchParams.get('tab')).toBe(expected === 'Live' ? null : 'live');
});

test('lakes.competitions.c2 lakes.competitions.c4 competitions-list.viitoare-balta.c4 competitions-list.viitoare-balta.c8 — tab counts, the empty card\'s way on (logged, focus on the new tab), «din 24 de concursuri», one column at 375', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const w = window as unknown as { __events: unknown[]; gtag: (...a: unknown[]) => void };
    w.__events = [];
    w.gtag = (...a: unknown[]) => w.__events.push(a);
  });
  await setFaults(page, ['competitions-tab']);
  try {
    const counts = { started: 0, notStarted: 24, completed: 3 };
    await page.route(CARDS, async r => {
      const u = new URL(r.request().url());
      const status = u.searchParams.get('status');
      if (status === 'notStarted') return json(r, cardsPage(rows('notStarted', 10, 'v'), { pageCount: 3, total: 24, counts }));
      if (status === 'completed') return json(r, cardsPage(rows('completed', 3, 't'), { total: 3, counts }));
      return json(r, cardsPage([], { total: 0, pageCount: 0, counts }));
    });
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(url('live'));
    const tabs = page.getByRole('tablist', { name: 'Concursuri la baltă' });
    const panel = page.getByRole('tabpanel');
    // c4: the tab's own empty title — fish's «Momentan nu este disponibil…» would contradict the
    // counts right above it (only when every count is 0, competitions-list-status.spec.ts).
    await expect(panel).toContainText('Niciun concurs live acum.', { timeout: 60_000 });
    await expect(panel.getByText('Momentan nu este disponibil niciun concurs.')).toHaveCount(0);
    // Where the competitions are, before opening a tab: Viitoare 24, Trecute 3, Live (zero) bare.
    await expect(tabs.getByRole('tab', { name: 'Viitoare, 24' })).toHaveText('Viitoare24');
    await expect(tabs.getByRole('tab', { name: 'Trecute, 3' })).toHaveText('Trecute3');
    await expect(tabs.getByRole('tab', { name: 'Live', exact: true })).toHaveText('Live');
    // The empty card's action: a tab switch like any other — logged, and focus never falls to <body>.
    await panel.getByRole('button', { name: 'Vezi concursurile viitoare' }).click();
    await expect(tabs.getByRole('tab', { name: 'Viitoare, 24' })).toHaveAttribute('aria-selected', 'true');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __events: unknown[][] }).__events.filter(e => e[1] === 'competition_list_tab_pressed')))
      .toEqual([['event', 'competition_list_tab_pressed', { tab_id: 'upcoming', screen_name: 'Competitions List', screen_class: 'Competitions List' }]]);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName)).toBe('concursuri-balta-tab-viitoare');
    // The counts stay on the tabs after the switch.
    await expect(tabs.getByRole('tab', { name: 'Trecute, 3' })).toBeVisible();
    // formatCount: «de» from 20.
    await expect(panel.getByText('10 din 24 de concursuri')).toBeAttached();
    // The approved phone layout: one column of compact cards (ListGrid min md).
    const columns = await panel.getByRole('list').first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(1);
    await expectNoA11yViolations(page);
  } finally {
    await setFaults(page, []);
  }
});

// fish ErrorScreen describeErrorWithQuality: the failure picks the title, the message and whether a
// retry is offered (lakes.competitions.c5, *-balta.c6). No «Deconectează-te»: the read is public.
test('lakes.competitions.c5 competitions-list.viitoare-balta.c6 — a failed tab says what failed: server down (retry), a request the server refuses (its message, no retry)', async ({ page }) => {
  test.setTimeout(120_000);
  await setFaults(page, ['competitions-tab']);
  try {
    let mode: 'down' | 'refused' = 'down';
    await page.route(CARDS, async (r) => {
      const u = new URL(r.request().url());
      if (u.searchParams.get('status') !== 'notStarted') return r.continue();
      return mode === 'down'
        ? json(r, { error: { status: 503, message: 'down' } }, 503)
        // A message the app shows only travels with a bluCode (core/transport apiErrorFromResponse).
        : json(r, { error: { status: 400, message: 'Lacul nu acceptă filtrul cerut.', details: { bluCode: 'FX_REFUSED' } } }, 400);
    });
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(url('viitoare'));
    const alert = page.getByRole('tabpanel').getByRole('alert');
    await expect(alert).toContainText('Serverul nu răspunde', { timeout: 60_000 });
    await expect(alert).toContainText('Lucrăm la asta. Încearcă din nou în câteva minute.');
    await expect(alert).not.toContainText('Verifică conexiunea');
    await expect(page.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    mode = 'refused';
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(alert).toContainText('Lacul nu acceptă filtrul cerut.', { timeout: 30_000 });
    await expect(alert).toContainText('A apărut o eroare');
    await expect(alert.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
  } finally {
    await setFaults(page, []);
  }
});
