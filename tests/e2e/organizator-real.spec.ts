import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { ADMIN_TOKEN, chitaStands, CHITA, cmsCompetition, farDates, realName, sweepLeftovers, tracker, type ChitaStand } from './helpers/real-organizer';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * organizer.wizard + organizer.panel with REAL writes against the local CMS (safe since 2026-10-08:
 * no push tokens, Postmark test token). The mocked specs (organizator-*.spec.ts) keep every state
 * and edge; this one proves the writes themselves:
 *  - the wizard creates the draft (typing the name auto-saves it: POST draft), the next steps
 *    auto-save it (PUT draft), «Publică competiția» publishes it (PUT publish) — the CMS then holds
 *    a notStarted competition with its sector, stands and species;
 *  - «Modifică competiția» edits it (PUT /competitions/organizer/:id) — the CMS has the new name/fee;
 *  - a saved draft is deleted from the wizard's trash and from the panel's card (DELETE draft).
 * Steps 1 and 2 are driven through their controls; the lake / sectors / stands / dates go through
 * the frame's dev seam (window.__bluviWizard, auto-saving) as their own specs cover those controls.
 * Everything created is removed in afterEach (helpers/real-organizer, admin token), even on failure.
 */

test.describe.configure({ timeout: 240_000 });

const LAPTOP = { width: 1280, height: 900 };
let jwt = '';
let stands: ChitaStand[] = [];
const created = tracker();

test.beforeAll(async ({ request }) => {
  test.skip(!ADMIN_TOKEN, 'E2E_CMS_ADMIN_TOKEN (local CMS API token) is not set in .env.local: no way to clean up');
  jwt = await qaJwt(request);
  stands = await chitaStands(request);
  await sweepLeftovers(request);
});

test.afterEach(async ({ request }) => {
  await created.cleanup(request);
});

const draftOf = (page: Page) => new URL(page.url()).searchParams.get('ciorna');
const nameInput = (page: Page) => page.getByLabel('Numele competiției *');

async function step(page: Page, slug: string) {
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', slug, { timeout: 90_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
}

/** The QA organizer's own read of a draft (GET draft/:id, as the wizard reloads it). */
async function readDraft(page: Page, id: string) {
  const res = await page.request.get(`${CMS}/competitions/organizer/draft/${id}`, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status(), data: res.ok() ? ((await res.json()) as { data: { name: string; competitionStatus: string; draftMeta: { fishSpeciesIds: string[]; sectors: unknown[] } | null } }).data : null };
}

/** Types a name in step 1: blurring the field auto-saves → the draft exists, its id in ?ciorna=. */
async function startDraft(page: Page, name: string): Promise<string> {
  await signIn(page.context(), jwt);
  await page.setViewportSize(LAPTOP);
  await page.goto('/organizator/concursuri/nou/detalii', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await step(page, 'detalii');
  const draftCreated = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/cms/competitions/organizer/draft', { timeout: 30_000 });
  await nameInput(page).fill(name);
  await nameInput(page).blur();
  expect((await draftCreated).status()).toBe(200);
  await expect.poll(() => draftOf(page), { timeout: 15_000 }).toBeTruthy();
  const id = draftOf(page)!;
  created.add(id);
  return id;
}

test('organizer.wizard REAL — create through the wizard, publish, then edit: the CMS holds each state', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const name = realName('Wizard');
  const id = await startDraft(page, name);
  // The CMS has the draft, under its name, as the QA organizer's.
  await expect.poll(async () => (await readDraft(page, id)).data?.name).toBe(name);
  expect((await readDraft(page, id)).data?.competitionStatus).toBe('draft');

  // Step 2 through its control: a species chip (debounced auto-save → PUT draft).
  await page.getByTestId('wizard-next').click();
  await step(page, 'configurare');
  const chip = page.getByTestId('configurare-specii').getByRole('button').first();
    const saved = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/cms/competitions/organizer/draft/${id}`, { timeout: 30_000 });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  expect((await saved).status()).toBe(200);
  await expect.poll(async () => (await readDraft(page, id)).data?.draftMeta?.fishSpeciesIds.length).toBe(1);

  // The rest as steps 2–5 fill it (seam), saved now.
  const { startDate, endDate } = farDates(1);
  const values = {
    startDate,
    endDate,
    competitionType: 'single',
    participantsLimit: '2',
    registerFee: '100',
    rankingType: 'quantity',
    lake: CHITA,
    sectors: [{ name: 'A', minFishNumber: 1 }],
    standAllocations: { A: stands.slice(0, 2).map(s => s.documentId) },
  };
  await page.evaluate(v => {
    const w = (window as unknown as { __bluviWizard: { setValue: (f: string, v: unknown, o?: unknown) => void } }).__bluviWizard;
    const entries = Object.entries(v);
    entries.forEach(([f, value], i) => w.setValue(f, value, { autoSave: i === entries.length - 1 ? 'now' : false }));
  }, values);
  await expect.poll(async () => (await readDraft(page, id)).data?.draftMeta?.sectors.length, { timeout: 20_000 }).toBe(1);

  // Reopen the saved draft on the review step (the wizard reads it back from the CMS) and publish.
  await page.goto(`/organizator/concursuri/nou/revizuire?ciorna=${id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await step(page, 'revizuire');
  await expect(page.getByTestId('step-review')).toContainText(name);
  await expect(page.getByTestId('step-review')).toContainText('1 specie');
  const publish = page.getByTestId('wizard-publish');
  await expect(publish).toBeEnabled({ timeout: 30_000 });
  await publish.click();
  const noPhoto = page.getByRole('dialog', { name: 'Publicare fără fotografie' });
  await expect(noPhoto).toBeVisible();
  await noPhoto.getByRole('button', { name: 'Continuă' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${id}(\\?fromPublish=1)?$`), { timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 });

  // The CMS: published (notStarted), its sector «A» on the two Chita stands, the species connected.
  const published = await cmsCompetition(page.request, id);
  expect(published?.competitionStatus).toBe('notStarted');
  expect(published?.participantsLimit).toBe(2);
  expect(Number(published?.registerFee)).toBe(100);
  expect(published?.sectors.map(s => s.name)).toEqual(['A']);
  expect(published?.sectors[0].stands.map(s => s.documentId).sort()).toEqual(stands.slice(0, 2).map(s => s.documentId).sort());
  expect(published?.fishSpecies).toHaveLength(1);

  // Edit it: «Modifică competiția» → the name and the fee, «Salvează modificările».
  const renamed = `${name} bis`;
  await page.goto(`/concursuri/${id}/editeaza/detalii`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await step(page, 'detalii');
  await expect(nameInput(page)).toHaveValue(name, { timeout: 30_000 });
  await nameInput(page).fill(renamed);
  await page.getByLabel('Taxă de înscriere (RON)').fill('120');
  const put = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/cms/competitions/organizer/${id}`, { timeout: 30_000 });
  await page.getByTestId('wizard-save').click();
  expect((await put).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/concursuri/${id}$`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible({ timeout: 30_000 });
  const edited = await cmsCompetition(page.request, id);
  expect(edited?.name).toBe(renamed);
  expect(Number(edited?.registerFee)).toBe(120);
  expect(edited?.competitionStatus).toBe('notStarted');
  expect(errors).toEqual([]);
});

test('organizer.wizard.c7 REAL — the header trash deletes the saved draft: gone from the CMS, back on the panel', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const id = await startDraft(page, realName('Trash'));
  await expect.poll(async () => (await readDraft(page, id)).status).toBe(200);
  await page.getByRole('button', { name: 'Șterge ciorna' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ștergi această ciornă?' });
  const del = page.waitForResponse(r => r.request().method() === 'DELETE' && new URL(r.url()).pathname === `/api/cms/competitions/organizer/draft/${id}`);
  await dialog.getByRole('button', { name: 'Șterge ciorna' }).click();
  expect((await del).status()).toBe(200);
  await expect(page.getByText('Ciorna a fost ștearsă.')).toBeVisible();
  await expect(page).toHaveURL(/\/organizator$/);
  expect((await readDraft(page, id)).status).toBe(404);
  expect(await cmsCompetition(page.request, id)).toBeNull();
  expect(errors).toEqual([]);
});

test('organizer.panel.c19 REAL — a draft card’s «Șterge» deletes it from the CMS and from the list', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const name = realName('Panou');
  const id = await startDraft(page, name);
  await expect.poll(async () => (await readDraft(page, id)).status).toBe(200);
  await page.goto('/organizator', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Panou organizator' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('tablist', { name: 'Stare competiții' }).getByRole('tab', { name: /^Ciorne/ }).click();
  const trash = page.getByRole('button', { name: `Șterge ciorna ${name}` });
  await expect(trash).toBeVisible({ timeout: 60_000 });
  await trash.click();
  const dialog = page.getByRole('alertdialog', { name: 'Ștergi această ciornă?' });
  const del = page.waitForResponse(r => r.request().method() === 'DELETE' && new URL(r.url()).pathname === `/api/cms/competitions/organizer/draft/${id}`);
  await dialog.getByRole('button', { name: 'Șterge', exact: true }).click();
  expect((await del).status()).toBe(200);
  await expect(page.getByText('Ciorna a fost ștearsă.')).toBeVisible();
  await expect(trash).toHaveCount(0, { timeout: 30_000 });
  expect((await readDraft(page, id)).status).toBe(404);
  expect(errors).toEqual([]);
});
