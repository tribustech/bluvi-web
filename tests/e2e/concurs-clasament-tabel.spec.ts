import { collectConsoleErrors } from './helpers/console';
import { expect, test, type Page } from '@playwright/test';

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

test('§4b.11 — no catch reads «–» in the weight, never «capot» (desktop table and phone rows)', async ({ page }) => {
  await open(page, ID.noCatch);
  const table = page.getByRole('region', { name: 'Clasament general' });
  const row = table.locator('tbody tr').filter({ hasText: 'Audit Pescar' });
  await expect(row.getByText('Fără capturi')).toHaveClass(/sr-only/);
  await expect(row.locator('td span[aria-hidden]').filter({ hasText: /^–$/ }).first()).toBeAttached();
  // (The competition's own name, «[AUDIT] Podium capot», is data; the ranking's UI says no «capot».)
  await expect(page.getByRole('region', { name: 'Clasament' }).first()).not.toContainText(/capot/i);
  await expect(page.getByRole('list', { name: 'Legendă' })).toContainText('fără capturi');

  await open(page, ID.noCatch, PHONE);
  const list = page.getByRole('list', { name: 'Clasament' });
  const item = list.getByRole('listitem').filter({ hasText: 'Audit Pescar' });
  await expect(item).toContainText('0 capturi');
  await expect(item.locator('span[aria-hidden]').filter({ hasText: /^–$/ })).toBeVisible();
  await expect(item.getByText('Fără capturi')).toHaveClass(/sr-only/);
  // Phone: no avatars in the ranking (no room), and still no «capot».
  await expect(page.locator('[data-ranking-face]:visible')).toHaveCount(0);
  await expect(list).not.toContainText(/capot/i);
});

test('§4b.12 §4b.13 — feeder General: coloured header rows, each leg’s stand stripe, avatars', async ({ page }) => {
  await open(page, ID.feeder);
  const table = page.getByRole('region', { name: 'Clasament general' });
  await expect(table.locator('tbody tr')).toHaveCount(20);
  expect(await table.locator('thead th').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe(HEAD_BG);
  expect(await table.locator('thead tr').nth(1).locator('th').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe(HEAD_BG);
  // Two legs → two Stand cells per row, each with its sector's 4px edge.
  await expect(table.locator('tbody tr').first().locator('td > span.absolute.w-1')).toHaveCount(2);
  await expect(table.locator('[data-ranking-face]')).toHaveCount(20);
  await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('Voicu Ionel si Ivan Gabriel');
});

test('§4b.12 §4b.13 — club ranking (NC): coloured header, a sector stripe per team, avatars', async ({ page }) => {
  await open(page, ID.nc);
  const table = page.getByRole('region', { name: 'Clasament pe cluburi' });
  await expect(table).toBeVisible();
  expect(await bg(page, '[aria-label="Clasament pe cluburi"] thead th')).toBe(HEAD_BG);
  await expect(table.locator('tbody tr td > span.absolute.w-1')).toHaveCount(18);
  await expect(table.locator('[data-ranking-face]')).toHaveCount(18);
});
