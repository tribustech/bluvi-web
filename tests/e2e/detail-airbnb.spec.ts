import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';

/*
 * Owner design rules 1 and 3 (ROADMAP §4b, 2026-10-06) on the T3 detail pages with photos / a map:
 * the lake (/balti/[id]) and the public water (/ape-publice/[id]).
 *  - rule 1, desktop (≥1024): title row → photo grid (one large + up to four small; ONE photo never
 *    spans the width — catches / the map fill its right third; one height whatever the count; one
 *    «Vezi toate fotografiile (N)» to the gallery) → two columns, the content left and a sticky
 *    summary card right (price, the main action, contact, key facts) and no quick-action tiles.
 *    Phone keeps the fish hero, plus a bottom bar with the price and the main action once the hero
 *    has scrolled away. The public water's map sits in its summary card from 1024.
 *  - rule 1, first screen: at 1440×900 and 1280×800 the summary card's price line and main action
 *    are on screen (the grid's height gives way to the window).
 *  - from 768 the DOM reads as the screen does: title → actions → photos (WCAG 1.3.2 / 2.4.3).
 *  - rule 3, phone: the pinned title + chip rows never float: while the site bar slides away they
 *    take the top edge, while it is shown they sit right under it — at rest and mid-slide. Run in
 *    Chromium AND in WebKit as an iPhone 13 (playwright.config `webkit-iphone`): the rows follow
 *    the bar as a compositor transform, which is where iOS used to lag.
 * Local CMS on :1337; the demo /dev/templates/t3 covers the 3 / 4 / 5+ photo layouts.
 */

const LAKE = process.env.E2E_LAKE_FULL ?? 'g14bobjsal2dbks2jg38v0oi'; // Balta Belin: 2 photos, a price, a phone, coordinates, no online booking
const ONE_PHOTO = process.env.E2E_LAKE_ONE_PHOTO ?? 'mvjlgripabbi23rb2pa6n6uy'; // Iaz Suharau: 1 photo + photographed catches
const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e'; // online booking on the rates model, no legacy price rows
const WATER = 2245; // Snagov
const PHONE = { width: 375, height: 740 };

const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

async function open(page: Page, path: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);
}

/** The pinned rows' gap to the bar (or to the top edge when the bar is away), in px; 0 = attached. */
const pinnedGap = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('header')!.getBoundingClientRect();
    const nav = document.querySelector('[data-t3="chips"]')!.getBoundingClientRect();
    return Math.round(nav.top - Math.max(0, bar.bottom));
  });

for (const width of [1024, 1440]) {
  test(`owner rule 1 — lake at ${width}: title row, photo grid, content left and a sticky summary card right`, async ({ page }) => {
    await open(page, `/balti/${LAKE}`, { width, height: 900 });
    const h1 = page.getByRole('heading', { level: 1 });
    const grid = page.locator('[data-t3="photo"]');
    const summary = page.getByRole('complementary', { name: 'Pe scurt' });
    // Order: the title row, then the photos under it, then the body.
    const [title, photos] = [await h1.boundingBox(), await grid.boundingBox()];
    expect(photos!.y).toBeGreaterThan(title!.y);
    // The grid: radius 16, inside the gutters (never full bleed).
    expect(photos!.x).toBeGreaterThanOrEqual(24);
    await expect(grid.locator('ul')).toHaveCSS('border-radius', '16px');
    // Two columns: the summary card right of the content, with the price, the booking, call + directions.
    const [content, card] = [await page.locator('#recenzii').boundingBox(), await summary.boundingBox()];
    expect(card!.x).toBeGreaterThan(content!.x + content!.width);
    await expect(summary).toContainText(/de la\s*\d+ RON/);
    // No online booking: the card says so once (the pill), «Sună» is the filled action and the
    // fish demand signal a secondary «Vreau să rezerv online».
    await expect(summary.getByText('Fără rezervări online')).toBeVisible();
    await expect(summary).not.toContainText('nu acceptă încă rezervări');
    await expect(summary.getByRole('link', { name: 'Sună' })).toHaveAttribute('href', /^tel:/);
    await expect(summary.getByRole('link', { name: 'Sună' })).toHaveClass(/bg-accent(?!-)/);
    await expect(summary.getByRole('button', { name: 'Vreau să rezerv online' })).toBeVisible();
    await expect(summary.getByRole('button', { name: 'Rezervă acum' })).toHaveCount(0);
    await expect(summary.getByRole('button', { name: 'Direcții' })).toBeVisible();
    await expect(summary).toContainText('Suprafață');
    // The booking lives in the card: the header keeps only «Distribuie»; the tiles are gone.
    await expect(page.locator('[data-t3="header"]').getByRole('button', { name: 'Rezervă acum' })).toBeHidden();
    await expect(page.getByRole('list', { name: 'Acțiuni rapide' })).toBeHidden();
    // Sticky: deep in the page the card is still in view, under the bar and the chips.
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(600);
    const stuck = await summary.boundingBox();
    expect(stuck!.y).toBeGreaterThanOrEqual(64 + 58);
    expect(stuck!.y).toBeLessThan(900);
    await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas-container'] });
  });
}

test('owner rule 1 — one «Vezi toate fotografiile (N)» to the gallery; every grid tile opens the lightbox; Escape closes it', async ({ page }) => {
  await open(page, `/balti/${LAKE}`, { width: 1280, height: 900 });
  const dialog = page.locator('dialog[open]');
  // One control from 768 (the phone's count pill is gone), the photos + catches, the gallery page.
  const all = page.getByRole('link', { name: /^Vezi toate fotografiile \(\d+\)$/ });
  await expect(all).toHaveAttribute('href', `/balti/${LAKE}/galerie`);
  await expect(page.getByRole('link', { name: /^Galerie:/ })).toBeHidden();
  await page.getByRole('button', { name: 'Deschide fotografia 1 din 2' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/1 din 2/);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Deschide fotografia 2 din 2' }).click();
  await expect(dialog).toContainText(/2 din 2/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Deschide fotografia 2 din 2' })).toBeFocused();
});

for (const width of [768, 1280, 1440]) {
  test(`owner rule 1 — one photo at ${width}: never the full width, the grid's one height, the right third filled`, async ({ page }) => {
    await open(page, `/balti/${ONE_PHOTO}`, { width, height: 900 });
    const grid = page.locator('[data-t3="photo"] ul');
    const [box, photo, fill] = [
      await grid.boundingBox(),
      await grid.locator('li').first().boundingBox(),
      await page.locator('[data-t3="photo-fill"]').boundingBox(),
    ];
    // The photo takes ~2/3, the fill the rest, both the grid's full height.
    expect(photo!.width / box!.width).toBeGreaterThan(0.6);
    expect(photo!.width / box!.width).toBeLessThan(0.7);
    expect(fill!.x).toBeGreaterThan(photo!.x + photo!.width);
    expect(Math.round(fill!.height)).toBe(Math.round(box!.height));
    // The same height as the 5-photo grid: 320 (768); from 1024 min(the step, 100dvh − 532) = 368 at 900 tall.
    expect(Math.round(box!.height)).toBe(width >= 1024 ? 368 : 320);
    // The pill says 3 (1 photo + 2 catches): so does the one control, to the gallery.
    await expect(page.getByRole('link', { name: /^Vezi toate fotografiile \(\d+\)$/ })).toHaveAttribute('href', `/balti/${ONE_PHOTO}/galerie`);
  });
}

test('owner rule 1 — phone: a bottom bar with the price and the main action once the hero has scrolled away', async ({ page }) => {
  await open(page, `/balti/${LAKE}`, PHONE);
  const bar = page.getByRole('region', { name: 'Rezervare' });
  // At the top the hero carries «Rezervă acum»: the bar waits off-screen, inert.
  await expect(bar).toHaveAttribute('inert', '');
  await page.mouse.move(180, 400);
  await page.mouse.wheel(0, 700);
  await expect(bar).not.toHaveAttribute('inert', '');
  await expect.poll(async () => Math.round((await bar.boundingBox())!.y + (await bar.boundingBox())!.height)).toBe(PHONE.height);
  await expect(bar).toContainText(/de la\s*\d+ RON/);
  // Belin takes no online bookings and has a phone: «Sună».
  await expect(bar.getByRole('link', { name: 'Sună' })).toHaveAttribute('href', /^tel:/);
});

test('owner rule 1 — phone keeps the fish hero: full-bleed photo strip, no grid buttons, no summary column', async ({ page }) => {
  await open(page, `/balti/${LAKE}`, PHONE);
  const hero = await page.locator('[data-t3="photo"]').boundingBox();
  expect(hero!.x).toBe(0);
  expect(hero!.width).toBe(PHONE.width);
  await expect(page.getByRole('button', { name: /Vezi toate fotografiile/ })).toBeHidden();
  await expect(page.getByRole('complementary', { name: 'Pe scurt' })).toBeHidden();
});

for (const width of [1280, 1440]) {
  test(`owner rule 1 — public water at ${width}: no full-width map slab; the map, Direcții and the facts in the summary card`, async ({ page }) => {
    await open(page, `/ape-publice/${WATER}`, { width, height: 900 });
    const summary = page.getByRole('complementary', { name: 'Pe scurt' });
    await expect(page.locator('[data-t3="photo"]')).toBeHidden();
    const map = summary.getByRole('link', { name: /^Deschide harta pentru/ });
    await expect(map).toHaveAttribute('href', /\/ape-publice\/.+\/harta/);
    await expect(summary.locator('[data-t3="water-map"]')).toHaveCSS('border-radius', '16px');
    await expect(summary.getByRole('button', { name: 'Direcții' })).toBeVisible();
    const [content, card] = [await page.locator('#locatie').boundingBox(), await summary.boundingBox()];
    expect(card!.x).toBeGreaterThan(content!.x + content!.width);
    // As the lake: no quick-action tiles from 1024 (Prezentare leaves with them); Partide /
    // Statistici are the card's compact buttons; «Distribuie» in the header.
    await expect(page.getByRole('heading', { name: 'Acțiuni rapide' })).toBeHidden();
    await expect(page.locator('#prezentare')).toBeHidden();
    await expect(page.locator('[data-t3="chips"] a[href="#prezentare"]')).toBeHidden();
    const more = summary.getByRole('list', { name: 'Mai multe despre apă' });
    await expect(more.getByRole('link', { name: /^Partide/ })).toHaveAttribute('href', /\/ape-publice\/.+\/partide/);
    await expect(more.getByRole('link', { name: 'Statistici' })).toHaveAttribute('href', /\/ape-publice\/.+\/statistici/);
    await expect(page.locator('[data-t3="header"]').getByRole('button', { name: 'Distribuie' })).toBeVisible();
    // One map entry per area: no Hartă / Direcții tiles, no «Vezi apa pe hartă» in Locație.
    await expect(page.locator('[data-action="harta"]')).toBeHidden();
    await expect(page.locator('#prezentare').getByRole('button', { name: 'Direcții' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Deschide apa pe hartă' })).toBeHidden();
    await expect(page.getByRole('link', { name: /^Deschide harta pentru/ }).locator('visible=true')).toHaveCount(1);
  });
}

test('public water phone: back and share over the map, before the title in the DOM', async ({ page }) => {
  await open(page, `/ape-publice/${WATER}`, PHONE);
  const share = page.getByRole('button', { name: 'Distribuie apa' });
  await expect(share).toBeVisible();
  const [map, btn] = [await page.locator('[data-t3="photo"]').boundingBox(), await share.boundingBox()];
  expect(btn!.y).toBeLessThan(map!.y + 80);
  expect(await share.evaluate(el => !!(el.compareDocumentPosition(document.querySelector('h1')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`owner rule 1 — first screen at ${width}×${height}: the price line and the main action are in view`, async ({ page }) => {
    await open(page, `/balti/${LAKE}`, { width, height });
    const summary = page.getByRole('complementary', { name: 'Pe scurt' });
    const price = summary.getByText(/^\d+ RON$/);
    const call = summary.getByRole('link', { name: 'Sună' });
    for (const el of [price, call]) {
      const box = await el.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    }
  });
}

test('from 768 the DOM order is the screen order: title → Distribuie → the photo tiles', async ({ page }) => {
  await open(page, `/balti/${ONE_PHOTO}`, { width: 1280, height: 900 });
  const order = await page.evaluate(() => {
    const h1 = document.querySelector('h1')!;
    const share = [...document.querySelectorAll('[data-t3="header"] button')].find(b => b.textContent?.includes('Distribuie'))!;
    const tile = document.querySelector('[data-t3="photo"] button')!;
    const all = [...document.querySelectorAll('[data-t3="photo"] a')].find(a => a.textContent?.includes('Vezi toate fotografiile'))!;
    const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { titleThenShare: before(h1, share), shareThenTile: before(share, tile), titleThenAll: before(h1, all) };
  });
  expect(order).toEqual({ titleThenShare: true, shareThenTile: true, titleThenAll: true });
  // Tab from the title row reaches «Distribuie» before any photo control.
  await page.locator('h1').evaluate(el => {
    el.setAttribute('tabindex', '-1');
    (el as HTMLElement).focus();
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.closest('[data-t3="photo"]') != null);
  expect(focused).toBe(false);
});

test('owner rule 1 — a lake with no description at 1440: no empty Prezentare card, no chip to it', async ({ page }) => {
  await open(page, '/dev/templates/t3?screen=lake&state=empty', { width: 1440, height: 900 });
  await expect(page.locator('#prezentare')).toBeHidden();
  await expect(page.locator('[data-t3="chips"] a[href="#prezentare"]')).toBeHidden();
  // Below 1024 the section keeps its tiles and characteristics, and its chip.
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator('#prezentare')).toBeVisible();
  await expect(page.locator('[data-t3="chips"] a[href="#prezentare"]')).toBeVisible();
});

test('rates-model lake (Chita): no legacy price — the card leads with the stands, the phone bar never repeats the pinned title', async ({ page }) => {
  await open(page, `/balti/${CHITA}`, { width: 1440, height: 900 });
  const summary = page.getByRole('complementary', { name: 'Pe scurt' });
  await expect(summary).toContainText(/\d+ (stand|standuri)\s*· alege standul și intervalul/);
  await open(page, `/balti/${CHITA}`, PHONE);
  await page.mouse.move(180, 400);
  await page.mouse.wheel(0, 900);
  const bar = page.getByRole('region', { name: 'Rezervare' });
  await expect(bar).not.toHaveAttribute('inert', '');
  const name = (await page.locator('h1').textContent())!.trim();
  await expect(bar).not.toContainText(name);
  await expect(bar).toContainText('Rezervare online');
  await expect(bar.getByRole('button', { name: 'Rezervă acum' }).or(bar.getByRole('link', { name: 'Rezervă acum' }))).toBeVisible();
});

/**
 * A wheel scroll where there is a mouse; mobile WebKit (the iPhone project) has none — a smooth
 * programmatic scroll there, which streams scroll events over several frames as a finger does.
 */
async function scroll(page: Page, dy: number, mobile: boolean) {
  if (!mobile) {
    await page.mouse.move(180, 400);
    return page.mouse.wheel(0, dy);
  }
  await page.evaluate(d => window.scrollBy({ top: d, behavior: 'smooth' }), dy);
}

for (const path of [`/balti/${LAKE}`, `/ape-publice/${WATER}`]) {
  test(`owner rule 3 — ${path} phone: the pinned rows stay attached to the bar or the top edge, at rest and mid-slide`, async ({ page, isMobile }) => {
    await open(page, path, PHONE);
    // Down: the bar slides away; sample every frame while it moves, then at rest.
    await scroll(page, 900, isMobile);
    const down = await page.evaluate(
      () =>
        new Promise<number[]>(resolve => {
          const gaps: number[] = [];
          const t0 = performance.now();
          const tick = () => {
            const bar = document.querySelector('header')!.getBoundingClientRect();
            const nav = document.querySelector('[data-t3="chips"]')!.getBoundingClientRect();
            // Only once the rows are pinned (their top is at their sticky offset or above the bar's bottom).
            if (nav.top <= 56.5) gaps.push(Math.round(nav.top - Math.max(0, bar.bottom)));
            if (performance.now() - t0 < 700) requestAnimationFrame(tick);
            else resolve(gaps);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(down.length).toBeGreaterThan(0);
    expect(Math.max(...down.map(Math.abs))).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.querySelector('header')!.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    expect(await pinnedGap(page)).toBe(0);
    // Up a little: the bar comes back, the rows sit right under it again.
    await scroll(page, -200, isMobile);
    await expect.poll(() => page.evaluate(() => document.querySelector('header')!.getBoundingClientRect().top)).toBe(0);
    await page.waitForTimeout(400);
    expect(await pinnedGap(page)).toBe(0);
    // A fast fling to the end and a bounce back up: still attached.
    await scroll(page, 20000, isMobile);
    await page.waitForTimeout(500);
    expect(Math.abs(await pinnedGap(page))).toBeLessThanOrEqual(1);
    await scroll(page, -60, isMobile);
    await page.waitForTimeout(500);
    expect(Math.abs(await pinnedGap(page))).toBeLessThanOrEqual(1);
  });
}
