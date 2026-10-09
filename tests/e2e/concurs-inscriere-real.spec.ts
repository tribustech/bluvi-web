import { type Page } from '@playwright/test';
import { expect, test } from './helpers/fake-chat';
import { addGuestRegistration, createCompetitionRegistration } from '../../core/competitions';
import { getProfile, type Profile } from '../../core/social';
import { createTestTransport } from '../transport';
import { BASE_URL as BASE } from './helpers/base-url';
import { anglerJwt } from './helpers/fake-organizer';
import {
  cleanupTestCompetitions,
  competitionExists,
  createTestCompetition,
  deleteRegistration,
  registrationsOf,
  setUserPhone,
  sweepStaleTestCompetitions,
  userByName,
  userPhone,
  type AdminUser,
} from './helpers/real-registration';
import { qaJwt, signIn } from './helpers/session';

/*
 * Înscriere — REAL writes on the local CMS (parity participant.register c14 / c17 / c18 / c19,
 * participant.register-guests c11 / c12, participant.b.register-entry-disabled). The mocked specs
 * (concurs-inscriere*.spec.ts) keep every state and error; here the write reaches the CMS, the UI
 * is asserted after it, and the CMS state is read back through its REST API.
 *
 * Safe since 2026-10-08 (owner): the local CMS has no push tokens and Postmark runs on its test
 * token, so the e-mails / pushes the registration controllers send reach nobody.
 *
 * Data: each test creates its own throwaway competition («[E2E-REAL] …», helpers/real-registration)
 * with the LOCAL full-access API token, on a lake of the local DB, authored by the test account
 * «Audit Organizator» (or by the QA user where the QA user acts as the organizer). Teammates are the
 * test accounts «E2E Pescar» and «Audit Pescar». afterEach deletes the competition and every
 * registration on it, failure or not, and checks it is gone; beforeAll sweeps a crashed run's
 * leftovers.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };

let jwt = '';
let qa: Profile;
let organizer: AdminUser;
let mate1: AdminUser;
let mate2: AdminUser;
const madeHere: string[] = [];
/** Undo steps for test accounts' own fields a real write changed (run after every test). */
const restores: (() => Promise<void>)[] = [];

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  qa = await getProfile(createTestTransport(jwt));
  organizer = await userByName('Audit Organizator');
  mate1 = await userByName('E2E Pescar');
  mate2 = await userByName('Audit Pescar');
  await sweepStaleTestCompetitions();
});

test.afterEach(async () => {
  for (const undo of restores.splice(0)) await undo();
  await cleanupTestCompetitions();
  for (const id of madeHere.splice(0)) expect(await competitionExists(id), `test competition ${id} removed`).toBe(false);
});

async function competition(over: Parameters<typeof createTestCompetition>[0]) {
  const id = await createTestCompetition(over);
  madeHere.push(id);
  return id;
}

const formPath = (id: string) => `/concursuri/${id}/inscriere`;
const visible = (l: ReturnType<Page['getByTestId']>) => l.locator('visible=true').first();
const submit = (page: Page) => visible(page.getByTestId('registration-submit'));
const status = (page: Page) => page.getByTestId('registration-status');

async function openForm(page: Page, id: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  await page.goto(formPath(id), { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Înscriere' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('registration-skeleton')).toHaveCount(0, { timeout: 60_000 });
  await expect(
    visible(page.getByTestId('registration-submit'))
      .or(visible(page.getByTestId('registration-locked')))
      .or(page.getByTestId('registration-unavailable')),
  ).toBeVisible({ timeout: 30_000 });
}

async function leave(page: Page, id: string) {
  await visible(page.getByTestId('registration-leave')).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Părăsește concursul' }).click();
  await expect(status(page)).toContainText('Ai părăsit competiția.', { timeout: 30_000 });
  await page.waitForURL(`${BASE}/concursuri/${id}`, { timeout: 15_000 });
}

async function pickTeammate(page: Page, username: string) {
  await page.getByTestId('add-teammates').click();
  const picker = page.getByTestId('teammate-picker');
  await picker.getByPlaceholder('Introdu numele').fill(username);
  const row = page.getByTestId('teammate-options').getByRole('button', { name: `Adaugă ${username}`, exact: true });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(picker).toHaveCount(0);
}

const ids = (r: { participants: { documentId: string }[] }) => r.participants.map(p => p.documentId).sort();

/* ============================================================================================== */

test('participant.register.c14 c17 c18 c19 — REAL team entry: teammates, POST, edit before the start (PUT), leave', async ({ page, context }) => {
  const id = await competition({ label: 'echipa', author: organizer.documentId, competitionType: 'team', teamParticipants: 3 });
  await signIn(context, jwt);

  // New team entry: name + two teammates found through the real user search.
  await openForm(page, id);
  await page.getByLabel('Numele echipei').fill('Crapii E2E');
  await pickTeammate(page, mate1.username);
  await pickTeammate(page, mate2.username);
  await expect(page.getByTestId('teammates').getByRole('listitem')).toHaveText([mate1.username, mate2.username]);
  await submit(page).click();
  await expect(status(page)).toHaveAttribute('data-phase', 'success', { timeout: 30_000 });
  await page.waitForURL(`${BASE}/concursuri/${id}`, { timeout: 15_000 });

  let regs = await registrationsOf(id);
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ registrationStatus: 'pending', teamName: 'Crapii E2E', author: { documentId: qa.documentId } });
  expect(ids(regs[0])).toEqual([qa.documentId, mate1.documentId, mate2.documentId].sort());
  // The competition page offers the edit now.
  await expect(page.getByRole('link', { name: 'Modifică înscrierea' }).locator('visible=true').first()).toHaveAttribute('href', formPath(id), {
    timeout: 60_000,
  });

  // Edit before the start: seeded from the CMS; drop a teammate, rename, save.
  await openForm(page, id, LAPTOP);
  await expect(page.getByLabel('Numele echipei')).toHaveValue('Crapii E2E');
  await expect(page.getByTestId('teammates').getByRole('listitem')).toHaveText([mate1.username, mate2.username]);
  await expect(submit(page)).toBeDisabled();
  await page.getByTestId('teammates').getByRole('button', { name: `Elimină pe ${mate2.username}` }).click();
  await page.getByLabel('Numele echipei').fill('Crapii E2E 2');
  await submit(page).click();
  await expect(status(page)).toContainText('Înregistrarea ta a fost modificată cu succes.', { timeout: 30_000 });
  await page.waitForURL(`${BASE}/concursuri/${id}`, { timeout: 15_000 });
  regs = await registrationsOf(id);
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ registrationStatus: 'pending', teamName: 'Crapii E2E 2' });
  expect(ids(regs[0])).toEqual([qa.documentId, mate1.documentId].sort());

  // Reopened: the saved values, then leave.
  await openForm(page, id);
  await expect(page.getByLabel('Numele echipei')).toHaveValue('Crapii E2E 2');
  await expect(page.getByTestId('teammates').getByRole('listitem')).toHaveText([mate1.username]);
  await leave(page, id);
  regs = await registrationsOf(id);
  expect(regs.map(r => r.registrationStatus)).toEqual(['cancelled']);
});

test('participant.register-guests.c11 c12 — REAL guest team added by the organizer (POST), then edited (PUT)', async ({ page, context }) => {
  const id = await competition({ label: 'oaspeti', author: qa.documentId, competitionType: 'team', teamParticipants: 2 });
  await signIn(context, jwt);
  await page.setViewportSize(LAPTOP);
  // From the competition page, so «back» after the write stays in the app.
  await page.goto(`/concursuri/${id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.evaluate(path => location.assign(path), `/concursuri/${id}/inscriere/fara-cont`);
  await expect(page.getByRole('heading', { level: 1, name: 'Adaugă participanți fără cont' })).toBeVisible({ timeout: 60_000 });
  const guestsSubmit = page.getByTestId('guests-submit').locator('visible=true').first();
  await expect(guestsSubmit).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Participant 1').fill('Ion Pop');
  await page.getByTestId('guest-add').click();
  await page.getByLabel('Participant 2').fill('Ana Maria');
  await page.getByLabel('Numele echipei').fill('Oaspetii E2E');
  await guestsSubmit.click();
  await page.waitForURL(url => !url.pathname.endsWith('/fara-cont'), { timeout: 60_000 });

  let regs = await registrationsOf(id);
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ registrationStatus: 'registered', guestName: 'Ion Pop, Ana Maria', teamName: 'Oaspetii E2E', participants: [] });

  // Edit the entry (the participants page's «Editează»): prefilled from the CMS, PUT.
  await page.goto(`/concursuri/${id}/inscriere/fara-cont?inscriere=${regs[0].documentId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Editează participanți' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel('Participant 2')).toHaveValue('Ana Maria', { timeout: 30_000 });
  await page.getByLabel('Participant 2').fill('Ana Maria Pop');
  await page.getByLabel('Numele echipei').fill('Oaspetii E2E 2');
  await page.getByTestId('guests-submit').locator('visible=true').first().click();
  // Saved: the form goes back (opened by its URL: to the competition).
  await page.waitForURL(url => !url.pathname.endsWith('/fara-cont'), { timeout: 60_000 });
  regs = await registrationsOf(id);
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ registrationStatus: 'registered', guestName: 'Ion Pop, Ana Maria Pop', teamName: 'Oaspetii E2E 2' });
});

test('participant.b.register-entry-disabled — REAL waiting list on a full competition (limit 1)', async ({ page, context, request }) => {
  const angler = await anglerJwt(request);
  expect(angler, 'Set E2E_CMS_ADMIN_TOKEN (the «E2E Pescar» test account) in .env.local').toBeTruthy();
  const phoneBefore = await userPhone(mate1.id);
  restores.push(() => setUserPhone(mate1.id, phoneBefore));
  if (phoneBefore) await setUserPhone(mate1.id, null);
  // Limit 1, organized by the QA user; the angler registers from the web.
  const id = await competition({ label: 'complet', author: qa.documentId, competitionType: 'single', participantsLimit: 1 });
  await signIn(context, angler!);

  // A request on a competition with a free place: pending — «în așteptare» until the organizer decides.
  // The angler has no phone on the profile: the form asks for it and the POST saves it (restored in finally).
  await openForm(page, id);
  await page.getByLabel('Număr de telefon*').fill('0712000111');
  await submit(page).click();
  await expect(status(page)).toHaveAttribute('data-phase', 'success', { timeout: 30_000 });
  await page.waitForURL(`${BASE}/concursuri/${id}`, { timeout: 15_000 });
  let regs = await registrationsOf(id);
  expect(regs).toHaveLength(1);
  expect(regs[0]).toMatchObject({ registrationStatus: 'pending', author: { documentId: mate1.documentId } });
  expect(await userPhone(mate1.id)).toBe('0712000111');

  // The organizer fills the one place (a guest entry, approved on creation): the angler's request waits on a full competition.
  await addGuestRegistration(createTestTransport(jwt), { competitionId: id, guestName: 'Loc Ocupat' });
  regs = await registrationsOf(id);
  expect(regs.map(r => r.registrationStatus).sort()).toEqual(['pending', 'registered']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Numărul maxim de participanți a fost atins').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(`a[href^="/concursuri/${id}/inscriere"]`)).toHaveCount(0);

  // fish never opens the form for a disabled entry: the angler's own request stays readable, locked
  // with the reason — no save, no leave (fish shows «Părăsește concursul» only inside that form).
  await openForm(page, id);
  await expect(visible(page.getByTestId('registration-locked'))).toHaveText('Numărul maxim de participanți a fost atins');
  await expect(page.getByTestId('registration-submit')).toHaveCount(0);
  await expect(page.getByTestId('registration-leave')).toHaveCount(0);

  // Without an entry (the request removed), a new one: the page says why, the form's URL is a gate,
  // and the CMS itself refuses the create.
  await deleteRegistration(regs.find(r => r.registrationStatus === 'pending')!.documentId);
  await page.goto(`/concursuri/${id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByText('Numărul maxim de participanți a fost atins').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(`a[href^="/concursuri/${id}/inscriere"]`)).toHaveCount(0);
  await openForm(page, id);
  const gate = page.getByTestId('registration-unavailable');
  await expect(gate).toContainText('Numărul maxim de participanți a fost atins');
  await expect(page.getByTestId('registration-submit')).toHaveCount(0);
  await expect(
    createCompetitionRegistration(createTestTransport(angler!), { competition: id, participants: [mate1.documentId], teamName: '', phone: null, registrationStatus: 'pending' }),
  ).rejects.toThrow(/Numarul maxim de participanti a fost atins/);
  regs = await registrationsOf(id);
  expect(regs.map(r => r.registrationStatus)).toEqual(['registered']);
});
