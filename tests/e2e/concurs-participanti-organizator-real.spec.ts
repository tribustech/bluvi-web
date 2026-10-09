import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { ADMIN_TOKEN, cmsCompetition, realName, seedCompetition, sweepLeftovers, tracker, type Seeded } from './helpers/real-organizer';
import { qaJwt, signIn } from './helpers/session';

/*
 * Concurs · Participanți for its author with REAL registration decisions (parity
 * competition-page.participanti-organizator c8 c9) against the local CMS — safe since 2026-10-08 (no
 * push tokens, Postmark test token). The mocked spec (concurs-participanti-organizator.spec.ts)
 * keeps every state and edge; this one proves the PATCHes accept / reject / pending land: a test
 * competition (helpers/real-organizer.seedCompetition, QA author, 3 guests) is moved through
 * «Mută în așteptare» (the waiting list), «Aprobă», «Elimină» and «Aprobă» again from the desktop
 * table, and after each the CMS status is read back. afterEach removes the competition, its
 * registrations and sectors, even on failure.
 */

test.describe.configure({ timeout: 180_000 });

const DESKTOP = { width: 1440, height: 900 };
let jwt = '';
const created = tracker();
let seeded: Seeded;

test.beforeAll(async ({ request }) => {
  test.skip(!ADMIN_TOKEN, 'E2E_CMS_ADMIN_TOKEN (local CMS API token) is not set in .env.local: no way to clean up');
  jwt = await qaJwt(request);
  await sweepLeftovers(request);
});

test.beforeEach(async ({ request }) => {
  seeded = await seedCompetition(request, jwt, { name: realName('Inscrieri'), stands: 3, guests: ['Ana Real', 'Barbu Real', 'Costel Real'], weeks: 2 });
  created.add(seeded.documentId);
});

test.afterEach(async ({ request }) => {
  await created.cleanup(request);
});

const filters = (page: Page) => page.getByRole('radiogroup', { name: 'Filtrează înscrierile' });
const pick = (page: Page, key: 'all' | 'pending' | 'registered' | 'rejected') => filters(page).locator(`[data-filter="${key}"]`).click();
const tableRow = (page: Page, name: string) => page.locator('[data-registrations="table"] tbody tr').filter({ has: page.getByText(name, { exact: true }) });
const count = (page: Page, key: string) => filters(page).locator(`[data-filter="${key}"] [data-count]`);

async function statusOf(page: Page, guest: string) {
  const c = await cmsCompetition(page.request, seeded.documentId);
  return c?.registrations.find(r => r.guestName === guest)?.registrationStatus;
}

/** Runs one row action through its confirmation; waits for the real PATCH and its answer. */
async function act(page: Page, guest: string, action: string, confirm: string, verb: 'accept' | 'reject' | 'pending') {
  const id = seeded.registrations.find(r => r.guestName === guest)!.documentId;
  await tableRow(page, guest).getByRole('button', { name: `${action} — ${guest}` }).click();
  const patch = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/cms/registrations/${id}/${verb}`);
  await page.getByRole('alertdialog').getByRole('button', { name: confirm, exact: true }).click();
  const res = await patch;
  expect(res.status(), `${verb} ${guest}`).toBeLessThan(300);
}

test('competition-page.participanti-organizator.c9 REAL — waiting list, approve, remove, approve again: each lands in the CMS', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await signIn(page.context(), jwt);
  await page.setViewportSize(DESKTOP);
  await page.goto(`/concursuri/${seeded.documentId}/participanti`);
  await expect(filters(page)).toBeVisible({ timeout: 60_000 });
  await expect(count(page, 'registered')).toHaveText('3');

  // Approved → the waiting list.
  await act(page, 'Ana Real', 'Mută în așteptare', 'Mută', 'pending');
  await expect.poll(() => statusOf(page, 'Ana Real')).toBe('pending');
  await expect(count(page, 'pending')).toHaveText('1');
  await expect(count(page, 'registered')).toHaveText('2');

  // Waiting list → approved.
  await pick(page, 'pending');
  await act(page, 'Ana Real', 'Aprobă', 'Acceptă', 'accept');
  await expect(page.getByText('Înregistrare acceptată cu succes.')).toBeVisible();
  await expect.poll(() => statusOf(page, 'Ana Real')).toBe('registered');
  await expect(count(page, 'pending')).toHaveText('0');

  // Approved → removed (rejected), then approved again.
  await pick(page, 'all');
  await act(page, 'Barbu Real', 'Elimină', 'Elimină', 'reject');
  await expect.poll(() => statusOf(page, 'Barbu Real')).toBe('rejected');
  await expect(count(page, 'rejected')).toHaveText('1');
  await pick(page, 'rejected');
  await act(page, 'Barbu Real', 'Aprobă', 'Acceptă', 'accept');
  await expect.poll(() => statusOf(page, 'Barbu Real')).toBe('registered');

  // A reload reads the same state the CMS holds (no optimistic leftovers).
  await page.reload();
  await expect(filters(page)).toBeVisible({ timeout: 60_000 });
  await expect(count(page, 'registered')).toHaveText('3');
  await expect(count(page, 'pending')).toHaveText('0');
  await expect(count(page, 'rejected')).toHaveText('0');
  expect((await cmsCompetition(page.request, seeded.documentId))?.registrations.map(r => r.registrationStatus)).toEqual(['registered', 'registered', 'registered']);
  expect(errors).toEqual([]);
});
