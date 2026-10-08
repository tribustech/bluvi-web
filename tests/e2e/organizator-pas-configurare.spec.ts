import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { getFishes } from '../../core/lakes';
import { sortCompetitionSpecies } from '../../app/(site)/organizator/_wizard/steps/configurare/model';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { draftFixture, expect, mockRead, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.step-config (c1–c8) — the wizard's step 2 «Configurare competiție»
 * (/organizator/concursuri/nou/configurare, /concursuri/[id]/editeaza/configurare; fish
 * app/(app)/create-competition/step-config.tsx).
 *
 * NO REAL WRITES: every draft PUT is route-mocked through the harness (helpers/fake-organizer, which
 * fails the test on any un-mocked write) and its body asserted. Reads: the species catalog
 * (/fishes, public) comes from the local CMS in one spec and from fixtures where the order / states
 * need exact data; the draft GET is a fixture.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const WIDTHS = [375, 1280, 1440, 1920];
const SHOTS = '.shots/organizator-pas-configurare';
mkdirSync(SHOTS, { recursive: true });

const DRAFT_PATH = '/competitions/organizer/draft';
const NEW = (q = '') => `/organizator/concursuri/nou/configurare${q}`;
const TEMPLATE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';

/** Fixture catalog: priorities out of order + Romanian names (ș, ț, â) to prove the collation. */
const FISHES = [
  { id: 1, documentId: 'f-stiuca', Name: 'Știucă', competitionPriority: null },
  { id: 2, documentId: 'f-amur', Name: 'Amur', competitionPriority: 3 },
  { id: 3, documentId: 'f-biban', Name: 'Biban', competitionPriority: null },
  { id: 4, documentId: 'f-oglinda', Name: 'Crap oglindă', competitionPriority: 2 },
  { id: 5, documentId: 'f-salau', Name: 'Șalău', competitionPriority: null },
  { id: 6, documentId: 'f-crap', Name: 'Crap', competitionPriority: 1 },
  { id: 7, documentId: 'f-tipar', Name: 'Țipar' },
  { id: 8, documentId: 'f-avat', Name: 'Avat', competitionPriority: null },
];
const ORDER = ['Crap', 'Crap oglindă', 'Amur', 'Avat', 'Biban', 'Șalău', 'Știucă', 'Țipar'];

test.beforeEach(async ({ context, request }) => {
  await signInOrganizer(context, request);
});

/* ── helpers ── */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const section = (page: Page, name: string) => page.getByRole('region', { name });
const typeGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Tipul competiției *' });
const radio = (page: Page, name: 'Individual' | 'Echipă') => typeGroup(page).getByRole('radio', { name });
const teamInput = (page: Page) => page.getByLabel('Participanți per echipă *');
const limitInput = (page: Page, team = false) => page.getByLabel(team ? 'Total echipe *' : 'Total participanți *');
const chips = (page: Page) => page.getByTestId('configurare-specii').getByRole('button');
const chip = (page: Page, name: string) => page.getByTestId('configurare-specii').getByRole('button', { name, exact: true });

async function open(page: Page, path: string, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'configurare', { timeout: 90_000 });
  await expect(section(page, 'Format participanți')).toBeVisible({ timeout: 30_000 });
}

/**
 * The catalog is a public GET: the browser transport reads it straight from the CMS
 * (NEXT_PUBLIC_CMS_URL) or through /api/cms — both answered here.
 */
async function mockFishes(page: Page, respond: { status?: number; json?: unknown; delayMs?: number } = { json: { data: FISHES, meta: {} } }) {
  await page.route(
    (url) => url.pathname === '/api/fishes' || url.pathname === '/api/cms/fishes',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (respond.delayMs) await new Promise((r) => setTimeout(r, respond.delayMs));
      return json(route, respond.json ?? {}, respond.status ?? 200).catch(() => {});
    },
  );
}

/** A saved draft the step edits (auto-save only runs for a named draft — fish isDirty + name ≥ 3). */
async function openDraft(page: Page, id: string, over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}, viewport?: { width: number; height: number }) {
  const draft = draftFixture({
    documentId: id,
    name: 'Cupa configurare',
    competitionType: 'single',
    participantsLimit: null,
    teamParticipants: null,
    lake: null,
    ...over,
    draftMeta: { sectors: [], standAllocations: {}, sponsorIds: [], fishSpeciesIds: [], completedSteps: [1], ...meta },
  });
  await mockRead(page, `${DRAFT_PATH}/${id}`, { json: { data: draft } });
  await open(page, NEW(`?ciorna=${id}`), viewport);
  return draft;
}

const data = (w: { body: unknown }) => ((w.body as { data?: Record<string, unknown> } | undefined)?.data ?? {}) as Record<string, unknown>;

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
async function shots(page: Page, name: string) {
  const before = page.viewportSize();
  for (const width of WIDTHS) {
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

/* ============================================================================================== */

test('organizer.step-config.c1 c4 c5 c8 — new competition: Individual preselected, capacity copy, species from the CMS, footer → clasament', async ({ page, organizer }) => {
  await open(page, NEW());
  const format = section(page, 'Format participanți');
  await expect(format).toContainText('Alege formatul competiției și structura echipei.');
  await expect(typeGroup(page)).toContainText('Alege dacă participanții concurează individual sau în echipă.');
  await expect(radio(page, 'Individual')).toBeChecked();
  await expect(radio(page, 'Echipă')).not.toBeChecked();
  await expect(teamInput(page)).toHaveCount(0);

  const capacity = section(page, 'Capacitate competiție');
  await expect(capacity).toContainText('Definește limita maximă de participanți sau echipe.');
  await expect(limitInput(page)).toHaveAttribute('placeholder', 'ex. 50');
  await expect(limitInput(page)).toHaveAttribute('inputmode', 'numeric');
  await expect(capacity).toContainText('Numărul maxim de participanți acceptați.');

  // c5: the real catalog (local CMS), in the step's order.
  const catalog = sortCompetitionSpecies(await getFishes(createTestTransport()));
  test.skip(catalog.length === 0, 'the local CMS has no species');
  const species = section(page, 'Specii eligibile *');
  await expect(species).toContainText('Selectează speciile de pește care intră în competiție.');
  await expect(chips(page)).toHaveText(catalog.map((f) => f.Name));
  await shots(page, 'nou-individual');
  await a11y(page);

  // c8: the footer.
  await expect(page.getByTestId('wizard-next')).toHaveText('Următorul pas');
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează și ieși');
  await page.getByTestId('wizard-next').click();
  await expect(page).toHaveURL(/\/organizator\/concursuri\/nou\/clasament/);
  // Nameless new competition: nothing saved (fish name ≥ 3 gate).
  expect(organizer.writes).toEqual([]);
});

test('organizer.step-config.c1 c2 c3 c4 c7 — Echipă: team size field, digits only, 1–10 error, capacity copy, auto-save on choose and on blur', async ({ page, organizer }) => {
  await mockFishes(page);
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-cfg`, { json: { data: draftFixture({ documentId: 'fx-cfg', name: 'Cupa configurare' }) } });
  await openDraft(page, 'fx-cfg');
  await expect(radio(page, 'Individual')).toBeChecked();

  // c2: choosing a type schedules an auto-save (debounced) with the new type.
  await typeGroup(page).getByText('Echipă', { exact: true }).click();
  await expect(radio(page, 'Echipă')).toBeChecked();
  await expect(radio(page, 'Individual')).not.toBeChecked();
  await expect.poll(() => organizer.writes.length, { timeout: 10_000 }).toBe(1);
  expect(organizer.writes[0]).toMatchObject({ method: 'PUT', path: `${DRAFT_PATH}/fx-cfg` });
  expect(data(organizer.writes[0])).toMatchObject({ name: 'Cupa configurare', competitionType: 'team' });

  // c3: only for Echipă, with its caption; digits only.
  await expect(teamInput(page)).toBeVisible();
  await expect(section(page, 'Format participanți')).toContainText('Câți membri are fiecare echipă.');
  await teamInput(page).fill('1a2');
  await expect(teamInput(page)).toHaveValue('12');
  const teamError = page.getByText('Participanți per echipă trebuie să fie între 1 și 10.');
  await expect(teamError).toBeVisible();
  await expect(teamInput(page)).toHaveAttribute('aria-invalid', 'true');
  await teamInput(page).fill('0');
  await expect(teamError).toBeVisible();
  await a11y(page);
  await teamInput(page).fill('4');
  await expect(teamError).toHaveCount(0);
  // c7: blur saves at once.
  await teamInput(page).blur();
  await expect.poll(() => organizer.writes.length).toBe(2);
  expect(String(data(organizer.writes[1]).teamParticipants)).toBe('4');

  // c4: team capacity copy, digits only, < 1 error; blur saves (c7).
  const capacity = section(page, 'Capacitate competiție');
  await expect(limitInput(page, true)).toHaveAttribute('placeholder', 'ex. 20');
  await expect(capacity).toContainText('Numărul maxim de echipe acceptate.');
  await expect(limitInput(page)).toHaveCount(0);
  await limitInput(page, true).fill('0');
  const limitError = page.getByText('Capacitatea trebuie să fie cel puțin 1.');
  await expect(limitError).toBeVisible();
  await limitInput(page, true).fill('x1 6');
  await expect(limitInput(page, true)).toHaveValue('16');
  await expect(limitError).toHaveCount(0);
  await limitInput(page, true).blur();
  await expect.poll(() => organizer.writes.length).toBe(3);
  expect(data(organizer.writes[2])).toMatchObject({ competitionType: 'team' });
  expect(String(data(organizer.writes[2]).teamParticipants)).toBe('4');
  expect(String(data(organizer.writes[2]).participantsLimit)).toBe('16');
  await shots(page, 'echipa');

  // Back to Individual: the team field goes, the capacity copy follows; saved again (c2).
  await typeGroup(page).getByText('Individual', { exact: true }).click();
  await expect(teamInput(page)).toHaveCount(0);
  await expect(limitInput(page)).toHaveAttribute('placeholder', 'ex. 50');
  await expect.poll(() => organizer.writes.length, { timeout: 10_000 }).toBe(4);
  expect(data(organizer.writes[3])).toMatchObject({ competitionType: 'single' });

  // c8: «Următorul pas» → clasament.
  await page.getByTestId('wizard-next').click();
  await expect(page).toHaveURL(/\/organizator\/concursuri\/nou\/clasament\?ciorna=fx-cfg/);
});

test('organizer.step-config.c5 c6 — order by priority then Romanian name; chips toggle (aria-pressed, accent) and auto-save; wrap', async ({ page, organizer }) => {
  await mockFishes(page);
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-sp`, { json: { data: draftFixture({ documentId: 'fx-sp', name: 'Cupa configurare' }) } });
  await openDraft(page, 'fx-sp', {}, {}, PHONE);

  await expect(chips(page)).toHaveText(ORDER);
  for (const c of await chips(page).all()) await expect(c).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('configurare-specii-count')).toHaveCount(0);
  await shots(page, 'specii-niciuna');

  // c6: toggle on → pressed, accent look, debounced auto-save carrying the ids (draftMeta).
  await chip(page, 'Crap').click();
  await chip(page, 'Știucă').click();
  await expect(chip(page, 'Crap')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Știucă')).toHaveAttribute('aria-pressed', 'true');
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent-ink').trim());
  expect(accent).not.toBe('');
  const on = await chip(page, 'Crap').evaluate((el) => getComputedStyle(el).color);
  const off = await chip(page, 'Amur').evaluate((el) => getComputedStyle(el).color);
  expect(on).not.toBe(off);
  await expect(page.getByTestId('configurare-specii-count')).toHaveText('2 selectate');
  await expect.poll(() => organizer.writes.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(() => (data(organizer.writes.at(-1)!).draftMeta as { fishSpeciesIds?: string[] }).fishSpeciesIds, { timeout: 10_000 }).toEqual(['f-crap', 'f-stiuca']);

  // Wraps on the web (c6 allows it): no horizontal overflow at 375; chips on more than one row.
  const box = await page.getByTestId('configurare-specii').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(box.sw).toBeLessThanOrEqual(box.cw);
  const tops = new Set(await chips(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))));
  expect(tops.size).toBeGreaterThan(1);
  await shots(page, 'specii-selectate');
  await a11y(page);

  // Toggle off → saved without it.
  const n = organizer.writes.length;
  await chip(page, 'Crap').click();
  await expect(chip(page, 'Crap')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('configurare-specii-count')).toHaveText('1 selectată');
  await expect.poll(() => organizer.writes.length, { timeout: 10_000 }).toBeGreaterThan(n);
  expect((data(organizer.writes.at(-1)!).draftMeta as { fishSpeciesIds?: string[] }).fishSpeciesIds).toEqual(['f-stiuca']);
});

test('organizer.step-config.c5 — species loading, empty or failed: the section is hidden (owner rule 4)', async ({ page }) => {
  // Loading (held reply).
  await mockFishes(page, { json: { data: FISHES, meta: {} }, delayMs: 4000 });
  await open(page, NEW());
  await expect(section(page, 'Capacitate competiție')).toBeVisible();
  await expect(section(page, 'Specii eligibile *')).toHaveCount(0);
  await shots(page, 'specii-se-incarca');
  await expect(section(page, 'Specii eligibile *')).toBeVisible({ timeout: 15_000 });

  // Empty catalog.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockFishes(page, { json: { data: [], meta: {} } });
  await open(page, NEW());
  await page.waitForResponse((r) => r.url().includes('/fishes')).catch(() => {});
  await page.waitForTimeout(500);
  await expect(section(page, 'Specii eligibile *')).toHaveCount(0);

  // Failed read.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockFishes(page, { status: 500, json: { error: { status: 500 } } });
  await open(page, NEW());
  await page.waitForTimeout(800);
  await expect(section(page, 'Specii eligibile *')).toHaveCount(0);
  await expect(page.getByText('Specii eligibile')).toHaveCount(0);
});

test('organizer.step-config — a saved team draft hydrates: Echipă, its size, the capacity, selected species', async ({ page, organizer }) => {
  await mockFishes(page);
  await openDraft(page, 'fx-hyd', { competitionType: 'team', teamParticipants: 3, participantsLimit: 12 }, { fishSpeciesIds: ['f-amur', 'f-tipar'] });
  await expect(radio(page, 'Echipă')).toBeChecked();
  await expect(teamInput(page)).toHaveValue('3');
  await expect(limitInput(page, true)).toHaveValue('12');
  await expect(chip(page, 'Amur')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Țipar')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Crap')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(800);
  expect(organizer.writes).toEqual([]);
  await shots(page, 'echipa-ciorna');

  // Both errors at once (c3 + c4), for the screenshots; the blurs save (mocked) like fish.
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-hyd`, { json: { data: draftFixture({ documentId: 'fx-hyd', name: 'Cupa configurare' }) } });
  await teamInput(page).fill('11');
  await limitInput(page, true).fill('0');
  await limitInput(page, true).blur();
  await expect(page.getByText('Participanți per echipă trebuie să fie între 1 și 10.')).toBeVisible();
  await expect(page.getByText('Capacitatea trebuie să fie cel puțin 1.')).toBeVisible();
  // Like fish (and the radiogroup caption): the captions stay, between the label and the input,
  // next to the errors (which go under the input).
  for (const [input, caption, error] of [
    [teamInput(page), 'Câți membri are fiecare echipă.', 'Participanți per echipă trebuie să fie între 1 și 10.'],
    [limitInput(page, true), 'Numărul maxim de echipe acceptate.', 'Capacitatea trebuie să fie cel puțin 1.'],
  ] as const) {
    const cap = page.getByText(caption, { exact: true });
    const err = page.getByText(error, { exact: true });
    await expect(cap).toBeVisible();
    await expect(input).toHaveAccessibleDescription(`${caption} ${error}`);
    const [c, i, e] = await Promise.all([cap.boundingBox(), input.boundingBox(), err.boundingBox()]);
    expect(c!.y).toBeLessThan(i!.y);
    expect(e!.y).toBeGreaterThan(i!.y);
  }
  // Desktop: the count fields end where the Individual / Echipă cards end (one right edge).
  const right = async (loc: ReturnType<typeof teamInput>) => {
    const b = await loc.boundingBox();
    return Math.round(b!.x + b!.width);
  };
  const cardsRight = await right(page.getByTestId('wizard-step').locator('[role="radiogroup"] > div.grid'));
  const limitShell = limitInput(page, true).locator('..');
  const teamShell = teamInput(page).locator('..');
  expect(await right(limitShell)).toBeLessThanOrEqual(cardsRight);
  expect(Math.abs((await right(limitShell)) - (await right(teamShell)))).toBeLessThanOrEqual(1);
  await shots(page, 'erori');
  await a11y(page);
});

test('organizer.step-config — Echipă → 11 → Individual: the hidden team size is dropped, publish is not blocked', async ({ page, organizer }) => {
  await mockFishes(page);
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-sw`, { json: { data: draftFixture({ documentId: 'fx-sw', name: 'Cupa configurare' }) } });
  await openDraft(page, 'fx-sw');
  // Everything else the review gate asks for (no auto-save from these).
  const valid: Record<string, unknown> = {
    startDate: '2026-11-14T05:00:00.000Z',
    endDate: '2026-11-15T12:00:00.000Z',
    participantsLimit: '12',
    fishSpeciesIds: ['f-crap'],
    rankingType: 'quantity',
    lake: 's84u55lo4n9z0emngozttt6e',
    sectors: [{ name: 'A', minFishNumber: 1 }],
  };
  await page.evaluate((v) => {
    const w = window as unknown as { __bluviWizard: { setValue: (f: string, v: unknown) => void } };
    for (const [f, x] of Object.entries(v)) w.__bluviWizard.setValue(f, x);
  }, valid);

  await typeGroup(page).getByText('Echipă', { exact: true }).click();
  await teamInput(page).fill('11');
  await expect(page.getByText('Participanți per echipă trebuie să fie între 1 și 10.')).toBeVisible();
  await typeGroup(page).getByText('Individual', { exact: true }).click();
  await expect(teamInput(page)).toHaveCount(0);
  const values = () =>
    page.evaluate(() => (window as unknown as { __bluviWizard: { values: () => Record<string, unknown> } }).__bluviWizard.values());
  await expect.poll(async () => (await values()).teamParticipants).toBeUndefined();
  // The debounced save carries single and no hidden '11'.
  await expect.poll(() => data(organizer.writes.at(-1) ?? { body: {} }).competitionType, { timeout: 10_000 }).toBe('single');
  for (const w of organizer.writes) expect(w).toMatchObject({ method: 'PUT', path: `${DRAFT_PATH}/fx-sw` });
  expect(String(data(organizer.writes.at(-1)!).teamParticipants ?? '')).not.toBe('11');

  // The review step's primary is enabled (nothing invisible blocks it). Not clicked: no publish.
  await page.getByRole('navigation', { name: 'Pașii competiției' }).getByRole('button', { name: /Revizuire/ }).click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'revizuire', { timeout: 30_000 });
  await expect(page.getByTestId('wizard-publish')).toBeEnabled({ timeout: 15_000 });
});

/* ── edit mode (a published, not-started competition; the frame's route) ── */

let base: CompetitionDetail | null = null;
test.beforeAll(async () => {
  base = await getCompetition(createTestTransport(), TEMPLATE).catch(() => null);
});

test('organizer.step-config — edit mode: values from the competition, no auto-save', async ({ page, organizer }) => {
  test.skip(!base, 'no local competition to base the edit fixture on');
  await mockFishes(page);
  const id = 'fx-cfg-e';
  const future = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const c = {
    ...(base as CompetitionDetail),
    documentId: id,
    name: 'Cupa editare configurare',
    competitionStatus: 'notStarted',
    competitionType: 'team',
    teamParticipants: 2,
    participantsLimit: 30,
    startDate: future(10),
    endDate: future(11),
    registrationDeadline: future(10),
    fishType: [{ id: 6, documentId: 'f-crap', Name: 'Crap' }],
  } as CompetitionDetail;
  const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
  await page.route(at(`/feed/competitions/${id}`), (route) => (route.request().method() === 'GET' ? json(route, { data: c }) : route.fallback()));
  await page.route(at(`/feed/competitions/${id}/my-status`), (route) => json(route, { data: { isFollowing: false, userRegistrationStatus: null } }));
  await page.route(at(`/user/profile/competition/${id}/statute`), (route) => json(route, { userRole: 'author' }));

  await open(page, `/concursuri/${id}/editeaza/configurare`);
  await expect(radio(page, 'Echipă')).toBeChecked();
  await expect(teamInput(page)).toHaveValue('2');
  await expect(limitInput(page, true)).toHaveValue('30');
  await expect(chip(page, 'Crap')).toHaveAttribute('aria-pressed', 'true');
  await limitInput(page, true).fill('40');
  await limitInput(page, true).blur();
  await chip(page, 'Amur').click();
  await page.waitForTimeout(1200);
  // Edit mode never auto-saves (fish shouldAttemptAutoSave): the change waits for «Salvează modificările».
  expect(organizer.writes).toEqual([]);
  await shots(page, 'editare');
});
