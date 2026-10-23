import { expect, test, type APIRequestContext } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { ADMIN_TOKEN, chitaStands, CHITA, farDates, firstFishSpecies, realName, sweepLeftovers, tracker, type ChitaStand } from './helpers/real-organizer';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * «Standuri valorice» (a stand's own grid at quality) with REAL writes against the local CMS:
 *  - a draft whose sector carries standFishNumbers publishes them, scoped to the sector's stands
 *    (an id that is not one of them is dropped);
 *  - the edit wizard's «Alocă standuri» step shows them in the «Standuri valorice» card, a + on a
 *    stand saves its new grid (PUT /competitions/organizer/:id), back to its sector's grid removes it;
 *  - Informații lists every stand by grid.
 * Everything created is removed in afterEach (helpers/real-organizer, admin token).
 */

test.describe.configure({ timeout: 240_000 });

const LAPTOP = { width: 1280, height: 900 };
let jwt = '';
let stands: ChitaStand[] = [];
const created = tracker();
const admin = () => ({ Authorization: `Bearer ${ADMIN_TOKEN}` });

test.beforeAll(async ({ request }) => {
  test.skip(!ADMIN_TOKEN, 'E2E_CMS_ADMIN_TOKEN (local CMS API token) is not set in .env.local: no way to clean up');
  jwt = await qaJwt(request);
  stands = await chitaStands(request);
  await sweepLeftovers(request);
});

test.afterEach(async ({ request }) => {
  await created.cleanup(request);
});

/** The sector «A» grids as the CMS holds them. */
async function sectorGrids(request: APIRequestContext, competitionId: string) {
  const res = await request.get(
    `${CMS}/sectors?filters%5Bcompetition%5D%5BdocumentId%5D%5B%24eq%5D=${competitionId}&fields%5B0%5D=name&fields%5B1%5D=minFishNumber&fields%5B2%5D=standFishNumbers`,
    { headers: admin() },
  );
  expect(res.ok()).toBe(true);
  const [sector] = ((await res.json()) as { data: { name: string; minFishNumber: number; standFishNumbers: Record<string, number> | null }[] }).data;
  return sector;
}

async function seedValued(request: APIRequestContext, name: string) {
  const fish = await firstFishSpecies(request);
  const { startDate, endDate } = farDates(3);
  const [s0, s1, s2] = stands;
  const auth = { Authorization: `Bearer ${jwt}` };
  const draft = await request.post(`${CMS}/competitions/organizer/draft`, {
    headers: auth,
    data: {
      data: {
        name,
        startDate,
        endDate,
        registrationDeadline: startDate,
        competitionType: 'single',
        participantsLimit: 3,
        rankingType: 'quantityQuality',
        generalRankingWinnerMode: 'bySectorPositionPerisReversed',
        lake: CHITA,
        draftMeta: {
          sectors: [{ name: 'A', minFishNumber: 3, standFishNumbers: { [s0.documentId]: 6, [s1.documentId]: 1, notAStandOfA: 5 } }],
          standAllocations: { A: [s0.documentId, s1.documentId, s2.documentId] },
          sponsorIds: [],
          fishSpeciesIds: [fish.documentId],
          completedSteps: [1, 2, 3, 4, 5],
        },
      },
    },
  });
  expect(draft.ok(), await draft.text()).toBe(true);
  const id = ((await draft.json()) as { data: { documentId: string } }).data.documentId;
  created.add(id);
  const published = await request.put(`${CMS}/competitions/organizer/draft/${id}/publish`, { headers: auth });
  expect(published.ok(), await published.text()).toBe(true);
  return id;
}

test('organizer.stand-grids REAL — publish keeps the sector stands’ grids; the edit wizard changes one; Informații lists them', async ({ page }) => {
  // Not this feature: main 5bdeb8c's SportsEvent JSON-LD reads Date.now() during the competition
  // page's prerender (load.ts competitionOffers), which Next 16 dev reports as an error.
  const errors = collectConsoleErrors(page, { ignore: /blocking-prerender-current-time/ });
  const [s0, s1, s2] = stands;
  const id = await seedValued(page.request, realName('Valorice'));

  // Publish: only the sector's stands keep a grid.
  expect(await sectorGrids(page.request, id)).toMatchObject({ name: 'A', minFishNumber: 3, standFishNumbers: { [s0.documentId]: 6, [s1.documentId]: 1 } });

  // Edit wizard, «Alocă standuri»: the card is on, the three stands show 6 / 1 / 3 pești.
  await signIn(page.context(), jwt);
  await page.setViewportSize(LAPTOP);
  await page.goto(`/concursuri/${id}/editeaza/standuri`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const card = page.getByTestId('stand-grid-editor-A');
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByRole('switch')).toBeChecked();
  await expect(card.getByTestId(`stand-grid-row-${s0.name}`)).toContainText('6 pești');
  await expect(card.getByTestId(`stand-grid-row-${s1.name}`)).toContainText('1 pește');
  await expect(card.getByTestId(`stand-grid-row-${s2.name}`)).toContainText('3 pești');
  await expect(card.getByRole('button', { name: `Mai puțini pești, standul A${s1.name}` })).toBeDisabled();

  // + on the third stand (3 → 4), − on the first down to the sector's grid (6 → 3: no longer valued).
  await card.getByRole('button', { name: `Mai mulți pești, standul A${s2.name}` }).click();
  for (let i = 0; i < 3; i++) await card.getByRole('button', { name: `Mai puțini pești, standul A${s0.name}` }).click();
  await expect(card.getByTestId(`stand-grid-row-${s2.name}`)).toContainText('4 pești');
  await expect(card.getByTestId(`stand-grid-row-${s0.name}`)).toContainText('3 pești');

  const put = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/cms/competitions/organizer/${id}`, { timeout: 30_000 });
  await page.getByTestId('wizard-save').click();
  const res = await put;
  expect(res.status()).toBe(200);
  const sent = res.request().postDataJSON() as { data: { draftMeta: { sectors: { standFishNumbers: unknown }[] } } };
  expect(sent.data.draftMeta.sectors[0].standFishNumbers).toEqual({ [s1.documentId]: 1, [s2.documentId]: 4 });
  expect((await sectorGrids(page.request, id)).standFishNumbers).toEqual({ [s1.documentId]: 1, [s2.documentId]: 4 });

  // Informații: every stand by grid, highest first.
  await page.goto(`/concursuri/${id}/informatii`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const info = page.getByTestId('stand-grid-info');
  await expect(info).toBeVisible({ timeout: 60_000 });
  await expect(info).toContainText(`4 peștiA${s2.name}`);
  await expect(info).toContainText(`3 peștiA${s0.name}`);
  await expect(info).toContainText(`1 peșteA${s1.name}`);
  expect(errors).toEqual([]);
});

test('organizer.stand-grids REAL — switching «Standuri valorice» off clears the sector’s grids on save', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const id = await seedValued(page.request, realName('Valorice off'));
  await signIn(page.context(), jwt);
  await page.setViewportSize(LAPTOP);
  await page.goto(`/concursuri/${id}/editeaza/standuri`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const card = page.getByTestId('stand-grid-editor-A');
  await expect(card.getByRole('switch')).toBeChecked({ timeout: 90_000 });
  await card.getByRole('switch').click();
  const dialog = page.getByRole('alertdialog', { name: 'Renunți la standurile valorice?' });
  await dialog.getByRole('button', { name: 'Renunță' }).click();
  await expect(card.getByRole('switch')).not.toBeChecked();

  const put = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/cms/competitions/organizer/${id}`, { timeout: 30_000 });
  await page.getByTestId('wizard-save').click();
  expect((await put).status()).toBe(200);
  expect((await sectorGrids(page.request, id)).standFishNumbers).toBeNull();
  expect(errors).toEqual([]);
});
