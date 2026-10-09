import { readFileSync } from 'node:fs';
import path from 'node:path';
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
 *      (lib/reveal-now.ts). Version guard: React's runtime (in the page and in the react-dom-server
 *      builds Next bundles) still takes `requestAnimationFrame` when `$RT` is not a number — a React
 *      upgrade that renames or reshapes the throttle fails here instead of silently bringing the
 *      300 ms back.
 *  p2  Only the upright Nunito face is preloaded; the italic face (app/globals.css) still draws
 *      italic text in Nunito once it is used.
 *  p3  /balti on a phone: the location placeholder takes exactly the box its skeleton reserved,
 *      so the rails under it never move (CLS was 0.065 at 412); the first full rail's first two
 *      photos (the page's LCP) are preloaded for phones only and load eagerly at high priority, and
 *      no photo of the desktop grid hidden at this width is downloaded (its first row's <picture>
 *      picks a blank data: source below 768, its preload is scoped to ≥ 768).
 *  p5  /balti at 1280: the mirror — the grid's first row is eager, high priority, preloaded for
 *      ≥ 768 only; the phone rails (display:none) download nothing.
 *  p4  /balti/harta: no list photo is eager / high priority (A/B: the hint measured nothing while the
 *      list waits for maplibre-gl and the map's bounds).
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
    // Version guard: the reveal runtime React streamed still branches on `$RT` being a number.
    expect(html, `${path}: React's $RC still skips the throttle while $RT is unset`).toContain(RT_BRANCH);
  }
  expect(errors).toEqual([]);
});

/** The branch reveal-now relies on, as React 19.2 writes it in `$RC` (completeBoundaryScript). */
const RT_BRANCH = '"number"!==typeof $RT?requestAnimationFrame';

test('p1 version guard: every react-dom-server build Next bundles keeps the $RT branch', () => {
  // The production server renders with these (stable and experimental channels); the dev server's
  // HTML above only proves the development build.
  const compiled = path.join(process.cwd(), 'node_modules/next/dist/compiled');
  for (const channel of ['react-dom', 'react-dom-experimental']) {
    for (const runtime of ['node', 'edge']) {
      const file = path.join(compiled, channel, 'cjs', `react-dom-server.${runtime}.production.js`);
      expect(readFileSync(file, 'utf8'), `${channel} ${runtime}`).toContain(RT_BRANCH);
    }
  }
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

  test('p3 the location placeholder fills the reserved box; the first rail’s photos load first, the hidden grid’s are never fetched', async ({ page }) => {
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
    for (const i of [0, 1]) {
      await expect(imgs.nth(i)).toHaveAttribute('fetchpriority', 'high');
      await expect(imgs.nth(i)).toHaveAttribute('loading', 'eager');
    }
    await expect(imgs.nth(2)).not.toHaveAttribute('fetchpriority', 'high');
    await expect(imgs.nth(2)).toHaveAttribute('loading', 'lazy');
    await page.waitForLoadState('networkidle');
    // The rail's photos really loaded (not the blank source).
    expect(await imgs.first().evaluate((i: HTMLImageElement) => i.currentSrc)).not.toMatch(/^data:/);
    // The desktop grid's first row (display:none here) is eager, but its <picture> picks the blank
    // data: source below 768: nothing downloaded.
    await expectPriorityPhotos(page, { hidden: page.locator('[data-balti-grid]'), media: PHONE_MEDIA });
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  });
});

const PHONE_MEDIA = '(max-width: 767.98px)';
const WIDE_MEDIA = '(min-width: 768px)';

/**
 * The image preloads are media-scoped (an HTML <link>, or the Link header for a srcset-less one —
 * React emits either), and the hidden layout's eager photos resolved to the blank source.
 */
async function expectPriorityPhotos(page: Page, { hidden, media }: { hidden: ReturnType<Page['locator']>; media: string }) {
  const hiddenEager = hidden.locator('img[loading="eager"]');
  expect(await hiddenEager.count(), 'the hidden layout still holds its eager first photos').toBeGreaterThan(0);
  for (const src of await hiddenEager.evaluateAll((list) => list.map((i) => (i as HTMLImageElement).currentSrc))) expect(src).toMatch(/^data:image\/gif/);
  const res = await page.request.get(page.url());
  const header = res.headers()['link'] ?? '';
  const html = await res.text();
  const medias = [
    ...[...header.matchAll(/as="image"[^,]*?media="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]*rel="preload"[^>]*as="image"[^>]*>/g)].map((m) => /media="([^"]+)"/.exec(m[0])?.[1] ?? ''),
  ];
  // The same HTML serves both layouts: this layout's photos are preloaded under its media query
  // (the browser skips a preload whose media does not match), and no preload is unscoped.
  expect(medias, 'this layout’s LCP photos are preloaded').toContain(media);
  for (const m of medias) expect([PHONE_MEDIA, WIDE_MEDIA]).toContain(m);
}

test('p5 /balti at 1280: the grid’s first row is preloaded for wide screens and eager; the hidden rails fetch nothing', async ({ page }) => {
  await patchGrants(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/balti');
  const grid = page.locator('[data-balti-grid]').first();
  const imgs = grid.locator('img');
  await expect(imgs.first()).toBeVisible();
  for (const i of [0, 1, 2, 3]) {
    await expect(imgs.nth(i)).toHaveAttribute('fetchpriority', 'high');
    await expect(imgs.nth(i)).toHaveAttribute('loading', 'eager');
  }
  await expect(imgs.nth(4)).toHaveAttribute('loading', 'lazy');
  await page.waitForLoadState('networkidle');
  expect(await imgs.first().evaluate((i: HTMLImageElement) => i.currentSrc)).not.toMatch(/^data:/);
  // The phone rails (display:none here): their eager photos resolved to the blank source.
  await expectPriorityPhotos(page, { hidden: page.locator('main .md\\:hidden'), media: WIDE_MEDIA });
});

test('p4 /balti/harta: no list photo is eager or high priority while the list waits for the map', async ({ page }) => {
  // M8-B4 A/B (docs/reviews/M8-notes.md): with the first two photos eager + fetchPriority=high the
  // simulated LCP was 9.39 s, without 9.33 s (5 runs each) — the list waits for maplibre-gl and the
  // map's first bounds, so the hint only competed with the map's chunks. It comes back with a
  // server-rendered first list page.
  await patchGrants(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/balti/harta');
  const cards = page.locator('[data-row-info]').locator('xpath=..');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const first = cards.first().locator('img').first();
  await expect(first).toHaveAttribute('loading', 'lazy');
  await expect(first).not.toHaveAttribute('fetchpriority', 'high');
});
