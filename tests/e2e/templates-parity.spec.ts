import { expect, test, type Page } from '@playwright/test';

/*
 * The template demos the owner approves must be the shipped screens (owner review 2026-10-06: the
 * T1 demo said «Competiții», «Urmărite», had no Județ chip and another bento / aside; the T2 demo had
 * another card). This compares each demo with its production page: the DOM landmarks (h1, tabs,
 * regions, the aside) and the chip sets of the filter bar, plus the list card the page renders.
 */

test.describe.configure({ timeout: 180_000 });
// Other units run Playwright against the same tree: no trace artifacts to collide over.
test.use({ trace: 'off' });

async function landmarks(page: Page) {
  return page.evaluate(() => {
    const shown = (el: Element) => (el as HTMLElement).offsetParent !== null;
    const name = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const main = document.querySelector('main')!;
    const h1 = [...main.querySelectorAll('h1')].map((h) => h.textContent?.trim());
    const tabs = [...main.querySelectorAll('[role="tab"]')].filter(shown).map(name);
    const regions = [...main.querySelectorAll('section[aria-label], section[aria-labelledby], aside[aria-label]')]
      .filter(shown)
      .map((r) => r.getAttribute('aria-label') ?? document.getElementById(r.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? '')
      .filter((n) => n && !/\d/.test(n));
    const bar = [...main.querySelectorAll('[role="group"]')].find((g) => /^Filtre/.test(g.getAttribute('aria-label') ?? '') && shown(g));
    const chips = bar ? [...bar.querySelectorAll('button')].filter(shown).map((b) => b.textContent?.replace(/\s+/g, ' ').trim()) : [];
    return { h1, tabs, regions: [...new Set(regions)].sort(), chips };
  });
}

test('T1 demo = /concursuri/viitoare: the same h1, tabs, regions and filter chips (1280)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // The demo opens on Viitoare (with «În lumina reflectoarelor»); /concursuri itself opens on Live when something is live.
  await page.goto('/concursuri/viitoare');
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'În lumina reflectoarelor' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('group', { name: /^Filtre/ }).first()).toBeVisible({ timeout: 30_000 });
  const prod = await landmarks(page);
  await page.goto('/dev/templates/t1');
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'În lumina reflectoarelor' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('group', { name: /^Filtre/ }).first()).toBeVisible({ timeout: 30_000 });
  // The tab badges (meta.counts) land with the demo's own lists, after the spotlight.
  await expect.poll(async () => (await landmarks(page)).tabs, { timeout: 30_000 }).toEqual(prod.tabs);
  const demo = await landmarks(page);
  expect(demo.h1).toEqual(prod.h1);
  expect(demo.chips).toEqual(prod.chips);
  expect(demo.regions).toEqual(prod.regions);
  expect(prod.chips).toEqual(expect.arrayContaining(['Filtre', 'Județ']));
});

test('T2 demo = /balti/harta: the same switch, filter chips and horizontal list card (1280)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const card = page.locator('[data-lake-row-card]').first();
  await page.goto('/balti/harta');
  await expect(card).toBeVisible({ timeout: 60_000 });
  const prod = await landmarks(page);
  const prodSwitch = await page.getByRole('navigation', { name: 'Tip de apă' }).getByRole('link').allTextContents();
  await page.goto('/dev/templates/t2');
  await expect(card).toBeVisible({ timeout: 60_000 });
  const demo = await landmarks(page);
  expect(await page.getByRole('navigation', { name: 'Tip de apă' }).getByRole('link').allTextContents()).toEqual(prodSwitch);
  expect(demo.chips).toEqual(prod.chips);
  expect(prod.chips.slice(0, 1)).toEqual(['Filtre']);
  // Map left, list right, one horizontal card per row — in both.
  for (const path of ['/balti/harta', '/dev/templates/t2']) {
    await page.goto(path);
    await expect(card).toBeVisible({ timeout: 60_000 });
    const map = (await page.locator('.maplibregl-canvas, [data-t2-map]').first().boundingBox())!;
    const list = (await page.getByRole('region', { name: 'Rezultate' }).boundingBox())!;
    expect(map.x, path).toBeLessThan(list.x);
    const lefts = await page.locator('[data-lake-row-card]').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
    expect(lefts, path).toBe(1);
  }
});
