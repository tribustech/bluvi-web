import { mkdirSync } from 'node:fs';
import type { Locator, Page, Route } from '@playwright/test';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { perfLevels, sortStands, type AllocatableStand } from '../../app/(site)/organizator/_wizard/steps/standuri/model';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS } from './helpers/session';
import { competitionFixture, expect, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.step-stand-allocation (c1–c9) — step 5 of the create-competition wizard,
 * /organizator/concursuri/nou/standuri (+ /concursuri/[id]/editeaza/standuri); fish
 * app/(app)/create-competition/step-stand-allocation.tsx, components/StandAllocator.tsx.
 *
 * Reads: the lake detail (Chita Lake, 21 stands with past-competition scores) comes from the local
 * CMS; the «no stands» and «no history» lakes are that DTO with its stands replaced. NO WRITES: the
 * new wizard has no name, so nothing auto-saves (fish: a draft needs a name ≥ 3), and this step
 * never auto-saves (fish neither); the harness aborts and fails on any write. Other form fields
 * (lake, sectors, allocations) are set through the frame's dev-only seam, as steps 1–4 would.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };
const WIDTHS = [375, 1280, 1440, 1920];
const SHOTS = '.shots/organizator-pas-standuri';
mkdirSync(SHOTS, { recursive: true });

const STEP = '/organizator/concursuri/nou/standuri';
const CHITA = 's84u55lo4n9z0emngozttt6e';
const TEMPLATE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';
const SECTORS = [
  { name: 'A', minFishNumber: 1 },
  { name: 'B', minFishNumber: 1 },
  { name: 'C', minFishNumber: 1 },
];

type LakeDto = { documentId: string; name: string; stands: AllocatableStand[] } & Record<string, unknown>;
let chita: LakeDto | null = null;

test.beforeAll(async () => {
  const res = await fetch(`${CMS}/feed/lakes/${CHITA}`);
  chita = res.ok ? (((await res.json()) as { data: LakeDto }).data ?? null) : null;
});

test.beforeEach(async ({ context, request }) => {
  test.skip(!chita?.stands?.length, 'the local CMS has no Chita Lake with stands');
  await signInOrganizer(context, request);
});

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────── */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/** A public lake detail answered from a fixture (straight to the CMS, or through the proxy). */
async function mockLake(page: Page, lake: LakeDto, opts: { delayMs?: number; status?: number } = {}) {
  await page.route(
    (url) => url.pathname.endsWith(`/feed/lakes/${lake.documentId}`),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      return json(route, opts.status && opts.status >= 400 ? { error: { status: opts.status } } : { data: lake }, opts.status ?? 200).catch(() => {});
    },
  );
}

async function open(page: Page, path = STEP, viewport = LAPTOP) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'standuri', { timeout: 90_000 });
  await expect(page.getByTestId('step-stand-allocation')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
}

async function set(page: Page, values: Record<string, unknown>) {
  await page.evaluate((v) => {
    const w = window as unknown as { __bluviWizard: { setValue: (f: string, v: unknown) => void } };
    for (const [f, value] of Object.entries(v)) w.__bluviWizard.setValue(f, value);
  }, values);
}

const values = (page: Page) =>
  page.evaluate(() => (window as unknown as { __bluviWizard: { values: () => Record<string, unknown> } }).__bluviWizard.values());

/**
 * The step's sector tab starts on the FIRST sector at mount (fish useState(sectors[0])): to enter
 * the step with sectors, set them on «Lac și sectoare» and come back, as an organizer would.
 */
async function enterWith(page: Page, v: Record<string, unknown>) {
  await page.getByRole('navigation', { name: 'Pașii competiției' }).first().getByRole('button', { name: /Lac și sectoare/ }).click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'lac-si-sectoare', { timeout: 30_000 });
  await set(page, v);
  await page.getByRole('navigation', { name: 'Pașii competiției' }).first().getByRole('button', { name: /Alocă standuri/ }).click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'standuri', { timeout: 30_000 });
}

const card = (page: Page) => page.getByRole('region', { name: 'Alocare standuri' });
const tabs = (page: Page) => page.getByRole('tablist', { name: 'Sectoare' });
const tab = (page: Page, name: string) => tabs(page).getByRole('tab', { name: new RegExp(`Sector ${name}`) });
const stand = (page: Page, name: string) => page.getByTestId(`stand-allocator-stand-${name}`);
const grid = (page: Page) => page.getByTestId('stand-grid');

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.waitForTimeout(300);
}

/** The state at every owner width (375 / 1280 / 1440 / 1920), full page. */
async function shots(page: Page, name: string, widths = WIDTHS) {
  const before = page.viewportSize();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true });
  }
  if (before) await page.setViewportSize(before);
}

const shadowOf = (el: Locator) => el.evaluate((n) => getComputedStyle(n).boxShadow);

/** The element's box-shadow holds the 2px inset ring in the accent colour (plus a lift). */
async function expectAccentRing(page: Page, el: Locator) {
  const accent = await page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--color-accent)';
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  const shadow = await shadowOf(el);
  expect(shadow).toContain(`${accent} 0px 0px 0px 2px inset`);
  expect(shadow.split(/,(?![^(]*\))/).length).toBeGreaterThan(1);
}

async function a11y(page: Page) {
  await settle(page);
  await scan(page);
}

/* ── c1 c2 — hint, the three empty cards ─────────────────────────────────────────────────────── */

test('organizer.step-stand-allocation.c1 c2 — hint; no lake / no sectors / no stands → empty card, «Înapoi la lac și sectoare»', async ({ page, organizer }) => {
  const errors = collectConsoleErrors(page);
  const lake = chita as LakeDto;
  const bare: LakeDto = { ...lake, documentId: 'fx-lake-fara-standuri', name: 'Balta fără standuri', stands: [] };
  await mockLake(page, bare);
  await open(page);

  // c1
  await expect(card(page).getByRole('heading', { name: 'Alocare standuri' })).toBeVisible();
  await expect(card(page)).toContainText('Selectează un sector, apoi apasă pe standuri pentru a le aloca.');

  // c2: no lake.
  const empty = page.getByTestId('stand-allocation-empty');
  await expect(empty).toHaveText(/Selectează un lac în pasul anterior\./);
  await expect(empty.getByRole('button', { name: 'Înapoi la lac și sectoare' })).toBeVisible();
  await shots(page, 'gol-fara-lac');
  await a11y(page);

  // c2: a lake, no sectors.
  await set(page, { lake: CHITA, sectors: [] });
  await expect(empty).toHaveText(/Adaugă sectoare în pasul anterior\./, { timeout: 30_000 });
  await shots(page, 'gol-fara-sectoare', [375, 1280]);

  // c2: sectors, a lake without stands.
  await set(page, { lake: bare.documentId, sectors: SECTORS });
  await expect(empty).toHaveText(/Lacul selectat nu are standuri configurate\./, { timeout: 30_000 });
  await shots(page, 'gol-fara-standuri', [375, 1280]);

  // The button goes back to «Lac și sectoare».
  await empty.getByRole('button', { name: 'Înapoi la lac și sectoare' }).click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'lac-si-sectoare', { timeout: 30_000 });
  expect(organizer.writes).toEqual([]);
  expect(errors).toEqual([]);
});

/* ── c3 c4 c5 — tabs, grid, toggle, refusal ──────────────────────────────────────────────────── */

test('organizer.step-stand-allocation.c3 c4 c5 — tabs with counts, first selected; numeric grid; add / remove / refuse', async ({ page, organizer }) => {
  const errors = collectConsoleErrors(page);
  const lake = chita as LakeDto;
  const byName = Object.fromEntries(lake.stands.map((s) => [s.name, s.documentId]));
  await open(page);
  await enterWith(page, { lake: CHITA, sectors: SECTORS, standAllocations: { B: [byName['5']] } });

  // c3: one tablist, badge + «Sector X» + count; the first sector selected.
  await expect(tabs(page).getByRole('tab')).toHaveCount(3, { timeout: 30_000 });
  await expect(tab(page, 'A')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'B')).toHaveAttribute('aria-selected', 'false');
  await expect(tab(page, 'A')).toContainText('Sector A');
  await expect(tab(page, 'A')).toContainText('0 standuri');
  await expect(tab(page, 'B')).toContainText('1 stand');
  await expect(tab(page, 'A').locator('span[aria-hidden]').first()).toHaveText('A');
  // c3 (rule 20): the selected tab carries the 2px accent ring AND its e1 lift (one box-shadow).
  await expectAccentRing(page, tab(page, 'A'));
  expect(await shadowOf(tab(page, 'B'))).not.toContain('inset');

  // c4: sorted numerically.
  const expected = sortStands(lake.stands).map((s) => s.name);
  const shown = await grid(page).getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')?.replace('stand-allocator-stand-', '')));
  expect(shown).toEqual(expected);
  expect(expected.slice(0, 3)).toEqual(['1', '2', '3']);
  // c4: an allocated stand reads sector + name in its sector colour.
  await expect(stand(page, '5')).toContainText('B5');
  await expect(stand(page, '5')).toHaveAttribute('aria-label', /^Stand 5, alocat sectorului B/);
  await expect(stand(page, '5')).toHaveAttribute('aria-pressed', 'false');
  const tint = await stand(page, '5').evaluate((el) => getComputedStyle(el).getPropertyValue('--sector').trim());
  // sectorVar('B'): the sector B token (computed styles resolve the variable).
  expect(tint).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-sector-b').trim()));

  // c5: a free stand joins the selected sector (A), outlined (pressed), the tab counts it.
  await stand(page, '12').click();
  await expect(stand(page, '12')).toContainText('A12');
  await expect(stand(page, '12')).toHaveAttribute('aria-pressed', 'true');
  await expect(stand(page, '12')).toHaveAttribute('aria-label', /^Stand 12, alocat sectorului A/);
  await expect(tab(page, 'A')).toContainText('1 stand');
  expect(((await values(page)).standAllocations as Record<string, string[]>).A).toEqual([byName['12']]);
  await stand(page, '2').click();
  await expect(tab(page, 'A')).toContainText('2 standuri');
  await expect(page.getByTestId('stand-allocator-tally')).toContainText(`Alocate: 3 din ${lake.stands.length}`);
  await shots(page, 'alocare');
  await a11y(page);

  // c5: a stand of another sector is refused with the toast; nothing changes.
  await stand(page, '5').click();
  await expect(page.getByText('Standul este deja alocat sectorului B.')).toBeVisible();
  expect(((await values(page)).standAllocations as Record<string, string[]>).B).toEqual([byName['5']]);
  await shots(page, 'refuz', [375, 1280]);

  // c5: one of the selected sector's stands leaves it.
  await stand(page, '12').click();
  await expect(stand(page, '12')).toHaveText(/^12/);
  await expect(stand(page, '12')).toHaveAttribute('aria-pressed', 'false');
  await expect(stand(page, '12')).toHaveAttribute('aria-label', /^Stand 12(,|$)/);
  await expect(tab(page, 'A')).toContainText('1 stand');

  // c3: another tab; its stands are the outlined ones now.
  await tab(page, 'B').click();
  await expect(tab(page, 'B')).toHaveAttribute('aria-selected', 'true');
  await expect(stand(page, '5')).toHaveAttribute('aria-pressed', 'true');
  await expect(stand(page, '2')).toHaveAttribute('aria-pressed', 'false');
  expect(organizer.writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('organizer.step-stand-allocation — keyboard: arrows move the tabs, Enter / Space toggle a stand (phone)', async ({ page }) => {
  await open(page, STEP, PHONE);
  await enterWith(page, { lake: CHITA, sectors: SECTORS, standAllocations: {} });
  await expect(tab(page, 'A')).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  await tab(page, 'A').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'B')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'B')).toBeFocused();
  await page.keyboard.press('End');
  await expect(tab(page, 'C')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tab(page, 'A')).toHaveAttribute('aria-selected', 'true');
  // Only the selected tab is in the tab order (roving tabindex).
  await expect(tab(page, 'B')).toHaveAttribute('tabindex', '-1');

  await stand(page, '7').focus();
  await page.keyboard.press('Enter');
  await expect(stand(page, '7')).toHaveAttribute('aria-pressed', 'true');
  await expect(stand(page, '7')).toHaveAttribute('aria-label', /^Stand 7, alocat sectorului A/);
  await page.keyboard.press('Space');
  await expect(stand(page, '7')).toHaveAttribute('aria-pressed', 'false');
  // The grid is the selected tab's panel.
  await expect(page.getByRole('tabpanel', { name: /Sector A/ })).toBeVisible();
});

/* ── c6 c7 — performance labels and the explanation ──────────────────────────────────────────── */

test('organizer.step-stand-allocation.c6 c7 — percentile labels from the lake history; «Cum funcționează?» explains them', async ({ page }) => {
  const lake = chita as LakeDto;
  const levels = perfLevels(lake.stands);
  test.skip(Object.keys(levels).length < 2, 'the local Chita Lake has fewer than 2 stands with history');
  await open(page);
  await enterWith(page, { lake: CHITA, sectors: SECTORS, standAllocations: {} });
  await expect(tab(page, 'A')).toBeVisible({ timeout: 30_000 });

  // c6: every scored stand shows its level, the rest none; the best is «Foarte bun», the worst «Slab».
  for (const s of lake.stands) {
    const level = levels[s.documentId];
    const perf = stand(page, s.name).getByTestId('stand-perf');
    if (level) await expect(perf).toHaveText(level.text);
    else await expect(perf).toHaveCount(0);
  }
  const best = [...lake.stands].filter((s) => levels[s.documentId]).sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0));
  await expect(stand(page, best[0].name).getByTestId('stand-perf')).toHaveText('Foarte bun');
  await expect(stand(page, best[best.length - 1].name).getByTestId('stand-perf')).toHaveText('Slab');
  await expect(stand(page, best[0].name)).toHaveAttribute('aria-label', `Stand ${best[0].name}, Foarte bun`);

  // c7
  await page.getByRole('button', { name: 'Cum funcționează?' }).click();
  const panel = page.getByRole('dialog', { name: 'Performanța standurilor' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Te ajutăm să creezi sectoare echilibrate oferindu-ți statistici despre performanța fiecărui stand.');
  await expect(panel).toContainText('greutatea medie totală a capturilor din competițiile anterioare desfășurate pe acest lac');
  await expect(panel).toContainText('Niveluri:');
  for (const [text, hint] of [
    ['Foarte bun', 'top 25% din standuri'],
    ['Bun', 'top 50%'],
    ['Mediu', 'sub medie'],
    ['Slab', 'ultimele 25%'],
  ]) {
    await expect(panel.getByRole('listitem').filter({ hasText: new RegExp(`^${text}\\s*—`) })).toContainText(hint);
  }
  await expect(panel).toContainText('Scorurile se actualizează automat la finalul fiecărei competiții. Standurile fără competiții anterioare nu au scor.');
  await shots(page, 'explicatie', [1280]);
  await a11y(page);
  await panel.getByRole('button', { name: 'Am înțeles' }).click();
  await expect(panel).toBeHidden();

  // Phone: the same explanation in a sheet.
  await page.setViewportSize(PHONE);
  await page.getByRole('button', { name: 'Cum funcționează?' }).click();
  await expect(page.getByRole('dialog', { name: 'Performanța standurilor' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/explicatie-375.png` });
  await page.getByRole('dialog', { name: 'Performanța standurilor' }).getByRole('button', { name: 'Am înțeles' }).click();
});

test('organizer.step-stand-allocation.c6 — fewer than 2 stands with history: no labels at all', async ({ page }) => {
  const lake = chita as LakeDto;
  const fresh: LakeDto = {
    ...lake,
    documentId: 'fx-lake-fara-istoric',
    name: 'Balta fără istoric',
    stands: lake.stands.map((s, i) => ({ ...s, performanceScore: i === 0 ? 12 : null, competitionsCount: i === 0 ? 2 : 0 })),
  };
  await mockLake(page, fresh);
  await open(page);
  await enterWith(page, { lake: fresh.documentId, sectors: SECTORS, standAllocations: {} });
  await expect(grid(page).getByRole('button')).toHaveCount(fresh.stands.length, { timeout: 30_000 });
  await expect(page.getByTestId('stand-perf')).toHaveCount(0);
  await shots(page, 'fara-istoric', [375, 1280]);
});

/* ── c8 — no sector selected ─────────────────────────────────────────────────────────────────── */

test('organizer.step-stand-allocation.c8 — no sector selected: stands dimmed and inert, «Selectează un sector mai întâi»', async ({ page, organizer }) => {
  await open(page);
  // Sectors arrive after the step mounted (fish: the tab is chosen once, at mount) → none selected.
  await set(page, { lake: CHITA, sectors: SECTORS, standAllocations: {} });
  await expect(grid(page)).toBeVisible({ timeout: 30_000 });
  await expect(tabs(page).getByRole('tab', { selected: true })).toHaveCount(0);
  await expect(page.getByTestId('stand-allocator-pick-sector')).toHaveText('Selectează un sector mai întâi');
  expect(Number(await grid(page).evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1);
  await expect(stand(page, '3')).toHaveAttribute('aria-disabled', 'true');
  await stand(page, '3').click({ force: true });
  await expect(stand(page, '3')).toHaveAttribute('aria-pressed', 'false');
  expect((await values(page)).standAllocations).toEqual({});
  await shots(page, 'fara-sector');
  await a11y(page);
  // Choosing a tab wakes the grid.
  await tab(page, 'C').click();
  await expect(page.getByTestId('stand-allocator-pick-sector')).toHaveCount(0);
  await stand(page, '3').click();
  await expect(stand(page, '3')).toContainText('C3');
  expect(organizer.writes).toEqual([]);
});

/* ── loading / error (rule 4) ────────────────────────────────────────────────────────────────── */

test('organizer.step-stand-allocation — the lake detail loading shows a skeleton, a failure the retry', async ({ page }) => {
  const lake = chita as LakeDto;
  const slow: LakeDto = { ...lake, documentId: 'fx-lake-lent' };
  await mockLake(page, slow, { delayMs: 4000 });
  const broken: LakeDto = { ...lake, documentId: 'fx-lake-eroare' };
  await mockLake(page, broken, { status: 500 });
  await open(page);
  await enterWith(page, { lake: slow.documentId, sectors: SECTORS, standAllocations: {} });
  await expect(page.getByTestId('stand-allocation-skeleton')).toBeVisible();
  await expect(page.getByTestId('stand-allocation-empty')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/incarcare-1280.png`, fullPage: true });
  await expect(grid(page)).toBeVisible({ timeout: 30_000 });

  await set(page, { lake: broken.documentId });
  await expect(page.getByText('Nu am putut încărca standurile lacului.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/eroare-1280.png`, fullPage: true });
});

/* ── c9 — footer; edit mode ──────────────────────────────────────────────────────────────────── */

test('organizer.step-stand-allocation.c9 — «Următorul pas» → revizuire', async ({ page, organizer }) => {
  await open(page);
  await enterWith(page, { lake: CHITA, sectors: SECTORS, standAllocations: {} });
  await expect(page.getByTestId('wizard-next')).toHaveText('Următorul pas');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'revizuire', { timeout: 30_000 });
  expect(organizer.writes).toEqual([]);
});

let base: CompetitionDetail | null = null;
test.beforeAll(async () => {
  base = await getCompetition(createTestTransport(), TEMPLATE).catch(() => null);
});

test('organizer.step-stand-allocation.c9 — edit mode: the competition\'s own sectors[].stands hydrate the allocation; «Salvează modificările» PUTs it', async ({ page, organizer }) => {
  test.skip(!base, 'no local competition to base the edit fixture on');
  const lake = chita as LakeDto;
  const byName = Object.fromEntries(lake.stands.map((s) => [s.name, s.documentId]));
  const ref = (name: string, n: number) => ({ id: 9000 + n, documentId: byName[name], name });
  const id = 'fx-std-e';
  const future = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const b = base as CompetitionDetail;
  // fish CreateCompetitionContext hydrate (edit): sectors[].stands → standAllocations — no seam.
  const c = {
    ...b,
    documentId: id,
    name: 'Cupa editare standuri',
    competitionStatus: 'notStarted',
    competitionType: 'single',
    participantsLimit: 30,
    startDate: future(10),
    endDate: future(11),
    registrationDeadline: future(10),
    lake: { id: 8001, documentId: CHITA, name: lake.name, contact: [], stands: lake.stands.map((s, n) => ref(s.name, n)) },
    sectors: [
      { id: 8101, documentId: 'fx-sec-a', name: 'A', minFishNumber: 1, stands: [ref('1', 1), ref('2', 2)] },
      { id: 8102, documentId: 'fx-sec-b', name: 'B', minFishNumber: 1, stands: [ref('3', 3)] },
    ],
  } as CompetitionDetail;
  const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
  await page.route(at(`/feed/competitions/${id}`), (route) => (route.request().method() === 'GET' ? json(route, { data: c }) : route.fallback()));
  await page.route(at(`/feed/competitions/${id}/my-status`), (route) => json(route, { data: { isFollowing: false, userRegistrationStatus: null } }));
  await page.route(at(`/user/profile/competition/${id}/statute`), (route) => json(route, { userRole: 'author' }));
  await organizer.mockWrite('PUT', `/competitions/organizer/${id}`, {
    json: {
      data: competitionFixture({ documentId: id, competitionStatus: 'notStarted', registrations: [] }),
      meta: { allocationsReset: false, affectedAllocationsCount: 0, risks: [], impact: { registeredCount: 0, pendingCount: 0, allocatedRegistrationsCount: 0, allocatedStandsCount: 0 } },
    },
  });

  await open(page, `/concursuri/${id}/editeaza/standuri`);
  await expect(tabs(page).getByRole('tab')).toHaveCount(2, { timeout: 30_000 });
  await expect(tab(page, 'A')).toHaveAttribute('aria-selected', 'true');
  await expect(stand(page, '1')).toContainText('A1');
  await expect(stand(page, '2')).toContainText('A2');
  await expect(stand(page, '3')).toContainText('B3');
  await expect(tab(page, 'A')).toContainText('2 standuri');
  await expect(tab(page, 'B')).toContainText('1 stand');
  await expect(page.getByTestId('wizard-next')).toHaveText('Următorul pas');
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează modificările');
  await stand(page, '4').click();
  await expect(stand(page, '4')).toContainText('A4');
  // No auto-save in edit mode.
  await page.waitForTimeout(1200);
  expect(organizer.writes).toEqual([]);
  await shots(page, 'editare');

  await page.getByTestId('wizard-save').click();
  await expect(page.getByText('Modificările au fost salvate cu succes.')).toBeVisible({ timeout: 15_000 });
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`PUT /competitions/organizer/${id}`]);
  const put = organizer.writes[0].body as { data: { lake?: string; draftMeta: { sectors: { name: string }[]; standAllocations: Record<string, string[]> } }; confirmRiskChanges: boolean };
  expect(put.confirmRiskChanges).toBe(false);
  expect(put.data.lake).toBe(CHITA);
  expect(put.data.draftMeta.sectors.map((s) => s.name)).toEqual(['A', 'B']);
  expect(put.data.draftMeta.standAllocations).toEqual({ A: [byName['1'], byName['2'], byName['4']], B: [byName['3']] });
});

/* ── many sectors (the CMS allows 24, A..X) ──────────────────────────────────────────────────── */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('');
const sectorsOf = (n: number) => LETTERS.slice(0, n).map((name) => ({ name, minFishNumber: 1 }));

test('organizer.step-stand-allocation.c3 — 6 sectors on a phone: every tab visible (2-column grid, count under the name), none cut off', async ({ page }) => {
  await open(page, STEP, PHONE);
  await enterWith(page, { lake: CHITA, sectors: sectorsOf(6), standAllocations: {} });
  await expect(tabs(page).getByRole('tab')).toHaveCount(6, { timeout: 30_000 });
  const list = await tabs(page).boundingBox();
  for (const name of LETTERS.slice(0, 6)) {
    const box = await tab(page, name).boundingBox();
    expect(box && list && box.x >= list.x - 0.5 && box.x + box.width <= list.x + list.width + 0.5, `Sector ${name} inside the tablist`).toBe(true);
    await expect(tab(page, name)).toBeInViewport({ ratio: 1 });
  }
  expect(await tabs(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expectAccentRing(page, tab(page, 'A'));
  await shots(page, 'sase-sectoare', [375]);
});

test('organizer.step-stand-allocation.c3 — 24 sectors: compact letter chips with the count, bounded at every width; the sticky column fits the viewport', async ({ page }) => {
  const lake = chita as LakeDto;
  const byName = Object.fromEntries(lake.stands.map((s) => [s.name, s.documentId]));
  await open(page);
  await enterWith(page, { lake: CHITA, sectors: sectorsOf(24), standAllocations: { X: [byName['1'], byName['2']] } });
  await expect(tabs(page).getByRole('tab')).toHaveCount(24, { timeout: 30_000 });
  await expect(tabs(page)).toHaveAttribute('data-compact', 'true');
  // The chip's accessible name and tooltip carry the full label and the count.
  await expect(tab(page, 'X')).toHaveAttribute('aria-label', 'Sector X, 2 standuri');
  await expect(tab(page, 'X')).toHaveAttribute('title', 'Sector X · 2 standuri');
  await expect(tab(page, 'X')).toContainText('2');
  await expectAccentRing(page, tab(page, 'A'));
  await tab(page, 'X').click();
  await expect(stand(page, '1')).toHaveAttribute('aria-pressed', 'true');

  for (const width of [375, 1280, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await settle(page);
    const h = (await tabs(page).boundingBox())?.height ?? Infinity;
    // A few rows of chips, never the 6–8 rows of full tabs (or a column taller than the screen).
    expect(h, `tablist height at ${width}`).toBeLessThan(width < 768 ? 300 : 420);
    // Every chip is on screen once the tablist is scrolled to.
    await tabs(page).scrollIntoViewIfNeeded();
    await expect(tab(page, 'X')).toBeInViewport({ ratio: 1 });
    await expect(tab(page, 'A')).toBeInViewport({ ratio: 1 });
  }
  await shots(page, 'sectoare-24', [375, 1280, 1920]);
  await a11y(page);
});
