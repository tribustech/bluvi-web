import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { anglerJwt } from './helpers/fake-organizer';
import { ADMIN_TOKEN, cmsCompetition, realName, seedCompetition, sweepLeftovers, tracker, type Seeded } from './helpers/real-organizer';
import { qaJwt, signIn } from './helpers/session';

/*
 * The author's «Organizare» menu with REAL writes that are safe to undo (parity
 * competition-page.organizare c9 c10, participant.register-guests c11 c12), against the local CMS —
 * safe since 2026-10-08 (no push tokens, Postmark test token). The mocked specs (concurs-organizare,
 * concurs-inscriere-fara-cont) keep every state and edge; these prove the writes land on a test
 * competition (helpers/real-organizer.seedCompetition, QA author):
 *  - «Adaugă arbitru» (PATCH referee) then «Șterge arbitru» (DELETE referee), with the local plain
 *    test angler (e2e-angler@bluvi.test) as the referee: the CMS referees after each;
 *  - «Adaugă participanți fără cont» (POST registrations/guests), then «Editează» it from the
 *    participants list (PUT registrations/guests/:id): the CMS registration after each.
 * Start / end / cancel are NOT run for real here: they are one-way on a competition.
 * afterEach removes the competition, its registrations and sectors, even on failure.
 */

test.describe.configure({ timeout: 180_000 });

const DESKTOP = { width: 1280, height: 900 };
let jwt = '';
const created = tracker();
let seeded: Seeded;

test.beforeAll(async ({ request }) => {
  test.skip(!ADMIN_TOKEN, 'E2E_CMS_ADMIN_TOKEN (local CMS API token) is not set in .env.local: no way to clean up');
  jwt = await qaJwt(request);
  await sweepLeftovers(request);
});

test.beforeEach(async ({ request }) => {
  seeded = await seedCompetition(request, jwt, { name: realName('Organizare'), stands: 2, participantsLimit: 4, weeks: 5 });
  created.add(seeded.documentId);
});

test.afterEach(async ({ request }) => {
  await created.cleanup(request);
});

const menu = (page: Page) => page.getByRole('menu', { name: 'Organizare' });

async function openMenu(page: Page) {
  await signIn(page.context(), jwt);
  await page.setViewportSize(DESKTOP);
  await page.goto(`/concursuri/${seeded.documentId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: seeded.name })).toBeVisible({ timeout: 60_000 });
  const trigger = page.getByRole('button', { name: 'Organizare', exact: true });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
  await expect(menu(page)).toBeVisible();
}

test('competition-page.organizare.c9 c10 REAL — add a referee, then remove him: the CMS referees follow', async ({ page, request }) => {
  const angler = await anglerJwt(request);
  test.skip(!angler, 'no plain test angler to make referee');
  const errors = collectConsoleErrors(page);
  await openMenu(page);
  await menu(page).getByRole('menuitem', { name: 'Adaugă arbitru' }).click();
  const add = page.getByRole('dialog', { name: 'Alegeți un arbitru' });
  await add.getByPlaceholder('Caută...').fill('E2E Pescar');
  const choice = add.getByRole('radio', { name: 'E2E Pescar', exact: true });
  await expect(choice).toBeVisible({ timeout: 30_000 });
  await choice.click();
  const patch = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/cms/competitions/${seeded.documentId}/referee`);
  await add.getByRole('button', { name: 'Adaugă' }).click();
  expect((await patch).ok()).toBe(true);
  await expect(page.getByText('Arbitrul a fost adăugat cu succes', { exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await cmsCompetition(request, seeded.documentId))?.referees.map(r => r.username)).toEqual(['E2E Pescar']);

  // Remove him (the page re-read the competition: he is offered).
  await page.getByRole('button', { name: 'Organizare', exact: true }).click();
  await menu(page).getByRole('menuitem', { name: 'Șterge arbitru' }).click();
  const remove = page.getByRole('dialog', { name: 'Șterge arbitru' });
  await remove.getByRole('radio', { name: 'E2E Pescar' }).click();
  const del = page.waitForResponse(r => r.request().method() === 'DELETE' && new URL(r.url()).pathname.startsWith(`/api/cms/competitions/${seeded.documentId}/referee/`));
  await remove.getByRole('button', { name: 'Șterge', exact: true }).click();
  expect((await del).ok()).toBe(true);
  await expect(page.getByText('Arbitrul a fost șters cu succes', { exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await cmsCompetition(request, seeded.documentId))?.referees).toEqual([]);
  expect(errors).toEqual([]);
});

test('participant.register-guests.c11 c12 REAL — «Adaugă participanți fără cont» registers the guest, «Editează» renames him in the CMS', async ({ page, request }) => {
  const errors = collectConsoleErrors(page);
  await openMenu(page);
  await menu(page).getByRole('menuitem', { name: 'Adaugă participanți fără cont' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${seeded.documentId}/inscriere/fara-cont$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Adaugă participanți fără cont' })).toBeVisible({ timeout: 60_000 });
  const submit = page.getByTestId('guests-submit').locator('visible=true').first();
  await page.getByRole('textbox', { name: 'Pescar', exact: true }).fill('Dan Real');
  const post = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/cms/registrations/guests');
  await submit.click();
  expect((await post).ok()).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/concursuri/${seeded.documentId}$`), { timeout: 30_000 });
  await expect.poll(async () => (await cmsCompetition(request, seeded.documentId))?.registrations.map(r => [r.guestName, r.registrationStatus])).toEqual([['Dan Real', 'registered']]);

  // «Editează» from the organizer's list → the same form, prefilled; rename.
  await page.goto(`/concursuri/${seeded.documentId}/participanti`);
  const row = page.locator('[data-registrations="table"] tbody tr').filter({ has: page.getByText('Dan Real', { exact: true }) });
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.getByRole('button', { name: 'Editează — Dan Real' }).or(row.getByRole('link', { name: 'Editează — Dan Real' })).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Editează participanți' })).toBeVisible({ timeout: 60_000 });
  const field = page.getByRole('textbox', { name: 'Pescar', exact: true });
  await expect(field).toHaveValue('Dan Real');
  await field.fill('Dan Real Pop');
  const put = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname.startsWith('/api/cms/registrations/guests/'));
  await submit.click();
  expect((await put).ok()).toBe(true);
  await expect(page.getByText('Înregistrarea a fost actualizată cu succes!')).toBeVisible();
  await expect.poll(async () => (await cmsCompetition(request, seeded.documentId))?.registrations.map(r => r.guestName)).toEqual(['Dan Real Pop']);
  expect(errors).toEqual([]);
});
