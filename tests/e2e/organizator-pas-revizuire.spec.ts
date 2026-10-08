import { mkdirSync } from 'node:fs';
import type { Locator, Page, Route } from '@playwright/test';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS } from './helpers/session';
import { competitionFixture, draftFixture, expect, mockRead, S3_IMAGE, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.step-review (c1–c12) — step 6 of the create-competition wizard,
 * /organizator/concursuri/nou/revizuire (+ /concursuri/[id]/editeaza/revizuire); fish
 * app/(app)/create-competition/step-review.tsx.
 *
 * Reads: the lake (Chita Lake) from the local CMS; the edit base competition from the local CMS,
 * served to the browser as a fixture. NO REAL WRITES (the local CMS sends real pushes / e-mails):
 * the draft create / update, the publish and the competition PUT are route-mocked through the
 * harness (helpers/fake-organizer — any other write is aborted and fails the test) and their
 * method, path and body asserted. The form is filled through the frame's dev-only seam
 * (window.__bluviWizard) without auto-save, as steps 1–5 would have filled it; a write happens
 * only where the test mocks it.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };
const WIDTHS = [375, 1280, 1440, 1920];
const SHOTS = '.shots/organizator-pas-revizuire';
mkdirSync(SHOTS, { recursive: true });

const STEP = '/organizator/concursuri/nou/revizuire';
const DRAFT_PATH = '/competitions/organizer/draft';
const CHITA = 's84u55lo4n9z0emngozttt6e';
const TEMPLATE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';

type Values = Record<string, unknown>;
type LakeDto = { documentId: string; name: string; stands: { documentId: string; name: string }[] } & Record<string, unknown>;

let chita: LakeDto | null = null;
let base: CompetitionDetail | null = null;

test.beforeAll(async () => {
  const res = await fetch(`${CMS}/feed/lakes/${CHITA}`).catch(() => null);
  chita = res?.ok ? (((await res.json()) as { data: LakeDto }).data ?? null) : null;
  base = await getCompetition(createTestTransport(), TEMPLATE).catch(() => null);
});

test.beforeEach(async ({ context, request }) => {
  test.skip(!chita?.stands?.length, 'the local CMS has no Chita Lake with stands');
  await signInOrganizer(context, request);
});

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────── */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const standIds = (n: number) => (chita as LakeDto).stands.slice(0, n).map((s) => s.documentId);

/** A publishable form (fish hasAnyError false): 2 stands allocated for 2 participants. */
const valid = (over: Values = {}): Values => ({
  name: 'Cupa Revizuire',
  startDate: '2026-11-14T05:00:00.000Z',
  endDate: '2026-11-15T12:00:00.000Z',
  registerFee: '150',
  competitionType: 'single',
  participantsLimit: '2',
  fishSpeciesIds: ['crap', 'caras'],
  rankingType: 'quantity',
  lake: CHITA,
  sectors: [{ name: 'A', minFishNumber: 1 }],
  standAllocations: { A: standIds(2) },
  ...over,
});

async function open(page: Page, path = STEP, viewport = LAPTOP) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'revizuire', { timeout: 90_000 });
  await expect(page.getByTestId('step-review')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
}

/** Set fields like steps 1–5 would (no auto-save: the test decides the writes). */
async function set(page: Page, values: Values) {
  await page.evaluate((v) => {
    const w = window as unknown as { __bluviWizard: { setValue: (f: string, v: unknown, o?: unknown) => void } };
    for (const [f, value] of Object.entries(v)) w.__bluviWizard.setValue(f, value, { autoSave: false });
  }, values);
}

const section = (page: Page, id: string) => page.getByTestId(`review-section-${id}`);
const row = (page: Page, key: string) => page.getByTestId(`review-row-${key}`);
const edit = (page: Page, id: string) => page.getByTestId(`review-edit-${id}`);
const publishBtn = (page: Page) => page.getByTestId('wizard-publish');
const titlesRail = ['Detalii de bază', 'Configurare competiție', 'Tip clasament', 'Lac și sectoare', 'Alocă standuri'];
const railStep = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const summary = (page: Page) => page.getByRole('group', { name: /trebuie corectat/ });

/** A row reads `label` then `value`, in that state. */
async function expectRow(r: Locator, label: string, value: string | RegExp, state: 'ok' | 'missing' | 'error' = 'ok') {
  await expect(r).toHaveAttribute('data-state', state);
  await expect(r).toContainText(label);
  await expect(r).toContainText(value);
}

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

async function a11y(page: Page) {
  await settle(page);
  await scan(page);
}

/** The Romanian «d MMM yyyy, HH:mm» of an ISO date in the browser's local time. */
const localLabel = (page: Page, iso: string) =>
  page.evaluate((s) => {
    const m = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
    const d = new Date(s);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
  }, iso);

function hold() {
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  return { held, release };
}

const bodyData = (w: { body: unknown }): Values => ((w.body as { data?: Values } | undefined)?.data ?? {}) as Values;

/* ── c1 c2 c11 — empty form ──────────────────────────────────────────────────────────────────── */

test('organizer.step-review.c1 c2 c11 — an empty form: four red sections «Completează», «Lipsește», the problem list, publish disabled', async ({ page, organizer }) => {
  const errors = collectConsoleErrors(page);
  await open(page);

  // c1: four sections, in order, each a heading.
  const titles = ['Detalii de bază', 'Configurare', 'Clasament', 'Lac și sectoare'];
  const ids = ['basics', 'config', 'ranking', 'lakeSectors'];
  for (let i = 0; i < 4; i++) {
    await expect(section(page, ids[i]).getByRole('heading', { level: 2 })).toHaveText(titles[i]);
    // Defaults: individual competition, no species, no name… every section misses something.
    await expect(section(page, ids[i])).toHaveAttribute('data-error', 'true');
    await expect(edit(page, ids[i])).toHaveText('Completează');
  }
  // c2: «Lipsește» for the missing required values, in red.
  for (const [key, label] of [
    ['name', 'Nume'],
    ['startDate', 'Data început'],
    ['endDate', 'Data sfârșit'],
    ['participantsLimit', 'Total participanți'],
    ['fishSpeciesIds', 'Specii de pește'],
    ['rankingType', 'Tip clasament'],
    ['lake', 'Lac'],
    ['sectors', 'Sectoare'],
  ] as const) {
    await expectRow(row(page, key), label, 'Lipsește', 'missing');
  }
  const missing = row(page, 'name').getByText('Lipsește');
  const danger = await page.evaluate(() => {
    const i = document.createElement('i');
    i.style.color = 'var(--color-status-danger-fg)';
    document.body.append(i);
    const c = getComputedStyle(i).color;
    i.remove();
    return c;
  });
  await expect(missing).toHaveCSS('color', danger);
  // c2: an empty optional value is not listed (no team members for an individual competition).
  await expect(row(page, 'teamParticipants')).toHaveCount(0);
  // Defaults: individual, a free competition.
  await expectRow(row(page, 'competitionType'), 'Tip competiție', 'Individual');
  await expectRow(row(page, 'registerFee'), 'Taxă înscriere', 'Gratuit');

  // The problem list says what blocks publishing; a line focuses its row.
  await expect(summary(page)).toContainText('8 câmpuri trebuie corectate');
  await summary(page).getByRole('link', { name: 'Lac: lipsește' }).click();
  await expect(row(page, 'lake')).toBeFocused();

  // c11: publish disabled while any section has an error.
  await expect(publishBtn(page)).toBeDisabled();
  await expect(publishBtn(page)).toHaveText('Publică competiția');
  // The rail (1280+) says what the cards say: four red steps, stands still to do, no check.
  for (const [i, title] of titlesRail.slice(0, 4).entries()) {
    await expect(railStep(page, `Pasul ${i + 1} din 6: ${title}, are erori`)).toBeVisible();
  }
  await expect(railStep(page, 'Pasul 5 din 6: Alocă standuri, urmează')).toContainText('De completat');
  await expect(page.getByRole('button', { name: /, completat$/ })).toHaveCount(0);
  await shots(page, 'gol');
  await a11y(page);
  expect(organizer.writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('organizer.step-review.c1 — «Completează» / «Editează» flush the auto-save, then open the section’s step', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { json: { data: draftFixture({ documentId: 'fx-rev-flush', id: 7101, name: 'Cupa flush' }) } });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-rev-flush`, { json: { data: draftFixture({ documentId: 'fx-rev-flush', id: 7101, name: 'Cupa flush' }) } });
  await open(page);
  await set(page, { name: 'Cupa flush' });
  expect(organizer.writes).toEqual([]);

  await edit(page, 'config').click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'configurare', { timeout: 30_000 });
  await expect(page).toHaveURL(/\/organizator\/concursuri\/nou\/configurare/);
  await expect.poll(() => organizer.writes.length).toBe(1);
  expect(organizer.writes[0].method).toBe('POST');
  expect(organizer.writes[0].path).toBe(DRAFT_PATH);
  expect(bodyData(organizer.writes[0])).toMatchObject({ name: 'Cupa flush' });

  // Each section's link lands on its own step.
  for (const [id, step] of [
    ['basics', 'detalii'],
    ['ranking', 'clasament'],
    ['lakeSectors', 'lac-si-sectoare'],
  ] as const) {
    await page.getByRole('navigation', { name: 'Pașii competiției' }).first().getByRole('button', { name: /Revizuire/ }).click();
    await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'revizuire', { timeout: 30_000 });
    await edit(page, id).click();
    await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', step, { timeout: 30_000 });
  }
});

/* ── c3 c4 c6 c8 c11 — a valid form ──────────────────────────────────────────────────────────── */

test('organizer.step-review.c3 c4 c6 c8 c11 — a valid form: the rows, «Editează» everywhere, publish enabled', async ({ page, organizer }) => {
  const errors = collectConsoleErrors(page);
  await open(page);
  const v = valid();
  await set(page, v);

  for (const id of ['basics', 'config', 'ranking', 'lakeSectors']) {
    await expect(section(page, id)).not.toHaveAttribute('data-error', 'true');
    await expect(edit(page, id)).toHaveText('Editează');
  }
  // c3
  await expectRow(row(page, 'name'), 'Nume', 'Cupa Revizuire');
  await expectRow(row(page, 'startDate'), 'Data început', await localLabel(page, v.startDate as string));
  await expectRow(row(page, 'endDate'), 'Data sfârșit', await localLabel(page, v.endDate as string));
  await expect(row(page, 'registerFee').locator('dd').first()).toHaveText('150 RON');
  // c4
  await expectRow(row(page, 'competitionType'), 'Tip competiție', 'Individual');
  await expectRow(row(page, 'participantsLimit'), 'Total participanți', '2');
  await expect(row(page, 'participantsLimit').getByTestId('review-note')).toHaveCount(0);
  await expectRow(row(page, 'fishSpeciesIds'), 'Specii de pește', '2 specii');
  // c6
  await expectRow(row(page, 'rankingType'), 'Tip clasament', 'Cantitate');
  // c8: the lake's name from the CMS, the sector count, one tile per sector.
  await expectRow(row(page, 'lake'), 'Lac', (chita as LakeDto).name);
  await expectRow(row(page, 'sectors'), 'Sectoare', '1 sector');
  await expectRow(row(page, 'sector-A'), 'Sector A', '2 standuri');
  await expect(page.getByTestId('review-capacity-warning')).toHaveCount(0);

  // The ready notice, no problem list; c11: publish enabled.
  await expect(page.getByRole('status').filter({ hasText: 'Totul este completat' })).toContainText('apoi publică competiția');
  await expect(summary(page)).toHaveCount(0);
  await expect(publishBtn(page)).toBeEnabled();
  await shots(page, 'valid');
  await a11y(page);

  // A free competition: «Gratuit».
  await set(page, { registerFee: '0' });
  await expect(row(page, 'registerFee').locator('dd').first()).toHaveText('Gratuit');

  // c4 — a team competition: «Echipă», «Participanți/echipă», «Total echipe».
  await set(page, { competitionType: 'team', teamParticipants: '3' });
  await expectRow(row(page, 'competitionType'), 'Tip competiție', 'Echipă');
  await expectRow(row(page, 'teamParticipants'), 'Participanți/echipă', '3');
  await expectRow(row(page, 'participantsLimit'), 'Total echipe', '2');
  await set(page, { teamParticipants: '11' });
  await expectRow(row(page, 'teamParticipants'), 'Participanți/echipă', 'Lipsește', 'missing');
  await expect(edit(page, 'config')).toHaveText('Completează');
  await expect(publishBtn(page)).toBeDisabled();
  expect(organizer.writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('organizer.step-review.c8 — while the lake loads, a neutral bar (never a guess)', async ({ page }) => {
  await page.route(
    (url) => url.pathname.endsWith(`/feed/lakes/${CHITA}`),
    async (route) => {
      await new Promise((r) => setTimeout(r, 4_000));
      return json(route, { data: chita }).catch(() => {});
    },
  );
  await open(page);
  await set(page, valid());
  await expect(row(page, 'lake').getByTestId('review-value-loading')).toBeVisible();
  await expect(row(page, 'lake')).not.toContainText('Selectat');
  await expectRow(row(page, 'lake'), 'Lac', (chita as LakeDto).name);
});

/* ── c3 — the fee error ──────────────────────────────────────────────────────────────────────── */

test('organizer.step-review.c3 — a fee out of range: the range error under it, the section red, publish disabled', async ({ page }) => {
  await open(page, STEP, PHONE);
  await set(page, valid({ registerFee: '60000' }));
  await expect(row(page, 'registerFee').locator('dd').first()).toHaveText('60000 RON');
  await expect(row(page, 'registerFee').getByTestId('review-note')).toHaveText('Taxa de înscriere trebuie să fie între 0 și 50.000 RON.');
  await expect(section(page, 'basics')).toHaveAttribute('data-error', 'true');
  await expect(edit(page, 'basics')).toHaveText('Completează');
  await expect(summary(page)).toContainText('Taxa de înscriere trebuie să fie între 0 și 50.000 RON.');
  await expect(publishBtn(page)).toBeDisabled();
  await shots(page, 'taxa-invalida', [375, 1280]);
});

/* ── c5 c9 — stand capacity ──────────────────────────────────────────────────────────────────── */

test('organizer.step-review.c5 c9 — fewer stands than places: the red note under the total, the amber warning; not an error', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { json: { data: draftFixture({ documentId: 'fx-rev-cap', id: 7102, name: 'Cupa Revizuire' }) } });
  await open(page);
  await set(page, valid({ participantsLimit: '12' }));
  await expect(row(page, 'participantsLimit').getByTestId('review-note')).toHaveText('Ai doar 2 standuri pe lac pentru 12 participanți.');
  await expect(page.getByTestId('review-capacity-warning')).toHaveText(
    'Avertisment: ai configurat 2 standuri pentru 12 participanți. Cel puțin 10 participanți nu vor putea fi alocați pe stand.',
  );
  // A warning, not an error: the sections stay neutral, publish stays enabled (fish).
  await expect(section(page, 'config')).not.toHaveAttribute('data-error', 'true');
  await expect(publishBtn(page)).toBeEnabled();
  // One verdict: a warning notice (never «Totul este completat») with a way to the stands step.
  await expect(page.getByText('Totul este completat')).toHaveCount(0);
  const notice = page.getByRole('status').filter({ hasText: 'Poți publica, dar nu toți participanții vor avea stand' });
  await expect(notice).toBeVisible();
  // The rail agrees: the four cards complete, «Alocă standuri» still to do (no check).
  for (const [i, title] of titlesRail.slice(0, 4).entries()) {
    await expect(railStep(page, `Pasul ${i + 1} din 6: ${title}, completat`)).toBeVisible();
  }
  await expect(railStep(page, 'Pasul 5 din 6: Alocă standuri, urmează')).toContainText('De completat');
  await shots(page, 'capacitate');
  await a11y(page);

  // No stand at all, a team competition: «Nu ai standuri pe lac pentru N echipe.»
  await set(page, { competitionType: 'team', teamParticipants: '2', participantsLimit: '25', standAllocations: {} });
  await expect(row(page, 'participantsLimit').getByTestId('review-note')).toHaveText('Nu ai standuri pe lac pentru 25 de echipe.');
  await expect(page.getByTestId('review-capacity-warning')).toHaveText(
    'Avertisment: ai configurat 0 standuri pentru 25 de echipe. Cel puțin 25 de echipe nu vor putea fi alocate pe stand.',
  );
  await expectRow(row(page, 'sector-A'), 'Sector A', '0 standuri');
  await expect(page.getByRole('status').filter({ hasText: 'Poți publica, dar nu toți participanții vor avea stand' })).toBeVisible();

  // The notice's «Alocă standuri» flushes the auto-save (mocked) and opens the stands step.
  await notice.getByRole('button', { name: 'Alocă standuri' }).click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'standuri', { timeout: 30_000 });
  await expect.poll(() => organizer.writes.length).toBe(1);
  expect(organizer.writes[0].method).toBe('POST');
  expect(organizer.writes[0].path).toBe(DRAFT_PATH);
});

/* ── c6 c7 — ranking ─────────────────────────────────────────────────────────────────────────── */

test('organizer.step-review.c6 — the ranking rows per type: general mode, grid rule, Best of, Feeder legs', async ({ page }) => {
  await open(page);
  await set(page, valid({ rankingType: 'quantityQuality', generalRankingWinnerMode: 'bySectorPosition', gridRule: 'average' }));
  await expectRow(row(page, 'rankingType'), 'Tip clasament', 'Cantitate/Calitate');
  await expectRow(row(page, 'generalRankingWinnerMode'), 'Mod clasament general', 'După poziția în sector, primează Cantitatea');
  await expectRow(row(page, 'gridRule'), 'Regula departajare', 'După media greutății');
  // A quality type lists the per-sector minimum.
  await expectRow(row(page, 'sector-A'), 'Sector A', '2 standuri, min 1 pește');
  await shots(page, 'clasament-calitate', [1280]);

  await set(page, { rankingType: 'bestOf', generalRankingWinnerMode: undefined, gridRule: undefined, bestOfFishCount: '5', numberOfWinners: '3' });
  await expectRow(row(page, 'rankingType'), 'Tip clasament', 'Best of');
  await expectRow(row(page, 'bestOfFishCount'), 'Nr. pești clasament', '5');
  await expectRow(row(page, 'numberOfWinners'), 'Nr. câștigători', '3');
  await expect(row(page, 'generalRankingWinnerMode')).toHaveCount(0);
  await expect(publishBtn(page)).toBeEnabled();
  await set(page, { numberOfWinners: '' });
  await expectRow(row(page, 'numberOfWinners'), 'Nr. câștigători', 'Lipsește', 'missing');
  await expect(edit(page, 'ranking')).toHaveText('Completează');
  await expect(publishBtn(page)).toBeDisabled();

  await set(page, { rankingType: 'feederRounds', bestOfFishCount: undefined, numberOfWinners: undefined, roundsCount: '3' });
  await expectRow(row(page, 'rankingType'), 'Tip clasament', 'Feeder (FIPS)');
  await expectRow(row(page, 'roundsCount'), 'Număr de manșe', '3 manșe');
  await set(page, { roundsCount: '1' });
  await expectRow(row(page, 'roundsCount'), 'Număr de manșe', '1 manșă');
  await expect(publishBtn(page)).toBeEnabled();
  await set(page, { roundsCount: undefined });
  await expectRow(row(page, 'roundsCount'), 'Număr de manșe', 'Lipsește', 'missing');
  await expect(publishBtn(page)).toBeDisabled();
});

test('organizer.step-review.c7 c10 — Best of tiers: the list, invalid tiers, not enough stands, exactly 1 sector', async ({ page }) => {
  await open(page);
  await set(page, valid({ rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7], standAllocations: { A: standIds(2) } }));
  await expectRow(row(page, 'rankingType'), 'Tip clasament', 'Best of x, y, z...');
  await expectRow(row(page, 'bestOfTierSizes'), 'Praguri Best of', '9, 7');
  await expect(publishBtn(page)).toBeEnabled();

  // c7: not strictly descending.
  await set(page, { bestOfTierSizes: [5, 7] });
  await expectRow(
    row(page, 'bestOfTierSizes'),
    'Praguri Best of',
    'Pragurile (5, 7) trebuie să fie întregi pozitive, ordonate descrescător și distincte.',
    'error',
  );
  await expect(publishBtn(page)).toBeDisabled();

  // c7: more tiers than allocated stands.
  await set(page, { bestOfTierSizes: [9, 7, 5] });
  await expectRow(row(page, 'allocatedStands'), 'Standuri alocate', 'Ai 3 praguri dar doar 2 standuri. Alocă cel puțin 3 standuri.', 'error');
  await expect(section(page, 'ranking')).toHaveAttribute('data-error', 'true');

  // c10: best of tiers on 2 sectors.
  await set(page, {
    bestOfTierSizes: [2, 1],
    sectors: [
      { name: 'A', minFishNumber: 1 },
      { name: 'B', minFishNumber: 1 },
    ],
  });
  await expectRow(row(page, 'bestOfTiersSectorCount'), 'Best of cu praguri', 'Necesită exact 1 sector', 'error');
  await expect(section(page, 'lakeSectors')).toHaveAttribute('data-error', 'true');
  await expect(edit(page, 'lakeSectors')).toHaveText('Completează');
  await expect(publishBtn(page)).toBeDisabled();
  await shots(page, 'praguri-erori', [375, 1280]);

  // No tiers at all.
  await set(page, { bestOfTierSizes: [], sectors: [{ name: 'A', minFishNumber: 1 }] });
  await expectRow(row(page, 'bestOfTierSizes'), 'Praguri Best of', 'Lipsește', 'missing');
});

/* ── c8 c10 — lake and sectors ───────────────────────────────────────────────────────────────── */

test('organizer.step-review.c8 c10 — sectors: «min N pești», «Min pești invalid (N)», «Minim 1 per sector», «Necesită exact 3 sectoare»', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await open(page);
  const ids = standIds(6);
  await set(
    page,
    valid({
      rankingType: 'quality',
      participantsLimit: '6',
      sectors: [
        { name: 'A', minFishNumber: 2 },
        { name: 'B', minFishNumber: 1 },
        { name: 'C', minFishNumber: 0 },
      ],
      standAllocations: { A: ids.slice(0, 3), B: ids.slice(3, 4), C: ids.slice(4, 6) },
    }),
  );
  await expectRow(row(page, 'sectors'), 'Sectoare', '3 sectoare');
  await expectRow(row(page, 'sector-A'), 'Sector A', '3 standuri, min 2 pești');
  await expectRow(row(page, 'sector-B'), 'Sector B', '1 stand, min 1 pește');
  await expectRow(row(page, 'sector-C'), 'Sector C', 'Min pești invalid (0)', 'error');
  await expectRow(row(page, 'minFishNumber'), 'Nr. minim pești', 'Minim 1 per sector', 'error');
  await expect(section(page, 'lakeSectors')).toHaveAttribute('data-error', 'true');
  await expect(publishBtn(page)).toBeDisabled();
  await shots(page, 'sectoare-erori');
  await a11y(page);

  // A quantity type: no minimum listed.
  await set(page, { rankingType: 'quantity' });
  await expectRow(row(page, 'sector-C'), 'Sector C', '2 standuri');
  await expect(row(page, 'minFishNumber')).toHaveCount(0);
  await expect(publishBtn(page)).toBeEnabled();

  // National championship / FIPSed on 2 sectors.
  await set(page, {
    rankingType: 'nationalChampionship',
    sectors: [
      { name: 'A', minFishNumber: 1 },
      { name: 'B', minFishNumber: 1 },
    ],
  });
  await expectRow(row(page, 'sectorCount'), 'Campionat Național / FIPSed', 'Necesită exact 3 sectoare', 'error');
  await expect(publishBtn(page)).toBeDisabled();
  await set(page, { rankingType: 'fipsed' });
  await expectRow(row(page, 'sectorCount'), 'Campionat Național / FIPSed', 'Necesită exact 3 sectoare', 'error');

  // No lake, no sectors.
  await set(page, { rankingType: 'quantity', lake: undefined, sectors: [], standAllocations: {} });
  await expectRow(row(page, 'lake'), 'Lac', 'Lipsește', 'missing');
  await expectRow(row(page, 'sectors'), 'Sectoare', 'Lipsește', 'missing');
  await expect(publishBtn(page)).toBeDisabled();
  expect(errors).toEqual([]);
});

/* ── c11 — publish ───────────────────────────────────────────────────────────────────────────── */

test('organizer.step-review.c11 — publish: disabled + loading while it runs, mocked create + publish, lands on /concursuri/[id]?fromPublish=1', async ({ page, organizer }) => {
  test.skip(!base, 'no local competition to land on');
  const publish = hold();
  await organizer.mockWrite('POST', DRAFT_PATH, { json: { data: draftFixture({ documentId: 'fx-rev-pub', id: 7201, name: 'Cupa Revizuire' }) } });
  await page.route(`**/api/cms${DRAFT_PATH}/fx-rev-pub/publish`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    organizer.writes.push({ method: 'PUT', path: `${DRAFT_PATH}/fx-rev-pub/publish`, query: '', body: route.request().postData() ?? undefined });
    await publish.held;
    // The published competition: a real local one, so the landing page renders from the CMS.
    return json(route, { data: competitionFixture({ documentId: TEMPLATE, competitionStatus: 'notStarted', registrations: [] }) }).catch(() => {});
  });
  const urls: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) urls.push(f.url());
  });
  await open(page);
  await set(page, valid());
  await expect(publishBtn(page)).toBeEnabled();
  await publishBtn(page).click();
  // No banner: fish's confirmation first.
  const confirm = page.getByRole('dialog', { name: 'Publicare fără fotografie' }).or(page.getByRole('alertdialog', { name: 'Publicare fără fotografie' }));
  await confirm.getByRole('button', { name: 'Continuă' }).click();

  // While it publishes: the button is disabled and spins.
  await expect(page.getByTestId('wizard-progress-status')).toHaveText('Publicăm competiția...', { timeout: 15_000 });
  await expect(publishBtn(page)).toBeDisabled();
  await expect(publishBtn(page).locator('svg.animate-spin')).toHaveCount(1);
  await expect(edit(page, 'basics')).toBeDisabled();

  publish.release();
  await page.waitForURL((u) => u.pathname === `/concursuri/${TEMPLATE}`, { timeout: 60_000 });
  await expect.poll(() => urls.some((u) => u.includes(`/concursuri/${TEMPLATE}?fromPublish=1`)) || page.url().includes('fromPublish=1')).toBe(true);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60_000 });

  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST ${DRAFT_PATH}`, `PUT ${DRAFT_PATH}/fx-rev-pub/publish`]);
  expect(bodyData(organizer.writes[0])).toMatchObject({
    name: 'Cupa Revizuire',
    competitionType: 'single',
    rankingType: 'quantity',
    lake: CHITA,
  });
});

test('organizer.step-review.c11 — a saved draft: mocked update + publish, then the competition', async ({ page, organizer }) => {
  test.skip(!base, 'no local competition to land on');
  const draft = { data: draftFixture({ documentId: 'fx-rev-d', id: 7301, name: 'Cupa Revizuire', banner: S3_IMAGE }) };
  await mockRead(page, `${DRAFT_PATH}/fx-rev-d`, { json: draft });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-rev-d`, { json: draft });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-rev-d/publish`, {
    json: { data: competitionFixture({ documentId: TEMPLATE, competitionStatus: 'notStarted', registrations: [] }) },
  });
  await open(page, `${STEP}?ciorna=fx-rev-d`, PHONE);
  await set(page, valid({ banner: S3_IMAGE.url }));
  await expect(publishBtn(page)).toBeEnabled();
  await shots(page, 'ciorna-valida', [375]);
  await publishBtn(page).click();
  await page.waitForURL((u) => u.pathname === `/concursuri/${TEMPLATE}`, { timeout: 60_000 });
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`PUT ${DRAFT_PATH}/fx-rev-d`, `PUT ${DRAFT_PATH}/fx-rev-d/publish`]);
  expect(bodyData(organizer.writes[0])).toMatchObject({ name: 'Cupa Revizuire', registerFee: '150', participantsLimit: '2' });
});

/* ── c12 — editing a published competition ──────────────────────────────────────────────────── */

async function routeCompetition(page: Page, c: CompetitionDetail) {
  const id = c.documentId;
  const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
  await page.route(at(`/feed/competitions/${id}`), (route) => (route.request().method() === 'GET' ? json(route, { data: c }) : route.fallback()));
  await page.route(at(`/feed/competitions/${id}/my-status`), (route) => json(route, { data: { isFollowing: false, userRegistrationStatus: null } }));
  await page.route(at(`/user/profile/competition/${id}/statute`), (route) => json(route, { userRole: 'author' }));
}

test('organizer.step-review.c12 — editing a published competition: only «Salvează modificările», disabled on an error; saves through the mocked PUT', async ({ page, organizer }) => {
  test.skip(!base, 'no local competition to base the edit fixture on');
  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const c: CompetitionDetail = {
    ...(base as CompetitionDetail),
    documentId: 'fx-rev-e',
    name: 'Cupa editare revizuire',
    competitionStatus: 'notStarted',
    competitionType: 'single',
    participantsLimit: 2,
    startDate: future(10),
    endDate: future(11),
    registrationDeadline: future(10),
  };
  await routeCompetition(page, c);
  await organizer.mockWrite('PUT', '/competitions/organizer/fx-rev-e', {
    json: {
      data: competitionFixture({ documentId: 'fx-rev-e', competitionStatus: 'notStarted', registrations: [] }),
      meta: { allocationsReset: false, affectedAllocationsCount: 0, risks: [], impact: { registeredCount: 0, pendingCount: 0, allocatedRegistrationsCount: 0, allocatedStandsCount: 0 } },
    },
  });
  await open(page, '/concursuri/fx-rev-e/editeaza/revizuire');
  await set(page, valid({ name: c.name }));
  await expect(publishBtn(page)).toHaveCount(0);
  const save = page.getByTestId('wizard-save-edit');
  await expect(save).toHaveText('Salvează modificările');
  await expect(page.getByTestId('wizard-save')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Totul este completat' })).toContainText('apoi salvează modificările');
  await expect(save).toBeEnabled();
  await shots(page, 'editare');

  await set(page, { fishSpeciesIds: [] });
  await expectRow(row(page, 'fishSpeciesIds'), 'Specii de pește', 'Lipsește', 'missing');
  await expect(save).toBeDisabled();
  await set(page, { fishSpeciesIds: ['crap'] });
  await expect(save).toBeEnabled();
  await save.click();
  await page.waitForURL((u) => u.pathname === '/concursuri/fx-rev-e', { timeout: 60_000 });
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual(['PUT /competitions/organizer/fx-rev-e']);
  expect((organizer.writes[0].body as { data: Values }).data).toMatchObject({ name: c.name, participantsLimit: '2' });
});
