import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { ADMIN_TOKEN, cmsCompetition, realName, seedCompetition, sweepLeftovers, tracker } from './helpers/real-organizer';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * «Alocă standuri pe sectoare» (organizer.sectors c8) and «Alocare participanți» (organizer.participants
 * c8) with REAL writes against the local CMS — safe since 2026-10-08 (no push tokens, Postmark test
 * token). The mocked specs (concurs-sectoare / concurs-alocare) keep every state and edge; these prove
 * the POSTs land: on a test competition (helpers/real-organizer.seedCompetition: QA author, one sector
 * «A» on Chita stands, guest registrations) the editor's save is read back from the CMS (the sector's
 * stands; each registration's stand and /allocated-participants). afterEach removes the competition,
 * its registrations and its sector (the Chita stands lose only their link to it), even on failure.
 */

test.describe.configure({ timeout: 180_000 });

let jwt = '';
const created = tracker();

test.beforeAll(async ({ request }) => {
  test.skip(!ADMIN_TOKEN, 'E2E_CMS_ADMIN_TOKEN (local CMS API token) is not set in .env.local: no way to clean up');
  jwt = await qaJwt(request);
  await sweepLeftovers(request);
});

test.afterEach(async ({ request }) => {
  await created.cleanup(request);
});

async function loaded(page: Page) {
  const first = page.getByRole('heading', { level: 2, name: 'Sector A' });
  const seen = await first.waitFor({ timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  // The shared dev server's Fast Refresh (other agents' edits) can strand a load: one reload.
  if (!seen) await page.reload();
  await expect(first).toBeVisible({ timeout: 30_000 });
}

test('organizer.sectors.c8 REAL — «Salvează» re-allocates the sector’s stands in the CMS', async ({ page, request }) => {
  const seeded = await seedCompetition(request, jwt, { name: realName('Sectoare'), stands: 3, participantsLimit: 4, weeks: 3 });
  created.add(seeded.documentId);
  const [s1, s2, s3] = seeded.sectorStands;
  const all = (await (await request.get(`${CMS}/feed/lakes/s84u55lo4n9z0emngozttt6e`)).json()).data.stands as { documentId: string; name: string }[];
  const s4 = all[3];
  const errors = collectConsoleErrors(page);
  await signIn(page.context(), jwt);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/concursuri/${seeded.documentId}/sectoare`);
  await loaded(page);
  const slot = (n: number) => page.getByTestId(`slot-A-${n}`);
  await expect(slot(1)).toHaveText(s1.name);
  // Empty slot 1, put the lake's 4th stand in the free 4th slot.
  await slot(1).click();
  await expect(slot(1)).toHaveText('-');
  await slot(4).click();
  await page.getByRole('dialog', { name: 'Sector A' }).getByTestId(`stand-option-${s4.name}`).click();
  await expect(slot(4)).toHaveText(s4.name);
  const post = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/cms/competitions/${seeded.documentId}/allocate-stands-to-sectors`);
  await page.getByRole('button', { name: 'Salvează' }).click();
  expect((await post).ok()).toBe(true);
  await expect(page.getByText('Standurile au fost alocate cu succes!')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${seeded.documentId}$`));
  const c = await cmsCompetition(request, seeded.documentId);
  expect(c?.sectors[0].stands.map(s => s.documentId).sort()).toEqual([s2, s3, s4].map(s => s.documentId).sort());
  // Reopened, the editor shows what the CMS holds.
  await page.goto(`/concursuri/${seeded.documentId}/sectoare`);
  await loaded(page);
  await expect(page.getByTestId('sector-A')).toContainText(s4.name);
  await expect(page.getByTestId('sector-A').getByTestId(/^slot-A-/).filter({ hasText: new RegExp(`^${s1.name}$`) })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('organizer.participants.c8 REAL — «Finalizează alocarea» seats the guests on their stands in the CMS', async ({ page, request }) => {
  const seeded = await seedCompetition(request, jwt, { name: realName('Alocare'), stands: 2, guests: ['Ana Real', 'Barbu Real'], weeks: 4 });
  created.add(seeded.documentId);
  const [s1, s2] = seeded.sectorStands;
  const errors = collectConsoleErrors(page);
  await signIn(page.context(), jwt);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/concursuri/${seeded.documentId}/alocare`);
  await loaded(page);
  const row = (stand: string) => page.getByTestId(`alloc-stand-A-${stand}`);
  const seat = async (stand: string, guest: string) => {
    await row(stand).getByRole('button', { name: new RegExp(`^Sector A, stand ${stand}:`) }).click();
    await page.getByRole('dialog', { name: `Sector A · Stand ${stand}` }).getByRole('button', { name: guest, exact: true }).click();
    await expect(row(stand)).toContainText(guest);
  };
  // Ana on the second stand, Barbu on the first.
  await seat(s2.name, 'Ana Real');
  await seat(s1.name, 'Barbu Real');
  const post = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/cms/competitions/${seeded.documentId}/allocate-stand-to-registration`);
  await page.getByRole('button', { name: 'Finalizează alocarea' }).click();
  expect((await post).ok()).toBe(true);
  await expect(page.getByText('Alocarea participanților a fost realizată cu succes')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${seeded.documentId}$`));
  const c = await cmsCompetition(request, seeded.documentId);
  const standOf = (guest: string) => c?.registrations.find(r => r.guestName === guest)?.stand?.documentId;
  expect(standOf('Ana Real')).toBe(s2.documentId);
  expect(standOf('Barbu Real')).toBe(s1.documentId);
  const allocated = (await (await request.get(`${CMS}/competitions/${seeded.documentId}/allocated-participants`)).json()).data as Record<string, { guestName: string } | null>;
  expect(allocated[s1.documentId]?.guestName).toBe('Barbu Real');
  expect(allocated[s2.documentId]?.guestName).toBe('Ana Real');
  // Reopened, the editor is prefilled from the CMS.
  await page.goto(`/concursuri/${seeded.documentId}/alocare`);
  await loaded(page);
  await expect(row(s1.name)).toContainText('Barbu Real');
  await expect(row(s2.name)).toContainText('Ana Real');
  expect(errors).toEqual([]);
});
