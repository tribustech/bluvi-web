import { readFileSync } from 'node:fs';
import path from 'node:path';
import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { qaJwt, signIn } from './helpers/session';
import { hydrateRanking, type RankingFixture } from '../fixtures/rankings/hydrate';

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
  await expect(row.getByText('Fără capturi').first()).toHaveClass(/sr-only/);
  await expect(row.locator('td span[aria-hidden]').filter({ hasText: /^–$/ }).first()).toBeAttached();
  // (The competition's own name, «[AUDIT] Podium capot», is data; the ranking's UI says no «capot».)
  await expect(page.getByRole('region', { name: 'Clasament' }).first()).not.toContainText(/capot/i);
  await expect(page.getByRole('list', { name: 'Legendă' })).toContainText('fără capturi');
  // A winner place without a catch is not a winner row: no 90% tint, no trophy (as RankingRow and
  // the feeder podium) — the last one never reads as a winner.
  await expect(row).not.toHaveAttribute('data-winner', /.*/);
  await expect(row.locator('[data-mark]')).toHaveCount(0);
  await expect(row.locator('td.rank-sector-win, th.rank-sector-win')).toHaveCount(0);
  // 24 sectors = 24 winner places (quantity): the sectors without a catch hold some of them, and
  // still read as no-catch rows, not winners.
  await open(page, ID.quantity);
  const live = page.getByRole('region', { name: 'Clasament general', exact: true }).locator('visible=true');
  const empties = live.locator('tbody tr').filter({ has: page.locator('.sr-only', { hasText: 'Fără capturi' }) });
  expect(await empties.count()).toBeGreaterThan(0);
  await expect(empties.and(page.locator('[data-winner]'))).toHaveCount(0);
  await expect(empties.locator('[data-mark="prize"]')).toHaveCount(0);

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

test('§4b.15 — a quantity ranking on a 375 phone: Stand, the name, Cantitate and Loc on the first screen (the deciding columns pinned at the right, fish’s order kept)', async ({ page }) => {
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
  // fish's order: Cantitate stays in the middle of the table, «Poziție generală» last.
  const titles = (await region.locator('thead th').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  expect(titles).toEqual(['Stand', 'Participant', 'C.M.M.C', 'Cantitate', 'Nr. Buc', 'Puncte cantitate', 'Poziție sector', 'Poziție generală']);
  // The two deciding columns wait pinned at the right edge.
  await expect.poll(() => inView(/^Cantitate$/)).toBe(true);
  expect(await inView(/^Poziție generală$/)).toBe(true);
  const loc = (await head(/^Poziție generală$/).boundingBox())!;
  expect(Math.abs(loc.x + loc.width - (box.x + box.width))).toBeLessThanOrEqual(1.5);
  // The name beside them is not covered: its text ends before Cantitate starts.
  const quantityX = (await head(/^Cantitate$/).boundingBox())!.x;
  const name = (await region.locator('tbody tr').first().locator('th[scope="row"] > span').boundingBox())!;
  expect(name.x + name.width).toBeLessThanOrEqual(quantityX + 1);
  // A little scroll: Cantitate and Loc are still where they were (the columns pass under them).
  await region.evaluate(el => el.scrollTo({ left: 40 }));
  await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(30);
  await expect.poll(async () => Math.abs((await head(/^Cantitate$/).boundingBox())!.x - quantityX)).toBeLessThanOrEqual(1);
  // To the end: Cantitate has moved on to its own place, the columns after it show, Loc stays at the edge.
  await region.evaluate(el => el.scrollTo({ left: el.scrollWidth }));
  await expect.poll(() => inView(/^Poziție sector$/)).toBe(true);
  expect((await head(/^Cantitate$/).boundingBox())!.x).toBeLessThan(quantityX - 1);
  const end = (await head(/^Poziție generală$/).boundingBox())!;
  expect(Math.abs(end.x + end.width - (box.x + box.width))).toBeLessThanOrEqual(1.5);
});

test('competition-page.clasament (phone) — no column cut by the right pins on the first screen: the name fills the room between the Stand and the pinned block', async ({ page }) => {
  for (const width of [375, 414]) {
    await open(page, ID.quantity, { width, height: 812 });
    const region = page.getByRole('region', { name: 'Clasament general', exact: true }).locator('visible=true');
    await expect(region.locator('xpath=..')).toHaveAttribute('data-wide', 'true');
    const box = (await region.boundingBox())!;
    const cantitate = region.locator('thead th').filter({ hasText: /^Cantitate$/ });
    await expect.poll(async () => {
      const name = (await region.locator('thead th').nth(1).boundingBox())!;
      return Math.abs(name.x + name.width - (await cantitate.boundingBox())!.x);
    }).toBeLessThanOrEqual(1.5);
    // Nothing between the name and Cantitate: C.M.M.C (the third column) is under the pins.
    const cmmc = (await region.locator('thead th').nth(2).boundingBox())!;
    expect(cmmc.x).toBeGreaterThanOrEqual((await cantitate.boundingBox())!.x - 1);
    expect(box.width).toBeGreaterThan(0);
  }
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

/* ------------------------------------------------------------------------------------------------ */
/* The standard ranking table on the real ranking payloads (tests/fixtures/rankings, hydrated),     */
/* answered through the proxy — data-independent: parity competition-page.clasament c7–c25.         */
/* ------------------------------------------------------------------------------------------------ */

/** Any completed competition with a standard ranking hosts the fixtures (its own ranking is replaced). */
const HOST = process.env.E2E_COMPETITION_COMPLETED ?? 'uxxie29m6820wrpdv45w0m7q';
const WIDE = { width: 1440, height: 900 };

const fixture = (type: string): RankingFixture =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'tests/fixtures/rankings', `${type}.json`), 'utf8')) as RankingFixture;

const displayed = (page: Page) => page.getByRole('region', { name: 'Clasament general', exact: true }).locator('visible=true');

/**
 * Opens HOST with its ranking answered by the `type` fixture (hydrated, then `edit`ed). The server
 * paints HOST's own ranking first; a focus after 30 s re-reads it (clasament.c6) and the fixture lands.
 */
async function openFixture(
  page: Page,
  type: string,
  { viewport = WIDE, edit, options }: { viewport?: { width: number; height: number }; edit?: (f: RankingFixture) => void; options?: Parameters<typeof hydrateRanking>[1] } = {},
) {
  const f = hydrateRanking(fixture(type), options);
  edit?.(f);
  await page.route(new RegExp(`/api/cms/competitions/${HOST}/ranking(\\?|$)`), route => route.fulfill({ json: f }));
  await page.clock.install({ time: new Date() });
  const errors = await open(page, HOST, viewport);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.clock.runFor(31_000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  if (f.rankings.length) {
    const table = displayed(page);
    await expect(table.locator('tbody tr')).toHaveCount(f.rankings.length, { timeout: 20_000 });
    await expect(table.locator('tbody tr td:first-child .sr-only').first()).toContainText(/^Sector /);
  }
  return { f, errors };
}

const heads = (region: Locator) => region.locator('thead th');
const catches = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}`);
const exact = (titles: string[]) => titles.map(t => new RegExp(`^${t.replace(/[.()]/g, m => `\\${m}`)}$`));

/** fish getTableColumns per type, for the fixtures (catch columns: the largest sectorMinNumberOfFish / maxBestOfFishCount / min(catchCount, tier)). */
const TYPE_COLUMNS: [type: string, criterion: string, titles: string[]][] = [
  ['quantity', 'c7', ['Stand', 'Participant', 'C.M.M.C', 'Cantitate', 'Nr. Buc', 'Puncte cantitate', 'Poziție sector', 'Poziție generală']],
  ['quality', 'c8', ['Stand', 'Participant', ...catches(7), 'Calitate', 'Nr. Buc', 'Poziție sector', 'Poziție generală']],
  [
    'quantityQuality',
    'c9',
    ['Stand', 'Participant', ...catches(8), 'Calitate', 'Cantitate', 'Nr. Buc', 'Puncte calitate', 'Puncte cantitate', 'Puncte total', 'Poziție sector', 'Poziție generală'],
  ],
  [
    'qualityQuantity',
    'c9',
    ['Stand', 'Participant', ...catches(6), 'Calitate', 'Cantitate', 'Nr. Buc', 'Puncte calitate', 'Puncte cantitate', 'Puncte total', 'Poziție sector', 'Poziție generală'],
  ],
  // One sector: no «Poziție sector» (fish getBestOfColumns numberOfSectors > 1).
  ['bestOf', 'c10', ['Stand', 'Participant', 'Nr buc.', ...catches(4), 'Medie (kg)', 'Poziție generală']],
  // min(largest catchCount 18, largest tier 9) = 9 catch columns; Best N ascending.
  ['bestOfTiers', 'c11', ['Stand', 'Participant', ...catches(9), 'Nr. Buc', 'Best 3', 'Best 5', 'Best 7', 'Best 9', 'Poziție generală']],
  [
    'calitateCalitate',
    'c12',
    ['Stand', 'Participant', ...catches(7), 'Calitate 1', 'C.M.M.C', 'Nr. Buc', 'Puncte Cal. 1', 'Puncte Cal. 2', 'Puncte total', 'Poziție sector', 'Poziție generală'],
  ],
  [
    'calitateCantitateCMMC',
    'c13',
    [
      'Stand', 'Participant', ...catches(8), 'Calitate', 'Cantitate', 'C.M.M.C', 'Nr. Buc',
      'Pct. Cal.', 'Pct. Cant.', 'Pct. CMMC', 'Puncte total', 'Poziție sector', 'Poziție generală',
    ],
  ],
];

for (const [type, criterion, titles] of TYPE_COLUMNS) {
  test(`competition-page.clasament.${criterion} — ${type}: exactly fish’s columns, in fish’s order and wording, inline and in «Clasament complet»; the phone table the same set`, async ({
    page,
  }) => {
    const { errors } = await openFixture(page, type);
    await expect(heads(displayed(page))).toHaveText(exact(titles));
    await page.getByRole('button', { name: 'Clasament complet' }).locator('visible=true').first().click();
    await expect(heads(page.getByRole('dialog').getByRole('region', { name: 'Clasament complet' }))).toHaveText(exact(titles));
    await page.keyboard.press('Escape');
    // 768–1279 and the phone: the same columns in the same order (every catch column too; a wider
    // table scrolls sideways with its deciding columns pinned).
    for (const viewport of [{ width: 1024, height: 900 }, PHONE]) {
      await page.setViewportSize(viewport);
      const shown = (await heads(displayed(page)).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
      expect(shown, `${viewport.width}px`).toEqual(titles);
    }
    expect(errors).toEqual([]);
  });
}

test('competition-page.clasament.c10 — bestOf with more than one sector shows «Poziție sector» before «Poziție generală»', async ({ page }) => {
  await openFixture(page, 'bestOf', {
    edit: f => {
      f.metadata.numberOfSectors = 2;
      f.rankings[2].sectorName = 'B';
      f.rankings[2].sectorId = 'sector-B';
    },
  });
  await expect(heads(displayed(page))).toHaveText(exact(['Stand', 'Participant', 'Nr buc.', ...catches(4), 'Medie (kg)', 'Poziție sector', 'Poziție generală']));
});

test('competition-page.clasament.c11 — bestOfTiers: catch columns follow the data under the largest tier; the Best-N band (deeper on winner rows), the won cell solid green, bold', async ({ page }) => {
  await openFixture(page, 'bestOfTiers');
  const table = displayed(page);
  await expect(table.locator('thead th.bg-indigo-4')).toHaveText([/^Best 3$/, /^Best 5$/, /^Best 7$/, /^Best 9$/]);
  // tierWonAt 1, 2, 3 of the tiers 9, 7, 5, 3: Best 9, Best 7, Best 5.
  const won = table.locator('td[data-tier-win]');
  await expect(won).toHaveCount(3);
  await expect(won.first()).toHaveClass(/bg-success/);
  expect(Number(await won.first().evaluate(e => getComputedStyle(e).fontWeight))).toBeGreaterThanOrEqual(700);
  // 3 rows, 4 tiers: every row a winner — the band's deeper step.
  await expect(table.locator('tbody tr[data-winner]')).toHaveCount(3);
  await expect(table.locator('td.bg-accent-tint-3')).toHaveCount(9);
});

test('competition-page.clasament.c11 — bestOfTiers with at most 4 catches: 4 catch columns, not the largest tier', async ({ page }) => {
  await openFixture(page, 'bestOfTiers', {
    edit: f =>
      f.rankings.forEach(r => {
        r.catchCount = Math.min(Number(r.catchCount), 4);
        r.catches = (r.catches as unknown[]).slice(0, 4);
      }),
  });
  await expect(heads(displayed(page))).toHaveText(exact(['Stand', 'Participant', ...catches(4), 'Nr. Buc', 'Best 3', 'Best 5', 'Best 7', 'Best 9', 'Poziție generală']));
});

test('competition-page.clasament.c14 competition-page.clasament.c15 competition-page.clasament.c21 — Stand «sector/stand»; the name team → usernames → guest → «–»; weights with three decimals, «–» for none; grey cells past the sector minimum; never «capot»', async ({
  page,
}) => {
  await openFixture(page, 'qualityQuantity', {
    edit: f => {
      const [first, , third] = f.rankings;
      // A registered angler with a guest name too: the username wins.
      first.participant = { username: 'ana.pescar' };
      first.catchCount = 3;
      first.catches = (first.catches as number[]).slice(0, 3);
      // No team name: the guest.
      third.teamName = '';
      // A stand without an angler and without a catch.
      f.rankings.push({ ...f.rankings[1], standId: 9010, standName: '7', teamName: null, guestName: null, participant: null, catchCount: 0, catches: [], quality: 0, quantity: 0, biggestFish: 0, generalPosition: 4, sectorPosition: 2 });
    },
  });
  const table = displayed(page);
  const rows = table.locator('tbody tr');
  // Stand order (sector A→Z, then the stand number): A/8, B/10, C/3, C/7.
  await expect(rows.locator('td:first-child')).toHaveText(['Sector A, stand 8A/8', 'Sector B, stand 10B/10', 'Sector C, stand 3C/3', 'Sector C, stand 7C/7']);
  await expect(rows.locator('th[scope=row]')).toHaveText(['ana.pescar', 'Pescar 3', 'Echipa 2', '–Stand liber']);
  const titles = (await heads(table).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  const cell = (row: number, title: string) => rows.nth(row).locator('> *').nth(titles.indexOf(title));
  // c15: three decimals with the decimal comma (fish 12.460 → «12,460»).
  await expect(cell(0, 'Calitate')).toHaveText('12,460');
  await expect(cell(0, 'Cantitate')).toHaveText('104,480');
  // (catch 1, 16,830, is the competition's biggest: gold, c19.)
  await expect(cell(0, '2')).toHaveText('16,330');
  // A catch the row does not have, within its sector minimum: «–».
  await expect(cell(0, '4')).toHaveText('–');
  // No catch: «–» in the deciding value, «Fără capturi» for a screen reader (ROADMAP §4b.11).
  await expect(cell(3, 'Cantitate').locator('span[aria-hidden]')).toHaveText('–');
  await expect(cell(3, 'Cantitate').getByText('Fără capturi')).toHaveClass(/sr-only/);
  // c21: B/10's sector minimum is 5: catch 6 is grey and empty (A/8's minimum is 6: none).
  await expect(cell(1, '6')).toHaveAttribute('aria-label', 'nu se punctează');
  await expect(cell(1, '6')).toHaveText('');
  await expect(rows.nth(0).locator('td[aria-label="nu se punctează"]')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(/capot/i);
});

test('competition-page.clasament.c16 — stand order by default (sector A→Z, then the stand number); «Poziție generală» orders by place', async ({ page }) => {
  await openFixture(page, 'quantity');
  const table = displayed(page);
  const stands = table.locator('tbody tr td:first-child > span[aria-hidden]:not(.absolute)');
  await expect(stands).toHaveText(['B/2', 'B/5', 'C/9']);
  const place = heads(table).filter({ hasText: 'Poziție generală' });
  await expect(async () => {
    await place.getByRole('button').click();
    await expect(place).toHaveAttribute('aria-sort', 'ascending', { timeout: 1000 });
  }).toPass();
  await expect(stands).toHaveText(['B/2', 'C/9', 'B/5']);
});

test('competition-page.clasament.c17 competition-page.clasament.c18 — every value cell in the sector colour (40%, 90% on a winner row), the white Stand cell with the 4px sector edge; winners = the sectors (quantity), numberOfWinners (bestOf), the tiers (bestOfTiers)', async ({
  page,
}) => {
  // Two sectors' worth of winners: places 1–2 (B/2, C/9); B/5 (3rd) is not one.
  await openFixture(page, 'quantity', { edit: f => (f.metadata.numberOfSectors = 2) });
  const table = displayed(page);
  const row = (stand: string) => table.locator('tbody tr').filter({ has: page.locator(`td:first-child > span[aria-hidden]:not(.absolute)`, { hasText: new RegExp(`^${stand}$`) }) });
  await expect(table.locator('tbody tr[data-winner]')).toHaveCount(2);
  await expect(row('B/5')).not.toHaveAttribute('data-winner', '');
  // fish getColorsBySector: the palette by the sorted sector names — B and C alone are palette[0]
  // and palette[1] (A's and B's colours), not their own letters' colours.
  for (const [stand, sector, fill] of [
    ['B/2', 'a', 'rank-sector-win'],
    ['C/9', 'b', 'rank-sector-win'],
    ['B/5', 'a', 'rank-sector-tint'],
  ] as const) {
    const r = row(stand);
    await expect(r).toHaveAttribute('style', new RegExp(`--sector: var\\(--color-sector-${sector}\\)`));
    // The Stand cell: no fill of its own, the sector's 4px edge.
    const standCell = r.locator('td').first();
    await expect(standCell.locator('> span.absolute')).toHaveClass(new RegExp(`bg-sector-${sector}`));
    expect((await standCell.locator('> span.absolute').boundingBox())!.width).toBeCloseTo(4, 0);
    expect(await standCell.evaluate(e => getComputedStyle(e).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/);
    // Every other cell: the sector fill (40%, or 90% on a winner row).
    const filled = r.locator('> [data-fill]');
    expect(await filled.count()).toBe(7);
    for (const c of await filled.all()) await expect(c).toHaveClass(new RegExp(fill));
  }
  // Same sector, winner vs not: the 90% fill is deeper than the 40% one.
  const lum = (stand: string) =>
    row(stand)
      .locator('td[data-fill]')
      .first()
      .evaluate(e => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = getComputedStyle(e).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return r + g + b;
      });
  expect(await lum('B/2')).toBeLessThan(await lum('B/5'));
  // fish's 🎖️ on «Poziție generală» of every winner row; with more than one sector, each sector's
  // winner (sector place 1) also on «Poziție sector».
  await expect(row('B/2').locator('td').nth(-2)).toContainText('câștigător de sector');
  await expect(row('B/2').locator('td').last()).toContainText('câștigător');
  await expect(row('C/9').locator('td').last()).toContainText('câștigător');
  await expect(row('B/5')).not.toContainText('câștigător');
  // The sector chips' dots follow the same colours.
  await expect(page.getByRole('radiogroup', { name: 'Filtru sector' }).locator('label').filter({ hasText: /^B$/ }).locator('span.rounded-full')).toHaveClass(/bg-sector-a/);
});

test('competition-page.clasament.c18 — one sector (quantity): only the winner row is marked, on «Poziție generală»; no sector trophy, no podium marks', async ({ page }) => {
  await openFixture(page, 'quantity', {
    edit: f => {
      f.metadata.numberOfSectors = 1;
      for (const r of f.rankings) {
        r.sectorName = 'B';
        r.sectorId = 'sector-B';
      }
    },
  });
  const table = displayed(page);
  const marks = table.locator('tbody tr').locator('[data-mark]');
  await expect(marks).toHaveCount(1);
  await expect(table.locator('tbody tr[data-winner]')).toHaveCount(1);
  await expect(table.locator('tbody tr[data-winner] td').last().locator('[data-mark]')).toHaveCount(1);
  await expect(table.locator('tbody tr[data-winner] td').last()).toContainText('Locul 1');
  await expect(table).not.toContainText('câștigător de sector');
  await expect(table).not.toContainText('podium');
});

test('competition-page.clasament.c18 — a sector’s second holding a place ≤ S (split points) gets the winner mark on its place, never the sector trophy', async ({ page }) => {
  await openFixture(page, 'quantity', {
    edit: f => {
      f.metadata.numberOfSectors = 2;
      // B/5 (sector B's second) ranked 2nd overall, C/9 (sector C's winner) 3rd.
      f.rankings[2].generalPosition = 2;
      f.rankings[1].generalPosition = 3;
    },
  });
  const table = displayed(page);
  const row = (stand: string) => table.locator('tbody tr').filter({ has: page.locator('td:first-child > span[aria-hidden]:not(.absolute)', { hasText: new RegExp(`^${stand}$`) }) });
  await expect(row('B/5').locator('td').last()).toContainText('câștigător');
  await expect(row('B/5')).not.toContainText('câștigător de sector');
  // C/9 is sector C's winner (sector place 1) outside the places 1..S: the sector trophy, no general mark.
  await expect(row('C/9').locator('td').nth(-2)).toContainText('câștigător de sector');
  await expect(row('C/9').locator('td').last().locator('[data-mark]')).toHaveCount(0);
});

test('competition-page.clasament.c18 — bestOf winners are numberOfWinners (the trophy on the general place); bestOfTiers one per tier', async ({ page }) => {
  await openFixture(page, 'bestOf', { options: { numberOfWinners: 1 } });
  const table = displayed(page);
  await expect(table.locator('tbody tr[data-winner]')).toHaveCount(1);
  await expect(table.locator('tbody tr[data-winner] td').last()).toContainText('câștigător');
  await expect(table.locator('tbody tr:not([data-winner]) td.rank-sector-win')).toHaveCount(0);
});

test('competition-page.clasament.c19 competition-page.clasament.c20 — the competition’s biggest catch is gold with bold dark text on its catch cell and its C.M.M.C (phone too); a split catch is marked SPLIT', async ({
  page,
}) => {
  await openFixture(page, 'calitateCantitateCMMC');
  const table = displayed(page);
  // A/B8 holds the biggest catch (26,275): its catch cell and its C.M.M.C.
  const biggest = table.locator('td[data-biggest]');
  await expect(biggest).toHaveCount(2);
  await expect(biggest).toHaveText(['Cea mai mare captură: 26,275', 'Cea mai mare captură: 26,275']);
  await expect(biggest.first()).toHaveClass(/bg-medal-gold/);
  expect(Number(await biggest.first().evaluate(e => getComputedStyle(e).fontWeight))).toBeGreaterThanOrEqual(700);
  await expect(page.getByRole('list', { name: 'Legendă' })).toContainText('C.M.M.C a concursului');
  await page.setViewportSize(PHONE);
  await expect(displayed(page).locator('td[data-biggest]')).toHaveCount(2);
  // The phone has the legend too, under its table.
  const legend = page.getByRole('list', { name: 'Legendă' }).locator('visible=true');
  await expect(legend).toContainText('C.M.M.C a concursului');
  await expect(legend).toContainText('fără capturi');
});

test('competition-page.clasament.c20 — a split catch shows a small «SPLIT» in its cell', async ({ page }) => {
  await openFixture(page, 'bestOf', { edit: f => ((f.rankings[0].catches as { weight: number; isSplit?: boolean }[])[1].isSplit = true) });
  const split = displayed(page).locator('td sup', { hasText: 'SPLIT' });
  await expect(split).toHaveCount(1);
  await expect(split.locator('xpath=..')).toHaveText(/^21,675\s*SPLIT$/);
});

test('competition-page.clasament.c23 — one penalty marker per row beside the name: yellow «Echipa are penalizări» (the reason as its title), red «Echipa este eliminată» when any penalty eliminates (phone too)', async ({
  page,
}) => {
  await openFixture(page, 'quantity', {
    edit: f => {
      f.rankings[0].penalties = [{ documentId: 'pen-1', action: 'DEDUCT_TOTAL_WEIGHT', value: 2, reason: 'nadă în exces', createdAt: '2026-09-10T08:00:00.000Z' }];
      f.rankings[1].penalties = [
        { documentId: 'pen-2', action: 'WARNING', value: null, reason: 'avertisment', createdAt: '2026-09-10T08:00:00.000Z' },
        { documentId: 'pen-3', action: 'ELIMINATE', value: null, reason: 'fraudă', createdAt: '2026-09-10T08:01:00.000Z' },
      ];
    },
  });
  for (const viewport of [WIDE, PHONE]) {
    await page.setViewportSize(viewport);
    const table = displayed(page);
    const warned = table.getByRole('img', { name: 'Echipa are penalizări' });
    const out = table.getByRole('img', { name: 'Echipa este eliminată' });
    await expect(warned).toHaveCount(1);
    await expect(warned).toHaveAttribute('title', /nadă în exces/);
    await expect(warned).toHaveClass(/bg-badge-yellow-fg/);
    // Two penalties, one of them ELIMINATE: one red marker, not one per penalty.
    await expect(out).toHaveCount(1);
    await expect(out).toHaveClass(/bg-status-danger-fg/);
    await expect(table.locator('th[scope=row]').filter({ has: page.getByRole('img', { name: 'Echipa este eliminată' }) })).toContainText('Pescar 2');
    // The legend names both markers at every width (the phone's under its table).
    const legend = page.getByRole('list', { name: 'Legendă' }).locator('visible=true');
    await expect(legend).toContainText('penalizare aplicată');
    await expect(legend).toContainText('eliminat');
  }
});

test('competition-page.clasament — a pressable row marks the pointer on its cells (the filled cells a step darker, the white Stand cell tinted)', async ({ page }) => {
  await open(page, ID.quantity);
  const row = displayed(page).locator('tbody tr').nth(2);
  await expect(row).toHaveAttribute('data-pressable', '');
  const filled = row.locator('td[data-fill]').first();
  const stand = row.locator('td').first();
  const before = await stand.evaluate(e => getComputedStyle(e).backgroundColor);
  await row.locator('td').nth(3).hover();
  await expect.poll(() => filled.evaluate(e => getComputedStyle(e).filter)).toBe('brightness(0.9)');
  await expect.poll(() => stand.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe(before);
});

test('§4b.16 competition-page.clasament — from 1440 the side column takes every pixel the table leaves: table and column reach the container’s edge (1440, 1920)', async ({ page }) => {
  for (const width of [1440, 1920]) {
    await open(page, ID.quantity, { width, height: 900 });
    const section = page.locator('section[aria-label="Clasament"]').locator('visible=true');
    const column = section.locator('[data-ranking-side-column]');
    await expect(column).toBeVisible();
    const [wrap, side] = [(await section.boundingBox())!, (await column.boundingBox())!];
    expect(Math.abs(side.x + side.width - (wrap.x + wrap.width)), `${width}px`).toBeLessThanOrEqual(1);
    // The stack: who leads each sector, and the sectors side by side.
    await expect(column.locator('[data-ranking-side]')).toContainText('Lideri pe sectoare');
    await expect(column.locator('[data-ranking-sectors]')).toContainText('Sector A');
  }
});

test('competition-page.clasament — the side column on 24 sectors: an empty sector says «Fără capturi» once (never «0 capturi 0,000 kg»), last; each tile lists 8 sectors, the rest behind «Vezi încă N sectoare»; the overflow fades', async ({ page }) => {
  await open(page, ID.quantity, { width: 1920, height: 900 });
  const column = page.locator('[data-ranking-side-column]').locator('visible=true');
  await expect(column).toBeVisible();
  const sectors = column.locator('[data-ranking-sectors]');
  await expect(sectors).not.toContainText(/\b0 capturi/);
  await expect(sectors).not.toContainText(/\b0,000\s*kg/);
  for (const tile of [column.locator('[data-ranking-side]'), sectors]) {
    await expect(tile.locator('li')).toHaveCount(8);
    const more = tile.locator('[data-ranking-side-more]');
    await expect(more).toHaveText(/^Vezi încă \d+ sectoare$/);
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(await tile.locator('li').count()).toBeGreaterThan(8);
  }
  // Every sector without a catch: one muted «Fără capturi», no bar, after the sectors with catches.
  const items = sectors.locator('li');
  const empty = await items.evaluateAll(lis => lis.map(li => li.hasAttribute('data-empty')));
  if (empty.includes(true)) {
    expect(empty.indexOf(true)).toBe(empty.length - empty.filter(Boolean).length);
    const first = sectors.locator('li[data-empty]').first();
    await expect(first).toContainText('Fără capturi');
    await expect(first.locator('[aria-hidden] > span')).toHaveCount(0);
  }
  // Taller than the column now: its bottom fades while there is more below.
  await expect(column).toHaveAttribute('data-more', /.*/);
  expect(await column.evaluate(el => getComputedStyle(el).maskImage)).toContain('linear-gradient');
});

test('competition-page.clasament — phone: rows below the table region are announced («Încă N pescari în tabel», a faded, square bottom) and the cue scrolls the region on', async ({ page }) => {
  await open(page, ID.quantity, PHONE);
  const table = displayed(page);
  await expect(table.locator('tbody tr').first()).toBeVisible();
  const cue = page.locator('[data-rows-below-cue]');
  await expect(cue).toHaveText(/^Încă \d+ pescari în tabel/);
  expect(await table.evaluate(el => getComputedStyle(el).borderBottomLeftRadius)).toBe('0px');
  const before = Number((await cue.innerText()).replace(/\D/g, ''));
  await cue.click();
  await expect.poll(() => table.evaluate(r => r.scrollTop)).toBeGreaterThan(0);
  await table.evaluate(r => (r.scrollTop = r.scrollHeight));
  await expect(cue).toHaveCount(0);
  expect(before).toBeGreaterThan(0);
});

test('competition-page.clasament — the side column on bestOfTiers: «Podium» from the places 1–3 only, each with the Best N it won at and its value (never «–»)', async ({ page }) => {
  // 1920 with at most 4 catches (4 catch columns): room beside the table for the side column.
  await openFixture(page, 'bestOfTiers', {
    viewport: { width: 1920, height: 1080 },
    edit: f =>
      f.rankings.forEach(r => {
        r.catchCount = Math.min(Number(r.catchCount), 4);
        r.catches = (r.catches as unknown[]).slice(0, 4);
      }),
  });
  const side = page.locator('[data-ranking-side]');
  await expect(side.getByRole('heading')).toHaveText('Podium');
  const lines = side.locator('li');
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toContainText(/Locul 1 · Best 9/);
  await expect(lines.nth(1)).toContainText(/Locul 2 · Best 7/);
  await expect(lines.nth(2)).toContainText(/Locul 3 · Best 5/);
  for (const line of await lines.all()) {
    await expect(line).toContainText(/\d+,\d{3}\s*kg/);
    await expect(line).not.toContainText('–');
  }
});

test('competition-page.clasament.c24 — a row without a registration behind it opens nothing (phone and desktop)', async ({ page }) => {
  await openFixture(page, 'quantity');
  await displayed(page).locator('tbody tr').first().locator('th[scope=row]').click();
  await expect(page.locator('[data-person-popover]')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('pescar')).toBeNull();
  await page.setViewportSize(PHONE);
  await displayed(page).locator('tbody tr').first().locator('td').first().click();
  await page.waitForTimeout(500);
  expect(new URL(page.url()).searchParams.get('pescar')).toBeNull();
});

test('competition-page.clasament.c24 — a row with a registration opens the angler: the sheet on the phone (?pescar=)', async ({ page }) => {
  await open(page, ID.quantity, PHONE);
  const table = displayed(page);
  await table.locator('tbody tr').first().locator('td').first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get('pescar')).not.toBeNull();
});

test('competition-page.clasament.c25 — a ranking with no rows says «Nu există date de afișat»', async ({ page }) => {
  await openFixture(page, 'quantity', { edit: f => (f.rankings = []) });
  await expect(page.getByText('Nu există date de afișat').locator('visible=true')).toBeVisible({ timeout: 20_000 });
  await expect(displayed(page)).toHaveCount(0);
});

for (const vp of [PHONE, { width: 1280, height: 900 }, WIDE, { width: 1920, height: 1080 }]) {
  test(`competition-page.clasament — every ranking type at ${vp.width}px: the table renders, axe clean, no console errors`, async ({ context }) => {
    test.setTimeout(300_000);
    for (const [type] of TYPE_COLUMNS.filter(([t], i, all) => all.findIndex(([u]) => u === t) === i)) {
      const page = await context.newPage();
      const { errors } = await openFixture(page, type, { viewport: vp });
      await expect(displayed(page).locator('tbody tr').first()).toBeVisible();
      await expectNoA11yViolations(page);
      expect(errors, `${type}: ${errors.join('\n')}`).toEqual([]);
      await page.close();
    }
  });
}
