import { collectConsoleErrors } from './helpers/console';
import { BASE_URL } from './helpers/base-url';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Bălți list + map — parity docs/parity/areas/lakes.yml: lakes.home (/balti), lakes.search (the
 * search layer), lakes.filters (+ lakes.choose-filters, merged into it) and lakes.results-map
 * (/balti/harta). Each test names the criterion ids (<screen>.c<n>) and the states (<screen>.s<n>,
 * 1-based in the yml's `states`) it covers, so /web-drift can count them.
 *
 * Local CMS gap: the local Public role has no grant on lake.home, lake.inBbox, lake.mapClusters,
 * lake.focusBbox and the explore count / suggestions handlers (anonymous reads → 403). The web reads
 * them without a token (auth: 'none'), so those calls are re-sent with the QA bearer
 * (patchGrants) — the data a guest gets once the grant exists. The two «no patch» tests at the end
 * of lakes.home run against the real setup and skip themselves while the grant is missing.
 *
 * Fixtures (local CMS): Chita Lake (s84u55lo4n9z0emngozttt6e) in Giurgiu county
 * (njf092b2ffdq6b8w3inqbjr5, 6 lakes); «Toate bălțile» returns 11 rows (so «Vezi toate» shows).
 */


const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 800 };
const DESKTOP = { width: 1440, height: 900 };
const WIDTHS = [PHONE, TABLET, LAPTOP, DESKTOP];

const CHITA = 's84u55lo4n9z0emngozttt6e';
const GIURGIU = 'njf092b2ffdq6b8w3inqbjr5';
const BUCHAREST = { latitude: 44.4268, longitude: 26.1025 };

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

// A patched request still in flight when a test ends must not fail it.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

/** The missing local grants, see the header. */
async function patchGrants(page: Page) {
  await page.route(/localhost:1337\/api\/lakes\//, async (route) => {
    const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
    await route.fulfill({ response: res });
  });
}

const visible = (l: Locator) => l.locator('visible=true').first();

/** Whether anonymous reads of /lakes/home pass (the Public grant, see the header). */
async function publicGrant(request: import('@playwright/test').APIRequestContext) {
  return (await request.get(`${CMS}/lakes/home?limit=11&radiusKm=50`)).ok();
}

/** Collects the `bluvi:analytics` events (lakes.home.c28, lakes.results-map.c25). */
async function recordAnalytics(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: { name: string; params: Record<string, unknown> }[] };
    w.__events = [];
    window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
}

type Geo = 'prompt' | 'prompt-allow' | 'granted' | 'denied' | 'services_off';

/** The browser's location as each fish location state (lakes.b.location-state). */
async function setGeo(context: BrowserContext, page: Page, geo: Geo) {
  if (geo === 'granted') {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(BUCHAREST);
    return;
  }
  if (geo === 'prompt') return;
  // Denied, services off and «the prompt is answered Allow» cannot be set through Playwright: stub
  // the two APIs.
  await page.addInitScript(
    ([mode, at]) => {
      let state = mode === 'denied' ? 'denied' : mode === 'prompt-allow' ? 'prompt' : 'granted';
      const status = { get state() { return state; }, addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'permissions', { value: { query: () => Promise.resolve(status) }, configurable: true });
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (ok: (p: unknown) => void, err: (e: { code: number; PERMISSION_DENIED: number }) => void) =>
            setTimeout(() => {
              if (mode === 'prompt-allow') {
                state = 'granted';
                ok({ coords: at });
              } else err({ code: mode === 'denied' ? 1 : 2, PERMISSION_DENIED: 1 });
            }, 50),
        },
        configurable: true,
      });
    },
    [geo, BUCHAREST] as const,
  );
}

/** The all-lakes block: fish's «Toate bălțile» rail on a phone, the «Bălți recomandate» grid from 768. */
const ALL_LAKES = /^(Toate bălțile|Bălți recomandate)$/;

async function openHome(page: Page, viewport = PHONE, geo: Geo = 'prompt') {
  await page.setViewportSize(viewport);
  await setGeo(page.context(), page, geo);
  await patchGrants(page);
  const res = await page.goto('/balti', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 20_000 });
}

async function openMap(page: Page, query = '', viewport = PHONE, geo: Geo = 'prompt', routes?: () => Promise<unknown>) {
  await page.setViewportSize(viewport);
  await setGeo(page.context(), page, geo);
  await patchGrants(page);
  // Registered after patchGrants: Playwright tries the newest route first.
  await routes?.();
  const res = await page.goto(`/balti/harta${query ? `?${query}` : ''}`, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(listHeading(page)).toHaveText(/\d+ (de )?(baltă|bălți) în această zonă/, { timeout: 25_000 });
  await settled(page);
}

/** The list is not refreshing (no faded «stale» cards for axe to misread). */
async function settled(page: Page) {
  // The map's first settle after load may refresh the list once more: wait for a quiet second.
  const scroller = page.locator('[data-t2-scroll]');
  await expect
    .poll(
      async () => {
        if ((await scroller.getAttribute('aria-busy')) === 'true') return false;
        await page.waitForTimeout(1000);
        return (await scroller.getAttribute('aria-busy')) !== 'true';
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

/**
 * Clicks a lake pin the user can see (inside the map's free band: under the floating toolbar and
 * above the phone sheet), opening clusters on the way until one stands alone. Returns its name.
 */
async function clickVisiblePin(page: Page): Promise<string> {
  await expect(page.locator('[data-t2-pin], button[aria-label$="mărește harta aici"]').first()).toBeVisible({ timeout: 20_000 });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(900);
    const vp = page.viewportSize()!;
    const phone = vp.width < 768;
    const canvas = (await page.locator('.maplibregl-canvas').boundingBox())!;
    const top = canvas.y + (phone ? 140 : 20);
    const bottom = phone ? vp.height * 0.55 : canvas.y + canvas.height - 20;
    const inBand = async (l: Locator) => {
      const out: Locator[] = [];
      for (const el of await l.all()) {
        const b = await el.boundingBox();
        if (b && b.x > canvas.x + 10 && b.x + b.width < canvas.x + canvas.width - 70 && b.y > top && b.y + b.height < bottom) out.push(el);
      }
      return out;
    };
    const [pin] = await inBand(page.locator('[data-t2-pin]'));
    if (pin) {
      const name = (await pin.getAttribute('aria-label'))!;
      await pin.click();
      return name;
    }
    const [cluster] = await inBand(page.locator('button[aria-label$="mărește harta aici"]'));
    if (!cluster) throw new Error('no pin or cluster in view');
    await cluster.click();
  }
  throw new Error('no pin stood alone');
}

const listHeading = (page: Page) => page.getByRole('region', { name: 'Rezultate' }).getByRole('heading', { level: 2 });
const sectionTitles = (page: Page) =>
  page.locator('main section > div h2').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.textContent?.trim()));

/* ======================================================================== lakes.home */

test.describe('lakes.home', () => {
  for (const vp of WIDTHS) {
    test(`lakes.home.c1 c2 c4 c5 c9 c23 c27 lakes.home.s3 s7 · ${vp.width}px signed out · chrome + axe`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await openHome(page, vp);
      // c1: the switch, «Bălți» current; c2: no «NOU» badge.
      const switcher = page.getByRole('navigation', { name: 'Tip de apă' });
      await expect(switcher.getByRole('link', { name: 'Bălți' })).toHaveAttribute('aria-current', 'page');
      await expect(switcher.getByRole('link', { name: 'Ape publice' })).toHaveAttribute('href', '/ape-publice');
      await expect(page.getByText('NOU', { exact: true })).toHaveCount(0);
      // c4: the search bubble.
      const bubble = page.getByRole('button', { name: 'Deschide căutarea pentru bălți' });
      await expect(bubble).toContainText('Caută bălți, lacuri...');
      // c5: «Filtre».
      await expect(visible(page.getByRole('button', { name: 'Filtre' }))).toBeVisible();
      // c9: each row has its badge + title (from 768: the grid's heading).
      await expect(visible(page.getByRole('heading', { name: ALL_LAKES, level: 2 }))).toBeVisible();
      // c23 + owner rule 6: «Arată harta» — floating on a phone; from 768 the header's primary action.
      const mapLink = visible(page.getByRole('link', { name: 'Arată harta', exact: true }));
      await expect(mapLink).toHaveAttribute('href', '/balti/harta');
      await expect(mapLink).toBeInViewport();
      if (vp.width >= 768) {
        // One designed unit spanning the content width: the map button ends on the content edge,
        // filled accent (not a surface tool), right after «Filtre».
        const map = (await mapLink.boundingBox())!;
        const gutter = vp.width >= 1280 ? 32 : 24;
        expect(Math.abs(map.x + map.width - (vp.width - gutter))).toBeLessThanOrEqual(2);
        expect(await mapLink.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
          await visible(page.getByRole('button', { name: 'Filtre' })).evaluate((el) => getComputedStyle(el).backgroundColor),
        );
      }
      // The h1 names the page for screen readers; the switch shows it.
      await expect(page.getByRole('heading', { level: 1, name: 'Bălți de pescuit' })).toHaveCount(1);
      // c27: the search row stays under the top bar while the page scrolls, with its edge once stuck.
      await page.mouse.wheel(0, 1200);
      await expect(bubble).toBeInViewport();
      const header = page.locator('[data-stuck]');
      await expect(header).toHaveCount(1);
      if (vp.width < 768) {
        // The top bar slid away: the header follows it to the top edge (no strip above it).
        await expect(page.locator('header').and(page.locator('[data-concealed]'))).toHaveCount(1);
        await expect.poll(async () => (await header.boundingBox())?.y).toBeLessThan(1);
      }
      await expectNoA11yViolations(page);
      expect(errors).toEqual([]);
    });
  }

  test('lakes.home.c7 c8 c17 c21 lakes.home.s3 · signed out, never asked: placeholder then all lakes then fixed rows in server order', async ({ page }) => {
    const homeCalls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/lakes/home')) homeCalls.push(r.url());
    });
    // fish's rows are the phone's home; from 768 they are one grid (owner rule 5, the categories test).
    await openHome(page, PHONE);
    // c17: never asked → the placeholder copy.
    const placeholder = page.getByRole('button', { name: /Descoperă bălți aproape de tine/ });
    await expect(placeholder).toContainText('Permite locația și îți arătăm instant locurile din apropiere.');
    await expect(placeholder).toContainText('Permite locația');
    // c21: limit 11, radius 50, no position.
    expect(homeCalls.some((u) => /limit=11/.test(u) && /radiusKm=50/.test(u) && !/lat=/.test(u))).toBe(true);
    // c7: all lakes first, then the CMS order (minus nearby / all_lakes).
    const api = await (await page.request.get(`${CMS}/lakes/home?limit=11&radiusKm=50`, { headers: { authorization: `Bearer ${jwt}` } })).json();
    const fixed = (api.data.sections as { key: string; title: string; lakes: unknown[] }[]).filter(
      (s) => s.key !== 'nearby' && s.key !== 'all_lakes' && s.lakes.length,
    );
    const titles = await sectionTitles(page);
    expect(titles[0]).toBe('Toate bălțile');
    // c8: a fixed row emptied by de-duplication is not rendered, so the shown rows are a subsequence.
    const shownFixed = titles.slice(1);
    const order = fixed.map((s) => s.title).filter((t) => shownFixed.includes(t));
    expect(shownFixed).toEqual(order);
    // c8: no lake twice across the fixed rows.
    const ids: string[] = [];
    for (const title of shownFixed) {
      const row = visible(page.getByRole('region', { name: title as string }));
      ids.push(...(await row.locator('article h3 a').locator('visible=true').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))));
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('lakes.home.c7 c12 c13 c21 lakes.home.s6 · location granted: nearby row with distances and the radius link', async ({ page }) => {
    const homeCalls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/lakes/home')) homeCalls.push(r.url());
    });
    await openHome(page, DESKTOP, 'granted');
    const nearby = visible(page.getByRole('region', { name: /Bălți din zona ta/ }));
    await expect(nearby).toBeVisible({ timeout: 15_000 });
    expect((await sectionTitles(page))[0]).toBe('Bălți din zona ta');
    expect(homeCalls.some((u) => /lat=44\.4268/.test(u) && /lng=26\.1025/.test(u) && /radiusKm=50/.test(u))).toBe(true);
    // c12: «50 km ›» instead of «Vezi toate», to the nearby map.
    const radius = nearby.getByRole('link', { name: 'Vezi pe hartă bălțile pe o rază de 50 km' });
    await expect(radius).toHaveText(/50 km/);
    await expect(radius).toHaveAttribute('href', '/balti/harta?aproape=1');
    // c13: one decimal under 10 km, rounded above.
    const pills = await nearby.locator('article').locator('visible=true').evaluateAll((as) => as.map((a) => a.textContent ?? ''));
    expect(pills.length).toBeGreaterThan(0);
    for (const text of pills) expect(text).toMatch(/La (\d,\d|\d{2,}) km/);
    await expectNoA11yViolations(page);
  });

  test('lakes.home.c21 lakes.home.s6 · location granted (a returning visitor), the position read slow: the nearby row is reserved from the first paint, nothing jumps (CLS < 0.01)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.addInitScript((at) => {
      // The hint location.ts left on the last visit (./_list/geoHint.ts).
      window.localStorage.setItem('bluvi:lakes-geo-granted', '1');
      const status = { state: 'granted', addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'permissions', { value: { query: () => Promise.resolve(status) }, configurable: true });
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: (ok: (p: unknown) => void) => setTimeout(() => ok({ coords: at }), 2500) },
        configurable: true,
      });
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    }, BUCHAREST);
    await patchGrants(page);
    await page.goto('/balti', { waitUntil: 'domcontentloaded' });
    await expect(visible(page.getByRole('region', { name: /Bălți din zona ta/ }))).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.01);
  });

  test('lakes.home.c10 c11 c14 c16 lakes.home.s9 · cards, «Vezi toate» header link and end card', async ({ page }) => {
    // The rails are the phone's home (from 768: the categorised grid, owner rule 5).
    await openHome(page, PHONE);
    const all = visible(page.getByRole('region', { name: ALL_LAKES }));
    // c10: at most 10 cards + the «Vezi toate» card, and the header link.
    await expect(all.locator('article')).toHaveCount(10);
    const seeAll = all.getByRole('link', { name: /^Vezi toate:? Toate bălțile/ });
    await expect(seeAll).toHaveCount(2);
    // c11: on any row other than bookable / nearby → the all-lakes map.
    for (const l of await seeAll.all()) await expect(l).toHaveAttribute('href', '/balti/harta');
    // c11: bookable → only «Rezervări» (when the row has more than 10; locally it may not).
    const bookable = page.getByRole('region', { name: 'Rezervă direct din aplicație' }).locator('visible=true');
    if ((await bookable.count()) && (await bookable.getByRole('link', { name: /^Vezi toate/ }).count())) {
      await expect(bookable.getByRole('link', { name: /^Vezi toate/ }).first()).toHaveAttribute('href', '/balti/harta?rezervari=1');
    }
    // c14: rating pill only with reviews; the name, the place; c16: the card opens /balti/[id].
    const card = all.locator('article').first();
    const href = await card.locator('h3 a').getAttribute('href');
    expect(href).toMatch(/^\/balti\/[a-z0-9]+$/);
    for (const art of await all.locator('article').all()) {
      const text = (await art.textContent()) ?? '';
      if (text.includes('Rating')) expect(text).toMatch(/Rating \d,\d/);
    }
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('lakes.home.c15 c22 lakes.home.s8 · recently viewed: first row, newest first, compact cards', async ({ page }) => {
    await page.addInitScript(
      ([a, b]) => window.localStorage.setItem('recentViewedLakeIds', JSON.stringify([a, b])),
      ['mvjlgripabbi23rb2pa6n6uy', CHITA],
    );
    await openHome(page, PHONE);
    const recent = visible(page.getByRole('region', { name: 'Vizualizate recent' }));
    await expect(recent).toBeVisible();
    expect((await sectionTitles(page))[0]).toBe('Vizualizate recent');
    const hrefs = await recent.locator('article h3 a').locator('visible=true').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    // Stored newest LAST → shown newest first.
    expect(hrefs).toEqual([`/balti/${CHITA}`, '/balti/mvjlgripabbi23rb2pa6n6uy']);
    // c15: compact — no facilities, no regime.
    await expect(recent.getByRole('list', { name: 'Facilități' })).toHaveCount(0);
    await expect(recent.getByText('Regim:')).toHaveCount(0);
    // c22: read again when the tab comes back.
    await page.evaluate(() => {
      window.localStorage.setItem('recentViewedLakeIds', JSON.stringify(['mvjlgripabbi23rb2pa6n6uy']));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(recent.locator('article').locator('visible=true')).toHaveCount(1);
    // From 768: compact — a strip of small items, first, never a rail a lone lake leaves empty (rule 5).
    await page.setViewportSize(LAPTOP);
    const strip = visible(page.getByRole('region', { name: 'Vizualizate recent' }));
    await expect(strip.getByRole('link')).toHaveCount(1);
    expect((await strip.getByRole('link').boundingBox())!.height).toBeLessThanOrEqual(80);
    expect((await sectionTitles(page))[0]).toBe('Vizualizate recent');
  });

  test('lakes.home.c18 c19 c20 lakes.home.s4 · denied: «Deschide setările» opens the permission dialog', async ({ page }) => {
    await openHome(page, PHONE, 'denied');
    const placeholder = page.getByRole('button', { name: /Activează locația din setări/ });
    await expect(placeholder).toContainText('Permisiunea e blocată acum, dar o poți reactiva rapid.');
    await placeholder.click();
    const dialog = page.getByRole('dialog', { name: 'Găsește bălți aproape de tine' });
    await expect(dialog).toContainText('Activează localizarea ca să îți arătăm bălțile din apropiere.');
    await expect(dialog).toContainText('iconița de lângă adresa paginii');
    await page.waitForTimeout(600); // the dialog's fade-in, so axe reads its settled colours
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Am înțeles' }).click();
    await expect(dialog).toBeHidden();
  });

  test('lakes.home.c17 c19 c20 lakes.home.s5 · services off: the dialog opens by itself once per session, placeholder copy', async ({ page }) => {
    await openHome(page, PHONE, 'services_off');
    const dialog = page.getByRole('dialog', { name: 'Activează serviciile de locație' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Locația dispozitivului este oprită. Activeaz-o ca să găsim bălți aproape de tine.');
    await dialog.getByRole('button', { name: 'Renunță' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: /Activează locația dispozitivului/ })).toContainText('Permisiunea e dată, dar locația telefonului este oprită.');
    // Once: it does not come back by itself — not even after leaving the page and coming back.
    await page.waitForTimeout(500);
    await expect(dialog).toBeHidden();
    await visible(page.getByRole('link', { name: 'Arată harta' })).click();
    await expect(page).toHaveURL(/\/balti\/harta$/);
    await page.getByRole('link', { name: 'Înapoi la Bălți' }).click();
    await expect(page).toHaveURL(/\/balti$/);
    await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await expect(dialog).toBeHidden();
  });

  test('lakes.home.c18 lakes.home.s3 s6 · never asked: the placeholder asks, then the nearby row loads', async ({ page }) => {
    await openHome(page, DESKTOP, 'prompt-allow');
    await page.getByRole('button', { name: /Descoperă bălți aproape de tine/ }).click();
    await expect(visible(page.getByRole('region', { name: /Bălți din zona ta/ }))).toBeVisible({ timeout: 15_000 });
  });

  test('lakes.home.c24 c25 lakes.home.s1 s2 · skeleton while loading, error screen with retry', async ({ page }) => {
    let fail = true;
    await page.setViewportSize(PHONE);
    await page.route(/localhost:1337\/api\/lakes\/home/, async (route) => {
      if (fail) {
        await new Promise((r) => setTimeout(r, 800));
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' });
      }
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.goto('/balti', { waitUntil: 'domcontentloaded' });
    // c24: the skeleton while /lakes/home is pending.
    // lakes.home s1 (screen readers): the page's one status line says it (the skeleton is silent).
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă bălțile' })).toHaveCount(1);
    // c25: the error screen + retry (TanStack retries twice first).
    const retry = page.getByRole('button', { name: 'Încearcă din nou' });
    await expect(retry).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Nu am putut încărca bălțile')).toBeVisible();
    fail = false;
    await retry.click();
    await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 15_000 });
    // WCAG 2.4.3: the retry button unmounted; focus lands on the first row's heading, not <body>.
    await expect(page.locator('h2', { hasText: ALL_LAKES }).locator('visible=true').first()).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: /Bălți încărcate: \d+ secțiuni/ })).toHaveCount(1);
  });

  test('lakes.home.c25 lakes.home.s2 · a 4xx: no «check your connection», a failed retry is said again', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(/localhost:1337\/api\/lakes\/home/, (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"status":403,"message":"Forbidden"}}' }),
    );
    await page.goto('/balti', { waitUntil: 'domcontentloaded' });
    const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut încărca bălțile' });
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText('Bălțile nu sunt disponibile acum.');
    await expect(alert).not.toContainText('Verifică conexiunea');
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(alert).toContainText('Tot nu merge. Încercarea 2.', { timeout: 10_000 });
    // lakes.home.s10 / c23: no lakes → no «Arată harta» from 768 either.
    await expect(page.getByRole('link', { name: 'Arată harta', exact: true })).toHaveCount(0);
  });

  test('lakes.home.c15 lakes.home.s8 · the recently viewed read fails: the block is hidden (owner rule 4), the rows stay', async ({ page }) => {
    await page.addInitScript((id) => window.localStorage.setItem('recentViewedLakeIds', JSON.stringify([id])), CHITA);
    await page.setViewportSize(DESKTOP);
    await patchGrants(page);
    let fail = true;
    let hits = 0;
    await page.route(/localhost:1337\/api\/feed\/lakes\/by-ids/, async (route) => {
      hits += 1;
      if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' });
      await route.fallback();
    });
    await page.goto('/balti', { waitUntil: 'domcontentloaded' });
    await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 20_000 });
    // TanStack's retries run out, then nothing is said: no error card, no «Vizualizate recent».
    await expect.poll(() => hits, { timeout: 25_000 }).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(500);
    await expect(page.getByText('Nu am putut încărca bălțile vizualizate recent')).toHaveCount(0);
    // (The shell's empty live regions — route announcer, network banner — are not cards.)
    await expect(page.locator('main').getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Vizualizate recent' })).toHaveCount(0);
    fail = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(visible(page.getByRole('region', { name: 'Vizualizate recent' }))).toBeVisible({ timeout: 15_000 });
  });

  test('lakes.home.c3 · «Ape publice» leaves for the public-waters map with nothing carried over', async ({ page }) => {
    await openHome(page, DESKTOP);
    await page.getByRole('navigation', { name: 'Tip de apă' }).getByRole('link', { name: 'Ape publice' }).click();
    await expect(page).toHaveURL(/\/ape-publice$/);
  });

  test('lakes.home.c25 lakes.home.s2 s8 · /lakes/home fails with recents: the recent row stays, the failure is said inline with a retry', async ({ page }) => {
    await page.addInitScript((id) => window.localStorage.setItem('recentViewedLakeIds', JSON.stringify([id])), CHITA);
    await page.setViewportSize(DESKTOP);
    await patchGrants(page);
    let fail = true;
    await page.route(/localhost:1337\/api\/lakes\/home/, async (route) => {
      if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' });
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.goto('/balti', { waitUntil: 'domcontentloaded' });
    await expect(visible(page.getByRole('region', { name: 'Vizualizate recent' }))).toBeVisible({ timeout: 20_000 });
    const retry = page.getByRole('button', { name: 'Încearcă din nou' });
    await expect(retry).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Nu am putut încărca bălțile', { exact: true })).toBeVisible();
    fail = false;
    await retry.click();
    await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 15_000 });
    await expect(visible(page.getByRole('region', { name: 'Vizualizate recent' }))).toBeVisible();
  });

  test('lakes.home.c23 lakes.home.s10 · every row empty: no rows, no map button', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await patchGrants(page);
    await page.route(/localhost:1337\/api\/lakes\/home/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { sections: [] } }) }),
    );
    await page.goto('/balti', { waitUntil: 'domcontentloaded' });
    // The location placeholder is the only block left (fish counts it as a section): no rows, no
    // «Arată harta» (c23 hides it without lakes).
    await expect(page.getByRole('button', { name: /Descoperă bălți aproape de tine/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('region', { name: ALL_LAKES })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Arată harta' })).toHaveCount(0);
    // From 1280 the header's «Arată harta» is hidden too (fish hides the map entry at 0 lakes).
    await page.setViewportSize(LAPTOP);
    await expect(page.getByRole('button', { name: /^Filtre/ }).locator('visible=true')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Arată harta', exact: true })).toHaveCount(0);
  });

  test('lakes.home.c7 lakes.home.s11 · signed in: the same rows as signed out', async ({ page, context }) => {
    await openHome(page, DESKTOP);
    const out = await sectionTitles(page);
    await signIn(context, jwt, BASE_URL);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Descoperă bălți aproape de tine/ })).toBeVisible();
    expect(await sectionTitles(page)).toEqual(out);
  });

  test('lakes.home.c28 · analytics: one impression per section with content, a click with its positions', async ({ page }) => {
    const events = await recordAnalytics(page);
    await openHome(page, PHONE);
    await page.waitForTimeout(500);
    const impressions = (await events()).filter((e) => e.name === 'lake_home_section_impression');
    // The never-asked placeholder is section 1 (fish counts it), «Toate bălțile» 2.
    expect(impressions[0].params).toEqual({ section_key: 'nearby', section_position: 1, lakes_count: 0 });
    expect(impressions[1].params).toMatchObject({ section_key: 'all_lakes', section_position: 2 });
    expect(new Set(impressions.map((e) => e.params.section_key)).size).toBe(impressions.length);
    const all = visible(page.getByRole('region', { name: ALL_LAKES }));
    const second = all.locator('article h3 a').nth(1);
    const id = (await second.getAttribute('href'))!.split('/').pop();
    // Keep the page (and its recorded events): the click is cancelled before the link navigates.
    await page.evaluate(() => window.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true }));
    await second.click();
    const click = (await events()).find((e) => e.name === 'lake_home_section_click');
    expect(click?.params).toEqual({ section_key: 'all_lakes', section_position: 2, item_position: 2, lake_id: id });
  });

  test('lakes.home.c24 · no patch: the server HTML lists the lakes (needs the Public grant)', async ({ request }) => {
    test.skip(!(await publicGrant(request)), 'local CMS: Public has no grant on lake.home yet');
    const html = await (await request.get('/balti')).text();
    expect(html).toMatch(/href="\/balti\/[a-z0-9]{20,}"/);
    expect(html).toContain('Toate bălțile');
  });

  test('lakes.home.c7 lakes.home.s3 · no patch: a guest gets the rows (needs the Public grant)', async ({ page, request }) => {
    test.skip(!(await publicGrant(request)), 'local CMS: Public has no grant on lake.home yet');
    await page.setViewportSize(DESKTOP);
    await page.goto('/balti');
    await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 20_000 });
  });
});

/* ======================================================================== lakes.filters */

test.describe('lakes.filters', () => {
  test('lakes.filters.c1 c2 c4 c7 c8 c10 c11 c12 lakes.home.c6 lakes.choose-filters.c2 lakes.filters.s1 s3 s5 · home panel → results map', async ({ page }) => {
    await openHome(page, DESKTOP);
    await visible(page.getByRole('button', { name: 'Filtre' })).click();
    // From 768 the kit dialog (owner rule 2, ROADMAP §4b: no filter column beside the rows).
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Închide' })).toBeFocused();
    // c1: the five sections in order (kit FilterSection: fieldset + legend).
    await expect(panel.locator('fieldset > legend')).toHaveText(['Regim', 'Facilități', 'Rating', 'Rezervări', 'Pești']);
    // c2: the regimes as checkboxes; c12: their checked state.
    const regime = panel.getByRole('group', { name: /^Regim/ });
    for (const name of ['C&R', 'Retinere', 'C&R + Retinere']) await expect(regime.getByRole('checkbox', { name, exact: true })).not.toBeChecked();
    // c7: rating options, one choice (radios); c8: the booking option pill (fish's on/off pill).
    const rating = panel.getByRole('group', { name: 'Rating' });
    await expect(rating.getByRole('radio')).toHaveCount(5);
    await expect(rating.getByRole('radio', { name: 'Orice' })).toBeChecked();
    await expect(rating.getByRole('radio', { name: 'Foarte bun' })).not.toBeChecked();
    const booking = panel.getByRole('group', { name: 'Rezervări' });
    await expect(booking.getByRole('checkbox', { name: 'Acceptă rezervări online' })).not.toBeChecked();
    await expect(booking.getByRole('switch')).toHaveCount(0);
    // c11: «Șterge» disabled with nothing selected.
    const clear = panel.getByRole('button', { name: 'Șterge', exact: true });
    await expect(clear).toBeDisabled();
    // c10: the live count.
    const apply = panel.getByRole('button', { name: /^Aplică/ });
    await expect(apply).toHaveText(/Aplică · \d+ (de )?(baltă|bălți)/, { timeout: 15_000 });
    const all = Number((await apply.textContent())!.match(/(\d+)/)![1]);
    // c4: «· N» and select-all.
    await regime.locator('label', { hasText: /^C&R$/ }).click();
    await expect(regime.getByRole('checkbox', { name: 'C&R', exact: true })).toBeChecked();
    await expect(regime.locator('legend')).toHaveText('Regim · 1');
    await expect(clear).toBeEnabled();
    await expect(apply).toHaveText(/Aplică · \d+/, { timeout: 15_000 });
    const filtered = Number((await apply.textContent())!.match(/(\d+)/)![1]);
    expect(filtered).toBeLessThanOrEqual(all);
    await panel.getByRole('button', { name: 'Selectează tot: Regim' }).click();
    await expect(panel.locator('fieldset > legend').first()).toHaveText('Regim · 3');
    await panel.getByRole('button', { name: 'Deselectează tot: Regim' }).click();
    await panel.getByRole('group', { name: /^Regim/ }).locator('label', { hasText: /^Retinere$/ }).click();
    await expectNoA11yViolations(page);
    // c6 (home): applying with a filter → the filtered map.
    await apply.click();
    await expect(page).toHaveURL(/\/balti\/harta\?regim=Retinere$/);
    await expect(listHeading(page)).toHaveText(/în această zonă/, { timeout: 20_000 });
    // The map rail shows it: c3 of the map.
    await expect(visible(page.getByRole('button', { name: 'Regim · 1' }))).toBeVisible();
  });

  test('lakes.filters.c1 c11 lakes.filters.s1 s3 · tablet: the kit dialog, the sections scroll under a fixed footer', async ({ page }) => {
    await openHome(page, TABLET);
    await page.getByRole('button', { name: 'Filtre' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(TABLET.height);
    await expect(panel.getByRole('button', { name: /^Aplică/ })).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: 'Filtre' })).toBeFocused();
  });

  test('lakes.home.c6 lakes.filters.s1 · applying with nothing set opens the all-lakes map', async ({ page }) => {
    await openHome(page, PHONE);
    await page.getByRole('button', { name: 'Filtre' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    await panel.getByRole('button', { name: /^Aplică/ }).click();
    await expect(page).toHaveURL(/\/balti\/harta$/);
  });

  test('lakes.filters.c10 lakes.filters.s4 s5 · «Aplică» while counting, the count once known', async ({ page }) => {
    await openHome(page, PHONE);
    await page.route(/localhost:1337\/api\/lakes\/explore\/count/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.getByRole('button', { name: 'Filtre' }).click();
    const apply = page.getByRole('dialog', { name: 'Filtre' }).getByRole('button', { name: /^Aplică/ });
    await expect(apply).toHaveText('Aplică');
    await expect(apply).toHaveText(/Aplică · \d+/, { timeout: 15_000 });
  });

  test('lakes.filters.c1 c3 c5 c6 c9 c13 lakes.filters.s2 s6 · map chip opens one section; long lists clip to 4 rows; draft discarded on close', async ({ page }) => {
    await openMap(page, '', DESKTOP);
    // c1: a chip opens only its section, titled with its name.
    await visible(page.getByRole('button', { name: 'Pești' })).click();
    const panel = page.getByRole('dialog', { name: 'Pești' });
    await expect(panel).toBeVisible();
    await expect(panel.locator('fieldset')).toHaveCount(1);
    const fish = () => page.getByRole('dialog', { name: 'Pești' }).getByRole('group', { name: /^Pești/ });
    // c3: options from /fishes; c5: clipped to four rows with an expand pill; clipped pills inert.
    const expand = panel.getByRole('button', { name: /^Vezi toți peștii \(\d+\)$/ });
    if (await expand.count()) {
      const total = Number((await expand.textContent())!.match(/\((\d+)\)/)![1]);
      const reachable = () => fish().locator('input[type=checkbox]').evaluateAll((bs) => bs.filter((b) => !b.closest('[inert]')).length);
      expect(await reachable()).toBeLessThan(total);
      await expand.click();
      await expect(panel.getByRole('button', { name: 'Vezi mai puțin' })).toBeVisible();
      await expect.poll(reachable).toBe(total);
    }
    // c9: a draft pick, then close → nothing applied; reopening starts from the committed filters.
    const first = fish().locator('label').first();
    const firstName = (await first.textContent())!.trim();
    await first.click();
    await panel.getByRole('button', { name: 'Închide' }).click();
    await expect(page).toHaveURL(/\/balti\/harta$/);
    await visible(page.getByRole('button', { name: 'Pești' })).click();
    await expect(fish().getByRole('checkbox', { name: firstName, exact: true })).not.toBeChecked();
    // Apply one → c6: the committed option is listed first next time.
    const third = fish().locator('label').nth(2);
    const thirdName = (await third.textContent())!.trim();
    await third.click();
    await page.getByRole('dialog', { name: 'Pești' }).getByRole('button', { name: /^Aplică/ }).click();
    await expect(page).toHaveURL(/pesti=/);
    await visible(page.getByRole('button', { name: 'Pești · 1' })).click();
    await expect(fish().locator('label').first()).toHaveText(thirdName);
    await expect(fish().getByRole('checkbox', { name: thirdName, exact: true })).toBeChecked();
    await page.waitForTimeout(600); // the dialog's fade-in, so axe reads its settled colours
    await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas-container'] });
  });

  test('lakes.filters.c3 c5 c6 c11 lakes.filters.s1 s3 s6 · glyphs per species and facility, Facilități clipped, order stable while toggling, «Șterge» clears', async ({ page }) => {
    const catalogs: string[] = [];
    page.on('request', (r) => {
      if (/localhost:1337\/api\/(facilities|fishes)/.test(r.url())) catalogs.push(r.url());
    });
    await openHome(page, PHONE);
    await page.getByRole('button', { name: 'Filtre' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    const fishGroup = panel.getByRole('group', { name: /^Pești/ });
    const facilities = panel.getByRole('group', { name: /^Facilități/ });
    // c3: species glyphs where fish has one (Crap, Știucă…), the generic fish otherwise.
    await expect(fishGroup.locator('label', { hasText: /^Crap$/ }).locator('[data-fish-glyph="crap"] svg')).toHaveCount(1);
    await expect(fishGroup.locator('label', { hasText: /^Stiuca$/ }).locator('[data-fish-glyph="stiuca"]')).toHaveCount(1);
    await expect(fishGroup.locator('label', { hasText: /^random fish$/ }).locator('[data-fish-glyph]')).toHaveCount(0);
    await expect(fishGroup.locator('label', { hasText: /^random fish$/ }).locator('svg')).toHaveCount(1);
    // c3: every facility pill carries its glyph; the catalogs are read once (cached 3h).
    const facilityLabels = facilities.locator('label');
    const nFacilities = await facilityLabels.count();
    expect(nFacilities).toBeGreaterThan(4);
    expect(await facilityLabels.evaluateAll((ls) => ls.every((l) => l.querySelector('svg')))).toBe(true);
    // c5: Facilități clipped to four rows too, with its own pill.
    const expand = panel.getByRole('button', { name: `Vezi toate facilitățile (${nFacilities})` });
    await expect(expand).toBeVisible();
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    const inert = () => facilities.locator('label').evaluateAll((ls) => ls.filter((l) => l.closest('[inert]')).length);
    expect(await inert()).toBeGreaterThan(0);
    await expand.click();
    await expect(panel.getByRole('button', { name: 'Vezi mai puțin' }).first()).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(inert).toBe(0);
    // c6: toggling never reorders the pills (the order follows the committed set, not the draft).
    const order = () => facilities.locator('label').allTextContents();
    const before = await order();
    await facilities.locator('label').nth(3).click();
    await facilities.locator('label').nth(1).click();
    expect(await order()).toEqual(before);
    await expect(facilities.locator('legend')).toHaveText('Facilități · 2');
    // c11: «Șterge» in all-mode clears every section of the draft and disables itself.
    await panel.getByRole('group', { name: 'Rezervări' }).locator('label', { hasText: 'Acceptă rezervări online' }).click();
    const clear = panel.getByRole('button', { name: 'Șterge', exact: true });
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(facilities.locator('legend')).toHaveText('Facilități');
    await expect(panel.getByRole('checkbox', { name: 'Acceptă rezervări online' })).not.toBeChecked();
    await expect(clear).toBeDisabled();
    expect(catalogs.filter((u) => /\/facilities/.test(u))).toHaveLength(1);
    expect(catalogs.filter((u) => /\/fishes/.test(u))).toHaveLength(1);
    // c9: the phone sheet closes with its «Închide» X (fish's header X); reopening reuses the
    // cached catalogs.
    await panel.getByRole('button', { name: 'Închide', exact: true }).click();
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Filtre' }).click();
    await expect(page.getByRole('dialog', { name: 'Filtre' }).getByRole('group', { name: /^Pești/ }).locator('label').first()).toBeVisible();
    expect(catalogs).toHaveLength(2);
    await expectNoA11yViolations(page);
  });

  test('lakes.filters.c11 lakes.filters.s2 s3 · a single section: «Șterge» clears only that section', async ({ page }) => {
    await openMap(page, 'regim=Retinere&rezervari=1', DESKTOP);
    await visible(page.getByRole('button', { name: 'Regim · 1' })).click();
    const panel = page.getByRole('dialog', { name: 'Regim' });
    await expect(panel.locator('fieldset')).toHaveCount(1);
    const clear = panel.getByRole('button', { name: 'Șterge', exact: true });
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(panel.getByRole('checkbox', { name: 'Retinere', exact: true })).not.toBeChecked();
    await expect(clear).toBeDisabled();
    await panel.getByRole('button', { name: /^Aplică/ }).click();
    // Rezervări (another section) survives.
    await expect(page).toHaveURL(/\/balti\/harta\?rezervari=1$/);
  });

  for (const vp of [LAPTOP, DESKTOP])
  test(`lakes.filters.c1 c9 lakes.filters.s1 · ${vp.width}px: «Filtre» opens the filters dialog (no column beside the rows); Escape keeps nothing, focus back on «Filtre»`, async ({ page }) => {
    await openHome(page, vp);
    const button = visible(page.getByRole('button', { name: 'Filtre' }));
    const before = (await button.boundingBox())!;
    // «Filtre» and «Arată harta» follow the search pill (no dead band before them).
    const search = (await visible(page.getByRole('button', { name: 'Deschide căutarea pentru bălți' })).boundingBox())!;
    expect(before.x - (search.x + search.width)).toBeLessThanOrEqual(13);
    await button.click();
    // Owner rule 2 (ROADMAP §4b): a centred dialog, never a vertical panel taking a column.
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Filtre' })).toHaveCount(0);
    const box = (await panel.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
    // The select-all shares the legend's row; its box ends before the pills.
    const regime = panel.getByRole('group', { name: /^Regim/ });
    const action = (await regime.getByRole('button', { name: 'Selectează tot: Regim' }).boundingBox())!;
    const pill = (await regime.locator('label').first().boundingBox())!;
    expect(action.y + action.height).toBeLessThanOrEqual(pill.y);
    await regime.locator('label', { hasText: /^C&R$/ }).click();
    await expect(regime.getByRole('checkbox', { name: 'C&R', exact: true })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
    await expect(page).toHaveURL(/\/balti$/);
    // Reopened: a fresh draft (nothing applied from the closed one).
    await button.click();
    await expect(page.getByRole('dialog', { name: 'Filtre' }).getByRole('group', { name: /^Regim/ }).getByRole('checkbox', { name: 'C&R', exact: true })).not.toBeChecked();
  });

  for (const vp of [PHONE, LAPTOP])
  test(`lakes.home.c5 · ${vp.width}px: owner rule 5 — icon categories under the search header filter ONE grid in place`, async ({ page }) => {
    await openHome(page, vp);
    const bar = page.getByRole('group', { name: 'Categorii' });
    const toate = bar.getByRole('button', { name: 'Recomandate' });
    await expect(toate).toHaveAttribute('aria-pressed', 'true');
    // Real toggles of the grid below: none navigates, none is a fake «pressed forever».
    const labels = await bar.getByRole('button').allTextContents();
    expect(labels[0]).toBe('Recomandate');
    if (vp.width >= 768) {
      // The grid is the home payload's selection, never «all»: no «Toate» title, no count it cannot vouch for.
      const head = page.locator('[data-balti-grid="all"] h2');
      await expect(head).toHaveText('Bălți recomandate');
      await expect(page.locator('[data-balti-grid] > div').first()).not.toContainText(/\d+ (bălți|baltă)/);
    }
    expect(labels.length).toBeGreaterThan(2);
    // Attached right under the search header.
    const header = (await page.locator('[data-list-chrome]').boundingBox())!;
    const barBox = (await bar.boundingBox())!;
    expect(barBox.y - (header.y + header.height)).toBeLessThanOrEqual(8);
    if (vp.width >= 768) {
      // Desktop: one dense grid (4:3 photos, text right under them), at most two curated rails.
      const grid = page.locator('[data-balti-grid="all"]');
      await expect(grid).toBeVisible();
      const photo = (await grid.locator('li article > div').first().boundingBox())!;
      expect(Math.abs(photo.width / photo.height - 4 / 3)).toBeLessThan(0.02);
      const cols = await grid.locator('ul > li').evaluateAll((lis) => new Set(lis.map((li) => Math.round(li.getBoundingClientRect().left))).size);
      expect(cols).toBeGreaterThanOrEqual(4);
      const rails = await page.locator('main ul.snap-x').evaluateAll(
        (els) => els.filter((e) => (e as HTMLElement).offsetParent !== null && e.closest('[data-balti-grid]') == null).length,
      );
      expect(rails).toBeLessThanOrEqual(2);
    }
    const pick = bar.getByRole('button', { name: 'Rezervare online' });
    await pick.click();
    await expect(pick).toHaveAttribute('aria-pressed', 'true');
    await expect(toate).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\/balti$/);
    const grid = page.locator('[data-balti-grid="bookable"]');
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('heading', { level: 2 })).toHaveText('Rezervă direct din aplicație');
    await expect(grid.getByRole('link', { name: 'Vezi pe hartă: Rezervă direct din aplicație' })).toHaveAttribute('href', '/balti/harta?rezervari=1');
    // Only the bookable lakes: every card says so.
    const n = await grid.locator('ul > li').count();
    expect(n).toBeGreaterThan(0);
    await expect(grid.locator('ul > li').filter({ hasText: 'Rezervare online' })).toHaveCount(n);
    await toate.click();
    await expect(page.locator('[data-balti-grid="bookable"]')).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test('lakes.filters.c3 lakes.filters.s1 · the catalogs fail → «Încearcă din nou» refetches them (skeleton while retrying, focus kept)', async ({ page }) => {
    let fail = true;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/localhost:1337\/api\/(facilities|fishes)/, async (route) => {
      if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      await gate;
      await route.fulfill({ response: await route.fetch() });
    });
    await openHome(page, TABLET);
    await page.getByRole('button', { name: 'Filtre' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    await expect(panel.getByText('Lista de facilități nu s-a încărcat.')).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByText('Lista de pești nu s-a încărcat.')).toBeVisible({ timeout: 20_000 });
    const facilities = panel.getByRole('group', { name: /^Facilități/ });
    fail = false;
    // The kit compact secondary Button, the page's one retry label.
    await facilities.getByRole('button', { name: 'Încearcă din nou' }).focus();
    await page.keyboard.press('Enter');
    // While it refetches: the collapsed-box skeleton and a busy section, not a dead error line.
    await expect(facilities).toHaveAttribute('aria-busy', 'true');
    await expect(facilities.getByText('Lista de facilități nu s-a încărcat.')).toHaveCount(0);
    release();
    await expect(facilities.locator('label').first()).toBeVisible({ timeout: 15_000 });
    await expect(facilities).not.toHaveAttribute('aria-busy', 'true');
    // Focus did not fall to <body>: it is on the section's first pill.
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT');
    await expect(facilities.getByRole('checkbox').first()).toBeFocused();
  });

  test('lakes.filters.c3 c5 lakes.filters.s1 s6 · catalogs arriving late do not move the sections under them (the skeleton is the collapsed box)', async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/localhost:1337\/api\/(facilities|fishes)/, async (route) => {
      await gate;
      await route.fulfill({ response: await route.fetch() });
    });
    await openHome(page, TABLET);
    await page.getByRole('button', { name: 'Filtre' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    const rating = panel.getByRole('group', { name: 'Rating' });
    await expect(rating).toBeVisible();
    // The select-all's place is held while the list loads.
    await expect(panel.getByRole('button', { name: 'Selectează tot: Facilități' })).toBeDisabled();
    const before = (await rating.boundingBox())!.y;
    release();
    await expect(panel.getByRole('button', { name: /^Vezi toate facilitățile/ })).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: 'Selectează tot: Facilități' })).toBeEnabled();
    expect(Math.abs((await rating.boundingBox())!.y - before)).toBeLessThanOrEqual(2);
  });

  test('lakes.filters.c10 lakes.filters.s4 · the count fails → plain «Aplică», still applies', async ({ page }) => {
    await openHome(page, PHONE);
    await page.route(/localhost:1337\/api\/lakes\/explore\/count/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await page.getByRole('button', { name: 'Filtre' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    await panel.getByRole('group', { name: /^Regim/ }).locator('label', { hasText: /^Retinere$/ }).click();
    const apply = panel.getByRole('button', { name: /^Aplică/ });
    await page.waitForTimeout(1500);
    await expect(apply).toHaveText('Aplică');
    await apply.click();
    await expect(page).toHaveURL(/\/balti\/harta\?regim=Retinere$/);
  });

  test('lakes.filters.c1 lakes.filters.s2 · a single section: no repeated title, only its select-all', async ({ page }) => {
    await openMap(page, '', PHONE);
    await visible(page.getByRole('button', { name: 'Regim' })).click();
    const panel = page.getByRole('dialog', { name: 'Regim' });
    await expect(panel.getByRole('button', { name: 'Selectează tot: Regim' })).toBeVisible();
    // The caps title is not drawn again under the panel title (the legend stays for screen readers).
    await expect(panel.locator('fieldset span.uppercase')).toHaveCount(0);
    await expect(panel.getByRole('group', { name: 'Regim' })).toHaveCount(1);
    // c9 on the map's phone sheet: the «Închide» X.
    await panel.getByRole('button', { name: 'Închide', exact: true }).click();
    await expect(panel).toBeHidden();
  });
});

/* ======================================================================== lakes.search */

test.describe('lakes.search', () => {
  test('lakes.search.c1 c2 c3 c5 c6 c7 c13 lakes.search.s1 s3 s4 s5 · the layer, empty term, typing, no results, close resets', async ({ page }) => {
    await openHome(page, PHONE);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await expect(layer).toBeVisible();
    const input = layer.getByRole('combobox', { name: 'Caută o baltă, județ sau localitate' });
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('placeholder', 'Caută o baltă, județ sau localitate');
    // c3: «În jurul meu» first.
    const rows = layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option');
    await expect(rows.first()).toHaveText(/În jurul meu/, { timeout: 15_000 });
    // One copy for the row at every moment (the CMS's own «Arie de 50km» never swaps it in).
    await expect(rows.first()).toContainText('Bălți în apropiere');
    await expect(layer.getByText('Arie de 50km')).toHaveCount(0);
    // c5: typing → text suggestions with title + subtitle.
    await input.fill('chita');
    await expect(rows.filter({ hasText: 'Chita Lake' })).toBeVisible({ timeout: 15_000 });
    // c6: one more letter keeps the shown list (marked busy) instead of blanking it.
    await input.press('End');
    await input.pressSequentially(' ');
    await expect(layer.getByRole('listbox', { name: 'Sugestii' })).toBeVisible();
    await expect(rows.filter({ hasText: 'Chita Lake' })).toBeVisible();
    // c6: while debouncing the skeleton, never the empty line.
    await input.fill('zzzzqqqxx');
    await expect(layer.getByText('Nu am găsit rezultate pentru căutarea ta.')).toHaveCount(0);
    // c7: no results.
    await expect(layer.locator('span.t-body-strong', { hasText: 'Nu am găsit rezultate pentru căutarea ta.' })).toBeVisible({ timeout: 15_000 });
    await expect(layer.getByText('Încearcă numele bălții, județul sau localitatea, fără prescurtări.')).toBeVisible();
    await expectNoA11yViolations(page);
    // c1 + c13: the close is the X named «Închide» on the sheet's title row (the one close pattern of
    // every phone sheet on Bălți); closing resets the term.
    await expect(layer.getByRole('button', { name: 'Închide', exact: true })).toHaveCount(1);
    await layer.getByRole('button', { name: 'Închide', exact: true }).click();
    await expect(layer).toBeHidden();
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    await expect(page.getByRole('combobox', { name: 'Caută o baltă, județ sau localitate' })).toHaveValue('');
  });

  test('lakes.search.c4 c10 lakes.results-map.c1 c5 lakes.search.s2 lakes.results-map.s7 · a county: recents, the scoped map with its title', async ({ page }) => {
    await openHome(page, DESKTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('giurgiu');
    await layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option', { name: /^Giurgiu/ }).click();
    await expect(page).toHaveURL(new RegExp(`/balti/harta\\?q=Giurgiu&judet=${GIURGIU}$`));
    // c1: the pill shows the place; c5: the list is the county's lakes.
    await expect(visible(page.getByRole('button', { name: /Acum: Giurgiu/ }))).toBeVisible();
    await expect(listHeading(page)).toHaveText(/^\d+ (de )?(baltă|bălți) în această zonă$/, { timeout: 25_000 });
    const n = Number((await listHeading(page).textContent())!.match(/\d+/)![0]);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(40);
    // c4: the pick is a recent now; «Șterge tot» clears.
    await visible(page.getByRole('button', { name: /Acum: Giurgiu/ })).click();
    const recents = page.getByRole('region', { name: 'Căutări recente' });
    await expect(recents.getByRole('option', { name: /^Giurgiu/ })).toBeVisible();
    await recents.getByRole('button', { name: 'Șterge tot' }).click();
    await expect(recents).toHaveCount(0);
  });

  test('lakes.search.c9 · a lake opens its page', async ({ page }) => {
    await openHome(page, PHONE);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('chita');
    await layer.getByRole('option', { name: /^Chita Lake/ }).click();
    await expect(page).toHaveURL(new RegExp(`/balti/${CHITA}$`));
    // c9: the pick is saved to the recents (newest first).
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('recentLakeSearches') ?? '[]') as { id: string; type: string }[]);
    expect(saved[0]).toMatchObject({ id: `lake-${CHITA}`, type: 'lake' });
  });

  test('lakes.search.c1 lakes.search.s1 · desktop: the dialog closes with its «Închide» X, the input focused on open', async ({ page }) => {
    await openHome(page, DESKTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await expect(layer.getByRole('combobox', { name: 'Caută o baltă, județ sau localitate' })).toBeFocused();
    await layer.getByRole('combobox').fill('chita');
    await layer.getByRole('button', { name: 'Închide', exact: true }).click();
    await expect(layer).toBeHidden();
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    await expect(layer.getByRole('combobox')).toHaveValue('');
  });

  test('lakes.search.c2 c5 lakes.search.s3 · typing: a text-mode request, the input says it is loading until the answer', async ({ page }) => {
    await openHome(page, PHONE);
    const requests: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/localhost:1337\/api\/lakes\/explore\/suggestions.*q=chita/, async (route) => {
      requests.push(route.request().url());
      await gate;
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await expect(layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option').first()).toHaveText(/În jurul meu/, { timeout: 15_000 });
    await layer.getByRole('combobox').fill('chita');
    await expect(layer.getByRole('status')).toHaveText('Se încarcă sugestiile');
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(requests[0]).toMatch(/mode=text/);
    await expect(layer.getByRole('status')).toHaveText('Se încarcă sugestiile');
    release();
    await expect(layer.getByRole('option', { name: /^Chita Lake/ })).toBeVisible({ timeout: 15_000 });
    await expect(layer.getByRole('status')).not.toHaveText('Se încarcă sugestiile');
  });

  test('lakes.search.c4 c10 lakes.search.s4 · a city: saved to the recents, the map scoped to it with its title', async ({ page }) => {
    await openHome(page, DESKTOP);
    // The local CMS has no city rows: the term is answered with one city suggestion.
    const city = { id: 'city-c1', type: 'city', title: 'Răsuceni', subtitle: 'Giurgiu · 1 baltă', icon: 'city', color: '#000000', county: 'Giurgiu', countyId: GIURGIU, cityId: 'c1' };
    await page.route(/localhost:1337\/api\/lakes\/explore\/suggestions.*q=rasuceni/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { suggestions: [city] }, meta: { query: 'rasuceni', normalizedTokens: ['rasuceni'], countsByType: { nearby: 0, county: 0, city: 1, lake: 0 }, pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 } } }) }),
    );
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('rasuceni');
    await layer.getByRole('option', { name: /^Răsuceni/ }).click();
    await expect(page).toHaveURL(/\/balti\/harta\?.*localitate=c1/);
    await expect(visible(page.getByRole('button', { name: /Acum: Răsuceni/ }))).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('recentLakeSearches') ?? '[]') as { id: string }[]);
    expect(saved[0]).toMatchObject({ id: 'city-c1' });
  });

  test('lakes.search.c8 lakes.search.s6 · the next page of suggestions on scroll; a failed page says so and retries', async ({ page }) => {
    await openHome(page, PHONE);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const list = page.getByRole('dialog', { name: 'Caută în Bălți' }).getByRole('listbox', { name: 'Sugestii' });
    const page2: string[] = [];
    page.on('request', (r) => {
      if (/explore\/suggestions.*page=2/.test(r.url())) page2.push(r.url());
    });
    await expect(list.getByRole('option')).toHaveCount(20, { timeout: 15_000 }); // page 1 (the CMS's nearby row included)
    expect(page2).toHaveLength(0);
    // The 40% look-ahead works against the sheet's own scroller: page 2 is asked for while the
    // last rows are still below the fold.
    const below = await list.evaluate((el) => {
      const scroller = el.closest<HTMLElement>('.overflow-y-auto')!;
      const end = scroller.querySelector<HTMLElement>('div.h-px[aria-hidden]')!;
      const gap = end.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      // The end marker 20% of the scroller's height below its bottom edge (out of view).
      scroller.scrollTop += gap - scroller.clientHeight * 1.2;
      return end.getBoundingClientRect().top - scroller.getBoundingClientRect().bottom;
    });
    expect(below).toBeGreaterThan(0);
    await expect.poll(() => page2.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(async () => list.getByRole('option').count(), { timeout: 15_000 }).toBeGreaterThan(20);
  });

  test('lakes.search.c8 lakes.search.s6 · a failed next page: the message and its retry', async ({ page }) => {
    await openHome(page, PHONE);
    let fail = true;
    await page.route(/localhost:1337\/api\/lakes\/explore\/suggestions.*page=2/, async (route) => {
      if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const list = layer.getByRole('listbox', { name: 'Sugestii' });
    await expect(list.getByRole('option')).toHaveCount(20, { timeout: 15_000 });
    await list.getByRole('option').last().scrollIntoViewIfNeeded();
    await expect(layer.getByText('Nu am putut încărca mai multe sugestii.')).toBeVisible({ timeout: 20_000 });
    fail = false;
    await layer.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect.poll(async () => list.getByRole('option').count(), { timeout: 15_000 }).toBeGreaterThan(20);
    // lakes.search.s3: the retry button is gone, focus stays in the combobox (not on <body>).
    await expect(layer.getByRole('combobox')).toBeFocused();
  });

  test('lakes.search.c11 c12 lakes.results-map.c22 c23 lakes.results-map.s10 · «În jurul meu»: nearby map, distances, the user drawn', async ({ page }) => {
    await openHome(page, PHONE, 'granted');
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    await page.getByRole('dialog', { name: 'Caută în Bălți' }).getByRole('option', { name: /^În jurul meu/ }).click();
    await expect(page).toHaveURL(/\/balti\/harta\?aproape=1$/);
    await expect(visible(page.getByRole('button', { name: /Acum: În jurul meu · 50km/ }))).toBeVisible();
    await expect(listHeading(page)).toHaveText(/în această zonă/, { timeout: 25_000 });
    // c23: list cards carry the distance.
    await expect(page.getByRole('region', { name: 'Rezultate' }).locator('article').first()).toContainText(/La \d+([.,]\d)? km/);
    // c22: «Locația mea» is on (the user is drawn).
    await expect(page.getByRole('button', { name: 'Locația mea' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('lakes.search.c2 c12 lakes.search.s7 · a spinner while the position is read; a second tap is ignored', async ({ page }) => {
    let calls = 0;
    await page.addInitScript(() => {
      const status = { state: 'prompt', addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'permissions', { value: { query: () => Promise.resolve(status) }, configurable: true });
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (ok: (p: unknown) => void) => {
            (window as unknown as { __geoCalls: number }).__geoCalls = ((window as unknown as { __geoCalls?: number }).__geoCalls ?? 0) + 1;
            setTimeout(() => {
              status.state = 'granted';
              ok({ coords: { latitude: 44.4268, longitude: 26.1025 } });
            }, 2500);
          },
        },
        configurable: true,
      });
    });
    await openHome(page, PHONE);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const nearby = layer.getByRole('option', { name: /^În jurul meu/ });
    await nearby.click();
    await expect(nearby).toHaveAttribute('aria-busy', 'true');
    await expect(layer.getByRole('status')).toHaveText('Se caută locația ta');
    await nearby.click();
    calls = await page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls);
    expect(calls).toBe(1);
    await expect(page).toHaveURL(/\/balti\/harta\?aproape=1$/, { timeout: 15_000 });
  });

  test('lakes.search.c11 lakes.search.s8 · «În jurul meu» denied → the permission dialog', async ({ page }) => {
    await openHome(page, PHONE, 'denied');
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    await page.getByRole('dialog', { name: 'Caută în Bălți' }).getByRole('option', { name: /^În jurul meu/ }).click();
    await expect(page.getByRole('dialog', { name: 'Găsește bălți aproape de tine' })).toBeVisible();
  });

  test('lakes.search.c11 lakes.search.s8 · «În jurul meu» with no position (location off) → the services dialog', async ({ page }) => {
    await openHome(page, PHONE, 'services_off');
    // The home's own services dialog opens by itself once (lakes.home.c20): dismiss it first.
    const services = page.getByRole('dialog', { name: 'Activează serviciile de locație' });
    await expect(services).toBeVisible();
    await services.getByRole('button', { name: 'Renunță' }).click();
    await expect(services).toBeHidden();
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    await page.getByRole('dialog', { name: 'Caută în Bălți' }).getByRole('option', { name: /^În jurul meu/ }).click();
    await expect(services).toBeVisible();
    await expect(page).toHaveURL(/\/balti$/);
  });

  test('lakes.search.c9 c10 lakes.search.s4 · keyboard: ↓ highlights a row (aria-activedescendant), Enter picks it', async ({ page }) => {
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const input = layer.getByRole('combobox');
    await input.fill('chita');
    const lake = layer.getByRole('option', { name: /^Chita Lake/ });
    await expect(lake).toBeVisible({ timeout: 15_000 });
    await expect(layer.getByRole('listbox', { name: 'Sugestii' })).not.toHaveAttribute('aria-busy', 'true');
    // The palette's row: a t-body-strong title, the soft-fill highlight with no ring.
    await expect(lake.locator('mark')).toHaveCount(0);
    const options = layer.getByRole('option');
    const ids = await options.evaluateAll((os) => os.map((o) => o.id));
    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', ids[0]);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    expect(await options.first().evaluate((o) => getComputedStyle(o).outlineStyle)).toBe('none');
    await input.press('ArrowUp');
    await expect(input).toHaveAttribute('aria-activedescendant', ids[ids.length - 1]);
    await expect(input).toBeFocused();
    // Pick the lake row with the arrows.
    const lakeIndex = ids.indexOf((await lake.getAttribute('id'))!);
    await input.press('ArrowDown'); // wraps to 0
    for (let i = 0; i < lakeIndex; i++) await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', ids[lakeIndex]);
    await input.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/balti/${CHITA}$`));
  });

  test('lakes.search.c9 lakes.search.s4 · Enter with nothing highlighted picks the first place or lake', async ({ page }) => {
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('chita');
    await expect(layer.getByRole('option', { name: /^Chita Lake/ })).toBeVisible({ timeout: 15_000 });
    await expect(layer.getByRole('status')).toHaveText('1 sugestie');
    await layer.getByRole('combobox').press('Enter');
    await expect(page).toHaveURL(new RegExp(`/balti/${CHITA}$`));
  });

  test('lakes.search.c1 c13 lakes.search.s4 · Escape closes at once, even with text in the field', async ({ page }) => {
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('qqzzxx');
    await page.keyboard.press('Escape');
    await expect(layer).toBeHidden();
  });

  test('lakes.search.c5 c6 c7 lakes.search.s3 s4 s5 · the input stays put while the list changes (dialog anchored to the top)', async ({ page }) => {
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const input = layer.getByRole('combobox');
    await expect(layer.getByRole('option').nth(3)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(600); // the dialog's open scale settles
    const y = (await input.boundingBox())!.y;
    await input.fill('chita');
    await expect(layer.getByRole('option', { name: /^Chita Lake/ })).toBeVisible({ timeout: 15_000 });
    expect(Math.abs((await input.boundingBox())!.y - y)).toBeLessThanOrEqual(1);
    await input.fill('qqzzxx');
    await expect(layer.locator('span.t-body-strong', { hasText: 'Nu am găsit rezultate pentru căutarea ta.' })).toBeVisible({ timeout: 15_000 });
    expect(Math.abs((await input.boundingBox())!.y - y)).toBeLessThanOrEqual(1);
    // The clear X stays while a term loads (the spinner sits beside it).
    await input.pressSequentially('q');
    await expect(layer.getByRole('button', { name: 'Șterge textul' })).toBeVisible();
  });

  test('lakes.search.c3 c6 lakes.search.s1 s3 · the default suggestions fail: «În jurul meu» stays, the line says so (and the status), the retry loads them', async ({ page }) => {
    await openHome(page, PHONE);
    let fail = true;
    await page.route(/localhost:1337\/api\/lakes\/explore\/suggestions/, async (route) => {
      if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const rows = layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option');
    await expect(rows.first()).toHaveText(/În jurul meu/);
    await expect(layer.getByRole('alert')).toHaveText(/Sugestiile nu s-au încărcat\./, { timeout: 20_000 });
    await expect(layer.getByRole('status')).toHaveText('Sugestiile nu s-au încărcat.');
    await expect(rows).toHaveCount(1);
    fail = false;
    await layer.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThan(5);
    // lakes.search.s3: focus stays in the combobox after the retry button unmounts.
    await expect(layer.getByRole('combobox')).toBeFocused();
    await expect(rows.first()).toContainText('Bălți în apropiere');
  });

  test('lakes.search.c3 lakes.search.s1 s3 · while the default suggestions load, «În jurul meu» is already the first row', async ({ page }) => {
    await openHome(page, LAPTOP);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/localhost:1337\/api\/lakes\/explore\/suggestions/, async (route) => {
      await gate;
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const rows = layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveText(/În jurul meu/);
    await page.waitForTimeout(600); // the dialog's open scale settles
    const y = (await layer.getByRole('combobox').boundingBox())!.y;
    release();
    await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThan(5);
    expect(Math.abs((await layer.getByRole('combobox').boundingBox())!.y - y)).toBeLessThanOrEqual(1);
  });

  test('lakes.search.c12 lakes.search.s7 · closing while the position is read does not navigate', async ({ page }) => {
    await page.addInitScript(() => {
      const status = { state: 'prompt', addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'permissions', { value: { query: () => Promise.resolve(status) }, configurable: true });
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (ok: (p: unknown) => void) =>
            setTimeout(() => {
              status.state = 'granted';
              ok({ coords: { latitude: 44.4268, longitude: 26.1025 } });
            }, 2500),
        },
        configurable: true,
      });
    });
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('option', { name: /^În jurul meu/ }).click();
    await expect(layer.getByRole('status')).toHaveText('Se caută locația ta');
    await layer.getByRole('button', { name: 'Închide', exact: true }).click();
    await expect(layer).toBeHidden();
    await page.waitForTimeout(3500);
    await expect(page).toHaveURL(/\/balti$/);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('lakes.search.c11 lakes.search.s8 · location off, then «Încearcă din nou» gets a position: the nearby pick goes through (one dialog at a time)', async ({ page }) => {
    await page.addInitScript(() => {
      let calls = 0;
      const status = { state: 'granted', addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'permissions', { value: { query: () => Promise.resolve(status) }, configurable: true });
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (ok: (p: unknown) => void, err: (e: { code: number; PERMISSION_DENIED: number }) => void) =>
            setTimeout(() => {
              calls += 1;
              // The home's own first read and the search's tap fail (location off); the retry works.
              if (calls < 3) err({ code: 2, PERMISSION_DENIED: 1 });
              else ok({ coords: { latitude: 44.4268, longitude: 26.1025 } });
            }, 50),
        },
        configurable: true,
      });
    });
    await openHome(page, PHONE);
    const services = page.getByRole('dialog', { name: 'Activează serviciile de locație' });
    if (await services.isVisible().catch(() => false)) await services.getByRole('button', { name: 'Renunță' }).click();
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    await page.getByRole('dialog', { name: 'Caută în Bălți' }).getByRole('option', { name: /^În jurul meu/ }).click();
    await expect(services).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await services.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page).toHaveURL(/\/balti\/harta\?aproape=1$/, { timeout: 15_000 });
  });

  test('lakes.search.c11 lakes.search.s8 · the map page: the same hand-off — the search closes first, a retry that gets a position commits the nearby search', async ({ page }) => {
    await page.addInitScript(() => {
      let calls = 0;
      const status = { state: 'granted', addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'permissions', { value: { query: () => Promise.resolve(status) }, configurable: true });
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (ok: (p: unknown) => void, err: (e: { code: number; PERMISSION_DENIED: number }) => void) =>
            setTimeout(() => {
              calls += 1;
              // The map's own first read and the search's tap fail (location off); the retry works.
              if (calls < 3) err({ code: 2, PERMISSION_DENIED: 1 });
              else ok({ coords: { latitude: 44.4268, longitude: 26.1025 } });
            }, 50),
        },
        configurable: true,
      });
    });
    await openMap(page, '', PHONE);
    const services = page.getByRole('dialog', { name: 'Activează serviciile de locație' });
    if (await services.isVisible().catch(() => false)) await services.getByRole('button', { name: 'Renunță' }).click();
    await visible(page.getByRole('button', { name: 'Caută bălți, lacuri', exact: true })).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('option', { name: /^În jurul meu/ }).click();
    await expect(services).toBeVisible();
    // One modal at a time: the search layer closed before the dialog opened.
    await expect(layer).toBeHidden();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await services.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page).toHaveURL(/\/balti\/harta\?aproape=1$/, { timeout: 15_000 });
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('lakes.search.c11 lakes.search.s8 · the location hand-off follows the surface rule: a sheet on a phone, a dialog from 768', async ({ page }) => {
    await openHome(page, PHONE, 'denied');
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    await page.getByRole('dialog', { name: 'Caută în Bălți' }).getByRole('option', { name: /^În jurul meu/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Găsește bălți aproape de tine' });
    await expect(sheet).toBeVisible();
    // The kit Sheet: its panel is anchored to the bottom edge, full width (never a centred modal).
    await page.waitForTimeout(600);
    const box = (await sheet.locator(':scope > div').first().boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(PHONE.height);
    expect(Math.round(box.width)).toBe(PHONE.width);
    await expect(sheet).toContainText('iconița de lângă adresa paginii');
    await sheet.getByRole('button', { name: 'Am înțeles' }).click();
    await expect(sheet).toBeHidden();
    // From 768 the kit Dialog (a decision: an alert dialog, answered by its action).
    await page.setViewportSize(TABLET);
    await page.getByRole('button', { name: /Activează locația din setări/ }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Găsește bălți aproape de tine' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Am înțeles' })).toBeFocused();
  });

  test('lakes.search.c11 c12 lakes.search.s7 · a permission prompt left unanswered: the spinner clears after the watchdog and a second tap asks again', async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      const w = window as unknown as { __asks: number };
      w.__asks = 0;
      const status = { state: 'prompt', addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'permissions', { value: { query: () => Promise.resolve(status) }, configurable: true });
      // Firefox's doorhanger clicked away / Safari's ignored prompt: never calls back.
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: () => void (w.__asks += 1) }, configurable: true });
    });
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const nearby = layer.getByRole('option', { name: /^În jurul meu/ });
    await nearby.click();
    await expect(nearby).toHaveAttribute('aria-busy', 'true');
    await expect(layer.getByRole('status')).toHaveText('Se caută locația ta');
    await expect(nearby).not.toHaveAttribute('aria-busy', 'true', { timeout: 20_000 });
    // Nothing opened, nothing navigated: the row is free again.
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(page).toHaveURL(/\/balti$/);
    await nearby.click();
    await expect(nearby).toHaveAttribute('aria-busy', 'true');
    expect(await page.evaluate(() => (window as unknown as { __asks: number }).__asks)).toBe(2);
  });

  test('lakes.search.c9 lakes.search.s3 s4 · Enter pressed before the answer is in waits for it (not dropped)', async ({ page }) => {
    await openHome(page, LAPTOP);
    // A slow CMS: every typed-term answer takes 1.5 s.
    await page.route(/localhost:1337\/api\/lakes\/explore\/suggestions.*q=/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } }).catch(() => null);
      if (res) await route.fulfill({ response: res }).catch(() => {});
    });
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('chita');
    await layer.getByRole('combobox').press('Enter');
    await expect(page).toHaveURL(new RegExp(`/balti/${CHITA}$`), { timeout: 15_000 });
  });

  test('lakes.search.c10 lakes.search.s4 · Enter on a county name opens the county, not the first lake ranked above it', async ({ page }) => {
    await openHome(page, DESKTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('giurgiu');
    await layer.getByRole('combobox').press('Enter');
    await expect(page).toHaveURL(new RegExp(`/balti/harta\\?q=Giurgiu&judet=${GIURGIU}$`), { timeout: 15_000 });
  });

  test('lakes.search.c9 lakes.search.s4 · Enter on a term that names no row highlights the first row; a second Enter picks it', async ({ page }) => {
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    const input = layer.getByRole('combobox');
    await input.fill('balta');
    await expect(layer.getByRole('listbox', { name: 'Sugestii' })).not.toHaveAttribute('aria-busy', 'true', { timeout: 15_000 });
    await expect(layer.getByRole('status')).toHaveText(/\d+ sugestii/, { timeout: 15_000 });
    await input.press('Enter');
    const first = layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option').nth(1); // after «În jurul meu»
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/balti$/);
    await input.press('Enter');
    await expect(page).not.toHaveURL(/\/balti$/, { timeout: 15_000 });
  });

  test('lakes.search.c5 · city rows keep their badge on the hover / highlight fill', async ({ page }) => {
    await openHome(page, LAPTOP);
    await page.getByRole('button', { name: 'Deschide căutarea pentru bălți' }).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('giurgiu');
    const option = layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option').first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    // Every row tone differs from the row's own hover / highlight fill (soft-fill).
    const softFill = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-soft-fill').trim());
    const tones = await layer.locator('[role=option] > span:first-child').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    const probe = await page.evaluate((c) => {
      const d = document.createElement('div');
      d.style.backgroundColor = c;
      document.body.append(d);
      const v = getComputedStyle(d).backgroundColor;
      d.remove();
      return v;
    }, softFill);
    for (const t of tones) expect(t).not.toBe(probe);
  });
});

/* ======================================================================== lakes.results-map */

test.describe('lakes.results-map', () => {
  for (const vp of WIDTHS) {
    test(`lakes.results-map.c1 c3 c15 c16 c18 lakes.results-map.s3 · ${vp.width}px · chrome, list, axe`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await openMap(page, '', vp);
      // c1: search pill + Filtre; back (phone) or the breadcrumb (768+).
      await expect(visible(page.getByRole('button', { name: 'Caută bălți, lacuri' }))).toContainText('Caută bălți, lacuri...');
      await expect(visible(page.getByRole('button', { name: 'Filtre' }))).toBeVisible();
      if (vp.width < 768) await expect(page.getByRole('link', { name: 'Înapoi la Bălți' })).toHaveAttribute('href', '/balti');
      // c3: the chip rail in fish order — the T1 FilterBar (from 768 its own «Filtre» leads it).
      const chips = (
        await page.getByRole('group', { name: 'Filtre' }).getByRole('button').evaluateAll((bs) => bs.filter((b) => (b as HTMLElement).offsetParent).map((b) => b.textContent?.trim()))
      ).filter((t) => t !== 'Filtre');
      expect(chips.slice(0, 5)).toEqual(['Regim', 'Facilități', 'Rating', 'Rezervări', 'Pești']);
      if (vp.width >= 768) {
        // Owner rule 7: the Bălți / Ape publice switch heads the map's toolbar; map left, list right.
        const sw = page.getByRole('navigation', { name: 'Tip de apă' });
        await expect(sw.getByRole('link', { name: 'Bălți' })).toHaveAttribute('aria-current', 'page');
        await expect(sw.getByRole('link', { name: 'Ape publice' })).toHaveAttribute('href', '/ape-publice');
        const mapBox = (await page.locator('.maplibregl-canvas').boundingBox())!;
        const listBox = (await page.getByRole('region', { name: 'Rezultate' }).boundingBox())!;
        expect(mapBox.x).toBeLessThan(listBox.x);
        expect(Math.abs(mapBox.width - listBox.width)).toBeLessThan(vp.width * 0.2);
      }
      // One horizontal card per row: the photo left of the text, every card the column's width.
      const cards = page.getByRole('region', { name: 'Rezultate' }).locator('[data-lake-row-card]');
      await expect(cards.first()).toBeVisible();
      const lefts = await cards.evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
      expect(lefts).toBe(1);
      const photo = (await cards.first().locator('img').first().boundingBox())!;
      const title = (await cards.first().locator('h3').boundingBox())!;
      expect(photo.x + photo.width).toBeLessThanOrEqual(title.x);
      // c15: the count; c16: the cards open /balti/[id].
      const region = page.getByRole('region', { name: 'Rezultate' });
      await expect(region.locator('article').first()).toBeVisible();
      expect(await region.locator('article').count()).toBeLessThanOrEqual(7);
      await expect(region.locator('article h3 a').first()).toHaveAttribute('href', /^\/balti\/[a-z0-9]+$/);
      // c16: fish LakeRating large — «★ 4,80 (N)».
      for (const text of await region.locator('article').allTextContents()) {
        if (text.includes('Rating')) expect(text).toMatch(/Rating \d,\d{2} \(\d+ recenzii\)/);
      }
      await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas-container'] });
      expect(errors).toEqual([]);
    });
  }

  test('lakes.results-map.c15 · 7 per page, the next page with the footer', async ({ page }) => {
    await openMap(page, '', DESKTOP);
    const region = page.getByRole('region', { name: 'Rezultate' });
    await expect(region.locator('article')).toHaveCount(7);
    await region.locator('article').last().scrollIntoViewIfNeeded();
    await expect.poll(async () => region.locator('article').count(), { timeout: 15_000 }).toBeGreaterThan(7);
  });

  test('lakes.results-map.c16 · owner rule 7: card ↔ marker — hovering a card raises its pin, hovering a pin outlines its card', async ({ page }) => {
    await openMap(page, '', LAPTOP);
    const region = page.getByRole('region', { name: 'Rezultate' });
    const first = region.locator('li[data-t2-id]').first();
    const id = (await first.getAttribute('data-t2-id'))!;
    await first.hover();
    // The hovered card's lake: its own pin raised when it stands alone; while it is clustered, the
    // bubble holding it is ringed (never a pin drawn over the bubble, hiding its count).
    const pin = page.locator(`[data-t2-pin="${id}"]`);
    const ringed = page.locator('button[data-highlighted]').filter({ hasText: /^\d+$/ });
    await expect.poll(async () => (await pin.count()) > 0 ? await pin.getAttribute('data-highlighted') : String(await ringed.count())).toBe(
      (await pin.count()) > 0 ? 'true' : '1',
    );
    if ((await pin.count()) === 0) {
      // The ringed bubble keeps its count legible: nothing is drawn over its centre.
      const box = (await ringed.boundingBox())!;
      const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.dataset.highlighted ?? null, [box.x + box.width / 2, box.y + box.height / 2]);
      expect(top).toBe('true');
    }
    await page.mouse.move(5, 5);
    await expect(page.locator(`[data-t2-pin="${id}"][data-highlighted]`)).toHaveCount(0);
    await expect(ringed).toHaveCount(0);
    // The reverse: a standalone pin whose lake is listed.
    const listed = new Set(await region.locator('li[data-t2-id]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-t2-id'))));
    const pins = await page.locator('[data-t2-pin]').evaluateAll((ps) => ps.map((p) => p.getAttribute('data-t2-pin')));
    const both = pins.find((p) => p && listed.has(p));
    test.skip(!both, 'no listed lake stands alone on the map at this zoom');
    await page.locator(`[data-t2-pin="${both}"]`).hover();
    await expect(region.locator(`li[data-t2-id="${both}"]`)).toHaveAttribute('data-highlighted', 'true');
  });

  test('lakes.results-map.c3 c4 c20 lakes.results-map.s7 · Rezervări flips in place; Rating chip label; «Șterge filtre» resets', async ({ page }) => {
    await openMap(page, '', DESKTOP);
    const booking = visible(page.getByRole('button', { name: 'Rezervări' }));
    await expect(booking).toHaveAttribute('aria-pressed', 'false');
    await booking.click();
    await expect(page).toHaveURL(/\?rezervari=1$/);
    await expect(visible(page.getByRole('button', { name: 'Rezervări' }))).toHaveAttribute('aria-pressed', 'true');
    // c3: the Rating chip becomes the tier name.
    await page.goto('/balti/harta?rating=foarte-bun&rezervari=1');
    await expect(visible(page.getByRole('button', { name: 'Foarte bun' }))).toBeVisible({ timeout: 20_000 });
    // c20: «Resetează» at the end of the bar (T1 FilterBar's place) → all lakes, no filters.
    const bar = page.getByRole('group', { name: 'Filtre' });
    await visible(bar.getByRole('button', { name: 'Resetează' })).click();
    await expect(page).toHaveURL(/\/balti\/harta$/);
    await expect(bar.getByRole('button', { name: 'Resetează' })).toHaveCount(0);
  });

  test('lakes.results-map.c6 lakes.results-map.s8 · the county box fails → the country overview, results still load', async ({ page }) => {
    await openMap(page, `q=Giurgiu&judet=${GIURGIU}`, DESKTOP, 'prompt', () =>
      page.route(/localhost:1337\/api\/lakes\/focus-bbox/, (r) => r.fulfill({ status: 500, body: '{}', contentType: 'application/json' })),
    );
    const n = Number((await listHeading(page).textContent())!.match(/\d+/)![0]);
    expect(n).toBeGreaterThan(40); // the whole country is in view
  });

  test('lakes.results-map.c8 lakes.results-map.s8 · a county waits for its box: the first list request is for the county', async ({ page }) => {
    const bboxes: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/lakes/in-bbox')) bboxes.push(r.url());
    });
    await openMap(page, `q=Giurgiu&judet=${GIURGIU}`, DESKTOP);
    const first = new URL(bboxes[0]);
    expect(Number(first.searchParams.get('north'))).toBeLessThan(45);
    expect(Number(first.searchParams.get('west'))).toBeGreaterThan(25);
  });

  test('lakes.results-map.c11 c12 c13 c14 lakes.results-map.s5 · a pin: the card, Direcții, closing returns to the list', async ({ page }) => {
    await openMap(page, `q=Giurgiu&judet=${GIURGIU}`, PHONE);
    const name = await clickVisiblePin(page);
    // c11: the list closes, the pin card opens.
    const card = page.getByRole('article', { name: name! });
    await expect(card).toBeVisible();
    await expect(page.getByRole('button', { name: /^Vezi lista/ })).toHaveCount(0);
    // c12: the name links to the lake; the place.
    await expect(card.getByRole('link', { name: name! })).toHaveAttribute('href', /^\/balti\/[a-z0-9]+$/);
    await expect(card).toContainText('Giurgiu');
    // c13: Google Maps, Waze, Apple Maps.
    await card.getByRole('button', { name: 'Direcții' }).click();
    const directions = page.getByRole('dialog', { name: 'Direcții' });
    await expect(directions.getByRole('link')).toHaveCount(3);
    await expect(directions.getByRole('link', { name: /Google Maps/ })).toHaveAttribute('href', /google\.com\/maps\/dir/);
    await expect(directions.getByRole('link', { name: /Waze/ })).toHaveAttribute('href', /waze\.com/);
    await expect(directions.getByRole('link', { name: /Apple Maps/ })).toHaveAttribute('href', /maps\.apple\.com/);
    await page.waitForTimeout(600); // the dialog's fade-in
    await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas-container'] });
    await directions.getByRole('button', { name: 'Închide' }).click();
    // c14: closing the card brings the list back.
    await card.getByRole('button', { name: 'Închide' }).click();
    await expect(card).toBeHidden();
    await expect(page.getByRole('region', { name: 'Rezultate' })).toBeInViewport();
  });

  test('lakes.results-map.c10 c25 · a cluster zooms in (never more than 2 levels)', async ({ page }) => {
    const events = await recordAnalytics(page);
    await openMap(page, '', DESKTOP);
    const cluster = page.getByRole('button', { name: /bălți — mărește harta aici/ }).first();
    await expect(cluster).toBeVisible({ timeout: 20_000 });
    const before = Number((await listHeading(page).textContent())!.match(/\d+/)![0]);
    await cluster.click();
    await expect.poll(async () => Number((await listHeading(page).textContent())!.match(/\d+/)![0]), { timeout: 15_000 }).toBeLessThan(before);
    expect((await events()).some((e) => e.name === 'lakes_map_results_cluster_tap')).toBe(true);
  });

  test('lakes.results-map.c17 lakes.results-map.s4 · no lakes in view', async ({ page }) => {
    await openMap(page, '', PHONE, 'prompt', () =>
      page.route(/localhost:1337\/api\/lakes\/in-bbox/, (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { total: 0, page: 1, pageSize: 7, hasMore: false } }) }),
      ),
    );
    await expect(listHeading(page)).toHaveText('0 bălți în această zonă');
    // The visible line (the live region says the same words, visually hidden).
    await expect(page.locator('p:not(.sr-only)', { hasText: 'Mărește harta sau modifică filtrele pentru a vedea bălțile.' })).toBeVisible();
  });

  test('lakes.results-map.s1 s3 · the list read fails → the error within 15 s (one viewport read, no second skeleton), retry focuses the list heading', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await patchGrants(page);
    let fail = true;
    const keys = new Set<string>();
    await page.route(/localhost:1337\/api\/lakes\/in-bbox/, async (route) => {
      const u = new URL(route.request().url());
      u.searchParams.delete('page');
      keys.add(u.search);
      if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' });
      await route.fallback();
    });
    const t0 = Date.now();
    await page.goto('/balti/harta', { waitUntil: 'domcontentloaded' });
    const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut încărca bălțile' });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    expect(Date.now() - t0).toBeLessThan(15_000);
    await expect(alert).toContainText('Verifică conexiunea');
    // The map's own settle on the framing did not start a second read of the same area.
    expect(keys.size).toBe(1);
    fail = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(listHeading(page)).toHaveText(/în această zonă/, { timeout: 15_000 });
    await expect(listHeading(page)).toBeFocused();
  });

  test('lakes.results-map.c18 lakes.results-map.s1 · the skeleton until the first page', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await patchGrants(page);
    await page.route(/localhost:1337\/api\/lakes\/in-bbox/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.goto('/balti/harta');
    await expect(listHeading(page)).toHaveText('Se încarcă rezultatele');
    await expect(listHeading(page)).toHaveText(/în această zonă/, { timeout: 25_000 });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('lakes.results-map.c19 c24 lakes.results-map.s6 · phone: a pan hides the list, «Vezi lista (N)» brings it back; the panel hides it', async ({ page }) => {
    await openMap(page, '', PHONE);
    const map = page.locator('.maplibregl-canvas');
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + 260, { steps: 8 });
    await page.mouse.up();
    const showList = page.getByRole('button', { name: /^Vezi lista \(\d+\)$/ });
    await expect(showList).toBeVisible();
    await showList.click();
    await expect(page.getByRole('region', { name: 'Rezultate' }).getByRole('heading', { level: 2 })).toBeInViewport();
    // c24: the panel takes the list away and gives it back.
    await page.getByRole('button', { name: 'Filtre' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtre' });
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: /^Vezi lista/ })).toHaveCount(0);
  });

  test('lakes.results-map.c21 lakes.home.c20 lakes.results-map.s9 · Locația mea: denied → the permission dialog (also opens by itself once per session)', async ({ page }) => {
    await openMap(page, '', PHONE, 'denied');
    const dialog = page.getByRole('dialog', { name: 'Găsește bălți aproape de tine' });
    await expect(dialog).toBeVisible();
    // One action, no X: the first focus is the action itself.
    await expect(dialog.getByRole('button', { name: 'Închide' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Am înțeles' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Am înțeles' }).click();
    await page.getByRole('button', { name: 'Locația mea' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Am înțeles' }).click();
    // Home → map again (client navigation, the same session): it does not open by itself.
    await page.getByRole('link', { name: 'Înapoi la Bălți' }).click();
    await expect(visible(page.getByRole('region', { name: ALL_LAKES }))).toBeVisible({ timeout: 20_000 });
    await visible(page.getByRole('link', { name: 'Arată harta' })).click();
    await expect(listHeading(page)).toHaveText(/în această zonă/, { timeout: 25_000 });
    await page.waitForTimeout(800);
    await expect(dialog).toBeHidden();
  });

  test('lakes.results-map.c21 lakes.results-map.s9 · Locația mea with location off → the services dialog', async ({ page }) => {
    await openMap(page, '', PHONE, 'services_off');
    const dialog = page.getByRole('dialog', { name: 'Activează serviciile de locație' });
    await page.getByRole('button', { name: 'Locația mea' }).click();
    await expect(dialog).toBeVisible();
  });

  test('lakes.results-map.s2 · «Se încarcă…» on the map while a pan refreshes the list', async ({ page }) => {
    await openMap(page, '', DESKTOP);
    await page.route(/localhost:1337\/api\/lakes\/in-bbox/, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
      await route.fulfill({ response: res });
    });
    await page.getByRole('button', { name: 'Mărește', exact: true }).click();
    await expect(page.getByText('Se încarcă…', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Se încarcă…', { exact: true })).toBeHidden({ timeout: 20_000 });
  });

  test('lakes.results-map.c9 · the pins fail: said in the live region, retried from the map', async ({ page }) => {
    let fail = true;
    await openMap(page, '', DESKTOP, 'prompt', () =>
      page.route(/localhost:1337\/api\/lakes\/map-clusters/, async (route) => {
        if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
        await route.fulfill({ response: res });
      }),
    );
    const retry = page.getByRole('button', { name: 'Încearcă din nou' });
    await expect(retry).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Bălțile nu s-au încărcat pe hartă', { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Bălțile nu s-au încărcat pe hartă.' })).toHaveCount(1, { timeout: 5_000 });
    fail = false;
    await retry.click();
    await expect(page.locator('[data-t2-pin], button[aria-label$="mărește harta aici"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(retry).toHaveCount(0);
  });

  test('lakes.results-map.c25 · analytics: view, pin tap, card dismiss, locate, clear', async ({ page }) => {
    const events = await recordAnalytics(page);
    await openMap(page, `q=Giurgiu&judet=${GIURGIU}`, PHONE);
    const names = async () => (await events()).map((e) => e.name);
    await expect.poll(names).toContain('lakes_map_results_view');
    const view = (await events()).find((e) => e.name === 'lakes_map_results_view')!;
    expect(view.params).toMatchObject({ search_mode: 'county' });
    expect(typeof view.params.zoom).toBe('number');
    expect((await events()).find((e) => e.name === 'lakes_map_results_focus_applied')!.params).toMatchObject({ mode: 'county', county_id: GIURGIU });
    await clickVisiblePin(page);
    await expect.poll(names).toContain('lakes_map_results_pin_tap');
    // The pin card (it has «Închide»; the list cards have their own «Direcții» too).
    const card = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'Închide' }) });
    await card.getByRole('button', { name: 'Direcții' }).click();
    await expect.poll(names).toContain('lakes_pin_card_open_maps');
    await page.getByRole('dialog', { name: 'Direcții' }).getByRole('button', { name: 'Închide' }).click();
    await card.getByRole('button', { name: 'Închide' }).click();
    await expect.poll(names).toContain('lakes_map_results_pin_card_dismiss');
    await page.getByRole('button', { name: 'Locația mea' }).click();
    await expect.poll(names).toContain('lakes_map_results_locate_me');
    // No position in this browser: the location dialog answers the tap; close it.
    await page.waitForTimeout(500);
    if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
    await visible(page.getByRole('button', { name: /^(Șterge filtre|Resetează)$/ })).click();
    await expect.poll(names).toContain('lakes_map_clear_filters');
  });

  test('lakes.results-map.c21 c22 lakes.results-map.s9 · Locația mea granted: centres on the user, then zooms in', async ({ page }) => {
    await openMap(page, '', DESKTOP, 'granted');
    const locate = page.getByRole('button', { name: 'Locația mea' });
    await expect(locate).toHaveAttribute('aria-pressed', 'true');
    const before = Number((await listHeading(page).textContent())!.match(/\d+/)![0]);
    await locate.click();
    await expect.poll(async () => Number((await listHeading(page).textContent())!.match(/\d+/)![0]), { timeout: 15_000 }).toBeLessThan(before);
  });

  test('lakes.results-map.c2 · back to the Bălți home drops search and filters', async ({ page }) => {
    await openMap(page, 'rezervari=1', PHONE);
    await page.getByRole('link', { name: 'Înapoi la Bălți' }).click();
    await expect(page).toHaveURL(/\/balti$/);
  });

  test('lakes.results-map.c7 · re-applying the same search re-centres the map', async ({ page }) => {
    await openMap(page, `q=Giurgiu&judet=${GIURGIU}`, DESKTOP);
    const county = Number((await listHeading(page).textContent())!.match(/\d+/)![0]);
    await page.getByRole('button', { name: 'Micșorează' }).click();
    await page.getByRole('button', { name: 'Micșorează' }).click();
    await expect.poll(async () => Number((await listHeading(page).textContent())!.match(/\d+/)![0]), { timeout: 15_000 }).toBeGreaterThan(county);
    await visible(page.getByRole('button', { name: /Acum: Giurgiu/ })).click();
    const layer = page.getByRole('dialog', { name: 'Caută în Bălți' });
    await layer.getByRole('combobox').fill('giurgiu');
    await layer.getByRole('listbox', { name: 'Sugestii' }).getByRole('option', { name: /^Giurgiu/ }).click();
    await expect(page).toHaveURL(new RegExp(`q=Giurgiu&judet=${GIURGIU}$`));
    await expect.poll(async () => Number((await listHeading(page).textContent())!.match(/\d+/)![0]), { timeout: 15_000 }).toBe(county);
  });
});
