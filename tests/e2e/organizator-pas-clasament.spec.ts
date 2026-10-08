import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { GRID_RULE_TIEBREAK_HELP, getGeneralRankingHelpText, RANKING_TYPES } from '../../core/organizer';
import { explanationParam } from '../../app/(site)/organizator/_wizard/explanation/model';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { draftFixture, expect, mockRead, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.step-ranking (c1–c12) — the wizard's step 3 «Tip clasament»
 * (/organizator/concursuri/nou/clasament, /concursuri/[id]/editeaza/clasament; fish
 * app/(app)/create-competition/step-ranking.tsx + components/RankingTypeCard.tsx).
 *
 * NO REAL WRITES: every draft PUT is route-mocked through the harness (helpers/fake-organizer fails
 * the test on any un-mocked write) and its body asserted. The draft GET is a fixture; nothing else
 * is read from the CMS except the edit-mode template competition.
 */

test.describe.configure({ timeout: 240_000 });

const PHONE = { width: 375, height: 812 };
const WIDTHS = [375, 1280, 1440, 1920];
const SHOTS = '.shots/organizator-pas-clasament';
mkdirSync(SHOTS, { recursive: true });

const DRAFT_PATH = '/competitions/organizer/draft';
const NEW = (q = '') => `/organizator/concursuri/nou/clasament${q}`;
const TEMPLATE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';

const NAMES = [
  'Cantitate',
  'Calitate',
  'Cantitate/Calitate',
  'Calitate/Cantitate',
  'Calitate/Calitate',
  'Calitate/Cantitate/CMMC',
  'Best of',
  'Best of x, y, z...',
  'Feeder (FIPS)',
  'Campionat Național',
  'Campionat Mondial FIPSed',
];

test.beforeEach(async ({ context, request }) => {
  await signInOrganizer(context, request);
});

/* ── helpers ── */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const group = (page: Page) => page.getByRole('radiogroup', { name: 'Tipul clasamentului' });
const radio = (page: Page, value: string) => page.locator(`#clasament-${value}`);
/** Clicks the card (its visible name) — the radio itself is visually hidden. */
const pick = (page: Page, value: string) =>
  group(page)
    .locator('label')
    .filter({ has: radio(page, value) })
    .click();
const options = (page: Page, value: string) => page.getByTestId(`clasament-optiuni-${value}`);
const modeTrigger = (page: Page) => page.getByTestId('clasament-mod-general');
const gridTrigger = (page: Page) => page.getByTestId('clasament-regula-grila');
const modeDialog = (page: Page) => page.getByRole('dialog', { name: '📊 Alege modul de departajare în clasamentul general' });
const gridDialog = (page: Page) => page.getByRole('dialog', { name: '🔀 Regula departajare standuri fără grilă' });
const tiersError = (page: Page) => page.locator('#clasament-praguri-error[role="alert"]');
const tiers = (page: Page) => page.getByLabel('Numărul de pești pentru calculul calității, descrescător, valori separate prin virgulă.');
/** The ?explicatie= value now in the URL (the codec is the explanation module's). */
const explicatie = (page: Page) => () => new URL(page.url()).searchParams.get('explicatie');
const values = (page: Page) =>
  page.evaluate(() => (window as unknown as { __bluviWizard: { values: () => Record<string, unknown> } }).__bluviWizard.values());

async function open(page: Page, path: string, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'clasament', { timeout: 90_000 });
  await expect(group(page)).toBeVisible({ timeout: 30_000 });
}

async function openDraft(page: Page, id: string, over: Record<string, unknown> = {}, viewport?: { width: number; height: number }) {
  const draft = draftFixture({
    documentId: id,
    name: 'Cupa clasament',
    competitionType: 'single',
    participantsLimit: 20,
    rankingType: null,
    generalRankingWinnerMode: null,
    gridRule: null,
    bestOfFishCount: null,
    bestOfTierSizes: null,
    roundsCount: null,
    numberOfWinners: null,
    lake: null,
    ...over,
  });
  await mockRead(page, `${DRAFT_PATH}/${id}`, { json: { data: draft } });
  await open(page, NEW(`?ciorna=${id}`), viewport);
  return draft;
}

const data = (w: { body: unknown }) => ((w.body as { data?: Record<string, unknown> } | undefined)?.data ?? {}) as Record<string, unknown>;

/** Waits for one more mocked write and returns its body's data. */
async function nextWrite(organizer: { writes: { body: unknown }[] }, n: number) {
  await expect.poll(() => organizer.writes.length, { timeout: 10_000 }).toBeGreaterThan(n);
  return data(organizer.writes.at(-1)!);
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
async function shots(page: Page, name: string, fullPage = true) {
  const before = page.viewportSize();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage });
  }
  if (before) await page.setViewportSize(before);
}

async function a11y(page: Page) {
  await settle(page);
  await scan(page);
}

async function mockPut(organizer: { mockWrite: (m: 'PUT', p: string, r: { json: unknown }) => Promise<void> }, id: string) {
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/${id}`, { json: { data: draftFixture({ documentId: id, name: 'Cupa clasament' }) } });
}

/* ============================================================================================== */

test('organizer.step-ranking.c1 c2 c3 c12 — 11 types in fish order, two disabled, a radio group (arrow keys), footer → lac și sectoare', async ({ page, organizer }) => {
  await open(page, NEW());
  const section = page.getByRole('region', { name: 'Tipul clasamentului' });
  await expect(section.getByRole('heading', { level: 2, name: 'Tipul clasamentului' })).toBeVisible();
  await expect(section).toContainText('Alege metoda principală și configurează departajările contextuale.');

  // c1: 11 radios, fish's order, label + description each.
  const radios = group(page).getByRole('radio');
  await expect(radios).toHaveCount(11);
  for (const [i, t] of RANKING_TYPES.entries()) {
    await expect(radios.nth(i)).toHaveAttribute('value', t.value);
    await expect(radios.nth(i)).toHaveAccessibleName(`${NAMES[i]} ${t.description}`);
    await expect(radios.nth(i)).not.toBeChecked();
  }
  // c3: nothing chosen → nothing expanded.
  await expect(page.getByText('Vezi explicația completă')).toHaveCount(0);

  // c2: Campionat Național + FIPSed shown, disabled, not choosable.
  for (const v of ['nationalChampionship', 'fipsed']) {
    await expect(radio(page, v)).toBeDisabled();
    // Playwright waits on a disabled control's label: force the click, it must change nothing.
    await group(page).locator('label').filter({ has: radio(page, v) }).click({ force: true });
    await expect(radio(page, v)).not.toBeChecked();
    await expect(options(page, v)).toHaveCount(0);
  }
  await shots(page, 'nou-nimic-ales');
  await a11y(page);

  // c3: arrow keys move the single choice (native radios); the chosen card expands.
  await radio(page, 'quantity').focus();
  await page.keyboard.press('Space');
  await expect(radio(page, 'quantity')).toBeChecked();
  await expect(options(page, 'quantity')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(radio(page, 'quality')).toBeChecked();
  await expect(radio(page, 'quantity')).not.toBeChecked();
  await expect(options(page, 'quantity')).toHaveCount(0);
  await expect(options(page, 'quality')).toBeVisible();
  await expect(radio(page, 'quality')).toBeFocused();
  // From Feeder, ArrowDown skips the two disabled types and wraps to Cantitate.
  await radio(page, 'feederRounds').focus();
  await page.keyboard.press('Space');
  await expect(radio(page, 'feederRounds')).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(radio(page, 'quantity')).toBeChecked();
  await expect(page.getByText('Vezi explicația completă')).toHaveCount(1);

  // c12: the footer — «Următorul pas»; no save button outside edit mode (fish isEditCompetitionMode &&).
  await expect(page.getByTestId('wizard-next')).toHaveText('Următorul pas');
  await expect(page.getByTestId('wizard-save')).toHaveCount(0);
  await page.getByTestId('wizard-next').click();
  await expect(page).toHaveURL(/\/organizator\/concursuri\/nou\/lac-si-sectoare/);
  // A nameless new competition saves nothing (fish name ≥ 3 gate).
  expect(organizer.writes).toEqual([]);
});

test('organizer.step-ranking.c3 c4 — every selectable type: its options, and the auto-saved patch', async ({ page, organizer }) => {
  await mockPut(organizer, 'fx-rk');
  await openDraft(page, 'fx-rk', { bestOfFishCount: 5, numberOfWinners: 2, bestOfTierSizes: [9, 7], gridRule: 'average' });

  const expectations: Record<string, { blocks: string[]; body: Record<string, unknown>; absent: string[] }> = {
    quantity: { blocks: ['Clasament general'], body: { rankingType: 'quantity', generalRankingWinnerMode: 'bySectorPosition' }, absent: ['gridRule', 'bestOfFishCount', 'numberOfWinners', 'bestOfTierSizes', 'roundsCount'] },
    quality: { blocks: ['Clasament general', 'Standuri fără grilă'], body: { rankingType: 'quality', generalRankingWinnerMode: 'bySectorPosition', gridRule: 'catchCount' }, absent: ['bestOfTierSizes', 'roundsCount'] },
    quantityQuality: { blocks: ['Clasament general', 'Standuri fără grilă'], body: { rankingType: 'quantityQuality', generalRankingWinnerMode: 'bySectorPosition', gridRule: 'catchCount' }, absent: [] },
    qualityQuantity: { blocks: ['Clasament general', 'Standuri fără grilă'], body: { rankingType: 'qualityQuantity', gridRule: 'catchCount' }, absent: [] },
    calitateCalitate: { blocks: [], body: { rankingType: 'calitateCalitate' }, absent: ['generalRankingWinnerMode', 'gridRule'] },
    calitateCantitateCMMC: { blocks: [], body: { rankingType: 'calitateCantitateCMMC' }, absent: ['generalRankingWinnerMode', 'gridRule'] },
    bestOf: { blocks: ['Parametri Best Of'], body: { rankingType: 'bestOf' }, absent: ['generalRankingWinnerMode', 'gridRule', 'roundsCount'] },
    bestOfTiers: { blocks: ['Praguri clasament'], body: { rankingType: 'bestOfTiers' }, absent: ['bestOfFishCount', 'numberOfWinners', 'roundsCount'] },
    feederRounds: { blocks: ['Număr de manșe'], body: { rankingType: 'feederRounds', roundsCount: '2' }, absent: ['bestOfTierSizes', 'generalRankingWinnerMode', 'gridRule'] },
  };
  for (const [value, e] of Object.entries(expectations)) {
    const n = organizer.writes.length;
    await pick(page, value);
    await expect(radio(page, value)).toBeChecked();
    const box = options(page, value);
    await expect(box).toBeVisible();
    await expect(box.getByRole('heading', { level: 3 })).toHaveText(e.blocks);
    await expect(box.getByRole('button', { name: 'Vezi explicația completă' })).toBeVisible();
    await expect(group(page).getByText('Vezi explicația completă')).toHaveCount(1);
    const body = await nextWrite(organizer, n);
    expect(organizer.writes.at(-1)).toMatchObject({ method: 'PUT', path: `${DRAFT_PATH}/fx-rk` });
    expect(body, value).toMatchObject({ name: 'Cupa clasament', ...e.body });
    for (const k of e.absent) expect(body[k], `${value}: ${k}`).toBeUndefined();
    if (value === 'quantity' || value === 'bestOf' || value === 'feederRounds' || value === 'bestOfTiers') await shots(page, `tip-${value}`);
  }
  // A feeder keeps legs it already has (fish: only empty → 2).
  await page.locator('[data-testid="clasament-manse"] label', { hasText: '3 manșe' }).click();
  await expect.poll(async () => (await values(page)).roundsCount).toBe('3');
  await pick(page, 'quantity');
  await expect.poll(async () => (await values(page)).roundsCount).toBeUndefined();
  await pick(page, 'feederRounds');
  await expect(page.locator('[data-testid="clasament-manse"] input:checked')).toHaveValue('2');
  await a11y(page);
});

test('organizer.step-ranking.c5 c6 c11 — general mode: trigger label, picker group, choice only on «Confirmă», explanation param', async ({ page, organizer }) => {
  await mockPut(organizer, 'fx-mod');
  await openDraft(page, 'fx-mod', { rankingType: 'quantity', generalRankingWinnerMode: 'bySectorPosition' });
  await expect(radio(page, 'quantity')).toBeChecked();

  // c5: the trigger under «Clasament general».
  await expect(modeTrigger(page)).toHaveAccessibleName('Mod de departajare în clasamentul general După poziția în sector, primează Cantitatea');

  // c6: the picker.
  await modeTrigger(page).click();
  const dlg = modeDialog(page);
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Cum funcționează departajarea');
  await expect(dlg).toContainText(getGeneralRankingHelpText('quantity'));
  const sector = dlg.getByRole('button', { name: /După poziția în sector/ });
  await expect(sector).toHaveAttribute('aria-expanded', 'true');
  const sectorGroup = dlg.getByRole('radiogroup', { name: 'După poziția în sector' });
  await expect(sectorGroup.getByRole('radio')).toHaveCount(1);
  await expect(sectorGroup.getByRole('radio', { name: /Primează cantitatea pe sector, cantitatea la general/ })).toBeChecked();
  const byPoints = dlg.getByRole('radio', { name: /^După punctaj/ });
  await expect(byPoints).not.toBeChecked();
  await shots(page, 'mod-general-dialog', false);
  await a11y(page);

  // Collapse / expand the sector group.
  await sector.click();
  await expect(sector).toHaveAttribute('aria-expanded', 'false');
  await expect(sectorGroup).toBeHidden();
  await sector.click();
  await expect(sectorGroup.getByRole('radio')).toHaveCount(1);

  // A choice without «Confirmă» is dropped.
  await dlg.locator('label', { hasText: 'După punctaj' }).click();
  await expect(byPoints).toBeChecked();
  await dlg.getByRole('button', { name: 'Închide' }).click();
  await expect(dlg).toBeHidden();
  await expect(modeTrigger(page)).toContainText('După poziția în sector, primează Cantitatea');
  await page.waitForTimeout(800);
  expect(organizer.writes).toEqual([]);

  // Confirmed: applied + auto-saved.
  await modeTrigger(page).click();
  await expect(modeDialog(page).getByRole('radio', { name: /^După punctaj/ })).not.toBeChecked();
  await modeDialog(page).locator('label', { hasText: 'După punctaj' }).click();
  await page.getByTestId('mod-general-confirma').click();
  await expect(modeDialog(page)).toBeHidden();
  await expect(modeTrigger(page)).toContainText('După punctaj');
  expect(await nextWrite(organizer, 0)).toMatchObject({ rankingType: 'quantity', generalRankingWinnerMode: 'byPoints' });

  // c6: Cantitate/Calitate offers the reversed row (🐟 = quality decides at the general).
  await pick(page, 'quantityQuality');
  await expect(modeTrigger(page)).toContainText('După punctaj');
  await modeTrigger(page).click();
  await expect(modeDialog(page)).toContainText(getGeneralRankingHelpText('quantityQuality'));
  const sec2 = modeDialog(page).getByRole('button', { name: /După poziția în sector/ });
  await expect(sec2).toHaveAttribute('aria-expanded', 'false');
  await sec2.click();
  const rows = modeDialog(page).getByRole('radiogroup', { name: 'După poziția în sector' }).getByRole('radio');
  await expect(rows).toHaveCount(2);
  await expect(modeDialog(page).getByRole('radiogroup', { name: 'După poziția în sector' }).locator('label')).toHaveText([
    /⚖️Primează cantitatea pe sector, cantitatea la general/,
    /🐟Primează cantitatea pe sector, calitatea la general/,
  ]);
  await modeDialog(page).locator('label', { hasText: 'calitatea la general' }).click();
  await shots(page, 'mod-general-inversat', false);
  const n = organizer.writes.length;
  await page.getByTestId('mod-general-confirma').click();
  await expect(modeTrigger(page)).toContainText('După poziția în sector, primează Calitatea');
  expect(await nextWrite(organizer, n)).toMatchObject({ rankingType: 'quantityQuality', generalRankingWinnerMode: 'bySectorPositionPerisReversed' });

  // Calitate does not support the reversed mode → back to the default (normalized, c4).
  const m = organizer.writes.length;
  await pick(page, 'quality');
  await expect(modeTrigger(page)).toContainText('După poziția în sector, primează Calitatea');
  expect(await nextWrite(organizer, m)).toMatchObject({ rankingType: 'quality', generalRankingWinnerMode: 'bySectorPosition', gridRule: 'catchCount' });

  // c11: «Vezi explicația completă» in the picker → ?explicatie=<general mode of quality>; closing it returns to the picker.
  await modeTrigger(page).click();
  await modeDialog(page).getByRole('button', { name: 'Vezi explicația completă' }).click();
  await expect.poll(explicatie(page)).toBe(explanationParam({ kind: 'generalMode', rankingType: 'quality' }));
  await page.keyboard.press('Escape');
  await expect.poll(explicatie(page)).toBeNull();
  await expect(modeDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modeDialog(page)).toBeHidden();

  // c11: the card's link → ?explicatie=<quality>.
  await options(page, 'quality').getByRole('button', { name: 'Vezi explicația completă' }).click();
  await expect.poll(explicatie(page)).toBe(explanationParam({ kind: 'ranking', rankingType: 'quality' }));
  await page.keyboard.press('Escape');
  await expect.poll(explicatie(page)).toBeNull();
});

test('organizer.step-ranking.c7 c11 — grid rule: default, help, «Confirmă», explanation param (phone sheet)', async ({ page, organizer }) => {
  await mockPut(organizer, 'fx-grila');
  await openDraft(page, 'fx-grila', { rankingType: 'qualityQuantity', generalRankingWinnerMode: 'bySectorPosition' }, PHONE);
  // Hydrated without a rule → the default (fish normalizeGridRule), not saved on its own.
  await expect(gridTrigger(page)).toHaveAccessibleName('Regula departajare standuri fără grilă După numărul de capturi');
  await expect(modeTrigger(page)).toContainText('După poziția în sector, primează Calitatea');
  await shots(page, 'calitate-cantitate');

  await gridTrigger(page).click();
  const dlg = gridDialog(page);
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Cum funcționează departajarea');
  await expect(dlg).toContainText(GRID_RULE_TIEBREAK_HELP);
  await expect(dlg.getByRole('radio', { name: /^După numărul de capturi/ })).toBeChecked();
  await expect(dlg.getByRole('radio', { name: /^După media greutății/ })).not.toBeChecked();
  await expect(dlg).toContainText('Mai mulți pești = loc mai bun la departajare.');
  await expect(dlg).toContainText('Media mai mare = loc mai bun la departajare.');
  await dlg.locator('label', { hasText: 'După media greutății' }).click();
  await shots(page, 'regula-grila-dialog', false);
  await a11y(page);

  await dlg.getByRole('button', { name: 'Vezi explicația completă' }).click();
  await expect.poll(explicatie(page)).toBe(explanationParam({ kind: 'gridRule' }));
  await page.keyboard.press('Escape');
  await expect.poll(explicatie(page)).toBeNull();

  await page.getByTestId('regula-grila-confirma').click();
  await expect(dlg).toBeHidden();
  await expect(gridTrigger(page)).toContainText('După media greutății');
  expect(await nextWrite(organizer, 0)).toMatchObject({ rankingType: 'qualityQuantity', gridRule: 'average' });
});

test('organizer.step-ranking.c8 — tiers: digits and commas only, each message on blur, a valid value saved at once', async ({ page, organizer }) => {
  await mockPut(organizer, 'fx-praguri');
  await openDraft(page, 'fx-praguri', { rankingType: 'bestOfTiers' });
  const input = tiers(page);
  await expect(input).toHaveAttribute('placeholder', '9,7,5,3');
  await input.fill('9a,7; 5');
  await expect(input).toHaveValue('9,75');

  const cases: [string, string][] = [
    ['0,1', 'Pragurile trebuie să fie numere întregi pozitive (ex: 9,7,5,3).'],
    [',,', 'Adaugă cel puțin un prag.'],
    [Array.from({ length: 21 }, (_, i) => 21 - i).join(','), 'Sunt permise cel mult 20 de praguri.'],
    ['5,7', 'Pragurile trebuie să fie ordonate descrescător și distincte.'],
    ['7,7', 'Pragurile trebuie să fie ordonate descrescător și distincte.'],
  ];
  for (const [text, message] of cases) {
    await input.fill(text);
    await input.blur();
    await expect(tiersError(page)).toHaveText(message);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    if (text === '5,7') await shots(page, 'praguri-eroare');
  }
  await a11y(page);
  // Typing clears the message; an invalid value never reaches a save.
  await input.fill('9');
  await expect(tiersError(page)).toHaveCount(0);
  await expect(tiers(page)).not.toHaveAttribute('aria-invalid', 'true');
  expect(organizer.writes).toEqual([]);

  await input.fill('9,7,5,3');
  await input.blur();
  expect(await nextWrite(organizer, 0)).toMatchObject({ rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7, 5, 3] });
  await expect(tiersError(page)).toHaveCount(0);
});

test('organizer.step-ranking.c9 — feeder legs: 2 by default, 1 / 2 / 3 exclusive, auto-saved', async ({ page, organizer }) => {
  await mockPut(organizer, 'fx-feeder');
  await openDraft(page, 'fx-feeder', { rankingType: 'feederRounds', roundsCount: null }, PHONE);
  const legs = page.getByRole('radiogroup', { name: 'Număr de manșe' });
  await expect(legs.getByRole('radio')).toHaveCount(3);
  await expect(legs.locator('label')).toHaveText(['1 manșă', '2 manșe', '3 manșe']);
  await expect(legs.getByRole('radio', { name: '2 manșe' })).toBeChecked();

  await legs.locator('label', { hasText: '3 manșe' }).click();
  await expect(legs.getByRole('radio', { name: '3 manșe' })).toBeChecked();
  await expect(legs.getByRole('radio', { name: '2 manșe' })).not.toBeChecked();
  expect(await nextWrite(organizer, 0)).toMatchObject({ rankingType: 'feederRounds', roundsCount: '3' });

  await legs.getByRole('radio', { name: '3 manșe' }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(legs.getByRole('radio', { name: '1 manșă' })).toBeChecked();
  await expect.poll(() => data(organizer.writes.at(-1)!).roundsCount, { timeout: 10_000 }).toBe('1');
  await shots(page, 'feeder-1-mansa');
  await a11y(page);
});

test('organizer.step-ranking.c10 — best of: 1–100 and ≥ 1 messages, digits only, saved on blur, cleared by another type', async ({ page, organizer }) => {
  await mockPut(organizer, 'fx-bestof');
  await openDraft(page, 'fx-bestof', { rankingType: 'bestOf' });
  const fish = page.getByLabel('Număr de pești pentru clasament');
  const winners = page.getByLabel('Număr de câștigători');
  await expect(fish).toHaveAttribute('inputmode', 'numeric');

  const fishError = page.getByText('Numărul de pești trebuie să fie între 1 și 100.');
  const winnersError = page.getByText('Numărul de câștigători trebuie să fie cel puțin 1.');
  await fish.fill('0');
  await expect(fishError).toBeVisible();
  await fish.fill('101');
  await expect(fishError).toBeVisible();
  await winners.fill('0');
  await expect(winnersError).toBeVisible();
  await expect(winners).toHaveAttribute('aria-invalid', 'true');
  await shots(page, 'best-of-erori');
  await a11y(page);

  // (Leaving a field saves at once, like fish's onBlur → autoSaveDraft, even with an error shown.)
  await fish.fill('1a5');
  await expect(fish).toHaveValue('15');
  await expect(fishError).toHaveCount(0);
  const before = organizer.writes.length;
  await fish.blur();
  expect(await nextWrite(organizer, before)).toMatchObject({ bestOfFishCount: '15' });
  await winners.fill('3');
  await expect(winnersError).toHaveCount(0);
  await winners.blur();
  expect(await nextWrite(organizer, before + 1)).toMatchObject({ rankingType: 'bestOf', bestOfFishCount: '15', numberOfWinners: '3' });

  // Another type clears them (c4).
  const n = organizer.writes.length;
  await pick(page, 'calitateCalitate');
  const body = await nextWrite(organizer, n);
  expect(body.bestOfFishCount).toBeUndefined();
  expect(body.numberOfWinners).toBeUndefined();
  expect((await values(page)).bestOfFishCount).toBe('');
});

test('organizer.step-ranking.c2 — a draft carrying a disabled type is cleared, without a save', async ({ page, organizer }) => {
  await openDraft(page, 'fx-nat', { rankingType: 'nationalChampionship' });
  await expect.poll(async () => (await values(page)).rankingType).toBeUndefined();
  for (const r of await group(page).getByRole('radio').all()) await expect(r).not.toBeChecked();
  await page.waitForTimeout(800);
  expect(organizer.writes).toEqual([]);
});

test('organizer.step-ranking — a saved draft hydrates its type and options', async ({ page, organizer }) => {
  await openDraft(page, 'fx-hyd', { rankingType: 'quality', generalRankingWinnerMode: 'byPoints', gridRule: 'average' });
  await expect(radio(page, 'quality')).toBeChecked();
  await expect(modeTrigger(page)).toContainText('După punctaj');
  await expect(gridTrigger(page)).toContainText('După media greutății');
  // c12: a saved draft has no save button on this step either.
  await expect(page.getByTestId('wizard-save')).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(organizer.writes).toEqual([]);
  await shots(page, 'calitate-ciorna');
});

test('organizer.step-ranking.c3 c4 — arrowing past a type and back keeps its tiers / legs (no PUT drops them)', async ({ page, organizer }) => {
  await mockPut(organizer, 'fx-kb');
  await openDraft(page, 'fx-kb', { rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7, 5, 3] });
  await expect(tiers(page)).toHaveValue('9,7,5,3');
  await radio(page, 'bestOfTiers').focus();

  // ArrowDown reads the next card (Feeder): the type really changes and is saved, as fish's tap.
  let n = organizer.writes.length;
  await page.keyboard.press('ArrowDown');
  await expect(radio(page, 'feederRounds')).toBeChecked();
  let body = await nextWrite(organizer, n);
  expect(body).toMatchObject({ rankingType: 'feederRounds', roundsCount: '2' });
  // Feeder with 3 legs, so the way back has something to keep too.
  await page.locator('[data-testid="clasament-manse"] label', { hasText: '3 manșe' }).click();
  await expect.poll(() => data(organizer.writes.at(-1)!).roundsCount, { timeout: 10_000 }).toBe('3');

  // ArrowUp back: the tiers come back and the save carries them.
  await radio(page, 'feederRounds').focus();
  n = organizer.writes.length;
  await page.keyboard.press('ArrowUp');
  await expect(radio(page, 'bestOfTiers')).toBeChecked();
  await expect(tiers(page)).toHaveValue('9,7,5,3');
  body = await nextWrite(organizer, n);
  expect(body).toMatchObject({ rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7, 5, 3] });
  expect((await values(page)).bestOfTierSizes).toEqual([9, 7, 5, 3]);

  // And down again: Feeder gets its 3 legs back (not fish's default 2).
  n = organizer.writes.length;
  await page.keyboard.press('ArrowDown');
  await expect(radio(page, 'feederRounds')).toBeChecked();
  body = await nextWrite(organizer, n);
  expect(body).toMatchObject({ rankingType: 'feederRounds', roundsCount: '3' });
});

/* ── edit mode (a published, not-started competition; the frame's route) ── */

let base: CompetitionDetail | null = null;
test.beforeAll(async () => {
  base = await getCompetition(createTestTransport(), TEMPLATE).catch(() => null);
});

/** A published, not-started competition (the local template with `over`), served by mocks. */
async function mockEdit(page: Page, id: string, over: Record<string, unknown>) {
  const future = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const c = {
    ...(base as CompetitionDetail),
    documentId: id,
    name: 'Cupa editare clasament',
    competitionStatus: 'notStarted',
    startDate: future(10),
    endDate: future(11),
    registrationDeadline: future(10),
    ...over,
  } as CompetitionDetail;
  const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
  await page.route(at(`/feed/competitions/${id}`), (route) => (route.request().method() === 'GET' ? json(route, { data: c }) : route.fallback()));
  await page.route(at(`/feed/competitions/${id}/my-status`), (route) => json(route, { data: { isFollowing: false, userRegistrationStatus: null } }));
  await page.route(at(`/user/profile/competition/${id}/statute`), (route) => json(route, { userRole: 'author' }));
}

test('organizer.step-ranking.c12 — edit mode: the type from the competition, the save button, no auto-save', async ({ page, organizer }) => {
  test.skip(!base, 'no local competition to base the edit fixture on');
  const id = 'fx-rk-e';
  await mockEdit(page, id, { rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7, 5] });

  await open(page, `/concursuri/${id}/editeaza/clasament`);
  await expect(radio(page, 'bestOfTiers')).toBeChecked();
  await expect(tiers(page)).toHaveValue('9,7,5');
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează modificările');
  await tiers(page).fill('9,7,5,3');
  await tiers(page).blur();
  await pick(page, 'feederRounds');
  await page.waitForTimeout(1200);
  // Edit mode never auto-saves (fish shouldAttemptAutoSave): the change waits for «Salvează modificările».
  expect(organizer.writes).toEqual([]);
  await shots(page, 'editare');
});

test('organizer.step-ranking.c4 — the normalised mode / grid rule of a loaded competition is not an edit: Back leaves without asking', async ({ page, organizer }) => {
  test.skip(!base, 'no local competition to base the edit fixture on');
  const id = 'fx-rk-n';
  // An older competition: quality with neither a general mode nor a grid rule (gridRule has no CMS default).
  await mockEdit(page, id, { rankingType: 'quality', generalRankingWinnerMode: null, gridRule: null });

  await open(page, `/concursuri/${id}/editeaza/clasament`);
  await expect(radio(page, 'quality')).toBeChecked();
  // fish's normalising effects ran (the values fit the type) …
  await expect.poll(async () => (await values(page)).gridRule).toBe('catchCount');
  expect((await values(page)).generalRankingWinnerMode).toBe('bySectorPosition');
  // … without making the form dirty: back through the steps and out, no «Salvezi progresul…».
  const leave = page.getByRole('dialog', { name: 'Salvezi progresul înainte de a ieși?' });
  await page.getByRole('button', { name: 'Pasul anterior' }).click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'configurare');
  await page.getByRole('button', { name: 'Pasul anterior' }).click();
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'detalii');
  await page.getByRole('button', { name: 'Ieși din asistent' }).click();
  await page.waitForURL((u) => u.pathname === `/concursuri/${id}`, { timeout: 60_000 });
  await expect(leave).toHaveCount(0);
  expect(organizer.writes).toEqual([]);
});
