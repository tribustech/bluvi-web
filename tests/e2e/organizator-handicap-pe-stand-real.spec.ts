import { expect, test, type APIRequestContext } from '@playwright/test';
import { collectConsoleErrors } from './helpers/console';
import { ADMIN_TOKEN, chitaStands, CHITA, farDates, firstFishSpecies, realName, sweepLeftovers, tracker, type ChitaStand } from './helpers/real-organizer';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * «Handicap pe stand» (only a percent of a stand's kg counts) with REAL writes against the local CMS:
 *  - a draft whose sector carries standHandicaps publishes them, scoped to the sector's stands;
 *  - the edit wizard's «Alocă standuri» step shows them in the «Handicap pe stand» card, − / + move a
 *    stand in 10% steps, back to 100% removes it, and the save sends the map (PUT /competitions/organizer/:id);
 *  - Informații lists the handicapped stands by percent.
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

/** The sector «A» handicaps as the CMS holds them. */
async function sectorHandicaps(request: APIRequestContext, competitionId: string) {
  const res = await request.get(
    `${CMS}/sectors?filters%5Bcompetition%5D%5BdocumentId%5D%5B%24eq%5D=${competitionId}&fields%5B0%5D=name&fields%5B1%5D=standHandicaps`,
    { headers: admin() },
  );
  expect(res.ok()).toBe(true);
  const [sector] = ((await res.json()) as { data: { name: string; standHandicaps: Record<string, number> | null }[] }).data;
  return sector;
}

async function seedHandicapped(request: APIRequestContext, name: string) {
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
        rankingType: 'quantity',
        lake: CHITA,
        draftMeta: {
          sectors: [{ name: 'A', minFishNumber: 1, standHandicaps: { [s0.documentId]: 30, [s1.documentId]: 50, notAStandOfA: 20 } }],
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

test('organizer.stand-handicaps REAL — publish keeps the sector stands’ handicaps; the edit wizard changes them; Informații lists them', async ({ page }) => {
  // Not this feature: the competition page's prerender reads Date.now() (see organizator-standuri-valorice-real).
  const errors = collectConsoleErrors(page, { ignore: /blocking-prerender-current-time/ });
  const [s0, s1, s2] = stands;
  const id = await seedHandicapped(page.request, realName('Handicap'));

  // Publish: only the sector's stands keep a handicap.
  expect(await sectorHandicaps(page.request, id)).toMatchObject({ name: 'A', standHandicaps: { [s0.documentId]: 30, [s1.documentId]: 50 } });

  await signIn(page.context(), jwt);
  await page.setViewportSize(LAPTOP);
  await page.goto(`/concursuri/${id}/editeaza/standuri`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const card = page.getByTestId('stand-handicap-editor-A');
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByRole('switch')).toBeChecked();
  await expect(card.getByTestId(`stand-handicap-row-${s0.name}`)).toContainText('30%');
  await expect(card.getByTestId(`stand-handicap-row-${s1.name}`)).toContainText('50%');
  await expect(card.getByTestId(`stand-handicap-row-${s2.name}`)).toContainText('100%');
  await expect(card.getByRole('button', { name: `Handicap mai mic, standul A${s2.name}` })).toBeDisabled();

  // − on the third stand (100 → 90), + on the second back to 100% (no longer handicapped).
  await card.getByRole('button', { name: `Handicap mai mare, standul A${s2.name}` }).click();
  for (let i = 0; i < 5; i++) await card.getByRole('button', { name: `Handicap mai mic, standul A${s1.name}` }).click();
  await expect(card.getByTestId(`stand-handicap-row-${s2.name}`)).toContainText('90%');
  await expect(card.getByTestId(`stand-handicap-row-${s1.name}`)).toContainText('100%');

  const put = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/cms/competitions/organizer/${id}`, { timeout: 30_000 });
  await page.getByTestId('wizard-save').click();
  const res = await put;
  expect(res.status()).toBe(200);
  const sent = res.request().postDataJSON() as { data: { draftMeta: { sectors: { standHandicaps: unknown }[] } } };
  expect(sent.data.draftMeta.sectors[0].standHandicaps).toEqual({ [s0.documentId]: 30, [s2.documentId]: 90 });
  expect((await sectorHandicaps(page.request, id)).standHandicaps).toEqual({ [s0.documentId]: 30, [s2.documentId]: 90 });

  // Informații: handicapped stands by percent, lowest first.
  await page.goto(`/concursuri/${id}/informatii`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const info = page.getByTestId('stand-handicap-info');
  await expect(info).toBeVisible({ timeout: 60_000 });
  await expect(info).toContainText(`30%A${s0.name}`);
  await expect(info).toContainText(`90%A${s2.name}`);
  expect(errors).toEqual([]);
});
