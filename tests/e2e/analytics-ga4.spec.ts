import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS } from './helpers/session';

/*
 * m8.ga4 — GA4 behind the cookie consent, the page_view tracker and the data-analytics-* listener
 * (components/analytics, lib/analytics). Parity global.b.screen-view-analytics, home.b.analytics and
 * the areas' *.b.analytics (their events reach GA4 through lib/analytics track()).
 *
 * GA4 itself is on only in production or with NEXT_PUBLIC_ANALYTICS_DEBUG (fish isCollectionEnabled).
 * The shared dev server runs WITHOUT NEXT_PUBLIC_GA4_ID (it is never restarted to inject one), so
 * this spec proves the «off» path end to end: no gtag script and no collect, before and after
 * «Accept toate». The «on» path (loader once after opt-in, consent default / update, config,
 * page_view once per navigation, events with fish params, refusal → disable flag + _ga cookies
 * deleted) is proven in jsdom by components/analytics/ga4.test.ts with a test id.
 * Google's hosts are route-mocked: nothing ever reaches GA. No CMS writes, no Firestore.
 */

const PREVIEW = { name: 'bluvi_consent_preview', value: 'all', domain: new URL(BASE_URL).hostname, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const };

const LAKE_A = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';
const LAKE_B = process.env.E2E_LAKE_FULL ?? 'g14bobjsal2dbks2jg38v0oi';

test.describe.configure({ timeout: 90_000 });
test.use({ trace: 'off' });
test.skip(Boolean(process.env.NEXT_PUBLIC_GA4_ID), 'this spec covers the «off» path; with an id see components/analytics/ga4.test.ts');

type Evt = { name: string; params: Record<string, string | number | boolean> };

/** Mocks Google's tag and collect hosts and records every hit (there must be none). */
async function mockGoogle(page: Page) {
  const hits: string[] = [];
  await page.route(/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/, (route) => {
    hits.push(route.request().url());
    return route.fulfill({ status: 204, body: '' });
  });
  return hits;
}

/** Collects the page_view and analytics CustomEvents from the first script on. */
async function recordEvents(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __views: unknown[]; __events: unknown[] };
    w.__views = [];
    w.__events = [];
    window.addEventListener('bluvi:page-view', (e) => w.__views.push((e as CustomEvent).detail));
    window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
  });
}
const views = (page: Page) => page.evaluate(() => (window as unknown as { __views: Evt[] }).__views);
const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: Evt[] }).__events);

async function gaState(page: Page) {
  return page.evaluate(() => ({
    scripts: document.querySelectorAll('script[src*="googletagmanager.com"]').length,
    gtag: typeof (window as unknown as { gtag?: unknown }).gtag,
    dataLayer: typeof (window as unknown as { dataLayer?: unknown }).dataLayer,
  }));
}

async function push(page: Page, href: string) {
  await page.evaluate((h) => (window as unknown as { next: { router: { push: (x: string) => void } } }).next.router.push(h), href);
  await page.waitForURL((u) => u.pathname === href, { timeout: 30_000 });
}

const banner = (page: Page) => page.getByRole('region', { name: 'Consimțământ cookie-uri' });

test.describe('no decision yet (banner shown via the dev preview cookie)', () => {
  test.use({ storageState: { cookies: [PREVIEW], origins: [] } });

  test('m8.ga4 no consent → no gtag script, no collect; «Accept toate» with no GA4 id on this server → still none', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ }); // a local CMS photo that 404s is not this unit's
    const hits = await mockGoogle(page);
    await page.goto(`/balti/${LAKE_A}`);
    await expect(banner(page)).toBeVisible();
    expect(await gaState(page)).toEqual({ scripts: 0, gtag: 'undefined', dataLayer: 'undefined' });

    await banner(page).getByRole('button', { name: 'Accept toate' }).click();
    await expect(banner(page)).toBeHidden();
    const consent = (await page.context().cookies()).find((c) => c.name === 'bluvi_consent');
    expect(JSON.parse(decodeURIComponent(consent!.value))).toMatchObject({ analytics: true });
    await push(page, `/balti/${LAKE_B}`);
    await page.waitForTimeout(500);
    expect(await gaState(page)).toEqual({ scripts: 0, gtag: 'undefined', dataLayer: 'undefined' });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await gaState(page)).toEqual({ scripts: 0, gtag: 'undefined', dataLayer: 'undefined' });
    expect(hits).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('m8.ga4 refusing after accepting deletes _ga / _ga_* (and loads nothing)', async ({ page, context }) => {
    const hits = await mockGoogle(page);
    await page.goto('/');
    await banner(page).getByRole('button', { name: 'Accept toate' }).click();
    const host = new URL(BASE_URL).hostname;
    await context.addCookies([
      { name: '_ga', value: 'GA1.1.1.1', domain: host, path: '/' },
      { name: '_ga_TEST1234', value: 'GS1.1.1', domain: host, path: '/' },
    ]);
    await page.goto('/cookie-uri');
    await page.getByRole('button', { name: 'Refuz toate' }).first().click();
    await expect.poll(async () => (await context.cookies()).filter((c) => c.name.startsWith('_ga')).map((c) => c.name)).toEqual([]);
    expect(JSON.parse(decodeURIComponent((await context.cookies()).find((c) => c.name === 'bluvi_consent')!.value))).toMatchObject({ analytics: false });
    expect(await gaState(page)).toMatchObject({ scripts: 0, gtag: 'undefined' });
    expect(hits).toEqual([]);
  });
});

test.describe('page_view tracker (global.b.screen-view-analytics)', () => {
  test('one page_view per navigation: lake A → lake B = 2, a re-render of the same route = 1, fish names and ids', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ }); // a local CMS photo that 404s is not this unit's
    const hits = await mockGoogle(page);
    await recordEvents(page);
    await page.goto(`/balti/${LAKE_A}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(async () => (await views(page)).length).toBe(1);
    expect((await views(page))[0]).toEqual({
      name: 'page_view',
      params: { screen_name: 'Lake Page', screen_class: 'Lake Page', page_path: `/balti/${LAKE_A}`, lake_id: LAKE_A },
    });

    // Re-renders of the same route (a dialog opens and closes, the viewport changes): still one.
    await page.getByRole('button', { name: 'Distribuie balta' }).locator('visible=true').first().click();
    const share = page.getByRole('dialog', { name: 'Distribuie balta' });
    await expect(share).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(share).toBeHidden();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    expect(await views(page)).toHaveLength(1);

    await push(page, `/balti/${LAKE_B}`);
    await expect.poll(async () => (await views(page)).map((v) => v.params.lake_id), { timeout: 30_000 }).toEqual([LAKE_A, LAKE_B]);
    // A subpage of the same lake is another screen: one more, with fish's name.
    await push(page, `/balti/${LAKE_B}/galerie`);
    await expect.poll(async () => (await views(page)).length, { timeout: 30_000 }).toBe(3); // a cold dev compile
    expect((await views(page))[2].params).toEqual({ screen_name: 'Lake Gallery', screen_class: 'Lake Gallery', page_path: `/balti/${LAKE_B}/galerie`, lake_id: LAKE_B });
    // The page channel stays the screens' own: page views never land in bluvi:analytics.
    expect((await events(page)).filter((e) => e.name === 'page_view')).toEqual([]);
    expect(await gaState(page)).toMatchObject({ scripts: 0, gtag: 'undefined' });
    expect(hits).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("an angler's page reports the route pattern, never the person's id", async ({ page }) => {
    await mockGoogle(page);
    await recordEvents(page);
    await page.goto('/pescari/nu-exista-pescar');
    await expect.poll(async () => (await views(page)).length).toBe(1);
    expect((await views(page))[0].params).toEqual({ screen_name: 'Angler Profile', screen_class: 'Angler Profile', page_path: '/pescari/[id]' });
  });
});

test.describe('page_view follows the URL, one per fish screen (global.b.screen-view-analytics)', () => {
  const LIVE = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';
  const COMPLETED = process.env.E2E_COMPETITION_COMPLETED ?? 'uxxie29m6820wrpdv45w0m7q';

  test('a URL moved with history.pushState (Next keeps the old router tree) is reported as the new screen and path', async ({ page }) => {
    await mockGoogle(page);
    await recordEvents(page);
    await page.goto(`/balti/${LAKE_A}`);
    await expect.poll(async () => (await views(page)).length).toBe(1);
    // What a screen's in-place switch does (Next patches pushState → ACTION_RESTORE: usePathname moves, the layout segments / params do not).
    await page.evaluate((href) => window.history.pushState(null, '', href), `/balti/${LAKE_A}/galerie`);
    await expect.poll(async () => (await views(page)).length).toBe(2);
    expect((await views(page))[1].params).toEqual({ screen_name: 'Lake Gallery', screen_class: 'Lake Gallery', page_path: `/balti/${LAKE_A}/galerie`, lake_id: LAKE_A });
  });

  test('Competitions List: Viitoare → Live (history.replaceState) is the same fish screen, no second page_view', async ({ page }) => {
    await mockGoogle(page);
    await recordEvents(page);
    await page.goto('/concursuri/viitoare');
    await expect.poll(async () => (await views(page)).length).toBe(1);
    expect((await views(page))[0].params).toEqual({ screen_name: 'Competitions List', screen_class: 'Competitions List', page_path: '/concursuri/viitoare' });
    await page.getByRole('tab', { name: /^Live/ }).click();
    await page.waitForURL((u) => u.pathname === '/concursuri/live');
    await page.getByRole('tab', { name: /^Rezultate/ }).click();
    await page.waitForURL((u) => u.pathname === '/concursuri/rezultate');
    await page.waitForTimeout(500);
    expect(await views(page)).toHaveLength(1);
    // Another screen and back: the list counts again, at its current path.
    await push(page, `/balti/${LAKE_A}`);
    await push(page, '/concursuri/live');
    await expect.poll(async () => (await views(page)).map((v) => v.params.page_path), { timeout: 30_000 }).toEqual(['/concursuri/viitoare', `/balti/${LAKE_A}`, '/concursuri/live']);
  });

  test('Competition Page: its tabs are one screen (clasament → Cântare → informații = 1), another competition = 1 more', async ({ page }) => {
    await mockGoogle(page);
    await recordEvents(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/concursuri/${LIVE}/clasament`);
    await expect.poll(async () => (await views(page)).length).toBe(1);
    expect((await views(page))[0].params).toMatchObject({ screen_name: 'Competition Page', competition_id: LIVE });
    await page.getByRole('tablist', { name: 'Vederi clasament' }).locator('visible=true').getByRole('tab', { name: /^Cântare/ }).click();
    await page.waitForURL((u) => u.pathname === `/concursuri/${LIVE}/cantare`);
    await push(page, `/concursuri/${LIVE}/informatii`);
    await page.waitForTimeout(500);
    expect(await views(page)).toHaveLength(1);
    await push(page, `/concursuri/${COMPLETED}/clasament`);
    await expect.poll(async () => (await views(page)).map((v) => v.params.competition_id), { timeout: 30_000 }).toEqual([LIVE, COMPLETED]);
  });
});

test.describe('data-analytics-* listener (home.b.analytics)', () => {
  test('a link carrying data-analytics-event logs its event and params once', async ({ page }) => {
    const hits = await mockGoogle(page);
    await recordEvents(page);
    await page.goto('/stiri');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The markup RichText writes on a news / sponsor link (app/(site)/stiri/_content/RichText.tsx),
    // clicked on an inner element: the delegated listener finds the closest marked ancestor.
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#test-link';
      a.dataset.analyticsEvent = 'news_link_clicked';
      a.dataset.analyticsParams = JSON.stringify({ newsId: 'n1', url: 'https://bluvi.ro' });
      a.innerHTML = '<strong>Link de test</strong>';
      document.body.appendChild(a);
      a.querySelector('strong')!.click();
      a.remove();
    });
    await expect.poll(async () => (await events(page)).filter((e) => e.name === 'news_link_clicked')).toEqual([
      { name: 'news_link_clicked', params: { newsId: 'n1', url: 'https://bluvi.ro' } },
    ]);
    expect(hits).toEqual([]);
  });
});

/** Keeps the page: the click is counted (capture phase), the navigation itself is not needed. */
async function holdNavigation(page: Page) {
  await page.evaluate(() => document.addEventListener('click', (e) => (e.target as Element).closest('a[href]') && e.preventDefault()));
}

test.describe('fish events carried as data-analytics-* (home.b.analytics, competition-page.b.analytics)', () => {
  const SPONSORED = process.env.E2E_TABS_SPONSORS ?? 'vdsjq8ulsmwnr2b77j6q3jp4';
  const UPCOMING = process.env.E2E_COMPETITION_UPCOMING_OWN ?? 'a6xjl65ooe9eadrtvvqj9hn1';

  test('Acasă «Sponsori»: a chip logs sponsor_dashboard { sponsor_id, sponsor_name, sponsor_url }', async ({ page, request }) => {
    await mockGoogle(page);
    const sponsors = (await (await request.get(`${CMS}/feed/sponsors/dashboard`)).json()).data as { documentId: string; name: string; url: string | null }[];
    test.skip(!sponsors?.length, 'no sponsor in the local CMS');
    await recordEvents(page);
    await page.goto('/');
    const chip = page.locator(`a[href="/sponsori/${sponsors[0].documentId}"]`).locator('visible=true').first();
    await chip.scrollIntoViewIfNeeded();
    await holdNavigation(page);
    await chip.click();
    const params: Record<string, string> = { sponsor_id: sponsors[0].documentId, sponsor_name: sponsors[0].name };
    if (sponsors[0].url) params.sponsor_url = sponsors[0].url;
    await expect.poll(async () => (await events(page)).filter((e) => e.name === 'sponsor_dashboard')).toEqual([{ name: 'sponsor_dashboard', params }]);
  });

  test('competition preview: «Vezi toate informațiile» / «Vezi toate înscrierile» log ranking_viewInfo / ranking_viewRegister', async ({ page }) => {
    await mockGoogle(page);
    await recordEvents(page);
    await page.goto(`/concursuri/${UPCOMING}`);
    const info = page.getByRole('link', { name: 'Vezi toate informațiile' }).locator('visible=true').first();
    test.skip(!(await info.count()), 'the upcoming fixture has no preview');
    await holdNavigation(page);
    await info.click();
    await page.getByRole('link', { name: 'Vezi toate înscrierile' }).locator('visible=true').first().click();
    await expect
      .poll(async () => (await events(page)).filter((e) => e.name.startsWith('ranking_view')))
      .toEqual([
        { name: 'ranking_viewInfo', params: { event_class: 'Competition Page', event_name: 'see_Info_button' } },
        { name: 'ranking_viewRegister', params: { event_class: 'Competition Page', event_name: 'see_register_button' } },
      ]);
  });

  test('competition contact: a phone logs contact_pressed «Competition phone contact» { competition_id, competition_name }', async ({ page, request }) => {
    const id = process.env.E2E_TABS_CONTACTS ?? 'u9kd3xs4n91j2ktah78ke73q';
    await mockGoogle(page);
    const res = await request.get(`${CMS}/feed/competitions/${id}`);
    test.skip(!res.ok(), 'the contacts fixture is not in the local CMS');
    const name = ((await res.json()).data as { name: string }).name;
    await recordEvents(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/concursuri/${id}/informatii`);
    const tel = page.getByRole('complementary', { name: 'Contact și sponsori' }).locator('a[href^="tel:"]').first();
    test.skip(!(await tel.count()), 'no phone on the contacts fixture');
    await holdNavigation(page);
    await tel.click();
    await expect
      .poll(async () => (await events(page)).filter((e) => e.name === 'contact_pressed'))
      .toEqual([{ name: 'contact_pressed', params: { contact_type: 'Competition phone contact', competition_id: id, competition_name: name } }]);
  });

  test('competition «Informații» sponsors: a sponsor logs sponsor_competition_screen', async ({ page, request }) => {
    await mockGoogle(page);
    const res = await request.get(`${CMS}/feed/competitions/${SPONSORED}`);
    test.skip(!res.ok(), 'the sponsored fixture is not in the local CMS');
    await recordEvents(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/concursuri/${SPONSORED}/informatii`);
    const aside = page.getByRole('complementary', { name: 'Contact și sponsori' });
    const link = aside.locator('a[href^="/sponsori/"]').first();
    await expect(link).toBeVisible();
    const sponsorId = (await link.getAttribute('href'))!.split('/').pop()!;
    await holdNavigation(page);
    await link.click();
    await expect
      .poll(async () => (await events(page)).filter((e) => e.name === 'sponsor_competition_screen').map((e) => e.params.sponsor_id))
      .toEqual([sponsorId]);
    expect((await events(page)).find((e) => e.name === 'sponsor_competition_screen')!.params.sponsor_name).toBeTruthy();
  });
});

test('m8.ga4 axe unaffected after an opt-in at 375 and 1280', async ({ page, context }) => {
  await mockGoogle(page);
  const accepted = encodeURIComponent(JSON.stringify({ v: 1, analytics: true, errors: false, at: '2026-10-09T00:00:00.000Z' }));
  await context.addCookies([PREVIEW, { ...PREVIEW, name: 'bluvi_consent', value: accepted }]);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/balti/${LAKE_A}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  }
});
