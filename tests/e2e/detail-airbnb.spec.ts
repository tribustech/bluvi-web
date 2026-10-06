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
 *    has scrolled away. The public water's map is its media band (from 1024 two thirds of it).
 *  - rule 1, first screen: at 1440×900 and 1280×800 the summary card's price line and main action
 *    are on screen (the grid's height gives way to the window).
 *  - from 768 the DOM reads as the screen does: title → actions → photos (WCAG 1.3.2 / 2.4.3).
 *  - rule 3, phone: the pinned title + chip rows never float: while the site bar slides away they
 *    take the top edge, while it is shown they sit right under it — at rest and mid-slide. Run in
 *    Chromium AND in WebKit as an iPhone 13 (playwright.config `webkit-iphone`): the bar and the
 *    rows move by one mechanism (their sticky `top`, one transition, one <html> flag) — iOS is
 *    where a translate-driven bar used to leave the `top`-driven rows behind.
 * Local CMS on :1337; the demo /dev/templates/t3 covers the 3 / 4 / 5+ photo layouts.
 */

const LAKE = process.env.E2E_LAKE_FULL ?? 'g14bobjsal2dbks2jg38v0oi'; // Balta Belin: 2 photos, a price, a phone, coordinates, no online booking
const ONE_PHOTO = process.env.E2E_LAKE_ONE_PHOTO ?? 'mvjlgripabbi23rb2pa6n6uy'; // Iaz Suharau: 1 photo + photographed catches
const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e'; // online booking on the rates model (12h tours from 06:00 / 18:00), no legacy price rows
const BLANK_DESCRIPTION = process.env.E2E_LAKE_BLANK_DESCRIPTION ?? 'vhz6iywr0hdl5rhztohf7ioe'; // Balta Palat Căciulați: the description is one empty paragraph
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
    await expect(summary).toContainText(/de la\s*\d+\s*RON/);
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
    const fills = page.locator('[data-t3="photo-fill"]');
    const [box, photo] = [await grid.boundingBox(), await grid.locator('li').first().boundingBox()];
    const tiles = await Promise.all((await fills.all()).map(f => f.boundingBox()));
    // The photo takes ~2/3, the catches stacked in the rest (Suharau: two), together the grid's full height.
    expect(photo!.width / box!.width).toBeGreaterThan(0.6);
    expect(photo!.width / box!.width).toBeLessThan(0.7);
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) expect(t!.x).toBeGreaterThan(photo!.x + photo!.width);
    const top = Math.min(...tiles.map(t => t!.y));
    const bottom = Math.max(...tiles.map(t => t!.y + t!.height));
    expect(Math.round(top)).toBe(Math.round(box!.y));
    expect(Math.round(bottom)).toBe(Math.round(box!.y + box!.height));
    // The same height as the 5-photo grid: 320 (768); from 1024 min(the step, 100dvh − 532) = 368 at 900 tall.
    expect(Math.round(box!.height)).toBe(width >= 1024 ? 368 : 320);
    // The pill says 3 (1 photo + 2 catches): so does the one control, to the gallery.
    await expect(page.getByRole('link', { name: /^Vezi toate fotografiile \(\d+\)$/ })).toHaveAttribute('href', `/balti/${ONE_PHOTO}/galerie`);
  });
}

const LONE_MAP = process.env.E2E_LAKE_LONE_MAP ?? 'c3xpxz8po84i4wnvzl3hv98o'; // QA Balta Blocaje: 1 photo, no catches, coordinates
const MANY_CATCHES = process.env.E2E_LAKE_MANY_CATCHES ?? 'fc6zivinbzuf5uwu3k4rqzhf'; // Balta Alesteu: 1 photo + hundreds of catch photos

test('owner rule 1 — a lone photo beside the map: no «Vezi toate fotografiile» (count 1), no «Hartă» pill on the tile, one map on the page', async ({ page }) => {
  await open(page, `/balti/${LONE_MAP}`, { width: 1440, height: 900 });
  const tile = page.getByTestId('lake-hero-map');
  await expect(tile).toBeVisible();
  await expect(tile).not.toContainText('Hartă');
  await expect(page.getByRole('link', { name: /^Vezi toate fotografiile/ })).toHaveCount(0);
  // Locație & contact does not show the same map a second time from 768.
  await expect(page.getByTestId('lake-mini-map')).toBeHidden();
});

test('owner rule 1 — catches top a short set up to one large + four small', async ({ page }) => {
  await open(page, `/balti/${MANY_CATCHES}`, { width: 1440, height: 900 });
  const grid = page.locator('[data-t3="photo"] ul');
  await expect(grid.locator('> li')).toHaveCount(5);
  const [box, lead] = [await grid.boundingBox(), await grid.locator('> li').first().boundingBox()];
  expect(Math.round(lead!.height)).toBe(Math.round(box!.height));
  expect(lead!.width / box!.width).toBeGreaterThan(0.45);
  expect(lead!.width / box!.width).toBeLessThan(0.55);
  for (const t of await grid.locator('[data-t3="photo-fill"]').all()) expect((await t.boundingBox())!.height).toBeLessThan(box!.height / 2);
});

test('owner rule 1 — phone: a bottom bar with the price and the main action once the hero has scrolled away', async ({ page }) => {
  await open(page, `/balti/${LAKE}`, PHONE);
  const bar = page.getByRole('region', { name: 'Rezervare' });
  // At the top the hero carries the booking control («Vreau să rezerv online» here — no online
  // booking, lakes.detail.c6 web_note): the bar waits off-screen, inert.
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
  test(`owner rule 1 — public water at ${width}: title → the map as the rounded media band (inside the gutters) → two columns; Direcții and the facts in the summary card`, async ({ page }) => {
    await open(page, `/ape-publice/${WATER}`, { width, height: 900 });
    const summary = page.getByRole('complementary', { name: 'Pe scurt' });
    const band = page.locator('[data-t3="photo"]');
    await expect(band).toBeVisible();
    await expect(band).toHaveCSS('border-radius', '16px');
    const [box, title] = [(await band.boundingBox())!, (await page.locator('h1').boundingBox())!];
    // Inside the gutters (not the full-bleed slab), under the title row, a real band (≥240px).
    expect(box.x).toBeGreaterThanOrEqual(24);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 24);
    expect(box.y).toBeGreaterThan(title.y + title.height);
    expect(box.height).toBeGreaterThanOrEqual(240);
    await expect(band.getByRole('link', { name: /^Deschide harta pentru/ })).toHaveAttribute('href', /\/ape-publice\/.+\/harta/);
    await expect(summary.getByRole('link', { name: /^Deschide harta pentru/ })).toHaveCount(0);
    await expect(summary.getByRole('button', { name: 'Direcții' })).toBeVisible();
    // The two columns start under the band.
    expect((await summary.boundingBox())!.y).toBeGreaterThan(box.y + box.height);
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
  for (const [lake, kind] of [[LAKE, 'call'], [CHITA, 'book']] as const) {
    test(`owner rule 1 — first screen at ${width}×${height} (${kind}): the price line and the main action are in view`, async ({ page }) => {
      await open(page, `/balti/${lake}`, { width, height });
      const summary = page.getByRole('complementary', { name: 'Pe scurt' });
      const price = summary.getByTestId('summary-price');
      const main =
        kind === 'call'
          ? summary.getByRole('link', { name: 'Sună' })
          : summary.getByRole('button', { name: 'Rezervă acum' }).or(summary.getByRole('link', { name: 'Rezervă acum' }));
      for (const el of [price, main]) {
        const box = await el.boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      }
      // Rules 7 + 10: the signature number is big (the map card's t-display), the unit smaller beside it.
      const px = (l: typeof price) => l.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(await px(price)).toBeGreaterThanOrEqual(30);
      expect(await px(summary.locator('[data-price-unit]'))).toBeLessThan(await px(price));
    });
  }
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

for (const width of [1024, 1440]) {
  test(`owner rule 1 — a real lake whose description is one empty paragraph, at ${width}: no empty card on top, no chip to it`, async ({ page }) => {
    await open(page, `/balti/${BLANK_DESCRIPTION}`, { width, height: 900 });
    await expect(page.locator('#prezentare')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Descriere' })).toHaveCount(0);
    await expect(page.locator('[data-t3="chips"] a[href="#prezentare"]')).toBeHidden();
    // The first card of the content column is a real section.
    const first = await page.evaluate(() => {
      const main = document.querySelector('#recenzii')!.parentElement!;
      const shown = [...main.children].find(c => c instanceof HTMLElement && c.getClientRects().length > 0 && c.id);
      return shown?.id ?? null;
    });
    expect(first).not.toBe('prezentare');
  });
}

test('rates-model lake (Chita): «de la» from the booking quote (no legacy rows), on the card and the phone bar, never the pinned title', async ({ page }) => {
  // The CMS sends no rates with the lake: the price is the server's own quote for the shortest tour
  // (priceFrom.ts) — the same answer the booking sheet gets.
  const quote = await page.request.post(`${CMS}/feed/lakes/${CHITA}/quote`, {
    data: { data: { stand: await firstStand(page, CHITA), startDate: inDays(3, 6), endDate: inDays(3, 18), extras: [] } },
  });
  const total = (await quote.json()).data.total as number;
  expect(total).toBeGreaterThan(0);
  await open(page, `/balti/${CHITA}`, { width: 1440, height: 900 });
  const summary = page.getByRole('complementary', { name: 'Pe scurt' });
  // Rule 10: the number, then «RON / tura de 12 ore» as its own smaller unit.
  await expect(summary).toContainText(/de la\s*\d+\s*RON \/ tura de \d+ ore/);
  // The cheapest tour of the week: never above one real quote.
  const shown = Number((await summary.getByTestId('summary-price').textContent())!.replace(/\D/g, ''));
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThanOrEqual(total);
  await expect(summary).not.toContainText('alege standul și intervalul');
  await open(page, `/balti/${CHITA}`, PHONE);
  await page.mouse.move(180, 400);
  await page.mouse.wheel(0, 900);
  const bar = page.getByRole('region', { name: 'Rezervare' });
  await expect(bar).not.toHaveAttribute('inert', '');
  const name = (await page.locator('h1').textContent())!.trim();
  await expect(bar).not.toContainText(name);
  await expect(bar).toContainText(new RegExp(`de la\\s*${shown} RON`));
  await expect(bar.getByRole('button', { name: 'Rezervă acum' }).or(bar.getByRole('link', { name: 'Rezervă acum' }))).toBeVisible();
});

for (const width of [1280, 1440]) {
  test(`summary card at ${width}: one stand count (the bookable stands, never beside the CMS «N locuri»), one way to Partide`, async ({ page }) => {
    const lake = (await (await page.request.get(`${CMS}/feed/lakes/${ONE_PHOTO}`)).json()).data as { stands?: unknown[] };
    await open(page, `/balti/${ONE_PHOTO}`, { width, height: 900 });
    const summary = page.getByRole('complementary', { name: 'Pe scurt' });
    await expect(summary.getByRole('button', { name: 'Rezervă acum' }).or(summary.getByRole('link', { name: 'Rezervă acum' }))).toBeVisible();
    const text = (await summary.textContent()) ?? '';
    if (lake.stands?.length) {
      expect(text).toContain(`${lake.stands.length} ${lake.stands.length === 1 ? 'stand rezervabil' : 'standuri rezervabile'}`);
      expect(text).not.toMatch(/\d+ locuri/);
    }
    expect(text).not.toMatch(/\d+ standuri ·/);
    // The Partide section's «Vezi tot» is its one link: no card chip, no outline button from 768.
    if (await page.locator('#partide').isVisible()) {
      await expect(summary.getByRole('link', { name: 'Partide' })).toHaveCount(0);
      await expect(page.locator('#partide').getByRole('link', { name: 'Vezi toate partidele' })).toBeHidden();
    }
    // Concursuri: never two «Vezi tot» going to different pages.
    const concursuri = page.locator('#concursuri');
    if (await concursuri.isVisible()) {
      const hrefs = await concursuri.getByRole('link', { name: 'Vezi tot', exact: true }).evaluateAll(as => as.map(a => a.getAttribute('href')));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs.length).toBeLessThanOrEqual(1);
    }
  });
}

const CMS = process.env.CMS_URL ?? 'http://localhost:1337/api';

async function firstStand(page: Page, lake: string): Promise<string> {
  const res = await page.request.get(`${CMS}/feed/lakes/${lake}`);
  return (await res.json()).data.stands[0].documentId;
}

/** «YYYY-MM-DDTHH:00:00» in Bucharest, `days` from today (summer +03:00 / winter +02:00). */
function inDays(days: number, hour: number): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(Date.now() + days * 86_400_000))
      .map(x => [x.type, x.value]),
  );
  const probe = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  const local = new Date(probe.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }));
  const off = Math.round((local.getTime() - new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) / 3_600_000);
  return `${p.year}-${p.month}-${p.day}T${String(hour).padStart(2, '0')}:00:00+0${off}:00`;
}

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

/**
 * Every frame for 700ms: the pinned rows' gap to the bar's bottom (or the top edge), once they are
 * pinned; `midSlide` counts the frames caught while the bar was partly on screen.
 */
const sampleSlide = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ gaps: number[]; midSlide: number }>(resolve => {
        const gaps: number[] = [];
        let midSlide = 0;
        const t0 = performance.now();
        const tick = () => {
          const bar = document.querySelector('header')!.getBoundingClientRect();
          const el = document.querySelector<HTMLElement>('[data-t3="chips"]')!;
          const nav = el.getBoundingClientRect();
          // Only while the rows are pinned: their box at their own (sliding) sticky `top`. A row
          // still in flow below the header band is not a header yet, wherever it is.
          if (Math.abs(nav.top - (parseFloat(getComputedStyle(el).top) || 0)) <= 0.5) {
            gaps.push(Math.round(nav.top - Math.max(0, bar.bottom)));
            if (bar.bottom > 0.5 && bar.bottom < 55.5) midSlide += 1;
          }
          if (performance.now() - t0 < 700) requestAnimationFrame(tick);
          else resolve({ gaps, midSlide });
        };
        requestAnimationFrame(tick);
      }),
  );

for (const path of [`/balti/${LAKE}`, `/ape-publice/${WATER}`]) {
  test(`owner rule 3 — ${path} phone: the pinned rows stay attached to the bar or the top edge, at rest and mid-slide`, async ({ page, isMobile }) => {
    await open(page, path, PHONE);
    // Down: the bar slides away; sample every frame while it moves, then at rest.
    await scroll(page, 900, isMobile);
    const down = await sampleSlide(page);
    expect(down.gaps.length).toBeGreaterThan(0);
    expect(down.midSlide).toBeGreaterThan(0);
    expect(Math.max(...down.gaps.map(Math.abs))).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.querySelector('header')!.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    expect(await pinnedGap(page)).toBe(0);
    // Up a little: the bar comes back, the rows ride down with it frame by frame, then sit right under it.
    await scroll(page, -200, isMobile);
    const up = await sampleSlide(page);
    expect(up.midSlide).toBeGreaterThan(0);
    expect(Math.max(...up.gaps.map(Math.abs))).toBeLessThanOrEqual(1);
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

test('owner rule 8 — a section reached from the chip row by keyboard takes focus without a ring; the chip keeps its own', async ({ page }) => {
  await open(page, `/balti/${LAKE}`, { width: 768, height: 900 });
  const chip = page.locator('[data-t3="chips"] a[data-section="recenzii"]');
  await chip.focus();
  await page.keyboard.press('Enter');
  const section = page.locator('#recenzii');
  await expect(section).toBeFocused();
  await expect(section).toHaveCSS('outline-style', 'none');
  // Rings stay for keyboard focus on controls.
  await page.keyboard.press('Shift+Tab');
  await chip.focus();
  await expect(chip).not.toHaveCSS('outline-style', 'none');
});

for (const [width, height] of [[375, 740], [1280, 800], [1440, 900]] as const) {
  test(`owner rule 20 — ${width}px: the section switcher is one container (segmented track on phone, tab bar ≥768) with a strong selected state`, async ({ page }) => {
    await open(page, `/balti/${LAKE}`, { width, height });
    const nav = page.locator('nav[data-t3="chips"]');
    const chips = nav.locator('a[data-section]');
    expect(await chips.count()).toBeGreaterThan(1);
    // Every chip in the same track.
    expect(await nav.locator('[data-t3-section-track]').count()).toBe(1);
    expect(await nav.locator('[data-t3-section-track] a[data-section]').count()).toBe(await chips.count());
    const current = nav.locator('a[aria-current="location"]');
    await expect(current).toHaveCount(1);
    if (width < 768) {
      // The track is one filled surface; the selected chip is filled, the others are not.
      await expect(nav.locator('[data-t3-section-track]')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(current).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(chips.and(page.locator(':not([aria-current])')).first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    } else {
      // A tab bar: no pills; the selected tab's underline sits on the nav's bottom edge.
      for (const chip of await chips.all()) if (await chip.isVisible()) await expect(chip).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const underline = await current.evaluate(el => {
        const a = getComputedStyle(el, '::after');
        return { h: parseFloat(a.height), bg: a.backgroundColor };
      });
      expect(underline.h).toBeGreaterThanOrEqual(2);
      expect(underline.bg).not.toBe('rgba(0, 0, 0, 0)');
      const [n, c] = [(await nav.boundingBox())!, (await current.boundingBox())!];
      expect(Math.abs(n.y + n.height - (c.y + c.height))).toBeLessThanOrEqual(2);
    }
  });
}
