import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { type Page } from '@playwright/test';
import { expect, test } from './helpers/fake-chat';
import { SESSIONS_COLLAPSED_MAX } from '@/core/competitions/domain/weighingSessions';
import { COMPETITION_CATCHES_PAGE_SIZE } from '@/core/competitions/queries';
import type { WeighingStatisticsItem } from '@/core/competitions/schemas';

/*
 * Concurs · the Clasament views and their surfaces — parity docs/parity/areas/competition-page.yml:
 * cantare, cantar-detaliu, statistici, toti-pestii, statistici-pescar, cronologie (M1 batch 3).
 * Local CMS on :1337; override the ids with E2E_STATS_* when the local data moves.
 */

const ID = {
  /** completed nationalChampionship, 3 sectors; stand A1's weighing was reopened once (a revision). */
  nc: process.env.E2E_STATS_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
  ncWeighing: process.env.E2E_STATS_NC_WEIGHING ?? 'fuqluwe496abmszwt4yh6ao4',
  ncStand: process.env.E2E_STATS_NC_STAND ?? 'ahs6zl0lu3dqj5jy9ep8bu7d',
  /** completed quantity, 114 weighings over 3 days (9 sessions with extras), 389 catches, no timeline snapshot. */
  rich: process.env.E2E_STATS_RICH ?? 'i8kzbi5k51vmbyq75dmyez3d',
  /** its registration with a Bluvi account (A1) and a guest one («Lala», A7). */
  richAngler: process.env.E2E_STATS_RICH_ANGLER ?? 'tx2r8udyq17bg8qubli055ru',
  richGuest: process.env.E2E_STATS_RICH_GUEST ?? 'r79jk8gw83ze85c9z2df3zsw',
  /** started quantity, 24 sectors × 1 stand, a timeline snapshot. */
  live: process.env.E2E_STATS_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  /** completed quality competition holding a weighing still in progress (stand A1). */
  openWeighing: process.env.E2E_STATS_OPEN ?? '0dab75714142e797e26304aa',
  openWeighingId: process.env.E2E_STATS_OPEN_WEIGHING ?? 'f0f9de2bbe2b58acd8038a58',
  openStand: process.env.E2E_STATS_OPEN_STAND ?? '5d8e24df4ec6b06a5a002082',
  /** completed team with one crew of two Bluvi accounts (statistici-pescar c5's «Vezi profilul» per member). */
  teamMembers: process.env.E2E_STATS_TEAM ?? 'g5l98otx5ypg6wttowra9yww',
  teamMembersCrew: process.env.E2E_STATS_TEAM_CREW ?? 's2mx0gunmo63zr9fiv2o8ocw',
  /** completed feeder team: crews entered without Bluvi accounts. */
  feederTeam: process.env.E2E_STATS_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr',
  /** notStarted, the QA user's own. */
  upcoming: process.env.E2E_STATS_UPCOMING ?? 'a6xjl65ooe9eadrtvvqj9hn1',
};

const PHONE = { width: 375, height: 812 };
/** Below 1280 Cântare keeps the stand cards (the table is the ≥1280 layout, owner rule 14). */
const TABLET = { width: 1279, height: 900 };
/** Below the person popover (1024): a ranking row opens the angler stats. */
const TABLET_768 = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };
/** The narrowest table: with the detail docked beside it. */
const LAPTOP = { width: 1280, height: 900 };
const WIDE = { width: 1920, height: 1080 };

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, path: string, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  // A 403 the local CMS answers for a grant it lacks is the browser's own network log line.
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
  // Wait for React to own the page (a press before hydration does nothing).
  await page.waitForFunction(() => !!document.querySelector('h1') && Object.keys(document.querySelector('h1')!).some(k => k.startsWith('__react')), null, {
    timeout: 60_000,
  });
  return errors;
}

/**
 * The desktop facts cell (the Statistici bento from 768): how much of its first row its tiles fill,
 * and where it sits — a cell of the chart grid (its first child), never a row of its own.
 */
async function factsCell(page: Page) {
  const summary = page.getByRole('list', { name: 'Rezumat' }).locator('visible=true');
  await expect(summary).toBeVisible({ timeout: 30_000 });
  return summary.evaluate(ul => {
    const box = ul.getBoundingClientRect();
    const tiles = [...ul.children].map(li => li.getBoundingClientRect());
    const top = Math.min(...tiles.map(b => b.top));
    const row = tiles.filter(b => Math.abs(b.top - top) < 1);
    const grid = ul.parentElement!;
    return {
      tiles: tiles.map(b => b.width),
      filled: row.reduce((sum, b) => sum + b.width, 0) / box.width,
      inGrid: grid.hasAttribute('data-stats-grid'),
      first: grid.firstElementChild === ul,
      width: box.width,
      gridWidth: grid.getBoundingClientRect().width,
    };
  });
}

/** Presses until it takes (a press before hydration does nothing). */
async function press(page: Page, locator: ReturnType<Page['locator']>, done: () => Promise<void>) {
  await expect(async () => {
    await locator.click();
    await done();
  }).toPass({ timeout: 60_000 });
}

/**
 * Every «N capturi / N standuri» line (and the «Total: …» footer) in `scope` takes «de» exactly when
 * Romanian wants it (N ≥ 20 or a round hundred: «69 de capturi», «21 de standuri», «12 capturi»).
 */
async function expectRomanianCounts(scope: ReturnType<Page['locator']>) {
  const lines = await scope.getByText(/^(Total: )?[\d.]+ (de )?(capturi|standuri)$/).allInnerTexts();
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    const n = Number(line.replace(/^Total: /, '').split(' ')[0].replace(/\./g, ''));
    const rest = n % 100;
    expect(line.includes(' de '), line).toBe(n !== 0 && (rest === 0 || rest >= 20));
  }
}

/** A box once it has stopped moving (a panel that slides in). */
async function steadyBox(page: Page, locator: ReturnType<Page['locator']>) {
  let box = (await locator.boundingBox())!;
  await expect
    .poll(async () => {
      const prev = box;
      await page.waitForTimeout(150);
      box = (await locator.boundingBox())!;
      return Math.abs(box.x - prev.x) + Math.abs(box.y - prev.y);
    })
    .toBe(0);
  return box;
}

/** The panel / sheet slides in: let it settle before axe reads the colours. */
const settle = (page: Page) => page.waitForTimeout(800);

/*
 * The numbers a test expects come from the same CMS reads the page makes (never pinned to today's
 * local data): the public weighing statistics, the timeline snapshot (the QA user's token).
 */
async function cmsJson<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`${CMS}${path}`, { headers: { Authorization: `Bearer ${await qaJwt(page.request)}` } });
  expect(res.ok(), `CMS ${path}`).toBeTruthy();
  return (await res.json()) as T;
}

/** A read the CMS wraps in `{ data }` (weighing statistics, timeline snapshot). */
async function cmsData<T>(page: Page, path: string): Promise<T> {
  return (await cmsJson<{ data: T }>(page, path)).data;
}

type RankingRow = { sectorName?: string; catchCount?: number; penalties?: { action: string; value: number | null }[] };

/** The ranking (GET /competitions/:id/ranking, unwrapped): its rows and metadata. */
const cmsRanking = (page: Page, id: string) =>
  cmsJson<{ rankings: RankingRow[]; metadata: { totalCatchesCount?: number } }>(page, `/competitions/${id}/ranking`);

/** The weight penalties the ranking rows carry (kg): the donut says «după penalizările de greutate» exactly when > 0. */
async function deductedKg(page: Page, id: string) {
  const { rankings } = await cmsRanking(page, id);
  return rankings.flatMap(r => r.penalties ?? []).reduce((kg, p) => kg + (p.action === 'DEDUCT_TOTAL_WEIGHT' && typeof p.value === 'number' ? p.value : 0), 0);
}

/**
 * «Not one catch, not one weighing» on any completed competition, whatever the local data holds:
 * the browser's ranking read keeps its rows (the anglers) with every catch zeroed, the weighing
 * statistics read is empty. The server's prefetch is real, so the state shows once the browser
 * re-reads (the Statistici chip invalidates both — noCatchView). Unroute with `{ behavior: 'wait' }`.
 */
async function routeNoCatch(page: Page, id: string) {
  await page.route(`**/competitions/${id}/ranking`, async route => {
    const res = await route.fetch();
    const body = await res.json();
    body.rankings = (body.rankings as Record<string, unknown>[]).map(r => ({ ...r, biggestFish: 0, quantity: 0, catchCount: 0, penalties: [] }));
    body.metadata = { ...body.metadata, totalQuantity: 0, totalCatchesCount: 0, biggestCatch: null, biggestFish: 0 };
    await route.fulfill({ response: res, json: body });
  });
  await page.route(`**/competitions/${id}/weighing-statistics`, route => route.fulfill({ json: { data: [] } }));
}

/** Opens a completed competition with routeNoCatch and the Statistici chip pressed (the browser re-reads). */
async function noCatchView(page: Page, viewport = DESKTOP) {
  await routeNoCatch(page, ID.rich);
  await open(page, `/concursuri/${ID.rich}`, viewport);
  await press(page, page.getByRole('tab', { name: /Statistici/ }), () =>
    expect(page.getByText('Nu există statistici pentru acest concurs')).toBeVisible({ timeout: 8000 }),
  );
}

/** Any catch-threshold count above 0 (the «Capturi» table is drawn exactly then, parity statistici.c13). */
async function anyThreshold(page: Page, id: string) {
  const t = await cmsJson<{ bySector: Record<string, unknown>[]; general: Record<string, unknown> }>(page, `/competitions/${id}/catch-threshold-counts`);
  return [t.general, ...t.bySector].some(row => Object.entries(row).some(([k, v]) => k.startsWith('count') && typeof v === 'number' && v > 0));
}

/** Every catch the competition's weighings hold (GET /competitions/:id/weighing-statistics). */
async function weighedCatches(page: Page, id: string) {
  const rows = await cmsData<{ catchCount: number }[]>(page, `/competitions/${id}/weighing-statistics`);
  return rows.reduce((sum, r) => sum + r.catchCount, 0);
}

/** The stands the timeline snapshot draws (GET /competitions/:id/timeline-snapshot). */
async function snapshotStands(page: Page, id: string) {
  const snapshot = await cmsData<{ stands: unknown[] } | null>(page, `/competitions/${id}/timeline-snapshot`);
  return snapshot?.stands.length ?? 0;
}

/** Toți peștii's page (core COMPETITION_CATCHES_PAGE_SIZE, fish's 20): only the constant, never the rows. */
const CATCHES_PAGE = COMPETITION_CATCHES_PAGE_SIZE;

/** «N capturi» / «N de capturi» as Romanian writes it (N ≥ 20 or a round hundred take «de»), «1.234» grouped. */
const roCount = (n: number, word: string) =>
  `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ${n !== 0 && (n % 100 === 0 || n % 100 >= 20) ? 'de ' : ''}${word}`;

/** «2.961,000» as the page prints a weight at `decimals` (Romanian grouping and comma). */
const roKg = (n: number, decimals: number) => {
  const [int, frac] = n.toFixed(decimals).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${frac ? `,${frac}` : ''}`;
};

type CoreStand = { documentId: string; name: string };
type CoreRegistration = {
  documentId: string;
  registrationStatus: string;
  teamName?: string | null;
  guestName?: string | null;
  stand?: CoreStand | null;
  participants: { documentId?: string; username?: string | null }[];
};
type Core = { sectors: { name: string; stands: CoreStand[] }[]; registrations: CoreRegistration[] };

/** The public competition core (GET /feed/competitions/:id, the page's own read). */
const cmsCore = async (page: Page, id: string) => (await (await page.request.get(`${CMS}/feed/competitions/${id}`)).json()).data as Core;

/** A registration's name as every surface prints it (getCompetitorDisplayName: team, the people, the guest). */
const entrantName = (r: CoreRegistration) =>
  r.teamName?.trim() || r.participants.map(p => p.username?.trim()).filter(Boolean).join(', ') || r.guestName?.trim() || '';

/** The stand's sector and the stand label the page uses («A1»: the sector, then the stand's name). */
function standOf(core: Core, standId: string) {
  const sector = core.sectors.find(x => x.stands.some(st => st.documentId === standId))!;
  return { sector: sector.name, label: `${sector.name}${sector.stands.find(st => st.documentId === standId)!.name}` };
}

/**
 * ID.ncWeighing on ID.ncStand, read from the CMS (never today's literals): the stand label, a second
 * registered stand of its sector, the angler, the stand's summary total and its weighing's catches
 * (NC weights print three decimals). The tests that need the stand's one weighing with one revision
 * skip with a reason when the local data no longer has that shape (override E2E_STATS_NC_*).
 */
async function ncFacts(page: Page) {
  const [core, summary, detail] = await Promise.all([
    cmsCore(page, ID.nc),
    cmsData<{ standId: string; totalKg: number; regularCount: number; extraCount: number }[]>(page, `/competitions/${ID.nc}/weighings-summary`),
    cmsJson<{ numberOfRevisions?: number; catches: { weight: number; fishType?: { Name?: string } | null }[] }>(page, `/feed/weighings/${ID.ncWeighing}`),
  ]);
  const { sector, label } = standOf(core, ID.ncStand);
  const registered = core.registrations.filter(r => r.registrationStatus === 'registered' && r.stand);
  const own = registered.find(r => r.stand!.documentId === ID.ncStand)!;
  const other = registered.map(r => standOf(core, r.stand!.documentId)).find(x => x.sector === sector && x.label !== label)!;
  const row = summary.find(x => x.standId === ID.ncStand)!;
  const weighed = detail.catches.reduce((kg, c) => kg + c.weight, 0);
  return {
    stand: label,
    other: other.label,
    angler: entrantName(own),
    standKg: roKg(row.totalKg, 3),
    weighingKg: roKg(weighed, 3),
    species: [...new Set(detail.catches.map(c => c.fishType?.Name).filter(Boolean))] as string[],
    weighings: row.regularCount + row.extraCount,
    revisions: detail.numberOfRevisions ?? 0,
  };
}

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function signedIn(page: Page) {
  await signIn(page.context(), await qaJwt(page.request));
}

/* ------------------------------------------------------------------ */
/* Cântare + weighing detail                                           */
/* ------------------------------------------------------------------ */

test('competition-page.cantare.c1 c3 c4 c5 c6 competition-page.cantare.s1 s2 s5 — below 1280: NC stand cards, one open at a time, its weighings', async ({ page }) => {
  await signedIn(page);
  const nc = await ncFacts(page);
  test.skip(nc.weighings !== 1, `ID.ncStand now has ${nc.weighings} weighings: point E2E_STATS_NC_* at a stand with one`);
  await open(page, `/concursuri/${ID.nc}/cantare`, TABLET);
  // c1: one section per sector, one card per stand; c3: «Stand A1» (NC draw label without a draw).
  await expect(page.getByRole('heading', { name: 'Sector A', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sector C', level: 2 })).toBeVisible();
  const stand = page.getByRole('button', { name: new RegExp(`^Stand ${nc.stand} `) });
  // The angler is the card's own control beside the toggle (owner rule 17: it opens the person).
  await expect(page.getByRole('listitem').filter({ has: stand }).getByRole('button', { name: nc.angler, exact: true })).toBeVisible();
  // c4: the closed card's total and counts from the summary, at the competition's precision (the
  // national championship prints three decimals, as its summary tiles).
  await expect(stand).toContainText(`${nc.standKg} kg`);
  await expect(page.getByText('Cântare:').first()).toBeVisible();
  await expect(page.getByText('Extra-cântare:').first()).toBeVisible();
  // c5: open one stand, then another: only one open at a time.
  await stand.click();
  await expect(stand).toHaveAttribute('aria-expanded', 'true');
  const a4 = page.getByRole('button', { name: new RegExp(`^Stand ${nc.other} `) });
  await a4.click();
  await expect(stand).toHaveAttribute('aria-expanded', 'false');
  await stand.click();
  // c6: the weighing item.
  const item = page.getByRole('button', { name: /Cântar 1/ });
  await expect(item).toContainText('Terminat');
  await expect(item).toContainText('Total:');
  await expect(item).toContainText('Capturi:');
  // c7: below 1280 the detail is a dialog over the page.
  await item.click();
  await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`cantar=${ID.ncWeighing}&stand=${ID.ncStand}`));
});

test('competition-page.cantare.c1 c3 c4 c7 competition-page.cantar-detaliu.c1 c2 c3 c4 c7 c8 c9 c10 competition-page.cantar-detaliu.s2 s3 s5 — from 1280: every weighing in one table (owner rule 14), a row opens the docked detail, its history', async ({ page }) => {
  await signedIn(page);
  const nc = await ncFacts(page);
  test.skip(
    nc.weighings !== 1 || nc.revisions !== 1,
    `ID.ncWeighing / ID.ncStand now have ${nc.weighings} weighings, ${nc.revisions} revisions: point E2E_STATS_NC_* at a stand with one weighing reopened once`,
  );
  const errors = await open(page, `/concursuri/${ID.nc}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  // Every column visible, on the coloured header row.
  for (const col of ['Stand', 'Pescar', 'Cântar', 'Interval', 'Capturi', 'Kg', 'Stare']) await expect(table.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
  const header = table.getByRole('columnheader', { name: 'Stand', exact: true });
  expect(await header.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  // c1: the sectors as row groups; no stand cards.
  await expect(table.getByRole('columnheader', { name: /^Sector A/ })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: /^Sector C/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Stand A1 / })).toHaveCount(0);
  // c3 / c4: the stand, its angler and kg («kg» apart from the number; one weighing: no «Total stand» line), the weighing's cells.
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(`Stand ${nc.stand}$`) }) });
  await expect(row).toContainText(nc.angler);
  await expect(row).toContainText(new RegExp(`${escapeRe(nc.standKg)}\\s*kg`));
  await expect(row).not.toContainText('Total');
  await expect(row).toContainText('Terminat');
  // c7 / cantar-detaliu.c1: the row's «Cântar 1» opens the detail docked beside the table.
  const item = row.getByRole('button', { name: 'Cântar 1' });
  await item.click();
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await expect(panel).toBeVisible();
  await expect(item).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(new RegExp(`cantar=${ID.ncWeighing}&stand=${ID.ncStand}`));
  // c2: the stand label, its participant.
  await expect(panel.getByText(`Stand ${nc.stand}`, { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: nc.angler, exact: true })).toBeVisible();
  // c3: a single weighing.
  await expect(panel.getByText(`Cântar 1 / ${nc.weighings}`)).toBeVisible();
  // c4 / c7: total (its catches' sum), state, the catches «N. specie: kg».
  await expect(panel.getByText(new RegExp(`Total: ${escapeRe(nc.weighingKg)} kg`))).toBeVisible();
  await expect(panel.getByText('Terminat')).toBeVisible();
  await expect(panel.getByRole('listitem').filter({ hasText: new RegExp(`^1\\.\\s*(${nc.species.map(escapeRe).join('|')}): `) })).toBeVisible();
  // c8: the revision line and «Vezi istoric» (finished).
  await expect(panel.getByRole('button', { name: 'Acest cântar a avut o modificare.' })).toBeVisible();
  await settle(page);
  await expectNoA11yViolations(page);
  // c9: the history, read only now; back to the weighing.
  const revisions = page.waitForRequest(r => r.url().includes('/weighing-logs'));
  await panel.getByRole('button', { name: 'Vezi istoric' }).click();
  await revisions;
  await expect(panel.getByRole('heading', { name: 'Istoric modificări' })).toBeVisible();
  await expect(panel.getByText(/Modificarea 1 \[de /)).toBeVisible();
  await expect(panel.getByText(/Redeschis la/)).toBeVisible();
  await panel.getByRole('button', { name: 'Înapoi la cântar' }).click();
  await expect(panel.getByText(`Cântar 1 / ${nc.weighings}`)).toBeVisible();
  // Back from the history, focus returns to the control that opened it (never <body>).
  await expect(panel.getByRole('button', { name: 'Vezi istoric' })).toBeFocused();
  // c10: closing removes the params.
  await panel.getByRole('button', { name: 'Închide' }).click();
  await expect(panel).toBeHidden();
  await expect(page).not.toHaveURL(/cantar=/);
  expect(errors).toEqual([]);
});

test('competition-page.cantare.c2 c5 — from 1280, signed in: only the stands the summary lists are read; «Cronologic» puts the newest weighing first', async ({ page }) => {
  await signedIn(page);
  const byStand: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/feed/weighings/by-stand')) byStand.push(r.url());
  });
  await open(page, `/concursuri/${ID.live}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  await expect(table.getByText('Niciun cântar încă').first()).toBeVisible({ timeout: 30_000 });
  const stands = await snapshotStands(page, ID.live);
  expect(stands, 'the live competition has a timeline snapshot').toBeGreaterThan(4);
  await expect(page.getByText(new RegExp(`· ${roCount(stands, 'standuri')}$`))).toBeVisible();
  expect(byStand.length).toBeLessThan(stands);
  // The timeline: the starts read newest first.
  await page.getByRole('button', { name: 'Cronologic' }).click();
  await expect(page.getByRole('button', { name: 'Cronologic' })).toHaveAttribute('aria-pressed', 'true');
  await open(page, `/concursuri/${ID.rich}/cantare`);
  await page.getByRole('button', { name: 'Cronologic' }).click();
  const rich = page.getByRole('table', { name: /ordine cronologică/ });
  // A timeline row is named by its place in the competition («#114» the newest), not «Cântar 1» of its stand.
  await expect(rich.getByRole('button', { name: /^Cântarul #\d+$/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(rich.getByRole('button', { name: /^Cântar \d+$/ })).toHaveCount(0);
  const weighings = (await cmsData<unknown[]>(page, `/competitions/${ID.rich}/weighing-statistics`)).length;
  expect(weighings, 'the rich competition has a timeline worth sorting').toBeGreaterThan(20);
  await expect(page.getByText(new RegExp(`^${roCount(weighings, 'cântare')}`))).toBeVisible({ timeout: 30_000 });
  const starts = await rich.locator('tbody tr td:nth-child(4)').allInnerTexts();
  const key = (t: string) => {
    // «10.05, 16:55 – …» on one line or the day over the hours («10.05\n16:55 – …»).
    const m = t.match(/^(\d\d)\.(\d\d)[,\s]+(\d\d):(\d\d)/);
    return m ? `${m[2]}${m[1]}${m[3]}${m[4]}` : '';
  };
  const keys = starts.map(key).filter(Boolean);
  expect(keys.length).toBe(weighings);
  expect([...keys].sort().reverse()).toEqual(keys);
  await expect(rich.getByRole('button', { name: `Cântarul #${weighings}` })).toBeVisible();
});

test('competition-page.cantare.c1 c7 — 1280 with the detail docked: every column stays in the table’s box (no sideways scroll); the open row is marked on every cell', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`, LAPTOP);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand A1$/ }) });
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await press(page, row.getByRole('button', { name: 'Cântar 1' }), () => expect(panel).toBeVisible({ timeout: 3000 }));
  await settle(page);
  const box = page.locator('[data-weighings-scroll]');
  const { scrollWidth, clientWidth } = await box.evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  for (const col of ['Capturi', 'Kg', 'Stare']) await expect(table.getByRole('columnheader', { name: col, exact: true })).toBeInViewport();
  // The interval on two lines (the day, then the hours).
  const lines = await row
    .locator('td')
    .nth(2)
    .evaluate(el => [...el.children].map(c => ({ h: c.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(c).lineHeight) })));
  expect(lines).toHaveLength(2);
  for (const { h, lh } of lines) expect(h).toBeLessThan(lh * 1.5);
  // A one-weighing stand: the stand and angler cells take the mark too (not only from Cântar on).
  const bg = (l: ReturnType<Page['locator']>) => l.evaluate(el => getComputedStyle(el).backgroundColor);
  const marked = await bg(row.locator('td').nth(1));
  expect(await bg(row.getByRole('rowheader'))).toBe(marked);
  expect(await bg(row.locator('td').first())).toBe(marked);
});

test('competition-page.cantare.c1 c7 — 1440 at rest: the side column is there before any press (Rezumat cântare: the counts, the latest weighing); a press replaces it with the detail, closing brings it back; 1280 keeps it for the press', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`);
  const rest = page.getByRole('complementary', { name: 'Rezumat cântare' });
  await expect(rest).toBeVisible();
  await expect(rest.getByText('Cântare', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(rest.getByRole('button', { name: /Stand A\d/ }).first()).toBeVisible();
  // The kg apart from its number (owner rule 10).
  await expect(rest.getByText('kg', { exact: true }).first()).toBeVisible();
  // Both columns slide in: measure each once it has stopped moving.
  const restBox = await steadyBox(page, rest);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  const tableWidth = (await table.boundingBox())!.width;
  // Pressing the latest weighing opens its detail in the same column: the table does not move.
  await rest.getByRole('button', { name: /Stand A\d/ }).last().click();
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await expect(panel).toBeVisible();
  await expect(rest).toBeHidden();
  const panelBox = await steadyBox(page, panel);
  expect(Math.abs(panelBox.x - restBox.x)).toBeLessThan(2);
  expect(Math.abs((await table.boundingBox())!.width - tableWidth)).toBeLessThan(2);
  await settle(page);
  await expectNoA11yViolations(page);
  await panel.getByRole('button', { name: 'Închide' }).click();
  await expect(rest).toBeVisible();
  // 1280: the table needs the width; the column comes with a press only.
  await page.setViewportSize(LAPTOP);
  await expect(rest).toBeHidden();
});

test('competition-page.cantare.c1 — 1920 with the detail docked: the interval stays on one line and the angler column stops at 28rem (the numbers stay near the names)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`, WIDE);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand A1$/ }) });
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await press(page, row.getByRole('button', { name: 'Cântar 1' }), () => expect(panel).toBeVisible({ timeout: 3000 }));
  await settle(page);
  const interval = row.locator('td').nth(2);
  // One line: no day / hours blocks, and the text's boxes all on one line.
  await expect(interval.locator('> span.block')).toHaveCount(0);
  // The visible text only: the screen reader's «până la» sits in a 1px box where every word wraps.
  const lines = await interval.evaluate(el => {
    const bottoms = new Set<number>();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      if (node.parentElement?.closest('.sr-only') || !node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) bottoms.add(Math.round(r.bottom));
    }
    return bottoms.size;
  });
  expect(lines).toBe(1);
  const pescar = (await table.getByRole('columnheader', { name: 'Pescar', exact: true }).boundingBox())!;
  const box = (await table.boundingBox())!;
  // Capped (448px, plus its share of what is left), never the whole leftover width.
  expect(pescar.width).toBeLessThan(box.width * 0.5);
});

test('competition-page.cantare.c1 c2 — a sector per stand (24 × 1): one table without sector rows; the stands without a weighing are one row of chips; signed out the stands are read a few at a time', async ({ page }) => {
  let inFlight = 0;
  let peak = 0;
  const done = (url: string) => {
    if (url.includes('/feed/weighings/by-stand')) inFlight--;
  };
  page.on('request', r => {
    if (!r.url().includes('/feed/weighings/by-stand')) return;
    inFlight++;
    peak = Math.max(peak, inFlight);
  });
  page.on('requestfinished', r => done(r.url()));
  page.on('requestfailed', r => done(r.url()));
  await open(page, `/concursuri/${ID.live}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  const stands = await snapshotStands(page, ID.live);
  await expect(page.getByText(new RegExp(`^\\d+ (de )?cântare? · ${roCount(stands, 'standuri')}$`))).toBeVisible({ timeout: 45_000 });
  await expect(table.getByRole('columnheader', { name: /^Sector / })).toHaveCount(0);
  const empty = table.getByRole('list', { name: /fără cântar/ });
  await expect(empty).toHaveCount(1);
  const weighed = await table.getByRole('rowheader').count();
  await expect(empty.getByRole('listitem')).toHaveCount(stands - weighed);
  expect(peak).toBeLessThanOrEqual(4);
  await expectNoA11yViolations(page);
});

test('competition-page.cantare.c1 c5 — feeder from 1280: the caption names the leg, «Manșa N» switches it; a guest crew’s members line only when it says more; Cronologic keeps the open weighing in view', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.feederTeam}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  await expect(page.getByText(/^Manșa 2 · [\d.]+ (de )?cântare · [\d.]+ (de )?standuri$/)).toBeVisible({ timeout: 45_000 });
  // «Florin Varjan si Petrisor M» / «Florin Varjan si Petrisor Muraru»: the crew once.
  const crew = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand 1$/ }) });
  await expect(crew.getByText(/Florin Varjan/)).toHaveCount(1);
  // A team competition: the column is «Echipă», as on Participanți.
  await expect(table.getByRole('columnheader', { name: 'Echipă', exact: true })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Pescar', exact: true })).toHaveCount(0);
  // The CMS lists the sectors A, D, C, B and their stands out of order: the table sorts both (as Participanți).
  const sectors = await table.getByRole('columnheader', { name: /^Sector / }).allInnerTexts();
  expect(sectors.map(t => t.slice(0, 8))).toEqual([...sectors.map(t => t.slice(0, 8))].sort());
  const stands = (await table.getByRole('rowheader').allInnerTexts()).map(t => Number(t.match(/\d+/)?.[0]));
  expect(stands).toEqual([...stands].sort((a, b) => a - b));
  await page.getByRole('group', { name: 'Manșa cântarelor' }).getByRole('button', { name: 'Manșa 1' }).click();
  await expect(page.getByText(/^Manșa 1 · [\d.]+ (de )?cântare · [\d.]+ (de )?standuri$/)).toBeVisible({ timeout: 45_000 });
  // Open the last stand's weighing, then switch to the timeline: the row stays on screen.
  const last = table.getByRole('button', { name: /^Cântar \d+$/ }).last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await page.getByRole('button', { name: 'Cronologic' }).click();
  await expect(table.locator('tr[data-selected]')).toBeInViewport();
});

test('competition-page.cantar-detaliu.c9 competition-page.cantar-detaliu.s5 — signed out the history read is refused: «Eroare la încărcarea modificărilor.»', async ({ page }) => {
  await open(page, `/concursuri/${ID.nc}/cantare?cantar=${ID.ncWeighing}&stand=${ID.ncStand}`);
  // A link opens the detail after the first paint: from 1280 over the page (a dialog), so the
  // stands column never narrows by itself.
  const panel = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await panel.getByRole('button', { name: 'Vezi istoric' }).click();
  await expect(panel.getByText('Eroare la încărcarea modificărilor.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
});

test('competition-page.cantar-detaliu.c10 — switching view with the detail open drops ?cantar / ?stand; back on Cântare nothing reopens', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`);
  const item = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand A1$/ }) }).getByRole('button', { name: 'Cântar 1' });
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await press(page, item, () => expect(panel).toBeVisible({ timeout: 3000 }));
  await expect(page).toHaveURL(/cantar=/);
  await page.getByRole('tab', { name: /^Statistici/ }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.nc}/statistici$`));
  await page.getByRole('tab', { name: /^Cântare/ }).click();
  await expect(page.getByRole('table', { name: /Cântarele concursului/ }).getByRole('columnheader', { name: /^Sector A/ })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('complementary', { name: 'Detaliu cântar' })).toBeHidden();
  await expect(page).not.toHaveURL(/cantar=|stand=/);
});

test('competition-page.cantare.c4 — signed in, a stand with no weighing yet reads «Cântare: 0 / Extra-cântare: 0»', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/cantare`, TABLET);
  const cards = page.locator('[id^="stand-"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  // Every card has its counts line once the summary has answered (none is left without it).
  await expect.poll(async () => (await cards.allInnerTexts()).every(text => /Cântare: \d+/.test(text) && /Extra-cântare: \d+/.test(text)), { timeout: 30_000 }).toBe(true);
  await expect(cards.filter({ hasText: 'Cântare: 0' }).first()).toBeVisible();
});

test('competition-page.cantare.c4 competition-page.cantare.s2 — signed out: one note above the sectors, not a line on every card', async ({ page }) => {
  await open(page, `/concursuri/${ID.rich}/cantare`, PHONE);
  await expect(page.getByText('Deschide un stand ca să vezi cântarele lui.')).toHaveCount(1);
  await expect(page.getByText('Deschide standul pentru cântare')).toHaveCount(0);
});

test('competition-page.cantare.c1 competition-page.cantare.s1 — 375: every stand card fits the screen (a long allocation line truncates)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/cantare`, PHONE);
  const cards = page.locator('[id^="stand-"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[id^="stand-"]')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 0.5).map(el => el.id),
  );
  expect(overflow).toEqual([]);
});

test('competition-page.cantare.s2 — signed in: the signed-out note never shows while the session is read', async ({ page }) => {
  await signedIn(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __sawNote?: boolean };
    w.__sawNote = false;
    new MutationObserver(() => {
      if (document.body?.textContent?.includes('Deschide un stand ca să vezi cântarele lui.')) w.__sawNote = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await open(page, `/concursuri/${ID.rich}/cantare`, PHONE);
  const cards = page.locator('[id^="stand-"]');
  await expect.poll(async () => (await cards.allInnerTexts()).every(text => /Cântare: \d+/.test(text)), { timeout: 30_000 }).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __sawNote?: boolean }).__sawNote)).toBe(false);
});

test('competition-page.cantare.c5 — 1279: an open stand stays in its cell (selected); its weighings open as a row after its row, no card moves', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/cantare`, TABLET);
  const sector = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Sector A', level: 2 }) });
  const cards = sector.locator('[id^="stand-"]');
  await expect.poll(async () => (await cards.allInnerTexts()).every(text => /Cântare: \d+/.test(text)), { timeout: 30_000 }).toBe(true);
  const second = cards.nth(1);
  const third = cards.nth(2);
  const [before2, before3] = [await second.boundingBox(), await third.boundingBox()];
  await second.getByRole('button').first().click();
  await expect(second.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  const panel = sector.getByRole('region', { name: /^Cântarele standului/ });
  await expect(panel.getByRole('button', { name: /Cântar 1/ })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await second.scrollIntoViewIfNeeded();
  const [after2, after3, panelBox] = [await second.boundingBox(), await third.boundingBox(), await panel.boundingBox()];
  // Same size and same place in the row (relative to each other: the page may have scrolled).
  expect(Math.round(after2!.width)).toBe(Math.round(before2!.width));
  expect(Math.round(after3!.x - after2!.x)).toBe(Math.round(before3!.x - before2!.x));
  expect(Math.round(after3!.y - after2!.y)).toBe(Math.round(before3!.y - before2!.y));
  // The panel spans the row, below the open card.
  expect(panelBox!.y).toBeGreaterThan(after2!.y + after2!.height);
  expect(panelBox!.width).toBeGreaterThan(after2!.width * 2);
});

test('competition-page.cantar-detaliu.s2 competition-page.b.notif-weighing — a link to a weighing that no longer exists: «Cântarul nu mai există.», no dead-end retry', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare?cantar=nu0exista0cantar0e2e0000&stand=${ID.ncStand}`);
  const surface = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await expect(surface.getByText('Cântarul nu mai există.')).toBeVisible({ timeout: 45_000 });
  await expect(surface.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
  await surface.getByRole('button', { name: 'Închide' }).click();
  await expect(page).not.toHaveURL(/cantar=/);
});

test('competition-page.cantar-detaliu.c1 c5 competition-page.cantar-detaliu.s2 competition-page.b.notif-weighing — a link opens the detail; in progress: «Se actualizează în m:ss» counts down, «Actualizează» re-reads', async ({ page }) => {
  await open(page, `/concursuri/${ID.openWeighing}/cantare?cantar=${ID.openWeighingId}&stand=${ID.openStand}`, PHONE);
  // Phone: the bottom sheet (a modal dialog).
  const sheet = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('În curs', { exact: true })).toBeVisible();
  const countdown = sheet.getByText(/Se actualizează în \d:\d\d/);
  await expect(countdown).toBeVisible();
  const first = await countdown.textContent();
  await expect(countdown).not.toHaveText(first!, { timeout: 3000 });
  const reread = page.waitForRequest(r => r.url().includes(`/feed/weighings/${ID.openWeighingId}`));
  await sheet.getByRole('button', { name: 'Actualizează' }).click();
  await reread;
  await expect(countdown).toHaveText(/Se actualizează în (1:00|0:5\d)/);
  await settle(page);
  await expectNoA11yViolations(page);
});

test('competition-page.cantare.c2 competition-page.cantare.s1 — the summary is read only on the Cântare view', async ({ page }) => {
  await signedIn(page);
  const summaries: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/weighings-summary')) summaries.push(r.url());
  });
  await open(page, `/concursuri/${ID.nc}`);
  await page.waitForTimeout(1500);
  expect(summaries).toEqual([]);
  await press(page, page.getByRole('tab', { name: /Cântare/ }), () => expect.poll(() => summaries.length, { timeout: 3000 }).toBeGreaterThan(0));
  // No per-stand read until a stand is opened.
  expect(summaries.every(u => !u.includes('by-stand'))).toBe(true);
});

test('competition-page.cantare.c8 — the phone action bar «Cântare» tile opens the view', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}`, PHONE);
  await press(page, page.getByRole('region', { name: 'Bara de acțiuni' }).getByRole('button', { name: 'Vezi cântarele din concurs' }), () =>
    expect(page).toHaveURL(new RegExp(`/concursuri/${ID.live}/cantare`), { timeout: 3000 }),
  );
  await expect(page.getByRole('heading', { name: 'Sector A', level: 2 })).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Statistici                                                          */
/* ------------------------------------------------------------------ */

test('competition-page.statistici.c1 competition-page.statistici.s1 — signed out: the sign-in prompt', async ({ page }) => {
  await open(page, `/concursuri/${ID.rich}/statistici`);
  // The phone line (fish) and the desktop gate share the sentence; one of them is displayed.
  await expect(page.getByText('Trebuie să fii autentificat pentru a vedea statisticile.').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', /statistici/);
});

test('competition-page.statistici.c2 c3 c5 c6 c7 c8 c10 c11 c12 c13 c16 competition-page.statistici.s2 s7 — sessions, Top capturi, sector donut, thresholds', async ({ page }) => {
  await signedIn(page);
  const reads: string[] = [];
  page.on('request', r => {
    if (/best-n|catch-threshold|weighing-statistics/.test(r.url())) reads.push(r.url());
  });
  const errors = await open(page, `/concursuri/${ID.rich}`, PHONE);
  // c2: nothing Statistici-only before the view (Best N, the thresholds; the weighing statistics are
  // prefetched with the page for the strip from 768).
  expect(reads.filter(u => /best-n|catch-threshold/.test(u))).toEqual([]);
  // c16: the bar's Statistici tile.
  await press(page, page.getByRole('region', { name: 'Bara de acțiuni' }).getByRole('button', { name: 'Statistici' }), () =>
    expect(page).toHaveURL(/\/statistici$/, { timeout: 3000 }),
  );
  // c3: the summary as a bento (owner rule 9; phone): the navy biggest catch and the quantity tile
  // across, the small «Capturi» fact and the stand facts — never the word «capot» (rule 11).
  const summary = page.getByRole('list', { name: 'Rezumat' });
  await expect(summary.getByText('Cea mai mare captură')).toBeVisible();
  await expect(summary.getByText('Capturi', { exact: true })).toBeVisible();
  await expect(summary.getByText('Cantitate totală')).toBeVisible();
  await expect(summary.getByText('Standuri cu pește')).toBeVisible();
  await expect(summary.getByText('Fără capturi')).toBeVisible();
  await expect(summary).not.toContainText(/capot/i);
  // Rule 10: the unit is its own spaced element («2.961,0 kg», never «2.961,0kg»).
  await expect(summary.getByRole('listitem').nth(1)).toContainText(/\d,\d\s+kg/);
  const tiles = await summary.getByRole('listitem').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  expect(new Set(tiles).size).toBeGreaterThan(1);
  // c5–c8: sessions. The oracle is the CMS's weighings read here, never the builder the page draws
  // with (core buildWeighingSessions): competitions weigh in day halves, so the normal sessions are
  // the distinct (day, morning / evening) of the normal weighings' starts on the reader's clock,
  // numbered in order; extras sit between them as «Extra-cântar» rows.
  const weighings = await cmsData<WeighingStatisticsItem[]>(page, `/competitions/${ID.rich}/weighing-statistics`);
  const halves = [
    ...new Set(
      weighings
        .filter(w => w.weighingType !== 'extra')
        .map(w => new Date(w.startDate))
        .sort((a, b) => a.getTime() - b.getTime())
        .map(d => `${d.toDateString()}|${d.getHours() < 14 ? 'Dimineață' : 'Seară'}`),
    ),
  ];
  const expectedNormal = halves.map((key, i) => `Cântar ${i + 1} – ${key.split('|')[1]}`);
  const extraWeighings = weighings.filter(w => w.weighingType === 'extra').length;
  const sessions = page.getByRole('region', { name: 'Sesiuni de cântărire' });
  await expect(sessions.getByText('Cronologia cântăririlor și cantitatea totală per sesiune.')).toBeVisible();
  const rows = sessions.getByRole('listitem');
  const label = (text: string) => /Cântar \d+ – (Dimineață|Seară)|Extra-cântar/.exec(text)?.[0] ?? text;
  // Collapsed: the first SESSIONS_COLLAPSED_MAX rows, a «Vezi toate» for the rest.
  await expect(rows).toHaveCount(Math.min(SESSIONS_COLLAPSED_MAX, expectedNormal.length + extraWeighings));
  const more = sessions.getByRole('button', { name: /^Vezi toate cântarele \((\d+) ascunse\)$/ });
  await expect(more, 'the rich competition has more sessions than the collapsed card shows').toBeVisible();
  const hidden = Number(/\((\d+) ascunse\)/.exec((await more.innerText()) ?? '')![1]);
  // Rule 19: the state every visitor lands on — collapsed, the peeked last row — is AA too (only
  // its rail dot and bar fade, never its text).
  await expectNoA11yViolations(page, { include: '#sesiuni' });
  await more.click();
  await expect(sessions.getByRole('button', { name: 'Restrânge' })).toBeVisible();
  await expect(rows).toHaveCount(SESSIONS_COLLAPSED_MAX + hidden);
  const labels = (await rows.allInnerTexts()).map(label);
  // Every row is a numbered day half or an extra; the normal ones are exactly the CMS's day halves, in order.
  for (const l of labels) expect(l).toMatch(/^(Cântar \d+ – (Dimineață|Seară)|Extra-cântar)$/);
  expect(labels.filter(l => l !== 'Extra-cântar')).toEqual(expectedNormal);
  // Extras: a row exactly when the CMS has extra weighings, never more rows than extra weighings, never two in a row.
  const extras = labels.filter(l => l === 'Extra-cântar').length;
  expect(extras > 0).toBe(extraWeighings > 0);
  expect(extras).toBeLessThanOrEqual(extraWeighings);
  labels.forEach((l, i) => i > 0 && l === 'Extra-cântar' && expect(labels[i - 1], `row ${i + 1}`).not.toBe('Extra-cântar'));
  // Every weighed catch is in exactly one row.
  const rowCatches = (await rows.allInnerTexts()).map(t => Number((/([\d.]+) (de )?captur(i|ă)/.exec(t)?.[1] ?? '0').replace(/\./g, '')));
  expect(rowCatches.reduce((a, b) => a + b, 0)).toBe(weighings.reduce((sum, w) => sum + w.catchCount, 0));
  // Romanian plural (components/cards/format plural): «389 de capturi», as the facts tile says.
  await expect(sessions.getByText(`Total: ${roCount(await weighedCatches(page, ID.rich), 'capturi')}`)).toBeVisible();
  await expectRomanianCounts(sessions);
  // Weights: the Romanian grouping («2.961,0 kg», never «2961,0»), at the competition's precision.
  await expect(sessions.getByText(/^\d{1,3}(\.\d{3})*,\d+\s+kg$/).last()).toBeVisible();
  // c10 / c11: Top capturi → Best 3 ranking.
  const tops = page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' });
  await expect(tops.getByRole('button')).toHaveCount(3);
  await tops.getByRole('button').first().click();
  const best = page.getByRole('dialog', { name: 'Best 3 - Clasament' });
  await expect(best.getByRole('columnheader')).toHaveText(['Stand', 'Participant(e) / Echipă', 'Primele capturi (kg)', 'Medie']);
  await page.keyboard.press('Escape');
  // c12: the sector donut + legend (its first slice: the ranking's sectors in order); c13: the thresholds table.
  const { rankings } = await cmsRanking(page, ID.rich);
  const sector = [...new Set(rankings.map(r => r.sectorName!))].sort((a, b) => a.localeCompare(b))[0];
  const donut = page.getByRole('region', { name: 'Cantitate pe sector (kg)' });
  await expect(donut.getByRole('img')).toHaveAttribute('aria-label', new RegExp(`Sector ${sector} [\\d.]+,\\d+\\s+kg`));
  await expect(donut.getByText(new RegExp(`^Sector ${sector} · [\\d.]+,\\d+\\s+kg$`))).toBeVisible();
  expect(await anyThreshold(page, ID.rich), 'the rich competition has catches over 10 kg').toBe(true);
  const thresholds = page.getByRole('region', { name: 'Capturi', exact: true });
  await expect(thresholds.getByRole('columnheader')).toHaveText(['Sector', '10+', '15+', '20+', '25+', '30+']);
  await expect(thresholds.getByRole('rowheader', { name: 'General' })).toBeVisible();
  expect(reads.some(u => u.includes('best-n'))).toBe(true);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.statistici.c2 — 1440 on Clasament: the strip reads the weighing statistics, Best N and the thresholds wait for the Statistici view', async ({ page }) => {
  await signedIn(page);
  const reads: string[] = [];
  page.on('request', r => {
    if (/best-n|catch-threshold/.test(r.url())) reads.push(r.url());
  });
  await open(page, `/concursuri/${ID.rich}`);
  await expect(page.getByRole('group', { name: 'Concursul pe scurt' }).getByText('Ultimul cântar')).toBeVisible({ timeout: 30_000 });
  // Hydrated and settled on Clasament: anything the view would read has had its chance.
  await page.waitForTimeout(2000);
  expect(reads).toEqual([]);
  await press(page, page.getByRole('tab', { name: /Statistici/ }), () => expect(page).toHaveURL(/\/statistici$/, { timeout: 3000 }));
  await expect.poll(() => reads.some(u => u.includes('best-n')) && reads.some(u => u.includes('catch-threshold'))).toBe(true);
});

test('competition-page.statistici.c4 competition-page.statistici.s2 — a weighing-statistics re-read that fails keeps the sessions and offers «Reîncearcă»', async ({ page }) => {
  // The server prefetches the weighing statistics with the page, so in the browser a failure can
  // only be a re-read (the Statistici chip): what was read stays, with the retry. The no-data
  // branch (the message + «Încearcă din nou») is the same BlockError the other blocks use.
  await signedIn(page);
  let fail = true;
  await page.route('**/weighing-statistics', route => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
  await open(page, `/concursuri/${ID.rich}`);
  await press(page, page.getByRole('tab', { name: /Statistici/ }), () =>
    expect(page.getByText(/Date posibil neactualizate/)).toBeVisible({ timeout: 8000 }),
  );
  await expect(page.getByRole('region', { name: 'Sesiuni de cântărire' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(page.getByText(/Date posibil neactualizate/)).toBeHidden();
});

test('competition-page.statistici.c14 c15 competition-page.statistici.s6 s8 — National Championship: Penalizări, newest first, 3 then all; a referee revokes one', async ({ page }) => {
  await signedIn(page);
  const penalties = Array.from({ length: 5 }, (_, i) => ({
    documentId: `pen${i}`,
    action: i === 0 ? 'ELIMINATE' : i === 1 ? 'DEDUCT_TOTAL_WEIGHT' : 'WARNING',
    value: i === 1 ? 2.5 : null,
    reason: `Motiv ${i}`,
    createdAt: new Date(Date.UTC(2026, 4, 9, 10 + i)).toISOString(),
    author: { id: 1, username: 'Arbitru' },
  }));
  await page.route(`**/competitions/${ID.nc}/ranking`, async route => {
    const res = await route.fetch();
    const body = await res.json();
    body.rankings[0].teams[0].penalties = penalties;
    await route.fulfill({ response: res, json: body });
  });
  await page.route(`**/user/profile/competition/*/statute`, route => route.fulfill({ json: { userRole: 'referee' } }));
  let deleted = '';
  await page.route('**/penalties/*', route => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deleted = route.request().url();
    return route.fulfill({ status: 204 });
  });
  await open(page, `/concursuri/${ID.nc}`);
  // The Statistici chip re-reads the ranking (through the route above).
  const card = page.getByRole('region', { name: 'Penalizări' });
  await press(page, page.getByRole('tab', { name: /Statistici/ }), () => expect(card).toBeVisible({ timeout: 5000 }));
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await expect(card.getByRole('listitem').first()).toContainText('Avertisment');
  await expect(card.getByRole('listitem').first()).toContainText('Motiv 4');
  await card.getByRole('button', { name: 'Vezi toate penalizările (2 ascunse)' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(5);
  await expect(card.getByText('Penalizare greutate · 2,5 kg')).toBeVisible();
  await expect(card.getByText('Eliminare')).toBeVisible();
  await card.getByRole('button', { name: 'Ascunde' }).click();
  // c15: revoke.
  const reread = page.waitForRequest(r => r.url().endsWith(`/competitions/${ID.nc}/ranking`));
  await card.getByRole('button', { name: 'Revocă' }).first().click();
  const ask = page.getByRole('alertdialog', { name: 'Revocă penalizarea?' });
  await expect(ask.getByText('Acțiunea va elimina penalizarea din clasament.')).toBeVisible();
  await ask.getByRole('button', { name: 'Revocă' }).click();
  await reread;
  expect(deleted).toContain('/penalties/pen4');
  // The re-read runs through the route above: let its `route.fetch()` finish here, never inside the next test.
  await page.unrouteAll({ behavior: 'wait' });
});

test('competition-page.statistici.c9 competition-page.cronologie.c3 c6 competition-page.cronologie.s4 — the stand timeline card: top 6, «Vezi toate (N standuri)», expand to the page', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/statistici`);
  const stands = await snapshotStands(page, ID.live);
  expect(stands, 'the live competition has a timeline snapshot').toBeGreaterThan(0);
  const card = page.getByRole('region', { name: 'Cronologia standurilor' });
  await expect(card.getByText('Trage timpul de mai jos pentru a vedea evoluția scorurilor.')).toBeVisible();
  // StandTimeline CARD_MAX_STANDS: the card's top 6, fewer when the snapshot has fewer.
  await expect(card.getByRole('list').last().getByRole('button')).toHaveCount(Math.min(6, stands));
  await expect(card.getByRole('link', { name: `Vezi toate (${roCount(stands, 'standuri')}) →` })).toHaveAttribute('href', `/concursuri/${ID.live}/statistici/cronologie`);
  await card.getByRole('link', { name: 'Deschide cronologia standurilor pe toată pagina' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cronologia standurilor' })).toBeVisible();
});

test('competition-page.statistici.c3 c9 competition-page.cronologie.c3 competition-page.statistici.s2 — no snapshot (204) after the competition: «Cronologia nu este disponibilă…» is the sessions card\'s footer, not a card of filler', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`);
  const sessions = page.getByRole('region', { name: 'Sesiuni de cântărire' });
  await expect(sessions.getByText('Cronologia nu este disponibilă pentru acest concurs.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Cronologia standurilor' })).toHaveCount(0);
  // Completed: never «… încă» beside 9 sessions.
  await expect(page.getByText('Nu există cântăriri înregistrate încă.')).toHaveCount(0);
});

for (const [kind, id, one, many] of [
  ['feeder', ID.feederTeam, 'echipă', 'echipe'],
  ['national championship', ID.nc, 'stand', 'standuri'],
] as const) {
  test(`competition-page.statistici.c3 — ${kind} at 375: the bento has the per-entrant facts the strip counts («${many} cu pește», «Fără capturi», «Media pe ${one}», «Capturi pe ${one}»)`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${id}/statistici`, PHONE);
    const summary = page.getByRole('list', { name: 'Rezumat' }).locator('visible=true');
    await expect(summary.getByText('Medie pe captură')).toBeVisible({ timeout: 30_000 });
    const label = many.charAt(0).toUpperCase() + many.slice(1);
    const withFish = summary.getByRole('listitem').filter({ hasText: `${label} cu pește` });
    await expect(withFish).toBeVisible();
    await expect(withFish).toContainText(/\d+\s*\/\d+/);
    await expect(summary.getByText('Fără capturi')).toBeVisible();
    await expect(summary.getByText(`Media pe ${one}`, { exact: true })).toBeVisible();
    await expect(summary.getByText(`Capturi pe ${one}`, { exact: true })).toBeVisible();
    await expect(summary).not.toContainText(/capot/i);
    await expectNoA11yViolations(page, { include: '[aria-label="Rezumat"]' });
  });

  test(`competition-page.statistici.c3 — ${kind} at 1440: the strip over the views stays (the same on every view), the bento under it only adds the facts it does not say, as the chart grid's first cell (never a near-empty row)`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${id}/statistici`);
    const summary = page.getByRole('list', { name: 'Rezumat' });
    const perCatch = summary.getByRole('listitem').filter({ hasText: 'Medie pe captură' });
    await expect(perCatch).toBeVisible({ timeout: 30_000 });
    const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
    // Rules 5 / 9 / 16: no row of one ~260px tile under the tabs — the facts are the first cell of the
    // chart grid (its first column from 1280). Feeder legs and club rankings count their teams (the
    // strip's own counts), so the cell is the pair, filling its row — never one lone tile beside
    // ~470px of empty grid.
    let cell = await factsCell(page);
    expect(cell.inGrid && cell.first).toBe(true);
    expect(cell.width).toBeLessThanOrEqual(cell.gridWidth / 2 + 1);
    expect(cell.tiles).toHaveLength(2);
    expect(cell.filled).toBeGreaterThanOrEqual(0.9);
    const perEntrant = summary.getByRole('listitem').filter({ hasText: `Capturi pe ${one}` });
    await expect(perEntrant).toBeVisible();
    await expect(perEntrant).toContainText(new RegExp(`pe (1 ${one}|\\d+ (de )?${many})`));
    // Rule 4 / item 8: the strip's captions are backed by the entrants (feeder) or the club teams
    // (NC), never the stock «în tot concursul».
    await expect(strip.getByText('în tot concursul')).toHaveCount(0);
    await expect(strip.locator('> *').filter({ hasText: /^Capturi/ })).toContainText(/cu pește[\s\S]*·[\s\S]*fără capturi/);
    await expect(strip.locator('> *').filter({ hasText: 'Cantitate totală' })).toContainText(/media pe (stand|echipă|participant)/);
    // The headline numbers are the strip's, never twice on screen: the bento does not repeat them.
    await expect(strip).toBeVisible();
    await expect(strip.getByText('Cea mai mare captură')).toBeVisible();
    for (const headline of ['Cea mai mare captură', 'Cantitate totală', 'Capturi']) {
      // «Capturi», not the per-entrant fact «Capturi pe echipă / stand».
      await expect(summary.getByRole('listitem').filter({ hasText: new RegExp(`^${headline}(?! pe )`) }).locator('visible=true')).toHaveCount(0);
    }
    await expect(summary).not.toContainText(/capot/i);
    // 768–1279: the same strip; the facts are still the grid's first cell, never under half filled.
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(strip).toBeVisible();
    cell = await factsCell(page);
    expect(cell.inGrid && cell.first).toBe(true);
    expect(cell.tiles).toHaveLength(2);
    expect(cell.filled).toBeGreaterThanOrEqual(0.9);
  });
}

test('competition-page.statistici.c3 — live at 1440: the weighing tile stays in the strip on Statistici («Toate cântarele» → Cântare); one precision, units apart', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/statistici`);
  const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
  await expect(strip).toBeVisible({ timeout: 30_000 });
  await expect(strip.getByText(/Ultimul cântar|Cântar în curs|Extra-cântar în curs|Cântare în curs/).first()).toBeVisible({ timeout: 30_000 });
  await strip.getByRole('button', { name: 'Toate cântarele' }).click();
  await expect(page).toHaveURL(/\/cantare$/);
  await page.goBack();
  // Rules 5 / 9 / 16: the facts are the chart grid's first cell, at least half filled.
  await expect(page.getByRole('list', { name: 'Rezumat' }).getByRole('listitem').filter({ hasText: 'Medie pe captură' })).toBeVisible();
  const cell = await factsCell(page);
  expect(cell.inGrid && cell.first).toBe(true);
  expect(cell.filled).toBeGreaterThanOrEqual(0.5);
  // Rule 10 / one precision: the session total, the donut legend — figure, then «kg» apart.
  const sessions = page.getByRole('region', { name: 'Sesiuni de cântărire' });
  await expect(sessions.getByText(/^Total: (1 captură|[\d.]+ (de )?capturi)$/)).toBeVisible();
  await expectRomanianCounts(sessions);
  const donut = page.getByRole('region', { name: 'Cantitate pe sector (kg)' });
  // The sector rows carry the quantity after the weight penalties: the card says so exactly when
  // the ranking holds a DEDUCT_TOTAL_WEIGHT penalty (the CMS decides, not today's data).
  if ((await deductedKg(page, ID.live)) > 0) await expect(donut.getByText(/după penalizările de greutate/)).toBeVisible();
  else await expect(donut.getByText('Cantitatea totală de pește cântărită pe fiecare sector al competiției.')).toBeVisible();
  const legendUnit = donut.getByRole('listitem').first().locator('span').last();
  await expect(legendUnit).toHaveText(/^\s*kg$/);
});

for (const [kind, id, label] of [
  ['feeder', ID.feederTeam, /^[A-Z]+\d+$/],
  // nationalStandLabel: «A3(10)» with a draw position, the plain «A10» without one (this data has none).
  ['national championship', ID.nc, /^[A-Z]+\d+(\(\d+\))?$/],
] as const) {
  test(`competition-page.statistici.c3 — ${kind} at 1280: the weighing tile names who was weighed, the stand as the page names it`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${id}`, LAPTOP);
    const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
    const tile = strip.locator('> *').filter({ hasText: 'Ultimul cântar' });
    await expect(tile).toBeVisible({ timeout: 30_000 });
    const caption = tile.locator('p').last();
    // «<name> · <stand> · N capturi» («21 de capturi» from 20): a name before the stand, never the
    // stand alone (the facts are flex items: innerText breaks lines between them).
    await expect(caption).toHaveText(/^[^·\s][^·]*·[^·]+·\s*[\d.]+ (de )?captur(ă|i)$/);
    // A wrap never leaves a line ending or starting with «·» (Facts: the separator that opens a
    // line is clipped): every visible «·» has a fact on its left on the same line.
    const dangling = await caption.evaluate(p => {
      const clip = p.querySelector('span')!.getBoundingClientRect();
      return [...p.querySelectorAll('[aria-hidden]')]
        .filter(d => d.textContent === '·')
        .filter(d => d.getBoundingClientRect().right > clip.left + 1 && d.getBoundingClientRect().left < clip.left + 1).length;
    });
    expect(dangling).toBe(0);
    const stand = (await caption.innerText()).split('·').at(-2)!.trim().replace(/^Stand\s*/, '');
    expect(stand).toMatch(label);
  });
}

test('competition-page.statistici.c3 c10 c12 — 1440, not one catch nor weighing: the summary line and one empty state, no Top capturi of «-», no ring of 0', async ({ page }) => {
  await signedIn(page);
  await noCatchView(page);
  await expect(page.getByText(/Nicio captură înregistrată/).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sesiuni de cântărire' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Cantitate pe sector (kg)' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Capturi', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Cronologia standurilor' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/capot/i);
  await page.unrouteAll({ behavior: 'wait' });
});

/**
 * Owner rule 10 on every surface: each unit in `scope` («kg», «standuri») is its own smaller element
 * in a colour of its own — never the number's ink at a smaller size. Returns how many were checked.
 */
async function expectMutedUnits(scope: ReturnType<Page['locator']>) {
  const units = await scope.evaluate(root =>
    [...root.querySelectorAll('[data-unit]')]
      .filter(u => (u as HTMLElement).offsetParent !== null)
      .map(u => {
        const num = u.parentElement!.querySelector('[data-number]')!;
        const a = getComputedStyle(num);
        const b = getComputedStyle(u);
        return { text: `${num.textContent} ${u.textContent?.trim()}`, numColor: a.color, unitColor: b.color, numSize: parseFloat(a.fontSize), unitSize: parseFloat(b.fontSize) };
      }),
  );
  for (const u of units) {
    expect(u.unitColor, `${u.text}: the unit takes the surface's muted tone, not the number's`).not.toBe(u.numColor);
    expect(u.unitSize, `${u.text}: the unit is smaller than the number`).toBeLessThan(u.numSize);
  }
  return units.length;
}

test('competition-page.statistici.c3 — owner rule 10 (375): every unit of the phone bento is muted and smaller than its number, on every tint', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`, PHONE);
  const summary = page.getByRole('list', { name: 'Rezumat' }).locator('visible=true');
  await expect(summary).toContainText(/\d,\d\s+kg/, { timeout: 30_000 });
  expect(await expectMutedUnits(summary)).toBeGreaterThan(1);
});

test('competition-page.statistici.c3 — owner rule 10 (1440): the strip (the weighing tile too) and the desktop facts keep each unit muted and smaller', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`);
  const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
  await expect(strip.getByText('Ultimul cântar')).toBeVisible({ timeout: 30_000 });
  await expect(strip.locator('> *').filter({ hasText: 'Ultimul cântar' })).toContainText(/\d,\d+\s+kg/);
  // The navy, indigo and the weighing tile's tint each carry a unit.
  expect(await expectMutedUnits(strip)).toBeGreaterThanOrEqual(3);
  const facts = page.getByRole('list', { name: 'Rezumat' }).locator('visible=true');
  await expect(facts).toContainText(/\d,\d\s+kg/);
  expect(await expectMutedUnits(facts)).toBeGreaterThan(0);
});

test('competition-page.statistici.c10 — 1440: text on a chart card\'s white inset is ink, not the tint (Best N labels and «-»)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`);
  const card = page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' });
  const label = card.getByText('Best 3', { exact: true });
  await expect(label).toBeVisible({ timeout: 30_000 });
  const { inset, tint, best } = await label.evaluate(el => {
    const section = el.closest('section')!;
    const inset = section.querySelector(':scope > div:last-child')!;
    return { inset: getComputedStyle(inset).color, tint: getComputedStyle(section).color, best: getComputedStyle(el).color };
  });
  expect(inset).not.toBe(tint);
  expect(best).not.toBe(tint);
});

test('competition-page.statistici.c3 — CLS: a ranking with no catch keeps the stat row\'s height (one row from 1280, two on a tablet), so nothing under it moves when the bones or the first catch swap in', async ({ page }) => {
  await signedIn(page);
  await noCatchView(page);
  const strip = page.locator('[data-summary-strip]').locator('visible=true');
  await expect(strip).toBeVisible({ timeout: 30_000 });
  // The strip is the same over every view (Statistici here, where the routed re-read lands).
  // The bones are server-rendered (the ranking is prefetched), so the browser never sees them swap:
  // what holds is that the strip is exactly its reserved slot (the bones' row, StatRowBones), not its
  // one line of text — no pixel literal, so a token change moves both together.
  const slot = () =>
    strip.evaluate(p => ({ height: Math.round(p.getBoundingClientRect().height), reserved: Math.round(parseFloat(getComputedStyle(p).minHeight)) }));
  const wide = await slot();
  expect(wide.reserved).toBeGreaterThan(0);
  expect(wide.height).toBe(wide.reserved);
  await page.setViewportSize({ width: 1024, height: 900 });
  // The tablet's two rows of tiles: a slot sized for one row would hide the jump.
  await expect.poll(async () => (await slot()).reserved).toBeGreaterThan(wide.reserved * 1.5);
  const tablet = await slot();
  expect(tablet.height).toBe(tablet.reserved);
  await page.unrouteAll({ behavior: 'wait' });
});

for (const width of [320, 375]) {
  test(`competition-page.statistici.c3 — ${width}: a three-decimal «Cantitate totală» fits its tile (the unit never runs past it)`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${ID.feederTeam}/statistici`, { width, height: 800 });
    const tile = page.getByRole('list', { name: 'Rezumat' }).getByRole('listitem').filter({ hasText: 'Cantitate totală' });
    await expect(tile).toContainText(/\d,\d{3}\s+kg/, { timeout: 30_000 });
    const fits = await tile.evaluate(li => {
      const box = li.firstElementChild as HTMLElement;
      return box.scrollWidth <= box.clientWidth && li.getBoundingClientRect().right <= window.innerWidth;
    });
    expect(fits).toBe(true);
  });
}

test('competition-page.statistici.c6 c13 — live, many sectors: no table of zeros, the donut legend in columns keeps its card short, the last odd card takes the row', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/statistici`);
  const donut = page.getByRole('region', { name: 'Cantitate pe sector (kg)' });
  await expect(donut).toBeVisible({ timeout: 30_000 });
  // c13: the «Capturi» table only when a count is above 0 — every count 0 (a live competition's
  // usual state) draws no table of zeros.
  await expect(page.getByRole('region', { name: 'Capturi', exact: true })).toHaveCount((await anyThreshold(page, ID.live)) ? 1 : 0);
  expect((await donut.boundingBox())!.height).toBeLessThan(420);
});

test('competition-page.statistici.c11 c13 — the thresholds and Best N tables have a coloured header band (owner rule 12)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`);
  const thresholds = page.getByRole('region', { name: 'Capturi', exact: true });
  const head = thresholds.getByRole('columnheader').first();
  await expect(head).toBeVisible({ timeout: 30_000 });
  const bg = await head.evaluate(th => getComputedStyle(th).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' }).getByRole('button').first().click();
  const best = page.getByRole('dialog', { name: 'Best 3 - Clasament' });
  const bestBg = await best.getByRole('columnheader').first().evaluate(th => getComputedStyle(th).backgroundColor);
  expect(bestBg).toBe(bg);
});

test('competition-page.statistici.c13 — owner rule 16: the thresholds table is as wide as its content at 1920 (the numbers stay by their sector)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`, WIDE);
  const table = page.getByRole('region', { name: 'Capturi', exact: true }).locator('table');
  await expect(table).toBeVisible({ timeout: 30_000 });
  expect((await table.boundingBox())!.width).toBeLessThanOrEqual(560);
});

test('competition-page.statistici.c13 — 375: the six-column thresholds table fits its white inset, no sideways scroll', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`, PHONE);
  const region = page.getByRole('region', { name: 'Capturi pe praguri de greutate' });
  await expect(region).toBeVisible({ timeout: 30_000 });
  const { scrollWidth, clientWidth } = await region.evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  const last = (await region.getByRole('columnheader', { name: '30+' }).boundingBox())!;
  const box = (await region.boundingBox())!;
  expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
  // The rows keep their full name for assistive tech («Sector A»), the letter on screen.
  await expect(region.getByRole('rowheader', { name: 'Sector A' })).toBeVisible();
});

test('competition-page.statistici.c10 — owner rule 16 at 1920: each Top capturi row has its face beside the name, only the chevron at the far end', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`, WIDE);
  const row = page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' }).getByRole('button').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const { gap, chevron } = await row.evaluate(btn => {
    const face = btn.querySelector('[data-face]')!.getBoundingClientRect();
    const name = btn.querySelector('.truncate')!.getBoundingClientRect();
    const svg = btn.querySelector(':scope > svg')!.getBoundingClientRect();
    return { gap: name.left - face.right, chevron: btn.getBoundingClientRect().right - svg.right };
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  // The stand mark then the name, right after the face (never ~700px across the card).
  expect(gap).toBeLessThan(80);
  expect(chevron).toBeLessThan(24);
});

test('competition-page.cronologie.s2 competition-page.statistici.s2 — offline with nothing cached: the timeline card says so with its retry, never bones for ever', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}`);
  await page.context().setOffline(true);
  try {
    await page.getByRole('tab', { name: /Statistici/ }).click();
    const card = page.getByRole('region', { name: 'Cronologia standurilor' });
    await expect(card.getByText('Ești offline. Conținutul se va încărca când revine conexiunea.')).toBeVisible({ timeout: 30_000 });
    await expect(card.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
    await expect(card.getByRole('status', { name: 'Se încarcă cronologia standurilor' })).toHaveCount(0);
  } finally {
    await page.context().setOffline(false);
  }
});

test('competition-page.cronologie.c1 c4 c5 c7 c8 c9 competition-page.cronologie.s5 s6 — the page: every stand, chips, slider, play, focus readout', async ({ page }) => {
  await signedIn(page);
  const errors = await open(page, `/concursuri/${ID.live}/statistici/cronologie`);
  // From 768 the breadcrumb is the way back (the back chip is the phone's).
  await expect(page.getByRole('button', { name: 'Înapoi la statistici' })).toBeHidden();
  const rows = page.getByRole('list', { name: /Standurile după/ }).getByRole('button');
  await expect(rows).toHaveCount(await snapshotStands(page, ID.live));
  // c4: sector chips (Toate first) and metric chips, the default metric checked.
  const sectors = page.getByRole('radiogroup', { name: 'Sector' });
  await expect(sectors.getByRole('radio', { name: 'Toate' })).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Indicator' }).getByRole('radio', { name: 'Cantitate' })).toBeChecked();
  // c5: ranked; the row label «A1» (the stand name carries its sector), «x,xxx kg» (fish: three
  // decimals; the ro-RO grouping), or «—» (named «fără valoare»).
  await expect(rows.first()).toHaveAccessibleName(/^Locul \d+: Sector A, standul A1, (\d{1,3}(\.\d{3})*,\d{3} kg|fără valoare)$/);
  // c5: a stand with no value yet reads «—» (fish formatMetricValue).
  await expect(page.getByRole('button', { name: /fără valoare$/ }).first()).toContainText('—');
  await expect(rows.first()).toContainText(/^A1/);
  await expect(rows.first()).not.toContainText('A/A1');
  await expect(page.getByRole('button', { name: /^Locul 1: / })).toBeVisible();
  // c7: the slider starts at the latest event; its labels.
  const slider = page.getByRole('slider', { name: 'Momentul din concurs' });
  const end = await slider.getAttribute('max');
  // c8: play from the end rewinds to the start and moves; dragging pauses.
  await page.getByRole('button', { name: 'Redă evoluția' }).click();
  await expect(page.getByRole('button', { name: 'Pauză' })).toBeVisible();
  await page.waitForTimeout(600);
  expect(Number(await slider.inputValue())).toBeLessThan(Number(end));
  await slider.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'Redă evoluția' })).toBeVisible();
  // c9: a stand focused: the readout; pressed again clears.
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Sector A, Standul A1')).toBeVisible();
  await expect(page.getByText('ULTIMA CÂNTĂRIRE')).toBeVisible();
  await page.getByRole('button', { name: 'Închide' }).click();
  await expect(page.getByText('Sector A, Standul A1')).toBeHidden();
  // A sector chip: «A1» without the sector. A focus on a stand the sector does not hold is dropped
  // (no greyed chart with no readout).
  await rows.first().click();
  await expect(page.getByText('ULTIMA CÂNTĂRIRE')).toBeVisible();
  await sectors.getByText('Sector B', { exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAccessibleName(/^Locul 1: Standul B1, /);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Închide' })).toBeVisible();
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.cronologie.c2 competition-page.cronologie.s1 — notStarted: no chart, nothing read', async ({ page }) => {
  await signedIn(page);
  const reads: string[] = [];
  page.on('request', r => {
    if (r.url().includes('timeline-snapshot')) reads.push(r.url());
  });
  await open(page, `/concursuri/${ID.upcoming}/statistici/cronologie`);
  await expect(page.getByText('Cronologia apare după primul cântar.')).toBeVisible();
  expect(reads).toEqual([]);
});

test('competition-page.cronologie.c3 competition-page.cronologie.s2 — error: «Nu s-a putut încărca cronologia.» + retry', async ({ page }) => {
  await signedIn(page);
  await page.route('**/timeline-snapshot', route => route.fulfill({ status: 500, body: '{}' }));
  await open(page, `/concursuri/${ID.live}/statistici/cronologie`, PHONE);
  await expect(page.getByText('Nu s-a putut încărca cronologia.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Toți peștii                                                         */
/* ------------------------------------------------------------------ */

test('competition-page.toti-pestii.c1 c2 c3 c4 c5 c7 competition-page.toti-pestii.s4 s5 s6 — sorts, stand / sector filter, rows, paging', async ({ page }) => {
  const reads: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/catches')) reads.push(r.url());
  });
  const { pagination } = await cmsJson<{ pagination: { total: number } }>(page, `/competitions/${ID.rich}/catches?sort=weight_desc&page=1&pageSize=${CATCHES_PAGE}`);
  expect(pagination.total, 'the rich competition has more than one page of catches').toBeGreaterThan(CATCHES_PAGE);
  const errors = await open(page, `/concursuri/${ID.rich}/capturi`, PHONE);
  const sorts = page.getByRole('radiogroup', { name: 'Sortare capturi' });
  // Phone: fish's sort chips (radio buttons, §4b.25); from 768 the kit choice chips.
  await expect(sorts.getByRole('radio')).toHaveText(['Cei mai mari', 'Cei mai mici', 'Pe stand', 'Pe sector']);
  await expect(sorts.getByRole('radio', { name: 'Cei mai mari' })).toBeChecked();
  const list = page.locator('ul').filter({ hasText: / kg/ }).first();
  await expect(list.getByRole('listitem')).toHaveCount(Math.min(CATCHES_PAGE, pagination.total), { timeout: 30_000 });
  // c5: the stand badge, weight + species, the competitor.
  await expect(list.getByRole('listitem').first()).toContainText(/Stand [A-Z]\d+/);
  await expect(list.getByRole('listitem').first()).toContainText(' kg');
  // c3: the next page loads near the end (and «Încarcă mai mult» stays as the explicit way).
  await expect(page.getByRole('button', { name: 'Încarcă mai mult' })).toBeVisible();
  await page.getByRole('button', { name: 'Încarcă mai mult' }).scrollIntoViewIfNeeded();
  await expect.poll(() => list.getByRole('listitem').count()).toBeGreaterThan(CATCHES_PAGE);
  // c4: no duplicates across pages.
  const ids = await list.getByRole('listitem').allInnerTexts();
  expect(ids.length).toBe(Math.min(2 * CATCHES_PAGE, pagination.total));
  // c2: Pe sector → sector chips, the first picked, filtered on the server.
  await sorts.getByText('Pe sector').click();
  const filter = page.getByRole('radiogroup', { name: 'Sector' });
  await expect(filter.getByRole('radio', { name: 'A' })).toBeChecked();
  await expect.poll(() => reads.some(u => u.includes('sectorName=A'))).toBe(true);
  await sorts.getByText('Pe stand').click();
  const stands = page.getByRole('radiogroup', { name: 'Stand' });
  await expect(stands.locator('label').first()).toHaveText('A1');
  await expect.poll(() => reads.some(u => u.includes('standKey=A1'))).toBe(true);
  // c7: fresh 5 minutes — coming back to «Cei mai mari» does not re-read page 1.
  const before = reads.filter(u => u.includes('sort=weight_desc') && u.includes('page=1')).length;
  await sorts.getByText('Cei mai mari').click();
  await page.waitForTimeout(800);
  expect(reads.filter(u => u.includes('sort=weight_desc') && u.includes('page=1')).length).toBe(before);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.toti-pestii.c2 c4 competition-page.toti-pestii.s5 s6 — stands named with their sector: the chip reads «A1», the filter sends the CMS key «AA1»; a catch repeated across pages shows once', async ({ page }) => {
  const reads: string[] = [];
  let first: unknown = null;
  await page.route('**/catches?**', async route => {
    const url = route.request().url();
    reads.push(url);
    const res = await route.fetch();
    const body = await res.json();
    if (url.includes('sort=weight_desc') && url.includes('page=1&')) first = body.data[0];
    // c4: page 2 repeats page 1's first catch (a catch landed between the two reads).
    if (url.includes('sort=weight_desc') && url.includes('page=2&') && first) body.data = [first, ...body.data];
    await route.fulfill({ response: res, json: body });
  });
  const { pagination } = await cmsJson<{ pagination: { total: number } }>(page, `/competitions/${ID.live}/catches?sort=weight_desc&page=1&pageSize=${CATCHES_PAGE}`);
  expect(pagination.total, 'the live competition has more than one page of catches').toBeGreaterThan(CATCHES_PAGE);
  await open(page, `/concursuri/${ID.live}/capturi`, PHONE);
  const list = page.locator('ul').filter({ hasText: / kg/ }).first();
  await expect(list.getByRole('listitem')).toHaveCount(CATCHES_PAGE, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Încarcă mai mult' }).scrollIntoViewIfNeeded();
  await expect.poll(() => reads.some(u => u.includes('page=2&'))).toBe(true);
  await expect.poll(() => list.getByRole('listitem').count()).toBeGreaterThan(CATCHES_PAGE);
  const texts = await list.getByRole('listitem').allInnerTexts();
  const head = texts[0];
  expect(texts.filter(t => t === head)).toHaveLength(1);
  const sorts = page.getByRole('radiogroup', { name: 'Sortare capturi' });
  await sorts.getByText('Pe stand').click();
  const stands = page.getByRole('radiogroup', { name: 'Stand' });
  await expect(stands.locator('label').first()).toHaveText('A1');
  await expect(stands.getByRole('radio', { name: 'A1', exact: true })).toBeChecked();
  await expect.poll(() => reads.some(u => u.includes('standKey=AA1'))).toBe(true);
  await stands.getByText('B1', { exact: true }).click();
  await expect.poll(() => reads.some(u => u.includes('standKey=BB1'))).toBe(true);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('competition-page.toti-pestii.c6 competition-page.toti-pestii.s2 — a failed read: the error and its retry', async ({ page }) => {
  let fail = true;
  await page.route('**/catches?**', route => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
  await open(page, `/concursuri/${ID.rich}`);
  await page.getByRole('tab', { name: /Toți peștii/ }).click();
  await expect(page.getByText('Nu s-au putut încărca capturile.')).toBeVisible({ timeout: 30_000 });
  fail = false;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByText(/^\d[\d,]* kg$/).first()).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Statistici pescar                                                   */
/* ------------------------------------------------------------------ */

test('competition-page.statistici-pescar.c1 c3 c4 c7 competition-page.statistici-pescar.s2 s3 s6 — below 1024 a row pressed opens the angler (from 1024 it is the person popover, owner rule 17); an account: three stats; a guest: the note', async ({ page }) => {
  await signedIn(page);
  const batches: string[] = [];
  page.on('request', r => {
    if (r.url().includes('statistics') && r.method() === 'POST') batches.push(r.url());
  });
  const core = await cmsCore(page, ID.rich);
  const guest = core.registrations.find(r => r.documentId === ID.richGuest)!;
  const angler = core.registrations.find(r => r.documentId === ID.richAngler)!;
  expect(guest.participants, 'ID.richGuest is a guest registration (no Bluvi account)').toHaveLength(0);
  expect(angler.participants.length, 'ID.richAngler has a Bluvi account').toBeGreaterThan(0);
  const errors = await open(page, `/concursuri/${ID.rich}`, TABLET_768);
  // c1: the table row (keyboard: Enter); 768–1279 the angler is a dialog over the page.
  const row = page.locator('tbody tr').locator('visible=true').filter({ hasText: entrantName(guest) }).first();
  await expect(row).toHaveAttribute('data-pressable', '', { timeout: 30_000 });
  await row.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Statistici pescar' });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`pescar=${ID.richGuest}`));
  // c4: a guest.
  await expect(panel.getByText('Invitat · statistici indisponibile')).toBeVisible();
  await expect(panel.getByText('Pescarul nu are cont Bluvi.')).toBeVisible();
  await panel.getByRole('button', { name: 'Închide' }).click();
  await expect(page).not.toHaveURL(/pescar=/);
  // c3 / c7: a link to an angler with an account: name, «Sector A · Standul 1», the three stats. A
  // link opens after the first paint: from 1280 over the page, so the ranking never narrows.
  await page.setViewportSize(DESKTOP);
  await page.goto(`/concursuri/${ID.rich}?pescar=${ID.richAngler}`);
  const linked = page.getByRole('dialog', { name: 'Statistici pescar' });
  const at = standOf(core, angler.stand!.documentId);
  await expect(linked.getByText(`Sector ${at.sector} · Standul ${at.label.slice(at.sector.length)}`, { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(linked.getByText('Capturi', { exact: true })).toBeVisible();
  await expect(linked.getByText('C.M.M.C', { exact: true })).toBeVisible();
  await expect(linked.getByText('Competiții', { exact: true })).toBeVisible();
  await expect.poll(() => batches.length).toBeGreaterThan(0);
  await settle(page);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.statistici-pescar.c3 — «Vezi profilul» opens the angler profile /pescari/[id] (pointer and keyboard)', async ({ page }) => {
  await signedIn(page);
  const core = await cmsCore(page, ID.rich);
  const angler = core.registrations.find(r => r.documentId === ID.richAngler)!;
  const person = angler.participants[0].documentId!;
  await open(page, `/concursuri/${ID.rich}?pescar=${ID.richAngler}`);
  const panel = page.getByRole('dialog', { name: 'Statistici pescar' });
  const link = panel.getByRole('link', { name: 'Vezi profilul' });
  await expect(link).toHaveCount(1, { timeout: 45_000 });
  await expect(link).toHaveAttribute('href', `/pescari/${person}`);
  await link.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(`**/pescari/${person}`);
  await expect(page.getByTestId('profile-name')).toBeVisible({ timeout: 45_000 });
});

test('competition-page.statistici-pescar.c5 — a team: each member with an account has its own «Vezi profilul» → /pescari/[id]', async ({ page }) => {
  await signedIn(page);
  const core = await cmsCore(page, ID.teamMembers);
  const crew = core.registrations.find(r => r.documentId === ID.teamMembersCrew);
  test.skip(!crew || crew.participants.length < 2, `ID.teamMembersCrew is no longer a crew of two accounts in ${ID.teamMembers}`);
  await open(page, `/concursuri/${ID.teamMembers}?pescar=${ID.teamMembersCrew}`);
  const panel = page.getByRole('dialog', { name: 'Statistici pescar' });
  const links = panel.getByRole('link', { name: 'Vezi profilul' });
  await expect(links).toHaveCount(crew!.participants.length, { timeout: 45_000 });
  const hrefs = await links.evaluateAll(els => els.map(e => e.getAttribute('href')));
  expect(hrefs.sort()).toEqual(crew!.participants.map(p => `/pescari/${p.documentId}`).sort());
  await links.first().click();
  await page.waitForURL(/\/pescari\/[^/?]+$/);
  await expect(page.getByTestId('profile-name')).toBeVisible({ timeout: 45_000 });
});

test('competition-page.statistici-pescar.c3 c7 — a failed stats batch says so, with a retry (never «–» passed off as data)', async ({ page }) => {
  await signedIn(page);
  let fail = true;
  await page.route(/statistics/, route => (fail && route.request().method() === 'POST' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
  await open(page, `/concursuri/${ID.rich}?pescar=${ID.richAngler}`);
  const panel = page.getByRole('dialog', { name: 'Statistici pescar' });
  await expect(panel.getByText('Statisticile nu au putut fi încărcate.')).toBeVisible({ timeout: 30_000 });
  fail = false;
  await panel.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(panel.getByText('Statisticile nu au putut fi încărcate.')).toBeHidden();
});

test('competition-page.statistici-pescar.c2 competition-page.statistici-pescar.s1 — signed out: the sign-in prompt, «Continuă ca vizitator» closes', async ({ page }) => {
  await open(page, `/concursuri/${ID.rich}`, PHONE);
  // The phone ranking is a compact table (owner rule 16); its rows are the pressable ones.
  const first = page.locator('tbody tr[data-stand-id]').locator('visible=true').first();
  await expect(first).toHaveAttribute('data-pressable', '', { timeout: 30_000 });
  await first.click();
  const sheet = page.getByRole('dialog', { name: 'Statistici pescar' });
  await expect(sheet.getByText('Statistici pentru pescari')).toBeVisible();
  await expect(sheet.getByText('Intră în cont ca să vezi capturile și recordurile fiecărui pescar din concurs.')).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Intră în cont' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Continuă ca vizitator' }).click();
  await expect(sheet).toBeHidden();
});

test('competition-page.statistici-pescar.c5 c6 competition-page.statistici-pescar.s5 — a team entered without accounts: the team header and «Statistici indisponibile»', async ({ page }) => {
  await signedIn(page);
  // Below 1024 (from 1024 a row is the person popover, owner rule 17).
  await open(page, `/concursuri/${ID.feederTeam}`, TABLET_768);
  const crew = page.locator('tr[data-registration]').locator('visible=true').first();
  await expect(crew).toHaveAttribute('data-pressable', '', { timeout: 30_000 });
  await crew.click();
  const panel = page.getByRole('dialog', { name: 'Statistici pescar' });
  await expect(panel.getByText('Statistici indisponibile', { exact: true })).toBeVisible();
  await expect(panel.getByText('Participanții au fost adăugați fără cont Bluvi.')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Apple-style bento surfaces (owner rule 19)                          */
/* ------------------------------------------------------------------ */


/**
 * The colour a surface reads as: its gradient's first stop (the tint it fades from), else its fill.
 * `surface` is «backgroundColor|backgroundImage» as the rule 19 tests read it.
 */
function surfaceRgb(surface: string): [number, number, number] {
  const [color, image] = surface.split('|');
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(image !== 'none' && /rgb/.test(image) ? image : color);
  if (!m) throw new Error(`no colour in ${surface}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Two surfaces look apart on screen: some channel differs by at least 24 (not only their CSS strings). */
const MIN_SURFACE_DELTA = 24;
function expectApart(a: string, b: string, what: string) {
  const [x, y] = [surfaceRgb(a), surfaceRgb(b)];
  const delta = Math.max(...x.map((v, i) => Math.abs(v - y[i])));
  expect(delta, `${what}: ${a} vs ${b}`).toBeGreaterThanOrEqual(MIN_SURFACE_DELTA);
}

/** Every pair of surfaces looks apart (a tinted bento where no two tiles read as one colour). */
function expectAllApart(surfaces: string[], what: string) {
  for (let i = 0; i < surfaces.length; i++) for (let j = i + 1; j < surfaces.length; j++) expectApart(surfaces[i], surfaces[j], `${what} ${i} and ${j}`);
}

for (const vp of [PHONE, LAPTOP, DESKTOP, WIDE]) {
  test(`competition-page.statistici.c3 — owner rule 19 (${vp.width}px): every bento tile has its own surface (navy signature gradient, indigo, tints), text AA`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${ID.live}/statistici`, vp);
    const summary = page.getByRole('list', { name: 'Rezumat' });
    await expect(summary.getByRole('listitem').filter({ hasText: 'Medie pe captură' })).toBeVisible({ timeout: 30_000 });
    const surfaceOf = (els: Element[]) => els.map(el => {
      const s = getComputedStyle(el);
      return `${s.backgroundColor}|${s.backgroundImage}`;
    });
    // From 768 the headline tiles are the strip over the views (on every view), the bento its facts.
    const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
    const stripTiles = vp.width >= 768 ? await strip.locator('> *').evaluateAll(surfaceOf) : [];
    const bento = await summary.getByRole('listitem').locator('visible=true').evaluateAll(lis => lis.map(li => li.firstElementChild!).map(el => {
      const s = getComputedStyle(el);
      return `${s.backgroundColor}|${s.backgroundImage}`;
    }));
    const surfaces = [...stripTiles, ...bento];
    // No grid of identical white cards: at least five different surfaces, none plain white.
    expect(new Set(surfaces).size).toBeGreaterThanOrEqual(5);
    expect(surfaces.filter(s => s.startsWith('rgb(255, 255, 255)|none'))).toEqual([]);
    // Different on screen, not only as strings: no two tiles (the strip's Capturi and the facts'
    // Capturi pe stand included) read as one pale periwinkle.
    expectAllApart(surfaces, 'tiles');
    // The signature tile is the navy one with a gradient.
    const navy = (vp.width >= 768 ? strip.locator('> *') : summary.getByRole('listitem').locator('> *')).filter({ hasText: 'Cea mai mare captură' }).first();
    expect(await navy.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    await expectNoA11yViolations(page, { include: '[aria-label="Rezumat"]' });
  });
}

/** The surface a grid child shows: its own fill, else (a transparent wrapper) its only child's. */
const surfacesOfGrid = (page: Page) =>
  page.locator('[data-stats-grid]').locator('visible=true').evaluate(grid =>
    [...grid.children]
      .filter(el => (el as HTMLElement).getBoundingClientRect().height > 0)
      .map(el => {
        // The facts cell (the Rezumat list) is the bento's facts, not a chart card: its tiles carry the surfaces.
        if (el.matches('ul[aria-label="Rezumat"]')) return `tiles:${el.children.length}`;
        let node = el;
        const clear = (n: Element) => {
          const s = getComputedStyle(n);
          return (s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'transparent') && s.backgroundImage === 'none';
        };
        while (clear(node) && node.children.length === 1) node = node.children[0];
        const s = getComputedStyle(node);
        // A cell of several tiles (the facts) has no surface of its own: its tiles carry them.
        return clear(node) ? `tiles:${node.children.length}` : `${s.backgroundColor}|${s.backgroundImage}`;
      }),
  );

for (const [kind, id, vp] of [
  ['rich', ID.rich, DESKTOP],
  ['national championship', ID.nc, DESKTOP],
  ['feeder', ID.feederTeam, WIDE],
  ['live', ID.live, LAPTOP],
  ['rich', ID.rich, PHONE],
] as const) {
  test(`competition-page.statistici.c3 — owner rule 19, ${kind} (${vp.width}px): the chart cards are bento surfaces, no two neighbours alike, text AA`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${id}/statistici`, vp);
    const grid = page.locator('[data-stats-grid]').locator('visible=true');
    await expect(grid.getByRole('region', { name: 'Sesiuni de cântărire' })).toBeVisible({ timeout: 30_000 });
    // Every block has landed (no bones left).
    await expect(grid.getByRole('status')).toHaveCount(0, { timeout: 30_000 });
    const surfaces = await surfacesOfGrid(page);
    expect(surfaces.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < surfaces.length; i++) expect(surfaces[i], `cards ${i - 1} and ${i}: ${surfaces.join(' / ')}`).not.toBe(surfaces[i - 1]);
    // Apart on screen: neighbours, and every two tinted cards of the grid (sessions, Top capturi,
    // the donut never read as one colour). The facts cell (`tiles:`) carries its tiles' surfaces.
    const cards = surfaces.filter(s => !s.startsWith('tiles:'));
    for (let i = 1; i < cards.length; i++) expectApart(cards[i - 1], cards[i], `cards ${i - 1} and ${i}`);
    expectAllApart(cards.filter(s => !s.startsWith('rgb(255, 255, 255)|none')), 'tinted cards');
    // Not a grid of white cards: at most the stand timeline is plain white.
    expect(surfaces.filter(s => s.startsWith('rgb(255, 255, 255)|none')).length).toBeLessThanOrEqual(1);
    // From 768 the whole screen at once (rule 19: no tint twice on one screen): the strip over the
    // views, the facts cell and the tinted chart cards — a clash between the strip and the grid
    // (the strip's Capturi and Top capturi, the weighing tile and the donut) fails here.
    if (vp.width >= 768) {
      const surfaceOf = (els: Element[]) => els.map(el => {
        const st = getComputedStyle(el);
        return `${st.backgroundColor}|${st.backgroundImage}`;
      });
      const strip = await page.getByRole('group', { name: 'Concursul pe scurt' }).locator('> *').evaluateAll(surfaceOf);
      const facts = await grid.getByRole('list', { name: 'Rezumat' }).getByRole('listitem').evaluateAll(lis => lis.map(li => {
        const st = getComputedStyle(li.firstElementChild!);
        return `${st.backgroundColor}|${st.backgroundImage}`;
      }));
      expect(strip.length).toBeGreaterThanOrEqual(3);
      expectAllApart([...strip, ...facts, ...cards.filter(s => !s.startsWith('rgb(255, 255, 255)|none'))], 'strip, facts and cards');
    }
    // The scan reads the view as it lands: the sessions list collapsed, its last row peeking.
    await settle(page);
    await expectNoA11yViolations(page, { include: '[data-stats-grid]' });
  });
}

test('competition-page.statistici.c3 — feeder (375): the navy tile shows the face of the catch’s crew, not of the registration that sat on that stand in another leg', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.feederTeam}/statistici`, PHONE);
  const navy = page.getByRole('list', { name: 'Rezumat' }).getByRole('listitem').filter({ hasText: 'Cea mai mare captură' });
  await expect(navy).toBeVisible({ timeout: 30_000 });
  const name = (await navy.locator('.t-body-strong').first().innerText()).trim();
  expect(name.length).toBeGreaterThan(0);
  const initials = await navy.locator('span.rounded-full[aria-hidden="true"]').evaluateAll(els => els.map(e => e.textContent?.trim() ?? '').filter(Boolean));
  // Every face is one of the crew named beside it (its initials start the name or one of its words).
  const words = name.toUpperCase().split(/\s+/).map(w => w[0]);
  expect(initials.length).toBeGreaterThan(0);
  for (const i of initials) expect(words).toContain(i[0]);
  expect(initials).not.toContain('TS');
});

test('competition-page.statistici.c3 — owner rule 19: the headline tiles over the views (1024 and 1440 on Clasament) each have their own surface, text AA', async ({ page }) => {
  await signedIn(page);
  for (const vp of [{ width: 1024, height: 900 }, DESKTOP]) {
    await open(page, `/concursuri/${ID.live}`, vp);
    const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
    await expect(strip).toBeVisible({ timeout: 30_000 });
    await expect(strip.getByText('Ultimul cântar').or(strip.getByText(/în curs/)).first()).toBeVisible({ timeout: 30_000 });
    const surfaces = await strip.locator('> *').evaluateAll(tiles => tiles.map(t => {
      const s = getComputedStyle(t);
      return `${s.backgroundColor}|${s.backgroundImage}`;
    }));
    expect(surfaces).toHaveLength(4);
    expect(new Set(surfaces).size).toBe(4);
    expectAllApart(surfaces, 'strip tiles');
    await expectNoA11yViolations(page, { include: '[aria-label="Concursul pe scurt"]' });
  }
});
