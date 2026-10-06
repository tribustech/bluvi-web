import { collectConsoleErrors } from './helpers/console';
import { expect, test, type Page } from '@playwright/test';
import { qaJwt, signIn } from './helpers/session';

/*
 * Concurs · every ranking table's look — owner rules ROADMAP §4b.11–13 (2026-10-06):
 *  - 11: the UI never says «capot»: «–» in the weight, «Fără capturi» for a screen reader / where a
 *    word is needed;
 *  - 12: every ranking table (standard, Best-N, feeder, club ranking) has a coloured header row,
 *    hairline rows and the sector stripe;
 *  - 13: from 768 every person / team row shows its avatar (photo, or initials) beside the name.
 * Local CMS on :1337. Override the ids with E2E_COMPETITION_* when the local data moves.
 */

const ID = {
  /** completed bestOfTiers, 5 anglers in sector A; Alesia has a profile photo, the guests none. */
  bestOfTiers: process.env.E2E_COMPETITION_BEST_OF_TIERS ?? 'wyjmy091opw9wat92j7i9xc5',
  /** quantity, 2 anglers: Sim QA with a catch, Audit Pescar without («[AUDIT] Podium capot»). */
  noCatch: process.env.E2E_COMPETITION_NO_CATCH ?? 'g29m8wrngu8uf35mnpu9dadf',
  feeder: process.env.E2E_COMPETITION_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr',
  /** live quantity, 24 anglers (A1–X1): no catch columns. */
  quantity: process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  nc: process.env.E2E_COMPETITION_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
};

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };
/** RANKING_HEAD: accent-tint-2 (#E0E7FF) — never the page grey or the card's white. */
const HEAD_BG = 'rgb(224, 231, 255)';

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, id: string, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  const errors = collectConsoleErrors(page);
  const res = await page.goto(`/concursuri/${id}`, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
  return errors;
}

const bg = (page: Page, selector: string) => page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor);

test('§4b.12 §4b.13 — standard table: coloured header (Best-N block a step deeper), sector stripe, avatars beside the names', async ({ page }) => {
  const errors = await open(page, ID.bestOfTiers);
  const table = page.getByRole('region', { name: 'Clasament general' });
  await expect(table).toBeVisible();
  const heads = table.locator('thead th');
  await expect(heads.first()).toHaveText(/Stand/);
  expect(await heads.first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe(HEAD_BG);
  // The Best-N header keeps its own deeper band.
  expect(await table.locator('thead th.bg-indigo-4').first().evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(HEAD_BG);
  // Hairline rows and the sector stripe on every row.
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(5);
  expect(await rows.nth(1).locator('td').first().evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('1px');
  await expect(table.locator('tbody tr td:first-child > span.absolute.w-1')).toHaveCount(5);
  // Avatars: the photo when the angler has one, the initials otherwise — not part of the cell's text.
  const alesia = table.getByRole('rowheader', { name: 'Alesia Maria Radulescu' });
  await expect(alesia.locator('[data-ranking-face] img')).toHaveAttribute('src', /^https:\/\//);
  const gigel = table.getByRole('rowheader', { name: 'Gigel' });
  await expect(gigel.locator('[data-initials="GI"]')).toBeVisible();
  await expect(gigel).toHaveText('Gigel');
  await expect(table.locator('[data-ranking-face]')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('§4b.11 — no catch reads «–» in the weight, never «capot» (desktop table and phone table)', async ({ page }) => {
  await open(page, ID.noCatch);
  const table = page.getByRole('region', { name: 'Clasament general' });
  const row = table.locator('tbody tr').filter({ hasText: 'Audit Pescar' });
  await expect(row.getByText('Fără capturi')).toHaveClass(/sr-only/);
  await expect(row.locator('td span[aria-hidden]').filter({ hasText: /^–$/ }).first()).toBeAttached();
  // (The competition's own name, «[AUDIT] Podium capot», is data; the ranking's UI says no «capot».)
  await expect(page.getByRole('region', { name: 'Clasament' }).first()).not.toContainText(/capot/i);
  await expect(page.getByRole('list', { name: 'Legendă' })).toContainText('fără capturi');

  // The phone draws the kit table too (MobileRanking): the no-catch row is a <tr>, «–» in Cantitate.
  await open(page, ID.noCatch, PHONE);
  const phone = page.getByRole('region', { name: 'Clasament general', exact: true }).locator('visible=true');
  const tr = phone.locator('tbody tr').filter({ hasText: 'Audit Pescar' });
  await expect(tr).toHaveCount(1);
  const heads = await phone.locator('thead th').allInnerTexts();
  const quantity = heads.findIndex(h => /Cantitate/.test(h));
  expect(quantity).toBeGreaterThan(-1);
  const cell = tr.locator('> *').nth(quantity);
  await expect(cell.locator('span[aria-hidden]')).toHaveText('–');
  await expect(cell.getByText('Fără capturi')).toHaveClass(/sr-only/);
  // Phone: no avatars in the ranking (no room), and still no «capot».
  await expect(page.locator('[data-ranking-face]:visible')).toHaveCount(0);
  await expect(phone).not.toContainText(/capot/i);
});

/** fish's colours (app/globals.css): the plain grey head, TOTAL_COLOR, LEG_COLORS. */
const PLAIN_HEAD = 'rgb(241, 243, 248)';
const TOTAL = 'rgb(57, 73, 171)';
const LEG = ['rgb(21, 101, 192)', 'rgb(0, 121, 107)'];

test('§4b.12 §4b.13 §4b.15 — feeder General: fish’s heads (plain Loc / Echipă, Total, a colour per leg), each group’s colour rule on the rows, avatars', async ({ page }) => {
  await open(page, ID.feeder);
  const table = page.getByRole('region', { name: 'Clasament general' });
  await expect(table.locator('tbody tr')).toHaveCount(20);
  const top = table.locator('thead tr').first().locator('th');
  const colour = (i: number) => top.nth(i).evaluate(el => getComputedStyle(el).backgroundColor);
  await expect(top.nth(0)).toHaveText('Loc');
  await expect(top.nth(0)).toHaveClass(/bg-rank-plain-head/);
  expect(await colour(0)).toBe(PLAIN_HEAD);
  await expect(top.nth(1)).toHaveClass(/bg-rank-plain-head/);
  expect(await colour(1)).toBe(PLAIN_HEAD);
  await expect(top.nth(2)).toHaveText('Total');
  await expect(top.nth(2)).toHaveClass(/bg-rank-total/);
  expect(await colour(2)).toBe(TOTAL);
  await expect(top.nth(3)).toHaveText('Manșa 1');
  expect(await colour(3)).toBe(LEG[0]);
  await expect(top.nth(4)).toHaveText('Manșa 2');
  expect(await colour(4)).toBe(LEG[1]);
  // Every row: each leg's group opens with a 2px rule in that leg's colour (fish's leg columns).
  const rules = await table
    .locator('tbody tr')
    .first()
    .locator('td')
    .evaluateAll(tds => tds.map(td => getComputedStyle(td)).filter(c => c.borderLeftWidth === '2px').map(c => c.borderLeftColor));
  expect(rules).toEqual([TOTAL, ...LEG]);
  await expect(table.locator('[data-ranking-face]')).toHaveCount(20);
  await expect(table.locator('tbody tr').first().locator('td').first()).toContainText('Voicu Ionel si Ivan Gabriel');
});

test('§4b.12 §4b.13 §4b.15 — club ranking (NC): coloured header, one club edge per club on its merged cell, avatars', async ({ page }) => {
  await open(page, ID.nc);
  const table = page.getByRole('region', { name: 'Clasament pe cluburi' });
  await expect(table).toBeVisible();
  expect(await bg(page, '[aria-label="Clasament pe cluburi"] thead th')).toBe(HEAD_BG);
  const clubs = table.locator('tbody th[scope="rowgroup"]');
  const count = await clubs.count();
  expect(count).toBeGreaterThan(1);
  await expect(table.locator('tbody th[scope="rowgroup"] > span.absolute.w-1')).toHaveCount(count);
  // The edge is the club's own colour (each rowgroup sets --sector): solid, never transparent.
  const edge = await table.locator('tbody th[scope="rowgroup"] > span.absolute.w-1').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(edge).not.toBe('rgba(0, 0, 0, 0)');
  await expect(table.locator('tbody tr')).toHaveCount(18);
  await expect(table.locator('[data-ranking-face]')).toHaveCount(18);
});

test('§4b.15 — a quantity ranking on a 375 phone: Stand, the name, Cantitate and Loc on the first screen (the deciding columns pinned at the right)', async ({ page }) => {
  await open(page, ID.quantity, PHONE);
  const region = page.getByRole('region', { name: 'Clasament general', exact: true }).locator('visible=true');
  await expect(region.locator('tbody tr').first()).toBeVisible();
  await expect(region.locator('xpath=..')).toHaveAttribute('data-wide', 'true');
  const box = (await region.boundingBox())!;
  const head = (title: RegExp) => region.locator('thead th').filter({ hasText: title });
  const inView = async (title: RegExp) => {
    const b = (await head(title).boundingBox())!;
    return b.x >= box.x - 1 && b.x + b.width <= box.x + box.width + 1;
  };
  // The two deciding columns close the table and stay pinned at its right edge.
  await expect.poll(() => inView(/^Cantitate$/)).toBe(true);
  expect(await inView(/^Poziție generală$/)).toBe(true);
  const loc = (await head(/^Poziție generală$/).boundingBox())!;
  expect(Math.abs(loc.x + loc.width - (box.x + box.width))).toBeLessThanOrEqual(1.5);
  // The name beside them is not covered: its text ends before Cantitate starts.
  const quantityX = (await head(/^Cantitate$/).boundingBox())!.x;
  const name = (await region.locator('tbody tr').first().locator('th[scope="row"] > span').boundingBox())!;
  expect(name.x + name.width).toBeLessThanOrEqual(quantityX + 1);
  // Scrolled to the end, Cantitate and Loc are still where they were.
  await region.evaluate(el => el.scrollTo({ left: el.scrollWidth }));
  await expect.poll(async () => Math.abs((await head(/^Cantitate$/).boundingBox())!.x - quantityX)).toBeLessThanOrEqual(1);
});

test('§4b.17 — from 1024 a ranking row opens the person popover anchored to it (standard, feeder, club ranking); never the docked panel', async ({ page }) => {
  for (const [id, region] of [
    [ID.quantity, 'Clasament general'],
    [ID.feeder, 'Clasament general'],
    [ID.nc, 'Clasament pe cluburi'],
  ] as const) {
    await open(page, id);
    const table = page.getByRole('region', { name: region, exact: true }).locator('visible=true');
    const row = table.locator('tbody tr').nth(1);
    await expect(row).toHaveAttribute('data-pressable', '');
    await row.locator('td').last().click();
    const popover = page.locator('[data-person-popover]');
    await expect(popover).toBeVisible();
    await expect(popover.getByRole('heading')).not.toBeEmpty();
    expect(new URL(page.url()).searchParams.get('pescar')).toBeNull();
    // Escape closes it and gives the focus back to the row.
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(row).toBeFocused();
    // Keyboard: Enter on the focused row opens it again.
    await page.keyboard.press('Enter');
    await expect(popover).toBeVisible();
  }
});

test('competition-page.statistici-pescar.c1 — a club ranking (NC) row pressed on the phone opens the angler sheet', async ({ page }) => {
  await open(page, ID.nc, PHONE);
  const table = page.getByRole('region', { name: 'Clasament pe cluburi', exact: true }).locator('visible=true');
  const row = table.locator('tbody tr').nth(1);
  await expect(row).toHaveAttribute('data-stand-id', /\d+/);
  await row.locator('td').nth(1).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('pescar')).not.toBeNull();
  await expect(page.locator('[data-person-popover]')).toHaveCount(0);
});

test('the viewer’s own row is marked over the sector fills, inline and in «Clasament complet»', async ({ page, request, context }) => {
  await signIn(context, await qaJwt(request));
  await open(page, ID.noCatch);
  const table = page.getByRole('region', { name: 'Clasament general', exact: true }).locator('visible=true');
  const mine = table.locator('tbody tr[data-me]');
  await expect(mine).toHaveCount(1);
  await expect(mine.locator('th[scope="row"]')).toContainText('Tu · ');
  // Every cell carries the accent rules, the filled ones too (a row background alone hides under them).
  const marked = await mine.locator('> *').evaluateAll(cells => cells.map(c => getComputedStyle(c).backgroundImage.includes('linear-gradient')));
  expect(marked.every(Boolean)).toBe(true);
  await page.getByRole('button', { name: 'Clasament complet' }).locator('visible=true').first().click();
  const full = page.getByRole('dialog').getByRole('region', { name: 'Clasament complet' });
  await expect(full.locator('tbody tr[data-me] th[scope="row"]')).toContainText('Tu · ');
});
