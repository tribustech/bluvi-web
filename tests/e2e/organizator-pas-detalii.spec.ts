import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { BASE_URL as BASE } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { draftFixture, expect, mockRead, S3_IMAGE, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.step-basics (c1–c11) — step «Detalii de bază» of the create / edit competition wizard
 * (/organizator/concursuri/nou/detalii, /concursuri/[id]/editeaza/detalii; fish
 * app/(app)/create-competition/step-basics.tsx).
 *
 * NO REAL WRITES (the local CMS sends real pushes / e-mails): every draft create / update, every
 * upload is route-mocked through the harness (helpers/fake-organizer guardCmsWrites — any other
 * write is aborted and fails the test) and each test asserts method, path and body. Reads: the
 * drafts are fixtures; the edited competition is a real local one under a fixture id.
 */

test.describe.configure({ timeout: 180_000 });
// Dates are picked and shown in the browser's local time (fish: the device's).
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };
const WIDE = { width: 1440, height: 900 };
const HUGE = { width: 1920, height: 1080 };
const WIDTHS = [PHONE, LAPTOP, WIDE, HUGE];
const SHOTS = '.shots/organizator-pas-detalii';
mkdirSync(SHOTS, { recursive: true });

const NEW = (q = '') => `/organizator/concursuri/nou/detalii${q}`;
const DRAFT_PATH = '/competitions/organizer/draft';
const TEMPLATE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (40\d|50\d)/, /ERR_|net::/];

test.beforeEach(async ({ context, request }) => {
  await signInOrganizer(context, request);
});

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────── */

type Values = Record<string, unknown>;

async function open(page: Page, path: string, viewport = LAPTOP) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('step-detalii')).toBeVisible({ timeout: 90_000 });
  // Hydrated: the provider's dev seam is set in an effect (the fields' handlers are live).
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
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
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string, fullPage = true) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`, fullPage });
}

async function a11y(page: Page) {
  await settle(page);
  await scan(page);
}

const draftBody = (over: Values = {}) => ({ data: draftFixture({ documentId: 'fx-new', id: 501, name: 'Cupa e2e', lake: null, ...over }) });
const bodyData = (w: { body: unknown }): Values => ((w.body as { data?: Values } | undefined)?.data ?? {}) as Values;

const nameInput = (page: Page) => page.getByLabel('Numele competiției *');
const feeInput = (page: Page) => page.getByLabel('Taxă de înscriere (RON)');
const section = (page: Page, name: string) => page.getByRole('region', { name });
const picker = (page: Page, name: string) => page.getByRole('dialog', { name });

/** A decodable 800 × 600 PNG drawn in the page. */
async function photoBuffer(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, 'hsl(200 70% 55%)');
    grad.addColorStop(1, 'hsl(160 60% 30%)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 800, 600);
    return c.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(b64, 'base64');
}

/** Strapi blocks: paragraphs and an unordered list. */
const para = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] });
const list = (items: string[]) => ({ type: 'list', format: 'unordered', children: items.map((t) => ({ type: 'list-item', children: [{ type: 'text', text: t }] })) });

const LONG_REWARD = [
  para('Premiile se acordă la festivitatea de premiere de duminică, după cântărirea finală a tuturor sectoarelor.'),
  list(['Locul 1: 3.000 RON și trofeu', 'Locul 2: 1.500 RON', 'Locul 3: 750 RON', 'Cea mai mare captură: lansetă']),
];

/** A saved draft with every field of the step (hydrated state). */
function fullDraft(id: string, over: Values = {}) {
  return draftBody({
    documentId: id,
    id: 640,
    name: 'Cupa Toamnei 2026',
    description: [para('Concurs de crap pe Chita Lake, 48 de ore, 3 sectoare.')],
    reward: LONG_REWARD,
    regulation: null,
    startDate: '2026-11-14T05:00:00.000Z',
    endDate: '2026-11-15T12:00:00.000Z',
    registrationDeadline: '2026-11-14T05:00:00.000Z',
    registerFee: 150,
    banner: S3_IMAGE,
    ...over,
  });
}

/* ============================================================================================== */
/* c1 c4 c7 c10 c11 — the empty form                                                              */
/* ============================================================================================== */

test('organizer.step-basics.c1 c4 c7 c10 c11 — the empty new form: three cards, fish copy, nothing filled', async ({ page, organizer }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await open(page, NEW());

  // c1 — Identitate competiție.
  const identity = section(page, 'Identitate competiție');
  await expect(identity).toContainText('Configurează numele și imaginea principală afișată în listă.');
  await expect(nameInput(page)).toHaveAttribute('placeholder', 'ex. Cupa Primăverii 2026');
  await expect(nameInput(page)).toHaveValue('');
  await expect(nameInput(page)).toHaveAccessibleDescription('Alege un nume scurt și ușor de reținut.');
  await expect(nameInput(page)).toHaveAttribute('id', 'concurs-nume');
  // c3 — Banner, none yet.
  await expect(page.getByRole('group', { name: 'Banner' })).toHaveAccessibleDescription('Imaginea principală afișată pe pagina competiției.');
  await expect(page.getByRole('button', { name: 'Alege o fotografie' })).toBeVisible();
  await expect(page.getByTestId('banner-thumbnail')).toHaveAttribute('data-empty', 'true');

  // c4 — Conținut competiție: three cards, «Adaugă conținut» each.
  const content = section(page, 'Conținut competiție');
  await expect(content).toContainText('Pregătește informațiile afișate participanților înainte de înscriere.');
  const cards = [
    ['descriere', 'Descriere *', 'Prezintă competiția pe scurt — locație, format, condiții.'],
    ['premii', 'Premii', 'Descrie premiile oferite câștigătorilor.'],
    ['regulament', 'Regulament', 'Regulile oficiale ale competiției.'],
  ] as const;
  for (const [field, label, helper] of cards) {
    const card = page.getByTestId(`rich-text-${field}`);
    await expect(card).toContainText(label);
    await expect(card).toContainText(helper);
    await expect(page.getByTestId(`rich-text-${field}-preview`)).toHaveText('Adaugă conținut');
    await expect(card).toHaveAttribute('data-state', 'empty');
    await expect(card.getByRole('button', { name: /^Editează/ })).toBeVisible();
    await expect(card.getByRole('button', { name: `${label}: adaugă conținut`, exact: true })).toHaveAccessibleDescription(helper);
  }

  // c7 — Calendar și taxă.
  const calendar = section(page, 'Calendar și taxă');
  await expect(calendar).toContainText('Stabilește perioada desfășurării și taxa de înscriere.');
  await expect(page.getByRole('group', { name: 'Datele competiției *' })).toHaveAccessibleDescription('Setează perioada competiției.');
  await expect(page.getByTestId('date-start')).toContainText('Data începerii');
  await expect(page.getByTestId('date-start-value')).toHaveText('Selectează data');
  await expect(page.getByTestId('date-end')).toContainText('Data încheierii');
  await expect(page.getByTestId('date-end-value')).toHaveText('Selectează data');
  // c10 — the fee: copy, placeholder, the spaced «RON» unit.
  await expect(feeInput(page)).toHaveAttribute('placeholder', 'ex. 150');
  await expect(feeInput(page)).toHaveAccessibleDescription('Suma percepută fiecărui participant la înscriere. Lasă gol sau 0 pentru competiție gratuită.');
  await expect(calendar.getByText('RON', { exact: true })).toBeVisible();

  // c11 — the footer: «Următorul pas» and the wizard's save label (new: «Salvează și ieși»).
  await expect(page.getByTestId('wizard-next')).toHaveText('Următorul pas');
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează și ieși');

  await a11y(page);
  for (const vp of WIDTHS) {
    await page.setViewportSize(vp);
    await shot(page, 'empty');
  }
  expect(organizer.writes).toEqual([]);
  expect(errors).toEqual([]);
});

/* ============================================================================================== */
/* c2 — the name                                                                                  */
/* ============================================================================================== */

test('organizer.step-basics.c2 — under 3 characters: the error once left (no save); a valid name auto-saves on blur', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { json: draftBody({ name: 'Cupa Primăverii e2e' }) });
  await open(page, NEW(), PHONE);

  await nameInput(page).fill('Cu');
  // Not yet left: no error (fish shows it once validated).
  await expect(page.getByText('Numele trebuie să aibă cel puțin 3 caractere')).toHaveCount(0);
  await nameInput(page).press('Tab');
  await expect(page.getByRole('alert').filter({ hasText: 'Numele trebuie să aibă cel puțin 3 caractere' })).toBeVisible();
  await expect(nameInput(page)).toHaveAttribute('aria-invalid', 'true');
  await shot(page, 'name-error', false);
  // A name under 3 characters is never saved (fish shouldAttemptAutoSave).
  await page.waitForTimeout(800);
  expect(organizer.writes).toEqual([]);
  await a11y(page);

  // A valid name clears the error as it is typed, and leaving the field saves (POST, the first save).
  await nameInput(page).fill('Cupa Primăverii e2e');
  await expect(page.getByText('Numele trebuie să aibă cel puțin 3 caractere')).toHaveCount(0);
  await nameInput(page).blur();
  await expect.poll(() => organizer.writes.length).toBe(1);
  expect(organizer.writes[0]).toMatchObject({ method: 'POST', path: DRAFT_PATH });
  expect(bodyData(organizer.writes[0])).toMatchObject({ name: 'Cupa Primăverii e2e', competitionType: 'single' });
  await expect(page.getByTestId('wizard-autosave')).toHaveAttribute('data-state', 'saved');
  // The draft is remembered in the URL; the save label follows (draft).
  await expect(page).toHaveURL(/\?ciorna=fx-new/);
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează modificările');
});

/* ============================================================================================== */
/* c10 — the fee                                                                                  */
/* ============================================================================================== */

test('organizer.step-basics.c10 — the fee validates as typed (0–50.000), digits only, blur auto-saves', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { json: draftBody({ name: 'Cupa taxă' }) });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-new`, { json: draftBody({ name: 'Cupa taxă' }) });
  await open(page, NEW(), PHONE);

  await nameInput(page).fill('Cupa taxă');
  await nameInput(page).press('Tab');
  await expect.poll(() => organizer.writes.length).toBe(1);
  // The first save settled (else an edit typed meanwhile gets the wizard's follow-up save).
  await expect(page.getByTestId('wizard-autosave')).toHaveAttribute('data-state', 'saved');

  // Live: the error shows while typing, before the field is left.
  await feeInput(page).fill('60000');
  const feeError = page.getByRole('alert').filter({ hasText: 'Taxa de înscriere trebuie să fie între 0 și 50.000 RON.' });
  await expect(feeError).toBeVisible();
  await expect(feeInput(page)).toBeFocused();
  await expect(feeInput(page)).toHaveAttribute('aria-invalid', 'true');
  await feeError.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot(page, 'fee-error', false);
  await a11y(page);
  await feeInput(page).fill('50000');
  await expect(feeError).toHaveCount(0);

  // fish number-pad: a sign, a comma or letters never reach the form.
  await feeInput(page).fill('');
  await feeInput(page).pressSequentially('-1,5o0');
  await expect(feeInput(page)).toHaveValue('150');
  await feeInput(page).blur();
  await expect.poll(() => organizer.writes.length).toBe(2);
  expect(organizer.writes[1]).toMatchObject({ method: 'PUT', path: `${DRAFT_PATH}/fx-new` });
  expect(bodyData(organizer.writes[1])).toMatchObject({ name: 'Cupa taxă', registerFee: '150' });

  // From 1280 the summary says it, with the spaced unit.
  await page.setViewportSize(LAPTOP);
  await expect(page.getByRole('region', { name: 'Rezumat' })).toContainText('150 RON');
  // 0 is free: valid, no error.
  await feeInput(page).fill('0');
  await expect(feeError).toHaveCount(0);
});

/* ============================================================================================== */
/* c3 — the banner                                                                                */
/* ============================================================================================== */

test('organizer.step-basics.c3 — a picked photo is cropped, previewed as a thumbnail and auto-saved (draft PUT + banner upload)', async ({ page, organizer }) => {
  await mockRead(page, `${DRAFT_PATH}/fx-ban`, { json: draftBody({ documentId: 'fx-ban', id: 702, name: 'Cupa banner' }) });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-ban`, { json: draftBody({ documentId: 'fx-ban', id: 702, name: 'Cupa banner' }) });
  await organizer.mockWrite('POST', '/upload', { json: [{ ...S3_IMAGE, id: 9101 }] });
  await open(page, NEW('?ciorna=fx-ban'), PHONE);
  await expect(page.getByTestId('banner-thumbnail')).toHaveAttribute('data-empty', 'true');
  await shot(page, 'no-banner', false);

  await page.getByTestId('banner-input').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: await photoBuffer(page) });
  const crop = page.getByTestId('chat-photo-crop');
  await expect(crop).toBeVisible();
  await expect(crop.getByTestId('chat-photo-crop-measuring')).toHaveCount(0, { timeout: 15_000 });
  await crop.getByRole('button', { name: 'Salvează' }).click();
  await expect(crop).toBeHidden();

  const thumb = page.getByTestId('banner-thumbnail').getByRole('img', { name: 'Bannerul ales' });
  await expect(thumb).toBeVisible();
  await expect(thumb).toHaveAttribute('src', /^blob:/);
  // The cropped photo is a decoded image (4:3 by default).
  const ratio = await thumb.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth / img.naturalHeight : 0));
  expect(ratio).toBeCloseTo(4 / 3, 1);

  // Debounced auto-save: the draft, then the banner attached to it.
  await expect.poll(() => organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`PUT ${DRAFT_PATH}/fx-ban`, 'POST /upload']);
  const upload = String(organizer.writes[1].body);
  expect(upload).toMatch(/name="ref"\s+api::competition\.competition/);
  expect(upload).toMatch(/name="refId"\s+702/);
  expect(upload).toMatch(/name="field"\s+banner/);
  expect(upload).toContain('image/jpeg');
  await shot(page, 'banner', false);
  await a11y(page);
});

/* ============================================================================================== */
/* c5 c6 — rich text previews; hydrated draft                                                    */
/* ============================================================================================== */

test('organizer.step-basics.c5 c6 — previews (short / long with bullets and «Vezi mai mult» / empty); card and «Editează» open the editor', async ({ page, organizer }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await mockRead(page, `${DRAFT_PATH}/fx-rt`, { json: fullDraft('fx-rt') });
  await open(page, NEW('?ciorna=fx-rt'), PHONE);

  // Hydrated draft: every field of the step holds the saved value.
  await expect(nameInput(page)).toHaveValue('Cupa Toamnei 2026');
  await expect(page.getByTestId('banner-thumbnail').getByRole('img')).toHaveAttribute('src', S3_IMAGE.url);
  await expect(page.getByTestId('date-start-value')).toHaveText('14 noi 2026, 07:00');
  await expect(page.getByTestId('date-end-value')).toHaveText('15 noi 2026, 14:00');
  await expect(feeInput(page)).toHaveValue('150');

  // c5 — short: the text, no «Vezi mai mult».
  const desc = page.getByTestId('rich-text-descriere');
  await expect(desc).toHaveAttribute('data-state', 'short');
  await expect(page.getByTestId('rich-text-descriere-preview')).toHaveText('Concurs de crap pe Chita Lake, 48 de ore, 3 sectoare.');
  await expect(desc.getByText('Vezi mai mult')).toHaveCount(0);
  // long: bullets, clamped to 3 lines, «Vezi mai mult».
  const reward = page.getByTestId('rich-text-premii');
  await expect(reward).toHaveAttribute('data-state', 'long');
  const rewardPreview = page.getByTestId('rich-text-premii-preview');
  await expect(rewardPreview).toContainText('• Locul 1: 3.000 RON și trofeu');
  await expect(rewardPreview).toContainText('• Cea mai mare captură: lansetă');
  await expect(reward.getByText('Vezi mai mult')).toBeVisible();
  const lines = await rewardPreview.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  expect(lines).toBeLessThanOrEqual(3);
  // The preview card is named by the label and the state, never by the whole text (the clamp only
  // hides it from the eye); the description is the helper and an excerpt of ≤ 80 characters.
  const rewardCard = reward.getByRole('button', { name: 'Premii: editează conținutul', exact: true });
  await expect(rewardCard).toBeVisible();
  await expect(rewardCard).toHaveAccessibleDescription(/^Descrie premiile oferite câștigătorilor\. Premiile se acordă la festivitatea .*…$/);
  const described = await rewardCard.evaluate((el) =>
    (el.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' '),
  );
  expect(described).not.toContain('Locul 1');
  expect(described.length).toBeLessThan(140);
  // empty: «Adaugă conținut».
  await expect(page.getByTestId('rich-text-regulament')).toHaveAttribute('data-state', 'empty');
  await expect(page.getByTestId('rich-text-regulament-preview')).toHaveText('Adaugă conținut');
  await a11y(page);
  for (const vp of WIDTHS) {
    await page.setViewportSize(vp);
    await shot(page, 'hydrated');
  }

  // c6 — the card opens the editor for its field…
  await page.setViewportSize(PHONE);
  await reward.getByRole('button', { name: /^Premii/ }).click();
  await expect(page).toHaveURL(/[?&]editor=premii/);
  await expect(page.getByTestId('step-detalii')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Premii' })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('step-detalii')).toBeVisible();
  // …and so does «Editează».
  await page.getByTestId('rich-text-regulament').getByRole('button', { name: 'Editează regulament' }).click();
  await expect(page).toHaveURL(/[?&]editor=regulament/);
  await expect(page.getByRole('region', { name: 'Regulament' })).toBeVisible();
  await page.goBack();
  await page.getByTestId('rich-text-descriere').getByRole('button', { name: 'Editează descriere' }).click();
  await expect(page).toHaveURL(/[?&]editor=descriere/);
  await expect(page.getByRole('region', { name: 'Descriere' })).toBeVisible();
  expect(organizer.writes).toEqual([]);
  expect(errors).toEqual([]);
});

/* ============================================================================================== */
/* c7 c8 c9 — dates                                                                               */
/* ============================================================================================== */

test('organizer.step-basics.c7 c8 c9 — date then 24 h time; cancel keeps the value; start ≤ end both ways; confirm auto-saves', async ({ page, organizer }) => {
  await page.clock.setFixedTime(new Date('2026-10-08T10:00:00+03:00'));
  await organizer.mockWrite('POST', DRAFT_PATH, { json: draftBody({ name: 'Cupa date' }) });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-new`, { json: draftBody({ name: 'Cupa date' }) });
  await open(page, NEW(), PHONE);
  await nameInput(page).fill('Cupa date');
  await nameInput(page).press('Tab');
  await expect.poll(() => organizer.writes.length).toBe(1);
  await expect(page.getByTestId('wizard-autosave')).toHaveAttribute('data-state', 'saved');

  // c8 — «Data începerii»: the date step opens on today's month, today ringed.
  await page.getByTestId('date-start').click();
  const start = picker(page, 'Data începerii');
  await expect(start).toBeVisible();
  await expect(start.getByTestId('date-picker')).toHaveAttribute('data-step', 'date');
  await expect(start.getByTestId('date-picker-month')).toHaveText('Octombrie 2026');
  await expect(start.getByTestId('date-picker-draft')).toHaveText('8 oct 2026, 10:00');
  await shot(page, 'picker-date', false);
  await a11y(page);
  // The month arrows move the calendar.
  await start.getByRole('button', { name: 'Luna următoare' }).click();
  await expect(start.getByTestId('date-picker-month')).toHaveText('Noiembrie 2026');
  await start.getByRole('button', { name: 'Luna anterioară' }).click();
  // A day → the time step (24 h), the day kept.
  await start.locator('[data-day="2026-10-20"]').click();
  await expect(start.getByTestId('date-picker')).toHaveAttribute('data-step', 'time');
  await expect(start.getByRole('button', { name: 'ora 23' })).toBeVisible();
  await start.getByRole('button', { name: 'ora 07' }).click();
  await start.getByRole('button', { name: 'minutul 30' }).click();
  await expect(start.getByTestId('date-picker-draft')).toHaveText('20 oct 2026, 07:30');
  await shot(page, 'picker-time', false);
  await a11y(page);
  // A short phone (iPhone SE Safari, landscape): the dialog fits and scrolls, the actions stay
  // pinned and reachable.
  await page.setViewportSize({ width: 375, height: 600 });
  await settle(page);
  await expect(start.getByTestId('date-picker-confirm')).toBeInViewport({ ratio: 1 });
  await expect(start.getByRole('button', { name: 'Anulează' })).toBeInViewport({ ratio: 1 });
  const box = await start.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(600);
  await page.screenshot({ path: `${SHOTS}/picker-time-375x600.png` });
  await page.setViewportSize(PHONE);
  // The switch row goes back to the date and keeps the time.
  await start.getByTestId('date-picker-switch').click();
  await expect(start.getByTestId('date-picker')).toHaveAttribute('data-step', 'date');
  await expect(start.locator('[data-day="2026-10-20"]')).toHaveAttribute('aria-pressed', 'true');
  await start.getByRole('button', { name: 'Alege ora' }).click();
  await start.getByTestId('date-picker-confirm').click();
  await expect(start).toBeHidden();
  await expect(page.getByTestId('date-start-value')).toHaveText('20 oct 2026, 07:30');
  // Confirm schedules the auto-save: the start (and the registration deadline = start).
  await expect.poll(() => organizer.writes.length).toBe(2);
  expect(bodyData(organizer.writes[1])).toMatchObject({ startDate: '2026-10-20T04:30:00.000Z', registrationDeadline: '2026-10-20T04:30:00.000Z' });

  // c8 — «Anulează» leaves the value as it was (and Escape too). The empty end opens on the start.
  await page.getByTestId('date-end').click();
  const end = picker(page, 'Data încheierii');
  await expect(end.getByTestId('date-picker-draft')).toHaveText('20 oct 2026, 07:30');
  await expect(end.locator('[data-day="2026-10-19"]')).toBeDisabled();
  await expect(end.locator('[data-day="2026-10-20"]')).toBeEnabled();
  await end.locator('[data-day="2026-10-22"]').click();
  await end.getByRole('button', { name: 'Anulează' }).click();
  await expect(end).toBeHidden();
  await expect(page.getByTestId('date-end-value')).toHaveText('Selectează data');
  await page.getByTestId('date-end').click();
  await expect(end).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(end).toBeHidden();
  await expect(page.getByTestId('date-end-value')).toHaveText('Selectează data');

  // c9 — an end before the start (the start's own day, an earlier hour: the calendar refuses earlier
  // days) moves the start to the end.
  await page.getByTestId('date-end').click();
  await end.locator('[data-day="2026-10-20"]').click();
  await end.getByRole('button', { name: 'ora 06' }).click();
  await end.getByRole('button', { name: 'minutul 00' }).click();
  await end.getByTestId('date-picker-confirm').click();
  await expect(page.getByTestId('date-end-value')).toHaveText('20 oct 2026, 06:00');
  await expect(page.getByTestId('date-start-value')).toHaveText('20 oct 2026, 06:00');
  await expect.poll(() => organizer.writes.length).toBe(3);
  expect(bodyData(organizer.writes[2])).toMatchObject({ startDate: '2026-10-20T03:00:00.000Z', endDate: '2026-10-20T03:00:00.000Z' });

  // c9 — a start after the end (same day, later hour; later days are greyed out) moves the end to
  // the start (the picker opens on the field's date).
  await page.getByTestId('date-start').click();
  await expect(start.getByTestId('date-picker-draft')).toHaveText('20 oct 2026, 06:00');
  await expect(start.locator('[data-day="2026-10-21"]')).toBeDisabled();
  await start.locator('[data-day="2026-10-20"]').click();
  await start.getByRole('button', { name: 'ora 09' }).click();
  await start.getByTestId('date-picker-confirm').click();
  await expect(page.getByTestId('date-start-value')).toHaveText('20 oct 2026, 09:00');
  await expect(page.getByTestId('date-end-value')).toHaveText('20 oct 2026, 09:00');
  await expect.poll(() => organizer.writes.length).toBe(4);
  expect(bodyData(organizer.writes[3])).toMatchObject({ startDate: '2026-10-20T06:00:00.000Z', endDate: '2026-10-20T06:00:00.000Z' });
  await page.setViewportSize(LAPTOP);
  await shot(page, 'dates-set');
});

test('organizer.step-basics.c8 — an empty end opens on the start (earlier days greyed, still browsable); an empty start is capped by the end', async ({ page, organizer }) => {
  await page.clock.setFixedTime(new Date('2026-10-08T10:00:00+03:00'));
  await mockRead(page, `${DRAFT_PATH}/fx-bounds`, { json: fullDraft('fx-bounds', { endDate: null }) });
  await open(page, NEW('?ciorna=fx-bounds'), PHONE);
  await expect(page.getByTestId('date-start-value')).toHaveText('14 noi 2026, 07:00');
  await expect(page.getByTestId('date-end-value')).toHaveText('Selectează data');

  await page.getByTestId('date-end').click();
  const end = picker(page, 'Data încheierii');
  // On the start's month and day, not on today (October).
  await expect(end.getByTestId('date-picker-month')).toHaveText('Noiembrie 2026');
  await expect(end.getByTestId('date-picker-draft')).toHaveText('14 noi 2026, 07:00');
  await expect(end.locator('[data-day="2026-11-13"]')).toBeDisabled();
  await expect(end.locator('[data-day="2026-11-01"]')).toBeDisabled();
  await expect(end.locator('[data-day="2026-11-14"]')).toBeEnabled();
  await expect(end.locator('[data-day="2026-11-30"]')).toBeEnabled();
  // The earlier months stay reachable, every day greyed out.
  await end.getByRole('button', { name: 'Luna anterioară' }).click();
  await expect(end.getByTestId('date-picker-month')).toHaveText('Octombrie 2026');
  await expect(end.locator('[data-day="2026-10-31"]')).toBeDisabled();
  await expect(end.locator('[data-day="2026-10-08"]')).toBeDisabled();
  await shot(page, 'picker-bounds', false);
  await a11y(page);
  await end.getByRole('button', { name: 'Anulează' }).click();
  await expect(page.getByTestId('date-end-value')).toHaveText('Selectează data');

  // The mirror: an end and no start — the start opens on the end, later days greyed.
  await mockRead(page, `${DRAFT_PATH}/fx-bounds2`, { json: fullDraft('fx-bounds2', { startDate: null, registrationDeadline: null }) });
  await open(page, NEW('?ciorna=fx-bounds2'), PHONE);
  await page.getByTestId('date-start').click();
  const start = picker(page, 'Data începerii');
  await expect(start.getByTestId('date-picker-month')).toHaveText('Noiembrie 2026');
  await expect(start.getByTestId('date-picker-draft')).toHaveText('15 noi 2026, 14:00');
  await expect(start.locator('[data-day="2026-11-15"]')).toBeEnabled();
  await expect(start.locator('[data-day="2026-11-16"]')).toBeDisabled();
  await expect(start.locator('[data-day="2026-10-20"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(organizer.writes).toEqual([]);
});

/* ============================================================================================== */
/* c11 — the footer                                                                               */
/* ============================================================================================== */

test('organizer.step-basics.c11 — «Următorul pas» goes to configurare; the save button saves and leaves', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { json: draftBody({ name: 'Cupa footer' }) });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-new`, { json: draftBody({ name: 'Cupa footer' }) });
  await open(page, NEW(), PHONE);
  await page.getByTestId('wizard-next').click();
  await expect(page).toHaveURL(`${BASE}/organizator/concursuri/nou/configurare`);
  await page.goBack();
  await expect(page.getByTestId('step-detalii')).toBeVisible();

  await nameInput(page).fill('Cupa footer');
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează și ieși');
  await page.getByTestId('wizard-save').click();
  await page.waitForURL((u) => u.pathname === '/organizator', { timeout: 60_000 });
  // Leaving the name (the click) auto-saves first (POST), then «Salvează și ieși» writes the draft (PUT).
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST ${DRAFT_PATH}`, `PUT ${DRAFT_PATH}/fx-new`]);
  for (const w of organizer.writes) expect(bodyData(w)).toMatchObject({ name: 'Cupa footer' });
});

/* ============================================================================================== */
/* Edit route                                                                                     */
/* ============================================================================================== */

let base: CompetitionDetail | null = null;
test.beforeAll(async () => {
  base = await getCompetition(createTestTransport(), TEMPLATE).catch(() => null);
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

test('/concursuri/[id]/editeaza/detalii — the same step on a published competition; leaving a field saves nothing (edit saves on demand)', async ({ page, organizer }) => {
  test.skip(!base, `the local competition ${TEMPLATE} is not readable`);
  const id = 'fx-edit-detalii';
  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const competition = {
    ...(base as CompetitionDetail),
    documentId: id,
    name: 'Cupa editată',
    competitionStatus: 'notStarted',
    startDate: future(10),
    endDate: future(11),
    registrationDeadline: future(10),
    // A decimal: the CMS sends it as a string.
    registerFee: '200',
  } as CompetitionDetail;
  const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
  await page.route(at(`/feed/competitions/${id}`), (route) => (route.request().method() === 'GET' ? json(route, { data: competition }) : route.fallback()));
  await page.route(at(`/feed/competitions/${id}/my-status`), (route) => json(route, { data: { isFollowing: false, userRegistrationStatus: null } }));
  await page.route(at(`/user/profile/competition/${id}/statute`), (route) => json(route, { userRole: 'author' }));

  await open(page, `/concursuri/${id}/editeaza/detalii`, LAPTOP);
  await expect(nameInput(page)).toHaveValue('Cupa editată');
  await expect(feeInput(page)).toHaveValue('200');
  await expect(page.getByTestId('date-start-value')).not.toHaveText('Selectează data');
  await nameInput(page).fill('Cupa editată 2');
  await nameInput(page).press('Tab');
  await feeInput(page).fill('250');
  await feeInput(page).blur();
  await page.waitForTimeout(1200);
  expect(organizer.writes).toEqual([]);
  await expect(page.getByTestId('wizard-save')).toHaveText('Salvează modificările');
  await shot(page, 'edit');
});
