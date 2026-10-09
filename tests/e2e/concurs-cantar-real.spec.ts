import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { signIn } from './helpers/session';
import {
  createRealScale,
  organizerHasGrant,
  rankingOf,
  weighingLogsOf,
  weighingsOf,
  type RealScale,
} from './helpers/real-scale';

/*
 * Cântar + penalizări with REAL writes (owner 2026-10-08: the local CMS has no push tokens and
 * Postmark on its test token, so organizer writes reach nobody). The mocked specs
 * (concurs-cantar*.spec.ts, concurs-penalizari*.spec.ts) keep every state and edge; this one walks
 * the happy path end to end against the local CMS and reads the CMS back after each write:
 *
 *   start a weighing → add catches (and delete one) → close it with both signatures → the ranking on
 *   /concursuri/[id] → reopen with a reason → add a catch → close → «Istoric modificări» shows the
 *   change → the ranking again; a penalty applied (and revoked) when the role may revoke it.
 *
 * The competition is built for the run (helpers/real-scale.ts: a started individual quantity
 * competition authored by the QA account, sectors A / B, test stands, guests) and removed in
 * afterAll, which fails the run if anything is left behind.
 */

test.describe.configure({ mode: 'serial', timeout: 240_000 });

let f: RealScale;
let destroy: (() => Promise<string[]>) | null = null;

test.beforeAll(async () => {
  test.skip(!process.env.E2E_CMS_ADMIN_TOKEN, 'E2E_CMS_ADMIN_TOKEN (local full-access API token) is not set');
  mkdirSync('.shots', { recursive: true });
  const made = await createRealScale();
  destroy = made.destroy;
  f = made.fixture!;
  expect(f.qa.role.name, 'the QA account must be an Organizer').toBe('Organizer');
});

test.afterAll(async ({ request }) => {
  if (!destroy) return;
  const left = await destroy();
  expect(left, 'test data left on the local CMS').toEqual([]);
  // The read-back: nothing of the run is still reachable.
  if (f) expect(await weighingsOf(request, f.competitionId)).toEqual([]);
});

const kg = (n: number) => n.toFixed(3).replace('.', ',');
const toast = (page: Page, text: string | RegExp) => page.getByText(text).first();
const actionBar = (page: Page) => page.getByRole('button', { name: 'Finalizează cântarul' });
const pick = (page: Page, name: string) =>
  page.getByRole('dialog', { name: 'Adaugă captură' }).locator('label').getByText(name, { exact: true }).click();

/** Opens a scale page; one reload if the shared dev server's Fast Refresh strands the first load. */
async function goto(page: Page, url: string, ready: () => ReturnType<Page['getByTestId']>) {
  await page.goto(url);
  const ok = await ready().first().waitFor({ timeout: 20_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(ready().first()).toBeVisible({ timeout: 30_000 });
}

async function sign(page: Page) {
  const pad = page.getByTestId('signature-pad');
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + 40 + (i % 2) * 30);
  await page.mouse.up();
}

async function addCatch(page: Page, weight: string, species: string) {
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adaugă captură' });
  await dialog.getByLabel('Greutate').fill(weight);
  await pick(page, species);
  await dialog.getByRole('button', { name: 'Finalizează' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('[data-testid="catch-row"][data-optimistic]')).toHaveCount(0, { timeout: 30_000 });
}

async function closeWithSignatures(page: Page) {
  await actionBar(page).click();
  const referee = page.getByRole('dialog', { name: 'Semnătură arbitru ✍🏻' });
  await expect(referee).toBeVisible();
  await sign(page);
  await referee.getByRole('button', { name: 'Mai departe' }).click();
  const witness = page.getByRole('dialog', { name: 'Semnătură martor ✍🏻' });
  await expect(witness.getByRole('button', { name: 'Mai departe' })).toBeDisabled();
  await sign(page);
  await witness.getByRole('button', { name: 'Mai departe' }).click();
  await expect(toast(page, 'Cântarul a fost finalizat cu succes!')).toBeVisible({ timeout: 30_000 });
}

/**
 * The «Clasament general» row of a guest on /concursuri/[id] shows `weight`. The public ranking is
 * cached (CMS CDN-Cache-Control 30 s while live), so the page is reloaded until it does.
 */
async function expectRankingRow(page: Page, guest: string, weight: string) {
  await expect
    .poll(
      async () => {
        await page.goto(`/concursuri/${f.competitionId}`);
        const table = page.getByRole('region', { name: 'Clasament general', exact: true }).locator('visible=true');
        const row = table.locator('tbody tr').filter({ hasText: guest });
        const shown = await row.first().waitFor({ timeout: 20_000 }).then(
          () => true,
          () => false,
        );
        return shown ? (await row.first().innerText()).replace(/\s+/g, ' ') : '';
      },
      { timeout: 120_000, intervals: [2_000, 5_000, 10_000] },
    )
    .toContain(weight);
}

let weighingId = '';

test('real: start a weighing, add catches (one deleted), close it signed → CMS + ranking', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page.context(), f.jwt);
  const errors = collectConsoleErrors(page);
  const [s1] = f.stands;
  const [crap, oglinda] = f.species;

  // Start — the stand's history, «Start cântar nou».
  await goto(page, `/concursuri/${f.competitionId}/cantar/${s1}`, () => page.getByTestId('stand-title').or(page.getByTestId('stand-missing')));
  await expect(page.getByTestId('stand-title')).toContainText('Sector A, Stand E2E-1');
  await expect(page.getByTestId('weighings-empty')).toHaveText('Nu s-a efectuat nicio cântărire.');
  await page.getByRole('button', { name: 'Start cântar nou' }).click();
  const start = page.getByRole('dialog', { name: 'Ești sigur că vrei să începi un nou cântar?' });
  await expect(start).toContainText('Sector: A, standul: E2E-1');
  await start.getByRole('button', { name: 'Începe cântarul' }).click();
  await page.waitForURL(new RegExp(`/concursuri/${f.competitionId}/cantar/${s1}/[a-z0-9]{24}$`), { timeout: 30_000 });
  weighingId = page.url().split('/').pop()!;
  let [w] = await weighingsOf(request, f.competitionId);
  expect(w).toMatchObject({ documentId: weighingId, weighingStatus: 'started', weighingType: 'normal', stand: { documentId: s1 }, catches: [] });

  // Catches — two kept, a third deleted.
  await expect(page.getByTestId('catches-empty')).toBeVisible({ timeout: 30_000 });
  await addCatch(page, '4,25', crap.Name);
  await expect(toast(page, 'Captură adăugată cu succes!')).toBeVisible();
  await addCatch(page, '2,5', oglinda.Name);
  await addCatch(page, '1', crap.Name);
  await expect(page.getByTestId('catch-row')).toHaveCount(3);
  await expect(page.getByTestId('weighing-total')).toHaveText(`Total: ${kg(7.75)} kg`);
  // Newest first: the 1 kg catch is row 1.
  await page.getByRole('button', { name: `Șterge captura 1: ${crap.Name}, ${kg(1)} kg` }).click();
  await page.getByRole('alertdialog', { name: 'Ești sigur că vrei să ștergi captura?' }).getByRole('button', { name: 'Șterge' }).click();
  await expect(page.getByTestId('catch-row')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId('weighing-total')).toHaveText(`Total: ${kg(6.75)} kg`);
  [w] = await weighingsOf(request, f.competitionId);
  expect(w.catches.map((c) => [c.weight, c.fishType?.Name]).sort()).toEqual([
    [2.5, oglinda.Name],
    [4.25, crap.Name],
  ]);

  // Close — referee + witness signatures, back to the stand.
  await closeWithSignatures(page);
  await expect(page).toHaveURL(new RegExp(`/concursuri/${f.competitionId}/cantar/${s1}$`));
  [w] = await weighingsOf(request, f.competitionId);
  expect(w.weighingStatus).toBe('finished');
  expect(w.refereeSignature?.url).toMatch(/^https?:\/\//);
  expect(w.witnessSignature?.url).toMatch(/^https?:\/\//);
  await page.screenshot({ path: '.shots/cantar-real-closed-1280.png', fullPage: true });

  // The CMS ranking and the competition page.
  const ranking = await rankingOf(request, f.competitionId);
  const row = ranking.rankings.find((r) => r.guestName === 'E2E Pescar Unu');
  expect(row).toMatchObject({ quantity: 6.75, catchCount: 2, sectorPosition: 1 });
  await expectRankingRow(page, 'E2E Pescar Unu', kg(6.75));
  await page.screenshot({ path: '.shots/cantar-real-ranking-1280.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('real: reopen with a reason, add a catch, close → the revision in «Istoric modificări» and the ranking', async ({ page, request }) => {
  test.skip(!weighingId, 'the first weighing was not made');
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page.context(), f.jwt);
  const errors = collectConsoleErrors(page);
  const [s1] = f.stands;
  const [crap] = f.species;
  const at = `/concursuri/${f.competitionId}/cantar/${s1}/${weighingId}`;

  await goto(page, at, () => page.getByTestId('catches').or(page.getByTestId('catches-empty')));
  await page.getByRole('button', { name: 'Redeschide cântarul' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să redeschizi cântarul?' });
  await dialog.getByLabel('Te rugăm să indici motivul redeschiderii:').fill('Captură uitată la cântar');
  await dialog.getByRole('button', { name: 'Redeschide cântarul' }).click();
  await expect(page.getByRole('button', { name: 'Adaugă captură' })).toBeVisible({ timeout: 30_000 });
  let [w] = await weighingsOf(request, f.competitionId);
  expect(w.weighingStatus).toBe('started');
  const reopen = (await weighingLogsOf(request, f.competitionId)).find((l) => l.action === 'reopen');
  expect(reopen, 'a REOPEN log').toBeTruthy();
  expect(JSON.stringify(reopen)).toContain('Captură uitată la cântar');

  await addCatch(page, '1,25', crap.Name);
  await expect(page.getByTestId('weighing-total')).toHaveText(`Total: ${kg(8)} kg`);
  await closeWithSignatures(page);
  [w] = await weighingsOf(request, f.competitionId);
  expect(w.weighingStatus).toBe('finished');
  expect(w.catches.map((c) => c.weight).sort()).toEqual([1.25, 2.5, 4.25]);
  const close = (await weighingLogsOf(request, f.competitionId)).find((l) => l.action === 'closed');
  expect(close, 'a CLOSE log with the diff').toBeTruthy();

  // The weighing now says it was changed, and the change log shows the added catch.
  await goto(page, at, () => page.getByTestId('catches').or(page.getByTestId('catches-empty')));
  await expect(page.getByTestId('revisions-link')).toHaveText('Acest cântar a avut o modificare.');
  await page.getByTestId('revisions-link').click();
  await expect(page).toHaveURL(new RegExp(`${at}/modificari$`));
  const card = page.getByTestId('revision-card');
  await expect(card).toHaveCount(1, { timeout: 30_000 });
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(`Modificarea 1 [de ${f.qa.username}]`);
  await expect(card.getByTestId('revision-reason')).toHaveText('Motiv: Captură uitată la cântar');
  await expect(card.getByTestId('revision-added').getByRole('listitem')).toHaveText([`• ${crap.Name} ${kg(1.25)} kg`]);
  await expect(card.getByTestId('revision-removed')).toHaveCount(0);
  await page.screenshot({ path: '.shots/cantar-real-revision-1280.png', fullPage: true });

  const row = (await rankingOf(request, f.competitionId)).rankings.find((r) => r.guestName === 'E2E Pescar Unu');
  expect(row).toMatchObject({ quantity: 8, catchCount: 3 });
  await expectRankingRow(page, 'E2E Pescar Unu', kg(8));
  expect(errors).toEqual([]);
});

test('real: a second sector — a weighing on B, the ranking keeps both sector winners', async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page.context(), f.jwt);
  const errors = collectConsoleErrors(page);
  const s3 = f.stands[2];
  const [, oglinda] = f.species;
  await goto(page, `/concursuri/${f.competitionId}/cantar/${s3}`, () => page.getByTestId('stand-title').or(page.getByTestId('stand-missing')));
  await expect(page.getByTestId('stand-title')).toContainText('Sector B, Stand E2E-3');
  await page.getByRole('button', { name: 'Start cântar nou' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Începe cântarul' }).click();
  await page.waitForURL(new RegExp(`/cantar/${s3}/[a-z0-9]{24}$`), { timeout: 30_000 });
  await expect(page.getByTestId('catches-empty')).toBeVisible({ timeout: 30_000 });
  await addCatch(page, '3', oglinda.Name);
  await closeWithSignatures(page);
  const onB = (await weighingsOf(request, f.competitionId)).filter((w) => w.stand?.documentId === s3);
  expect(onB).toHaveLength(1);
  expect(onB[0]).toMatchObject({ weighingStatus: 'finished', catches: [{ weight: 3 }] });
  const rows = (await rankingOf(request, f.competitionId)).rankings;
  expect(rows.find((r) => r.guestName === 'E2E Pescar Trei')).toMatchObject({ quantity: 3, sectorPosition: 1 });
  expect(rows.find((r) => r.guestName === 'E2E Pescar Unu')).toMatchObject({ quantity: 8, sectorPosition: 1 });
  await expectRankingRow(page, 'E2E Pescar Trei', kg(3));
  expect(errors).toEqual([]);
});

test('real: a penalty applied and revoked → CMS + ranking', async ({ page, request }) => {
  // A real penalty can only be cleaned up through DELETE /penalties/:id (no core route). When the
  // QA account's role cannot revoke, a real apply would be left behind: the penalty writes stay
  // mocked (concurs-penalizari*.spec.ts) — docs/private/cms-patches/realwrites-grants.md.
  test.skip(
    !(await organizerHasGrant(request, f.qa.role.id, 'api::penalty.penalty', 'delete')),
    'the local Organizer role has no api::penalty.penalty.delete grant — a real penalty could not be revoked / cleaned up',
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page.context(), f.jwt);
  const errors = collectConsoleErrors(page);
  const reg = f.registrationByStand[f.stands[0]];
  await page.goto(`/concursuri/${f.competitionId}/penalizari/aplica?inscriere=${reg}`);
  const submit = page.getByTestId('penalty-apply-submit');
  await expect(submit).toBeVisible({ timeout: 30_000 });
  await page.locator('label').filter({ has: page.getByRole('radio', { name: /^Penalizare greutate/ }) }).click();
  await page.getByRole('textbox', { name: 'Greutate de penalizat' }).fill('1,5');
  await page.getByRole('textbox', { name: /^Motivul/ }).fill('Pește sub dimensiune reținut');
  await submit.click();
  await expect(page.getByText('Penalizarea a fost aplicată')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/concursuri/${f.competitionId}/penalizari$`), { timeout: 30_000 });
  let row = (await rankingOf(request, f.competitionId)).rankings.find((r) => r.registrationId === reg)!;
  expect(row.penalties).toHaveLength(1);
  expect(row.penalties![0]).toMatchObject({ action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5, reason: 'Pește sub dimensiune reținut' });
  expect(row.quantity).toBe(6.5);
  const id = row.penalties![0].documentId;
  await expect(page.getByTestId(`penalty-${id}`).getByTestId('penalty-action')).toHaveText('Penalizare greutate · 1,5 kg', { timeout: 30_000 });
  await expectRankingRow(page, 'E2E Pescar Unu', kg(6.5));

  await page.goto(`/concursuri/${f.competitionId}/penalizari`);
  await page.getByTestId(`penalty-${id}`).getByRole('button', { name: /^Revocă/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revocă', exact: true }).click();
  await expect(page.getByTestId(`penalty-${id}`)).toHaveCount(0, { timeout: 30_000 });
  row = (await rankingOf(request, f.competitionId)).rankings.find((r) => r.registrationId === reg)!;
  expect(row.penalties).toEqual([]);
  expect(row.quantity).toBe(8);
  await expectRankingRow(page, 'E2E Pescar Unu', kg(8));
  expect(errors).toEqual([]);
});
