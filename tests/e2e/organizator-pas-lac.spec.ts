import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { BASE_URL as BASE } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS } from './helpers/session';
import { draftFixture, expect, mockRead, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.step-lake-sectors (c1–c15) — step 4 of the create-competition wizard,
 * /organizator/concursuri/nou/lac-si-sectoare (fish app/(app)/create-competition/step-lake-sectors.tsx,
 * components/SectorBuilder.tsx).
 *
 * Reads: the lake list (/feed/lakes/search) and the lake detail (Chita Lake, 21 stands) come from the
 * local CMS; the organizer's recent lakes are a fixture (a deterministic recency order). NO REAL
 * WRITES: the draft auto-save (POST /competitions/organizer/draft) is route-mocked and its body
 * asserted; every other write is aborted by the harness and fails the test. Other fields of the form
 * (name, limit, ranking type) are set through the frame's dev-only seam (window.__bluviWizard), as
 * steps 1–3 would.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };
const SHOTS = '.shots/organizator-pas-lac';
mkdirSync(SHOTS, { recursive: true });

const STEP = '/organizator/concursuri/nou/lac-si-sectoare';
const DRAFT_PATH = '/competitions/organizer/draft';
const CHITA = 's84u55lo4n9z0emngozttt6e';
const SUHARAU = 'mvjlgripabbi23rb2pa6n6uy';
const RECENT = [
  { documentId: CHITA, name: 'Chita Lake', lastUsedAt: '2026-10-01T10:00:00.000Z' },
  { documentId: SUHARAU, name: 'Iaz Suharau', lastUsedAt: '2026-09-01T10:00:00.000Z' },
];

test.beforeEach(async ({ context, request, page }) => {
  await signInOrganizer(context, request);
  await mockRead(page, '/competitions/organizer/recent-lakes', { json: { data: RECENT } });
});

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────── */

type Values = Record<string, unknown>;

async function open(page: Page, viewport = LAPTOP) {
  await page.setViewportSize(viewport);
  await page.goto(STEP, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('step-lake-sectors')).toBeVisible({ timeout: 90_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
}

async function set(page: Page, values: Values) {
  await page.evaluate((v) => {
    const w = window as unknown as { __bluviWizard: { setValue: (f: string, v: unknown, o?: unknown) => void } };
    for (const [f, value] of Object.entries(v)) w.__bluviWizard.setValue(f, value);
  }, values);
}

const values = (page: Page) =>
  page.evaluate(() => (window as unknown as { __bluviWizard: { values: () => Record<string, unknown> } }).__bluviWizard.values());

const picker = (page: Page) => page.getByTestId('lake-picker');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Alege un lac' });
const rows = (page: Page) => dialog(page).getByRole('list', { name: 'Bălți' }).getByRole('listitem');
const lakeSection = (page: Page) => page.getByRole('region', { name: 'Selectare lac' });
const sectorSection = (page: Page) => page.getByRole('region', { name: 'Configurare sectoare' });
const addBtn = (page: Page) => page.getByTestId('sector-builder-add');

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function a11y(page: Page) {
  await settle(page);
  await scan(page);
}

/** Holds the lake detail GET (public: straight to the CMS, or the proxy) until `release()`. */
async function holdLakeDetail(page: Page, id: string) {
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route((url) => url.pathname.endsWith(`/feed/lakes/${id}`), async (route) => {
    await held;
    await route.fallback();
  });
  return release;
}

async function pickBySearch(page: Page, term: string, name: string) {
  await picker(page).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('searchbox', { name: 'Caută lacul' }).fill(term);
  await expect(rows(page)).toHaveCount(1, { timeout: 30_000 });
  await rows(page).first().getByRole('button', { name }).click();
  await expect(dialog(page)).toBeHidden();
}

/** The first page of the public lake list, as the picker reads it. */
async function firstPageNames(): Promise<{ documentId: string; name: string }[]> {
  const res = await fetch(`${CMS}/feed/lakes/search?page=1&pageSize=20`);
  return ((await res.json()) as { data: { documentId: string; name: string }[] }).data;
}

/* ── c1 c2 c3 c4 ─────────────────────────────────────────────────────────────────────────────── */

test('c1 c2 c3 c4 — «Selectare lac»: «Alege un lac», recent lakes first, then A→Z; 20 a page, search, no results', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await open(page);
  // c1
  await expect(lakeSection(page).getByRole('heading', { name: 'Selectare lac' })).toBeVisible();
  await expect(lakeSection(page)).toContainText('Alege lacul pe care vrei să configurezi competiția.');
  await expect(picker(page)).toHaveText('Alege un lac');
  await shot(page, '1280-empty');

  // c2 + c3: 20 rows; the recent lakes first in their order, then the rest by name (ro, case-insensitive).
  await picker(page).click();
  await expect(dialog(page)).toBeVisible();
  const search = dialog(page).getByRole('searchbox', { name: 'Caută lacul' });
  await expect(search).toHaveAttribute('placeholder', 'Introdu numele');
  await expect(rows(page)).toHaveCount(20, { timeout: 30_000 });
  const page1 = await firstPageNames();
  const recentIds = RECENT.map((r) => r.documentId);
  const rest = page1
    .filter((l) => !recentIds.includes(l.documentId))
    .map((l) => l.name)
    .sort((a, b) => a.localeCompare(b, 'ro', { sensitivity: 'base' }));
  const expected = [...RECENT.filter((r) => page1.some((l) => l.documentId === r.documentId)).map((r) => r.name), ...rest];
  const shown = await rows(page).locator('button > span.flex-col > span:first-child').allTextContents();
  expect(shown).toEqual(expected);

  // c4: the photo avatar and «oraș, județ» (Balta Belin: Belin, Covasna).
  const belin = rows(page).filter({ hasText: 'Balta Belin' });
  await expect(belin).toContainText('Belin, Covasna');
  await expect(belin.locator('img')).toHaveCount(1);
  await shot(page, '1280-picker');

  // c2: the end of the list loads the next 20.
  await rows(page).last().scrollIntoViewIfNeeded();
  await expect(rows(page)).toHaveCount(40, { timeout: 30_000 });

  // c2: a search with no match.
  await search.fill('zzzz-nu-exista');
  await expect(dialog(page).getByText('Nu s-au găsit rezultate')).toBeVisible({ timeout: 30_000 });
  await search.fill('chita');
  await expect(rows(page)).toHaveCount(1, { timeout: 30_000 });
  await expect(rows(page).first()).toContainText('Chita Lake');
  await a11y(page);
  // (Escape in a search field clears it first — the X closes.)
  await dialog(page).getByRole('button', { name: 'Închide' }).click();
  await expect(dialog(page)).toBeHidden();
  // Closing forgets the search: the next opening lists every lake again.
  await picker(page).click();
  await expect(rows(page)).toHaveCount(40, { timeout: 30_000 });
  await expect(dialog(page).getByRole('searchbox', { name: 'Caută lacul' })).toHaveValue('');
  await dialog(page).getByRole('button', { name: 'Închide' }).click();
  expect(errors).toEqual([]);
});

test('c3 c4 — with a current lake (edit / back to the step): it keeps its recency place, first and disabled', async ({ page }) => {
  await open(page);
  await set(page, { lake: RECENT[0].documentId });
  await expect(picker(page)).toHaveText(RECENT[0].name, { timeout: 30_000 });
  await picker(page).click();
  await expect(rows(page)).toHaveCount(20, { timeout: 30_000 });
  const first = rows(page).first().getByRole('button');
  await expect(first).toHaveAccessibleName(`${RECENT[0].name}, selectat`);
  await expect(first).toBeDisabled();
  // The same order as with no lake: the recent ones, then A→Z — nothing moved to the bottom.
  const page1 = await firstPageNames();
  const recentIds = RECENT.map((r) => r.documentId);
  const rest = page1
    .filter((l) => !recentIds.includes(l.documentId))
    .map((l) => l.name)
    .sort((a, b) => a.localeCompare(b, 'ro', { sensitivity: 'base' }));
  const expected = [...RECENT.filter((r) => page1.some((l) => l.documentId === r.documentId)).map((r) => r.name), ...rest];
  expect(await rows(page).locator('button > span.flex-col > span:first-child').allTextContents()).toEqual(expected);
  // Still first after the next page lands.
  await rows(page).last().scrollIntoViewIfNeeded();
  await expect(rows(page)).toHaveCount(40, { timeout: 30_000 });
  await expect(rows(page).first().getByRole('button')).toHaveAccessibleName(`${RECENT[0].name}, selectat`);
  await shot(page, '1280-picker-current');
  await dialog(page).getByRole('button', { name: 'Închide' }).click();
});

test('c5 c6 — the saved lake whose detail fails: «Lac salvat» (never «Alege un lac»), no shimmer, the retry recovers', async ({ page }) => {
  await open(page);
  let fail = true;
  await page.route((url) => url.pathname.endsWith(`/feed/lakes/${CHITA}`), async (route) => {
    if (fail) await route.fulfill({ status: 500, json: { error: { status: 500, message: 'x' } } });
    else await route.fallback();
  });
  // A saved draft / edit: the lake id only, no picked row.
  await set(page, { lake: CHITA });
  const notice = lakeSection(page).getByRole('alert').filter({ hasText: 'Nu am putut încărca lacul.' });
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText('Nu am putut încărca standurile lacului.');
  await expect(picker(page)).toHaveText('Lac salvat');
  await expect(picker(page)).toHaveAccessibleName('Lac salvat. Schimbă lacul');
  await expect(page.getByTestId('selected-lake-skeleton')).toHaveCount(0);
  await shot(page, '1280-saved-error');
  await a11y(page);

  // «Încearcă din nou» → the name and the stands.
  fail = false;
  await notice.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(picker(page)).toHaveText('Chita Lake', { timeout: 30_000 });
  await expect(page.getByTestId('selected-lake-stands')).toHaveText('21 de standuri disponibile');
  await expect(notice).toHaveCount(0);
});

test('c6 — a picked lake whose detail fails: the card without a count line (no endless shimmer), the notice to retry', async ({ page }) => {
  await open(page);
  let fail = true;
  await page.route((url) => url.pathname.endsWith(`/feed/lakes/${SUHARAU}`), async (route) => {
    if (fail) await route.fulfill({ status: 500, json: { error: { status: 500, message: 'x' } } });
    else await route.fallback();
  });
  await pickBySearch(page, 'suharau', 'Iaz Suharau');
  const card = page.getByTestId('selected-lake');
  await expect(card).toContainText('Iaz Suharau');
  const notice = lakeSection(page).getByRole('alert').filter({ hasText: 'Nu am putut încărca lacul.' });
  await expect(notice).toBeVisible({ timeout: 30_000 });
  await expect(card.locator('.animate-shimmer')).toHaveCount(0);
  await expect(page.getByTestId('selected-lake-stands')).toHaveCount(0);
  await shot(page, '1280-picked-error');
  fail = false;
  await notice.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('selected-lake-stands')).toBeVisible({ timeout: 30_000 });
  await expect(notice).toHaveCount(0);
});

/* ── c5 c6 ───────────────────────────────────────────────────────────────────────────────────── */

test('c5 c6 — choosing shows the lake at once, auto-saves it, then the card «Lac selectat» with the stands and photo', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { json: { data: draftFixture({ documentId: 'fx-lac', name: 'Cupa lacului' }) } });
  await open(page);
  await set(page, { name: 'Cupa lacului' });
  const release = await holdLakeDetail(page, CHITA);
  await pickBySearch(page, 'chita', 'Chita Lake');

  // At once, from the picked row: the field and the card's name; the count waits for the detail.
  await expect(picker(page)).toHaveText('Chita Lake');
  const card = page.getByTestId('selected-lake');
  await expect(card).toContainText('Lac selectat');
  await expect(card).toContainText('Chita Lake');
  await expect(page.getByTestId('selected-lake-stands')).toHaveCount(0);
  await expect(card).not.toContainText('0 standuri');
  await shot(page, '1280-picked-loading');

  // The debounced auto-save carries the lake.
  await expect.poll(() => organizer.writes.length, { timeout: 10_000 }).toBe(1);
  expect(organizer.writes[0]).toMatchObject({ method: 'POST', path: DRAFT_PATH });
  expect((organizer.writes[0].body as { data: Values }).data).toMatchObject({ name: 'Cupa lacului', lake: CHITA });

  // The detail lands: «21 de standuri disponibile» and the photo.
  release();
  await expect(page.getByTestId('selected-lake-stands')).toHaveText('21 de standuri disponibile', { timeout: 30_000 });
  await expect(page.getByTestId('selected-lake-photo')).toBeVisible();

  // c4: reopened, the current lake is disabled and marked, «selectat» read once (no tag + check twice).
  await picker(page).click();
  await dialog(page).getByRole('searchbox', { name: 'Caută lacul' }).fill('chita');
  await expect(rows(page)).toHaveCount(1, { timeout: 30_000 });
  await expect(rows(page).first().getByRole('button')).toBeDisabled();
  await expect(rows(page).first().getByRole('button')).toHaveAccessibleName('Chita Lake, selectat');
  await expect(rows(page).first().getByText('selectat', { exact: true })).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'Închide' }).click();
  await expect(dialog(page)).toBeHidden();
  await a11y(page);
});

test('c5 — another lake clears the stand allocations; the same flow never writes without a name', async ({ page }) => {
  await open(page);
  await set(page, { lake: CHITA, sectors: [{ name: 'A', minFishNumber: 1 }], standAllocations: { A: ['st1', 'st2'] } });
  await expect(page.getByTestId('selected-lake')).toContainText('Chita Lake', { timeout: 30_000 });
  await pickBySearch(page, 'suharau', 'Iaz Suharau');
  await expect(picker(page)).toHaveText('Iaz Suharau');
  const v = await values(page);
  expect(v.lake).toBe(SUHARAU);
  expect(v.standAllocations).toEqual({});
  expect(v.sectors).toEqual([{ name: 'A', minFishNumber: 1 }]);
});

/* ── c7 ──────────────────────────────────────────────────────────────────────────────────────── */

test('c7 — limit above the stands: the red warning (participanți / echipe); «Modifică limita» → configurare', async ({ page }) => {
  await open(page);
  await set(page, { lake: CHITA, competitionType: 'single', participantsLimit: '30' });
  const warning = page.getByTestId('stands-warning');
  await expect(warning).toHaveText(/Lacul are doar 21 de standuri, dar competiția are 30 de participanți\./, { timeout: 30_000 });
  await shot(page, '1280-warning');
  await set(page, { participantsLimit: '21' });
  await expect(warning).toHaveCount(0);
  await set(page, { competitionType: 'team', participantsLimit: '25' });
  await expect(warning).toContainText('dar competiția are 25 de echipe.');
  await a11y(page);
  await warning.getByRole('button', { name: 'Modifică limita' }).click();
  await expect(page).toHaveURL(`${BASE}/organizator/concursuri/nou/configurare`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Configurare competiție');
});

/* ── c8 c9 c13 c14 ───────────────────────────────────────────────────────────────────────────── */

test('c8 c9 c13 — plain types: chips, «Sectoare (n)», «Adaugă sector» up to 24 (A…X), the empty message', async ({ page }) => {
  await open(page);
  await set(page, { rankingType: 'quantity' });
  await expect(sectorSection(page)).toContainText('Împarte lacul în sectoare pentru alocarea standurilor.');
  await expect(page.getByTestId('sector-count')).toHaveText('Sectoare (0)');
  await expect(page.getByTestId('sector-empty')).toHaveText('Niciun sector adăugat. Adaugă cel puțin un sector.');
  await shot(page, '1280-no-sectors');
  for (let i = 0; i < 3; i++) await addBtn(page).click();
  await expect(page.getByTestId('sector-count')).toHaveText('Sectoare (3)');
  for (const l of ['A', 'B', 'C']) await expect(page.getByTestId(`sector-row-${l}`)).toContainText(`Sector ${l}`);
  // A colour badge per letter (the sector's own token).
  const badge = page.getByTestId('sector-row-B').locator('span[aria-hidden]').first();
  await expect(badge).toHaveText('B');
  await expect(badge).toHaveClass(/bg-sector-b/);
  // No min-fish stepper on a plain type.
  await expect(sectorSection(page).getByRole('textbox')).toHaveCount(0);
  expect((await values(page)).sectors).toEqual(['A', 'B', 'C'].map((name) => ({ name, minFishNumber: 1 })));
  await shot(page, '1280-chips');
  for (let i = 3; i < 24; i++) await addBtn(page).click();
  await expect(page.getByTestId('sector-count')).toHaveText('Sectoare (24)');
  await expect(page.getByTestId('sector-row-X')).toBeVisible();
  await expect(addBtn(page)).toHaveCount(0);
  await shot(page, '1280-24-sectors');
  await a11y(page);
});

test('c9 c14 — national / FIPSed: at most 3 sectors, «… necesită exact 3 sectoare» otherwise', async ({ page }) => {
  await open(page);
  await set(page, { rankingType: 'nationalChampionship', sectors: [{ name: 'A', minFishNumber: 1 }, { name: 'B', minFishNumber: 1 }] });
  const err = page.getByTestId('sector-count-error');
  await expect(err).toHaveText('Campionatul Național și FIPSed necesită exact 3 sectoare.');
  await addBtn(page).click();
  await expect(err).toHaveCount(0);
  await expect(addBtn(page)).toHaveCount(0);
  await set(page, { rankingType: 'fipsed', sectors: [{ name: 'A', minFishNumber: 1 }] });
  await expect(err).toBeVisible();
  await set(page, { rankingType: 'quantity' });
  await expect(err).toHaveCount(0);
  await expect(addBtn(page)).toBeVisible();
});

/* ── c8 c10 c13 ──────────────────────────────────────────────────────────────────────────────── */

test('c8 c10 c13 — quality types: «Nr. minim pești» stepper (default 1, ≥ 0, digits only) and its error', async ({ page }) => {
  await open(page);
  for (const type of ['quality', 'quantityQuality', 'qualityQuantity', 'calitateCalitate', 'calitateCantitateCMMC']) {
    await set(page, { rankingType: type });
    await expect(sectorSection(page)).toContainText('Împarte lacul în sectoare și setează numărul minim de pești pentru fiecare.');
  }
  await addBtn(page).click();
  const row = page.getByTestId('sector-row-A');
  await expect(row).toContainText('Sector A');
  await expect(row).toContainText('Nr. minim pești');
  const input = row.getByRole('textbox', { name: 'Nr. minim pești, sector A' });
  await expect(input).toHaveValue('1');
  await row.getByRole('button', { name: 'Mai mulți pești, sector A' }).click();
  await expect(input).toHaveValue('2');
  await row.getByRole('button', { name: 'Mai puțini pești, sector A' }).click();
  await row.getByRole('button', { name: 'Mai puțini pești, sector A' }).click();
  // 0 shows as the empty field; − stops there.
  await expect(input).toHaveValue('');
  await expect(row.getByRole('button', { name: 'Mai puțini pești, sector A' })).toBeDisabled();
  await expect(page.getByTestId('min-fish-error')).toHaveText('Nr. minim pești trebuie să fie cel puțin 1 pentru fiecare sector.');
  await shot(page, '1280-min-fish-error');
  // Digits only.
  await input.fill('');
  await input.pressSequentially('1a2');
  await expect(input).toHaveValue('12');
  await expect(page.getByTestId('min-fish-error')).toHaveCount(0);
  expect((await values(page)).sectors).toEqual([{ name: 'A', minFishNumber: 12 }]);
  // Keyboard path: tab from the field to + and press it.
  await input.focus();
  await page.keyboard.press('Tab');
  await expect(row.getByRole('button', { name: 'Mai mulți pești, sector A' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('13');
  await a11y(page);
});

/* ── c11 c12 ─────────────────────────────────────────────────────────────────────────────────── */

test('c11 c12 — remove only with > 1, rename in order, «Ștergi sectorul?» for a changed minimum; allocations follow', async ({ page }) => {
  await open(page);
  await set(page, {
    rankingType: 'quality',
    sectors: [{ name: 'A', minFishNumber: 1 }, { name: 'B', minFishNumber: 4 }, { name: 'C', minFishNumber: 2 }],
    standAllocations: { A: ['s1'], B: ['s2'], C: ['s3'] },
  });
  // A (min 1): removed at once; B, C become A, B; the vanished «C» loses its stands.
  await page.getByRole('button', { name: 'Șterge sectorul A' }).click();
  await expect(page.getByTestId('sector-count')).toHaveText('Sectoare (2)');
  let v = await values(page);
  expect(v.sectors).toEqual([{ name: 'A', minFishNumber: 4 }, { name: 'B', minFishNumber: 2 }]);
  expect(v.standAllocations).toEqual({ A: ['s1'], B: ['s2'] });

  // A now has min 4: asks first. «Anulează» keeps it.
  await page.getByRole('button', { name: 'Șterge sectorul A' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Ștergi sectorul?' });
  await expect(confirm).toContainText('Sectorul A are nr. minim pești modificat (4). Sigur vrei să-l ștergi?');
  await shot(page, '1280-confirm');
  await a11y(page);
  await confirm.getByRole('button', { name: 'Anulează' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByTestId('sector-count')).toHaveText('Sectoare (2)');
  await page.getByRole('button', { name: 'Șterge sectorul A' }).click();
  await confirm.getByRole('button', { name: 'Șterge' }).click();
  await expect(page.getByTestId('sector-count')).toHaveText('Sectoare (1)');
  v = await values(page);
  expect(v.sectors).toEqual([{ name: 'A', minFishNumber: 2 }]);
  expect(v.standAllocations).toEqual({ A: ['s1'] });
  // The last sector cannot be removed.
  await expect(page.getByRole('button', { name: /Șterge sectorul/ })).toHaveCount(0);

  // Plain types never ask (no minimum there).
  await set(page, { rankingType: 'quantity', sectors: [{ name: 'A', minFishNumber: 5 }, { name: 'B', minFishNumber: 1 }] });
  await page.getByRole('button', { name: 'Șterge sectorul A' }).click();
  await expect(confirm).toHaveCount(0);
  expect((await values(page)).sectors).toEqual([{ name: 'A', minFishNumber: 1 }]);
});

/* ── c15 ─────────────────────────────────────────────────────────────────────────────────────── */

test('c15 — the footer: «Următorul pas» goes to «Alocă standuri»', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează și ieși');
  await page.getByTestId('wizard-next').click();
  await expect(page).toHaveURL(`${BASE}/organizator/concursuri/nou/standuri`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alocă standuri');
});

/* ── every state at the four widths ──────────────────────────────────────────────────────────── */

test('phone + desktop widths — the filled step (lake card, warning, sector rows) and the picker sheet', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  for (const [w, h] of [[375, 812], [1280, 900], [1440, 900], [1920, 1080]] as const) {
    await open(page, { width: w, height: h });
    await set(page, {
      lake: CHITA,
      participantsLimit: '30',
      competitionType: 'single',
      rankingType: 'quality',
      sectors: [{ name: 'A', minFishNumber: 1 }, { name: 'B', minFishNumber: 2 }, { name: 'C', minFishNumber: 0 }],
    });
    await expect(page.getByTestId('selected-lake-stands')).toHaveText('21 de standuri disponibile', { timeout: 30_000 });
    // No horizontal page scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (w >= 1440) {
      // Desktop: the lake card and the sector builder side by side.
      const a = await lakeSection(page).boundingBox();
      const b = await sectorSection(page).boundingBox();
      expect(a && b && Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width).toBeTruthy();
    }
    await shot(page, `${w}-filled`);
    await set(page, { rankingType: 'quantity', participantsLimit: '12' });
    await shot(page, `${w}-chips`);
    if (w === 375) {
      await picker(page).click();
      await expect(rows(page)).toHaveCount(20, { timeout: 30_000 });
      await shot(page, '375-picker');
      await a11y(page);
      // The phone sheet has no X: Escape (the search is empty) closes it.
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
    }
  }
  await open(page, PHONE);
  await a11y(page);
  expect(errors).toEqual([]);
});
