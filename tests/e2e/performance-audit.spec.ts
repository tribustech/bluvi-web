import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt } from './helpers/session';

/*
 * global.b.performance-audit (M8-B4, docs/parity/areas/global.yml): the fixes the Lighthouse audit
 * made, each pinned where the dev server can prove it. The numbers themselves (LCP, CLS, TBT, JS
 * bytes per page) come from the production build: scripts/lighthouse-urls.mjs, `lhci collect`,
 * scripts/lighthouse-summary.mjs and scripts/lighthouse-bundles.mjs (docs/reviews/M8-notes.md
 * «m8.perf-audit»).
 *
 *  p1  Suspense boundaries are revealed on the next frame, not 300 ms after the shell: the
 *      reveal-now script is in <head>, before React's streaming runtime, React's `$RT` throttle
 *      timestamp stays unset after the page streamed in, and every boundary is revealed
 *      (lib/reveal-now.ts).
 *  p2  Only the upright Nunito face is preloaded; the italic face (app/globals.css) still draws
 *      italic text in Nunito once it is used.
 *  p3  /balti on a phone: the location placeholder takes exactly the box its skeleton reserved,
 *      so the rails under it never move (CLS was 0.065 at 412); the first full rail's first two
 *      photos (the page's LCP) load at high priority, and no photo of the desktop grid hidden at
 *      this width is downloaded (it stays lazy, and no image preload: a preload ignores display:none).
 *  p4  /balti/harta: the list's first card photo loads eagerly at high priority.
 *
 * Read-only: nothing is written. The local Public role misses the lakes grants (balti-list.spec.ts
 * header): those GETs are re-sent with the QA bearer, as there.
 */

const PHONE = { width: 412, height: 823 };
const AUDITED = ['/', '/balti', '/concursuri', '/stiri', '/partide'];

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

async function patchGrants(page: Page) {
  await page.route(/localhost:1337\/api\/lakes\//, async (route) => {
    const res = await route.fetch({ headers: { ...route.request().headers(), authorization: `Bearer ${jwt}` } });
    await route.fulfill({ response: res });
  });
}

test('p1 reveal-now runs before React’s streaming runtime and React’s reveal throttle stays off', async ({ page, request }) => {
  const errors = collectConsoleErrors(page);
  for (const path of AUDITED) {
    // The document as streamed: the script sits in <head>, before every inline script of React's
    // runtime (the shell's `$RT` timestamp and each boundary's `$RC`), which are in <body>.
    const html = await (await request.get(path)).text();
    const ours = html.indexOf("Object.defineProperty(window,'$RT'");
    const head = html.indexOf('</head>');
    const shellTime = html.indexOf('$RT=performance.now()');
    expect(ours, path).toBeGreaterThan(0);
    expect(ours, `${path}: in <head>`).toBeLessThan(head);
    if (shellTime > 0) expect(ours, `${path}: before React's runtime`).toBeLessThan(shellTime);

    await page.goto(path);
    await page.waitForLoadState('load');
    const probe = await page.evaluate(() => ({
      rt: typeof (window as unknown as { $RT?: unknown }).$RT,
      // React's runtime ran (a boundary was streamed): the throttle had something to throttle.
      runtime: typeof (window as unknown as { $RC?: unknown }).$RC,
      // Nothing is left behind a pending boundary.
      pending: document.querySelectorAll('template[id^="B:"]').length,
    }));
    expect(probe.rt, path).toBe('undefined');
    expect(probe.runtime, `${path}: React streamed at least one boundary`).toBe('function');
    expect(probe.pending, `${path}: every streamed boundary was revealed`).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('p2 only the upright Nunito face is preloaded; italic text still uses Nunito italic', async ({ page }) => {
  await page.goto('/stiri');
  const preloads = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((l) => l.href),
  );
  expect(preloads).toHaveLength(1);
  expect(preloads[0]).not.toMatch(/italic/i);
  // Draw italic text: the face loads on use and is the family's italic (not a synthesized oblique).
  const italic = await page.evaluate(async () => {
    const em = document.createElement('em');
    em.textContent = 'Șțăîâ italic';
    em.style.fontFamily = 'var(--font-nunito)';
    document.body.append(em);
    const faces = await document.fonts.load('italic 400 16px nunito', 'Șțăîâ');
    return faces.map((f) => ({ style: f.style, status: f.status }));
  });
  expect(italic).toContainEqual({ style: 'italic', status: 'loaded' });
});

test.describe('p3 /balti phone', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

  test('p3 the location placeholder fills the reserved box; the first rail’s photos load first, the hidden grid’s stay lazy', async ({ page }) => {
    await patchGrants(page);
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/balti');
    const placeholder = page.locator('section[aria-labelledby="balti-nearby-title"] button');
    await expect(placeholder).toBeVisible();
    // min-h-55: the skeleton's box (NEARBY_CARD_BOX) — the card is exactly as tall, not taller.
    expect(Math.round((await placeholder.boundingBox())!.height)).toBe(220);
    const firstRail = page.locator('main [data-lake-id]').first().locator('xpath=ancestor::ul[1]');
    const imgs = firstRail.locator('img');
    await expect(imgs.first()).toBeVisible();
    // High priority, but still lazy and no preload: the desktop grid in the same page (display:none
    // here) must not be fetched on a phone, nor these rails on a desktop.
    for (const i of [0, 1]) await expect(imgs.nth(i)).toHaveAttribute('fetchpriority', 'high');
    await expect(imgs.nth(2)).not.toHaveAttribute('fetchpriority', 'high');
    // The desktop grid's first row (display:none here) keeps its lazy loading, so a phone never
    // downloads it; nothing is preloaded (a preload ignores display:none).
    const grid = page.locator('[data-balti-grid] img');
    if (await grid.count()) await expect(grid.first()).toHaveAttribute('loading', 'lazy');
    const preloads = await page.locator('link[rel="preload"][as="image"]').count();
    expect(preloads).toBe(0);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

test('p4 /balti/harta: the list’s first card photo loads eagerly at high priority', async ({ page }) => {
  await patchGrants(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/balti/harta');
  const cards = page.locator('[data-row-info]').locator('xpath=..');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const first = cards.first().locator('img').first();
  await expect(first).not.toHaveAttribute('loading', 'lazy');
  await expect(first).toHaveAttribute('fetchpriority', 'high');
  const third = cards.nth(2).locator('img').first();
  if (await third.count()) await expect(third).toHaveAttribute('loading', 'lazy');
});
